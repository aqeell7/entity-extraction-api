"use client"; // Tells Next.js this is a Client Component (runs in the browser, uses state/hooks)

import { useState } from "react";

export default function Home() {
  // ============================================================================
  // REACT STATE HOOKS: Stores UI data as it changes
  // ============================================================================
  const [text, setText] = useState("");         // Stores what the user types in the textarea
  const [result, setResult] = useState<unknown>(null); // Stores the successful JSON response from the API
  const [error, setError] = useState<string | null>(null); // Stores any error message if something goes wrong
  const [loading, setLoading] = useState(false); // Tracks whether the API request is currently in progress

  // ============================================================================
  // API HANDLER: Sends user text to your backend route and handles the response
  // ============================================================================
  async function handleExtract() {
    setLoading(true);   // Turn on loading state (disables button, changes text)
    setError(null);     // Clear any previous errors
    setResult(null);    // Clear any previous results

    try {
      // Send a POST request to your Next.js API endpoint (`/api/extract`)
      const res = await fetch("/api/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ textToExtract: text }), // Wrap user text in JSON format
      });

      const data = await res.json(); // Parse the JSON response from the server

      // If the server responded with an error status (like 400 or 500)
      if (!res.ok) {
        setError(data.error ?? "Request failed"); // Show server error or fallback text
        return;
      }

      // Success! Save the extracted data into state so it displays on the screen
      setResult(data);
    } catch {
      // Handles network drop or if the server is completely unreachable
      setError("Could not reach the server");
    } finally {
      // Always runs last: turns off loading state whether it succeeded or failed
      setLoading(false);
    }
  }

  // ============================================================================
  // USER INTERFACE (JSX): What gets rendered on the web browser page
  // ============================================================================
  return (
    <main
      style={{
        maxWidth: 720,
        margin: "40px auto",
        padding: 24,
        fontFamily: "sans-serif",
        backgroundColor: "#0f172a", // Dark mode slate background
        color: "#f8fafc",
        borderRadius: 12,
      }}
    >
      <h1 style={{ fontSize: "24px", marginBottom: 8 }}>Entity Extraction API</h1>
      <p style={{ color: "#94a3b8", marginBottom: 20 }}>
        Paste any text. Get back its category and the people, organizations, locations, and dates in it.
      </p>

      {/* TEXT INPUT AREA: User types or pastes messy text here */}
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)} // Updates `text` state as the user types
        rows={6}
        style={{
          width: "100%",
          padding: 12,
          backgroundColor: "#1e293b",
          color: "#f8fafc",
          border: "1px solid #334155",
          borderRadius: 8,
          fontSize: "15px",
          outline: "none",
          boxSizing: "border-box",
        }}
        placeholder="e.g. Hi Jonson, the meeting postponed to Monday morning due to the deployment failure of our applications."
      />

      {/* ACTION BUTTON: Triggers `handleExtract`. Disabled if loading or textarea is empty/spaces only. */}
      <button
        onClick={handleExtract}
        disabled={loading || !text.trim()}
        style={{
          marginTop: 12,
          padding: "10px 20px",
          backgroundColor: loading || !text.trim() ? "#475569" : "#3b82f6",
          color: "#fff",
          border: "none",
          borderRadius: 8,
          fontWeight: 600,
          cursor: loading || !text.trim() ? "not-allowed" : "pointer",
        }}
      >
        {loading ? "Extracting… (can take ~15s)" : "Extract"}
      </button>

      {/* ERROR MESSAGE DISPLAY: Only shows if an error string exists in state */}
      {error && <p style={{ color: "#f87171", marginTop: 12 }}>Error: {error}</p>}

      {/* RESULT DISPLAY BOX: Only shows if `result` state is not null */}
      {result !== null && (
        <div style={{ marginTop: 24 }}>
          <h3 style={{ fontSize: "16px", marginBottom: 8, color: "#cbd5e1" }}>Result</h3>
          {/* JSON.stringify formats the result object nicely with 2 spaces indentation */}
          <pre
            style={{
              background: "#1e293b",
              color: "#38bdf8",
              padding: 16,
              borderRadius: 8,
              overflowX: "auto",
              fontSize: "14px",
              border: "1px solid #334155",
            }}
          >
            {JSON.stringify(result, null, 2)}
          </pre>
        </div>
      )}
    </main>
  );
}