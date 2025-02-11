// server.ts
import express from 'express';
import cors from 'cors';
import { deepResearch, writeFinalReport } from './src/deep-research';
import { generateFeedback } from './src/feedback';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Set up __dirname for ES modules.
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;

app.use(express.json());
app.use(cors());

/**
 * POST /api/research
 * 
 * Request Body can contain:
 *  - query (string, required)
 *  - breadth (number, optional)
 *  - depth (number, optional)
 *  - followUpAnswers (array of strings, optional)
 *
 * Behavior:
 *  - If any of breadth, depth, or followUpAnswers is missing, the API will generate follow‑up questions.
 *  - Otherwise, the API combines the query with the follow‑up answers, runs deep research,
 *    generates a final Markdown report, writes it to disk, and returns a JSON response that includes
 *    a download URL for the final report.
 */
app.post('/api/research', async (req, res) => {
  try {
    const { query, breadth, depth, followUpAnswers } = req.body;

    if (!query) {
      return res.status(400).json({ error: 'Query is required' });
    }

    // If any parameters are missing, return follow-up questions.
    if (typeof breadth === 'undefined' || typeof depth === 'undefined' || !followUpAnswers) {
      const additionalQuestions: string[] = [];
      if (typeof breadth === 'undefined') {
        additionalQuestions.push("Please specify the research breadth (i.e. the number of SERP queries to generate).");
      }
      if (typeof depth === 'undefined') {
        additionalQuestions.push("Please specify the research depth (i.e. how many recursive levels to dive into).");
      }
      
      // Generate additional clarifying questions.
      const feedbackQuestions = await generateFeedback({ query, numQuestions: 3 });
      const followUpQuestionsCombined = additionalQuestions.concat(feedbackQuestions);

      return res.json({
        phase: 'followup',
        message: 'Some parameters are missing. Please answer the following follow-up questions to refine your research.',
        followUpQuestions: followUpQuestionsCombined,
      });
    }

    // Combine the original query with the follow-up answers.
    const combinedQuery = `${query}\nFollow-up answers:\n${followUpAnswers.join('\n')}`;
    console.log(`Received combined query: ${combinedQuery}`);

    // Run deep research.
    const researchResult = await deepResearch({
      query: combinedQuery,
      breadth,
      depth,
      learnings: [],
      visitedUrls: [],
    });

    // Generate the final markdown report.
    const report = await writeFinalReport({
      prompt: combinedQuery,
      learnings: researchResult.learnings,
      visitedUrls: researchResult.visitedUrls,
    });

    // Write the report to disk so it can be downloaded.
    const reportFilePath = path.join(__dirname, 'output.md');
    fs.writeFileSync(reportFilePath, report, 'utf-8');

    // Return the research result along with the final report and a download URL.
    return res.json({
      phase: 'research',
      researchResult,
      report,
      downloadUrl: `/api/download`
    });
  } catch (error) {
    console.error('Error processing research:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/download
 * 
 * Serves the final markdown report (output.md) as a downloadable file.
 */
app.get('/api/download', (req, res) => {
  const reportFilePath = path.join(__dirname, 'output.md');
  if (fs.existsSync(reportFilePath)) {
    res.download(reportFilePath, 'final.md', (err) => {
      if (err) {
        console.error('Error downloading file:', err);
        res.status(500).send('Error downloading file');
      }
    });
  } else {
    res.status(404).send('Report not found');
  }
});

app.listen(PORT, () => {
  console.log(`API Server running on http://localhost:${PORT}`);
});
