// test-api.js
import axios from 'axios';

async function runTest() {
  // Use environment variable API_BASE_URL (set in docker-compose) or fallback to localhost
  const baseUrl = process.env.API_BASE_URL || 'http://localhost:3001';
  const endpoint = '/api/research';

  // Step 1: Send initial query (missing breadth, depth, followUpAnswers)
  const initialPayload = {
    query: "What are the latest trends in AI research?"
    // intentionally omitting breadth, depth, and followUpAnswers
  };

  try {
    console.log("Sending initial request with incomplete parameters...");
    const initialResponse = await axios.post(`${baseUrl}${endpoint}`, initialPayload);
    console.log("Response from API:", initialResponse.data);

    // Check if the API is asking for follow-up answers
    if (
      initialResponse.data.phase === 'followup' &&
      Array.isArray(initialResponse.data.followUpQuestions)
    ) {
      const followUpQuestions = initialResponse.data.followUpQuestions;
      console.log("\n--- Follow-up Questions Received ---");
      followUpQuestions.forEach((question, idx) => {
        console.log(`${idx + 1}. ${question}`);
      });

      // Step 2: Simulate answering each follow-up question.
      // For instance, if a question asks for breadth or depth, we answer accordingly.
      const simulatedAnswers = followUpQuestions.map(question => {
        if (question.toLowerCase().includes("breadth")) {
          return "5"; // simulate setting the SERP query count
        }
        if (question.toLowerCase().includes("depth")) {
          return "2"; // simulate setting the recursion depth
        }
        // For any additional questions, provide a generic response.
        return "No additional clarifications.";
      });

      console.log("\nSimulated Answers:");
      simulatedAnswers.forEach((answer, idx) => {
        console.log(`${idx + 1}. ${answer}`);
      });

      // Step 3: Send a complete request with all parameters.
      const completePayload = {
        query: initialPayload.query,
        breadth: 5,         // based on simulated answer for breadth
        depth: 2,           // based on simulated answer for depth
        followUpAnswers: simulatedAnswers,
      };

      console.log("\nSending second request with complete parameters...");
      const researchResponse = await axios.post(`${baseUrl}${endpoint}`, completePayload);
      console.log("\n--- Final Research Results ---");
      console.log(JSON.stringify(researchResponse.data, null, 2));
    } else {
      console.error("Unexpected response phase. Expected follow-up questions.");
    }
  } catch (error) {
    console.error("Error during API testing:", error.response ? error.response.data : error.message);
  }
}

runTest();
