// src/components/ChatInterface.js
import React, { useState, useRef, useEffect } from "react";
import { API_BASE_URL } from "../config";

export default function ChatInterface() {
  // "phase" can be "initial", "followup", or "research"
  const [phase, setPhase] = useState("initial");
  const [query, setQuery] = useState("");
  // Save the original query for later use.
  const [originalQuery, setOriginalQuery] = useState("");
  const [messages, setMessages] = useState([]);
  // Follow‑up questions (array) and answers (array)
  const [followUpQuestions, setFollowUpQuestions] = useState([]);
  const [currentFollowupIndex, setCurrentFollowupIndex] = useState(0);
  const [currentAnswer, setCurrentAnswer] = useState("");
  const [collectedFollowupAnswers, setCollectedFollowupAnswers] = useState([]);
  const [loading, setLoading] = useState(false);
  // State for the download URL returned by the API.
  const [downloadUrl, setDownloadUrl] = useState(null);
  // State to turn debug messages on or off (disabled by default).
  const [debugEnabled, setDebugEnabled] = useState(false);
  // State to control the display of the settings modal.
  const [showSettings, setShowSettings] = useState(false);

  // Ref and effect for auto‑scrolling the message area when new messages are added.
  const messagesEndRef = useRef(null);
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Debug helper: add a debug message to the chat UI if debug is enabled.
  const addDebugMessage = (msg) => {
    if (!debugEnabled) return;
    setMessages((prev) => [
      ...prev,
      { text: "DEBUG: " + msg, type: "debug" },
    ]);
  };

  // Handle sending the initial query.
  // This call sends only the query so the API returns follow‑up questions or research.
  const handleInitialSend = async () => {
    if (!query.trim()) return;
    setOriginalQuery(query);
    setLoading(true);
    // Append the user's initial query to chat.
    setMessages((prev) => [...prev, { text: query, type: "user" }]);
    try {
      addDebugMessage(`Sending initial query to ${API_BASE_URL}/api/research`);
      const response = await fetch(`${API_BASE_URL}/api/research`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query }),
      });
      addDebugMessage(`Received response with status: ${response.status}`);
      const data = await response.json();
      if (data.phase === "followup") {
        // If the API returns a list of follow‑up questions (say, 5 in total),
        // override only the first two with our custom prompts.
        let updatedQuestions = data.followUpQuestions.slice();
        if (updatedQuestions.length >= 1) {
          updatedQuestions[0] = "Enter research breadth (recommended 2-10, default 4):";
        }
        if (updatedQuestions.length >= 2) {
          updatedQuestions[1] = "Enter research depth (recommended 1-5, default 2):";
        }
        setPhase("followup");
        setFollowUpQuestions(updatedQuestions);
        setCurrentFollowupIndex(0);
        setCollectedFollowupAnswers([]);
        // Display the system message from the API and our custom first follow‑up prompt.
        setMessages((prev) => [
          ...prev,
          { text: data.message, type: "bot" },
          { text: updatedQuestions[0], type: "bot" }
        ]);
      } else {
        // Direct research result returned.
        // Use data.report (if available) to display the nicely formatted final response.
        const finalText =
          data.report ||
          (data.learnings && Array.isArray(data.learnings) && data.learnings.length > 0
            ? data.learnings.join(". ")
            : "No research results found.");
        // Optionally add debug info if enabled.
        if (debugEnabled) {
          addDebugMessage(`Final API response: ${JSON.stringify(data, null, 2)}`);
        }
        setMessages((prev) => [
          ...prev,
          { text: finalText, type: "bot", formatted: true },
        ]);
        if (data.downloadUrl) {
          setDownloadUrl(data.downloadUrl);
        }
        setPhase("research");
      }
    } catch (error) {
      setMessages((prev) => [
        ...prev,
        { text: "Error fetching response: " + error.message, type: "bot" },
      ]);
    } finally {
      setLoading(false);
      setQuery("");
    }
  };

  // Handle submitting one follow‑up answer.
  // This function collects the current answer, updates state, and if more questions remain, displays the next one.
  // Otherwise, it combines the original query with the collected answers and sends a final request for research.
  const handleFollowupAnswer = async () => {
    // For the first two follow‑up questions, if the user hits Enter (i.e. blank answer), use default values.
    let answer = currentAnswer.trim();
    if (!answer) {
      if (currentFollowupIndex === 0) {
        answer = "4"; // Default breadth
      } else if (currentFollowupIndex === 1) {
        answer = "2"; // Default depth
      }
    }
    setLoading(true);
    // Append the user's (or default) follow‑up answer to chat.
    setMessages((prev) => [...prev, { text: answer, type: "user" }]);
    // Update the collected follow‑up answers.
    const updatedAnswers = [...collectedFollowupAnswers, answer];
    setCollectedFollowupAnswers(updatedAnswers);
    setCurrentAnswer(""); // Clear the answer input for the next question
    const nextIndex = currentFollowupIndex + 1;
    if (nextIndex < followUpQuestions.length) {
      // Display the next follow‑up question.
      setCurrentFollowupIndex(nextIndex);
      const nextQuestion = followUpQuestions[nextIndex];
      setMessages((prev) => [...prev, { text: nextQuestion, type: "bot" }]);
      setLoading(false);
    } else {
      // All follow‑up questions have been answered; now send the combined query.
      addDebugMessage(`All follow‑up answers collected: ${JSON.stringify(updatedAnswers)}`);
      try {
        // Build the payload.
        const payload = {
          query: originalQuery,
          breadth: parseInt(updatedAnswers[0], 10), // Use the answer (or default) for breadth
          depth: parseInt(updatedAnswers[1], 10),   // Use the answer (or default) for depth
          followUpAnswers: updatedAnswers,
        };
        addDebugMessage(`Submitting follow‑up answers for original query: "${originalQuery}" with payload: ${JSON.stringify(payload)}`);
        const response = await fetch(`${API_BASE_URL}/api/research`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        addDebugMessage(`Follow‑up response status: ${response.status}`);
        const data = await response.json();
        if (debugEnabled) {
          addDebugMessage(`Final API response: ${JSON.stringify(data, null, 2)}`);
        }
        if (data.phase === "research") {
          const finalText =
            data.report ||
            (data.learnings && Array.isArray(data.learnings) && data.learnings.length > 0
              ? data.learnings.join(". ")
              : "No research results found.");
          setMessages((prev) => [
            ...prev,
            { text: finalText, type: "bot", formatted: true },
          ]);
          if (data.downloadUrl) {
            setDownloadUrl(data.downloadUrl);
          }
          setPhase("research");
        } else {
          setMessages((prev) => [
            ...prev,
            { text: "Unexpected phase: " + JSON.stringify(data), type: "bot" },
          ]);
        }
      } catch (error) {
        setMessages((prev) => [
          ...prev,
          { text: "Error fetching research results: " + error.message, type: "bot" },
        ]);
      } finally {
        setLoading(false);
      }
    }
  };

  // Handle the Enter key: send on Enter, allow newline on Shift+Enter.
  const handleKeyDown = (e, submitFunction) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submitFunction();
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-100">
      {/* Chat container centered in the viewport */}
      <div className="w-full max-w-3xl h-4/5 flex flex-col shadow-lg border bg-white relative">
        {/* Header with title and settings link */}
        <header className="bg-white border-b p-4 flex items-center justify-between">
          <h1 className="text-2xl font-bold">deep-research</h1>
          <span
            onClick={() => setShowSettings(true)}
            className="text-blue-500 cursor-pointer hover:underline"
          >
            Settings
          </span>
        </header>

        {/* Chat messages container with scroll overflow */}
        <main className="flex-grow overflow-y-auto p-6">
          {messages.map((msg, index) => (
            <div key={index} className="mb-4 flex justify-center">
              <div
                className={`w-full max-w-xl px-6 py-4 rounded-lg shadow break-words ${
                  msg.type === "user"
                    ? "bg-blue-500 text-white"
                    : msg.type === "debug"
                    ? "bg-yellow-200 text-black text-xs"
                    : "bg-gray-200 text-black"
                } ${msg.formatted ? "whitespace-pre-wrap" : ""}`}
              >
                {msg.text}
              </div>
            </div>
          ))}
          <div ref={messagesEndRef} />
          {/* Download button if a download URL exists */}
          {downloadUrl && (
            <div className="flex justify-center my-4">
              <a
                href={`${API_BASE_URL}${downloadUrl}`}
                download
                className="px-8 py-4 bg-green-500 text-white rounded-lg"
              >
                Download .md file
              </a>
            </div>
          )}
        </main>

        {/* Input area */}
        <footer className="bg-white border-t p-4">
          {(phase === "initial" || phase === "research") && (
            <div className="flex justify-center items-center">
              <textarea
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => handleKeyDown(e, handleInitialSend)}
                placeholder="What would you like to research?"
                className="w-full max-w-xl h-40 overflow-y-auto resize-none border rounded-lg p-6 text-xl focus:outline-none focus:ring"
              />
              <button
                onClick={handleInitialSend}
                disabled={loading || !query.trim()}
                className="ml-4 px-8 py-4 bg-blue-500 text-white rounded-lg disabled:opacity-50 text-xl"
              >
                {loading ? "Thinking..." : "Send"}
              </button>
            </div>
          )}
          {phase === "followup" && (
            <div className="flex justify-center items-center">
              <textarea
                value={currentAnswer}
                onChange={(e) => setCurrentAnswer(e.target.value)}
                onKeyDown={(e) => handleKeyDown(e, handleFollowupAnswer)}
                placeholder="Type your answer..."
                className="w-full max-w-xl h-40 overflow-y-auto resize-none border rounded-lg p-6 text-xl focus:outline-none focus:ring"
              />
              <button
                onClick={handleFollowupAnswer}
                disabled={loading}
                className="ml-4 px-8 py-4 bg-blue-500 text-white rounded-lg disabled:opacity-50 text-xl"
              >
                {loading ? "Submitting..." : "Submit"}
              </button>
            </div>
          )}
        </footer>

        {/* Settings Modal */}
        {showSettings && (
          <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50">
            <div className="bg-white p-6 rounded-lg shadow-lg w-60">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold">Settings</h2>
                <button
                  onClick={() => setShowSettings(false)}
                  className="text-gray-600 hover:text-gray-800 focus:outline-none"
                >
                  Close
                </button>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-lg">Enable Debug</span>
                <input
                  type="checkbox"
                  checked={debugEnabled}
                  onChange={(e) => setDebugEnabled(e.target.checked)}
                  className="h-6 w-6"
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
