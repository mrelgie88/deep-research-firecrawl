import FirecrawlApp, { SearchResponse } from '@mendable/firecrawl-js';
import { generateObject } from 'ai';
import { compact } from 'lodash-es';
import pLimit from 'p-limit';
import { z } from 'zod';

import { o3MiniModel, trimPrompt } from './ai/providers';
import { systemPrompt } from './prompt';

type ResearchResult = {
  learnings: string[];
  visitedUrls: string[];
};

// increase this if you have higher API rate limits
const ConcurrencyLimit = 2;

// Initialize Firecrawl with optional API key and optional base url

const firecrawl = new FirecrawlApp({
  apiKey: process.env.FIRECRAWL_KEY ?? '',
  apiUrl: process.env.FIRECRAWL_BASE_URL,
});

// take en user query, return a list of SERP queries
async function generateSerpQueries({
  query,
  numQueries = 3,
  learnings,
}: {
  query: string;
  numQueries?: number;

  // optional, if provided, the research will continue from the last learning
  learnings?: string[];
}) {
  const res = await generateObject({
    model: o3MiniModel,
    system: systemPrompt(),
    prompt: `Given the following prompt from the user, generate a list of SERP queries to research the topic. Return a maximum of ${numQueries} queries, but feel free to return less if the original prompt is clear. Make sure each query is unique and not similar to each other: <prompt>${query}</prompt>\n\n${
      learnings
        ? `Here are some learnings from previous research, use them to generate more specific queries: ${learnings.join(
            '\n',
          )}`
        : ''
    }`,
    schema: z.object({
      queries: z
        .array(
          z.object({
            query: z.string().describe('The SERP query'),
            researchGoal: z
              .string()
              .describe(
                'First talk about the goal of the research that this query is meant to accomplish, then go deeper into how to advance the research once the results are found, mention additional research directions. Be as specific as possible, especially for additional research directions.',
              ),
          }),
        )
        .describe(`List of SERP queries, max of ${numQueries}`),
    }),
  });
  console.log(
    `Created ${res.object.queries.length} queries`,
    res.object.queries,
  );

  return res.object.queries.slice(0, numQueries);
}

async function processSerpResult({
  query,
  result,
  numLearnings = 3,
  numFollowUpQuestions = 3,
}: {
  query: string;
  result: SearchResponse;
  numLearnings?: number;
  numFollowUpQuestions?: number;
}) {
  const contents = compact(result.data.map(item => item.markdown)).map(
    content => trimPrompt(content, 25_000),
  );
  console.log(`Ran ${query}, found ${contents.length} contents`);

  const res = await generateObject({
    model: o3MiniModel,
    abortSignal: AbortSignal.timeout(60_000),
    system: systemPrompt(),
    prompt: `Given the following contents from a SERP search for the query <query>${query}</query>, generate a list of learnings from the contents. Return a maximum of ${numLearnings} learnings, but feel free to return less if the contents are clear. Make sure each learning is unique and not similar to each other. The learnings should be concise and to the point, as detailed and infromation dense as possible. Make sure to include any entities like people, places, companies, products, things, etc in the learnings, as well as any exact metrics, numbers, or dates. The learnings will be used to research the topic further.\n\n<contents>${contents
      .map(content => `<content>\n${content}\n</content>`)
      .join('\n')}</contents>`,
    schema: z.object({
      learnings: z
        .array(z.string())
        .describe(`List of learnings, max of ${numLearnings}`),
      followUpQuestions: z
        .array(z.string())
        .describe(
          `List of follow-up questions to research the topic further, max of ${numFollowUpQuestions}`,
        ),
    }),
  });
  console.log(
    `Created ${res.object.learnings.length} learnings`,
    res.object.learnings,
  );

  return res.object;
}

export async function writeFinalReport({
  prompt,
  learnings,
  visitedUrls,
}: {
  prompt: string;
  learnings: string[];
  visitedUrls: string[];
}) {
  const learningsString = trimPrompt(
    learnings
      .map(learning => `<learning>\n${learning}\n</learning>`)
      .join('\n'),
    150_000,
  );

  const res = await generateObject({
    model: o3MiniModel,
    system: systemPrompt(),
    prompt: `Given the following prompt from the user, write a final report on the topic using the learnings from research. Make it as as detailed as possible, aim for 3 or more pages, include ALL the learnings from research:\n\n<prompt>${prompt}</prompt>\n\nHere are all the learnings from previous research:\n\n<learnings>\n${learningsString}\n</learnings>`,
    schema: z.object({
      reportMarkdown: z
        .string()
        .describe('Final report on the topic in Markdown'),
    }),
  });

  // Append the visited URLs section to the report
  const urlsSection = `\n\n## Sources\n\n${visitedUrls.map(url => `- ${url}`).join('\n')}`;
  return res.object.reportMarkdown + urlsSection;
}

export async function deepResearch({
  query,
  breadth,
  depth,
  learnings = [],
  visitedUrls = [],
}: {
  query: string;
  breadth: number;
  depth: number;
  learnings?: string[];
  visitedUrls?: string[];
}): Promise<ResearchResult> {
  console.log(`Starting deepResearch with query: "${query}"`);
  console.log(`Current visited URLs:`, visitedUrls);

  const serpQueries = await generateSerpQueries({
    query,
    learnings,
    numQueries: breadth,
  });

  console.log(`Generated ${serpQueries.length} SERP queries:`, serpQueries);

  const limit = pLimit(ConcurrencyLimit);
  const firecrawlBaseURL = process.env.FIRECRAWL_BASE_URL_SCRAPE; // Updated to scrape endpoint
  const searxngBaseURL = 'http://searxng:8080/search'; // Searxng instance

  const results = await Promise.all(
    serpQueries.map(serpQuery =>
      limit(async () => {
        try {
          console.log(`Fetching valid URLs for query: "${serpQuery.query}"`);

          // Use searxng to get actual URLs from search
          const searchResponse = await fetch(`${searxngBaseURL}?q=${encodeURIComponent(serpQuery.query)}&format=json`);
          const searchResults = await searchResponse.json();

          const validUrls = searchResults.results
            ?.map((item: any) => item.url)
            ?.filter((url: string) => url.startsWith('http'));

          if (!validUrls || validUrls.length === 0) {
            console.warn(`No valid URLs found for query: "${serpQuery.query}". Skipping...`);
            return { learnings: [], visitedUrls: [] };
          }

          console.log(`Valid URLs found:`, validUrls);

          // Scrape each valid URL
          const scrapedResults = await Promise.all(
            validUrls.map(async (url) => {
              try {
                console.log(`Scraping content from URL: ${url}`);
                const response = await fetch(firecrawlBaseURL, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ url, formats: ["markdown"] })
                });

                console.log(`Firecrawl HTTP Status: ${response.status} ${response.statusText}`);

                const rawResponse = await response.json();
                console.log(`Parsed Firecrawl Response:`, JSON.stringify(rawResponse, null, 2));

                if (!rawResponse.data || !Array.isArray(rawResponse.data)) {
                  console.warn(`Unexpected Firecrawl response format:`, rawResponse);
                  return null;
                }

                return rawResponse;
              } catch (scrapeError) {
                console.error(`Error scraping URL ${url}:`, scrapeError);
                return null;
              }
            })
          );

          // Extract learnings from scraped content
          const extractedLearnings = scrapedResults
            .filter(result => result && Array.isArray(result.data))
            .flatMap(result => result.data.map((item: any) => item.text || ''));

          console.log(`Extracted learnings from query "${serpQuery.query}":`, extractedLearnings);

          const allLearnings = [...learnings, ...extractedLearnings];
          const allUrls = [...visitedUrls, ...validUrls];

          console.log(`Updated visited URLs count: ${allUrls.length}`);

          if (depth > 1) {
            console.log(`Researching deeper with depth: ${depth - 1}`);

            return deepResearch({
              query: extractedLearnings.join("\n"),
              breadth: Math.ceil(breadth / 2),
              depth: depth - 1,
              learnings: allLearnings,
              visitedUrls: allUrls,
            });
          } else {
            return { learnings: allLearnings, visitedUrls: allUrls };
          }
        } catch (e: any) {
          console.error(`Error running query: "${serpQuery.query}":`, e);
          return { learnings: [], visitedUrls: [] };
        }
      })
    ),
  );

  const finalLearnings = [...new Set(results.flatMap(r => r.learnings))];
  const finalVisitedUrls = [...new Set(results.flatMap(r => r.visitedUrls))];

  console.log(`Final research results - Learnings: ${finalLearnings.length}, Visited URLs: ${finalVisitedUrls.length}`);
  console.log(`Final list of visited URLs:`, finalVisitedUrls);

  return { learnings: finalLearnings, visitedUrls: finalVisitedUrls };
}
