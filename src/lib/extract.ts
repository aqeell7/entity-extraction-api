import { openai } from "./openai";
import { zodResponseFormat } from "openai/helpers/zod";
import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";
import { ExtractionSchema, type Extraction } from "./schema";
import { tools, runTool } from "./tools";
// 1. Import our retry/fallback helper function
import { withFallback } from "./retry";

// 2. Define our primary and backup (fallback) models as constants
const PRIMARY_MODEL = "gpt-5-nano";
//const PRIMARY_MODEL = "fake provider";
const FALLBACK_MODEL = "gpt-5-mini";

// ============================================================================
// MAIN FUNCTION: Takes messy text and extracts structured data using an AI agent
// ============================================================================
export async function extract(text: string): Promise<Extraction> {
  
  // 3. CHAT HISTORY SETUP: We start the conversation with instructions (system)
  // and the raw text we want to analyze (user).
  const messages: ChatCompletionMessageParam[] = [
    {
      role: "system",
      content:
        "Classify the text into one category. Extract named entities into people, organizations, locations, and dates. For each date, keep the original words in 'text'. Use the get_current_date tool to convert relative dates (like 'Friday') into YYYY-MM-DD in 'isoDate'. If a date can't be worked out, set isoDate to null. Leave a group empty if nothing fits.",
    },
    { role: "user", content: text },
  ];

  // 4. HELPER FUNCTION: A reusable recipe to call OpenAI with our settings
  // Wrapped as a function so we can pass it easily into our fallback system.
  const callModel = (model: string) =>
    openai.chat.completions.parse({
      model,
      messages,
      tools,
      response_format: zodResponseFormat(ExtractionSchema, "extraction"),
    });

  // 5. SAFETY BACKSTOP: Prevents the AI from looping forever (max 3 round trips)
  const maxTurns = 3;

  // 6. THE AGENT LOOP: Each iteration of this loop is ONE round trip to OpenAI
  for (let turn = 0; turn < maxTurns; turn++) {
    
    // Call OpenAI using our fail-safe wrapper:
    // - Tries the PRIMARY_MODEL first with retry-with-backoff.
    // - If the primary model fails due to a server/network error, 
    //   it automatically switches over to the FALLBACK_MODEL.
    const completion = await withFallback(
      () => callModel(PRIMARY_MODEL),
      () => callModel(FALLBACK_MODEL)
    );

    // Grab the model's response message from the response object
    const message = completion.choices[0].message;

    // ========================================================================
    // BRANCH 1: THE AI WANTS TO USE A TOOL
    // (e.g., The text says "meet on Friday", so the AI asks to run get_current_date)
    // ========================================================================
    if (message.tool_calls && message.tool_calls.length > 0) {
      
      // CRITICAL: Save the AI's tool-request into our history FIRST. 
      // If we don't save the request, the history breaks and the AI gets confused.
      messages.push(message as ChatCompletionMessageParam);

      // Loop through EVERY tool the AI asked for (it can ask for multiple at once)
      for (const call of message.tool_calls) {
        
        // Run our local function if it's a valid function tool, otherwise return an error string
        const result =
          call.type === "function"
            ? runTool(call.function.name)
            : JSON.stringify({ error: "Unsupported tool type" });

        console.log("tool called:", call.type === "function" ? call.function.name : call.type);

        // Push the tool's ANSWER into the chat history, tagged with the call's unique ID
        messages.push({
          role: "tool",
          tool_call_id: call.id,
          content: result,
        });
      }

      // `continue` jumps back to the top of the loop! 
      // The AI now loops around, sees the tool's answer in the history, and tries again.
      continue;
    }

    // ========================================================================
    // BRANCH 2: THE AI IS FINISHED (Gave us the final structured answer)
    // ========================================================================
    
    // SAFETY CHECK: When OpenAI's .parse() finishes successfully, it automatically 
    // validates and places the final structured object inside `message.parsed`.
    // If it's missing here, something went wrong.
    if (!message.parsed) {
      throw new Error("Model did not return a valid extraction");
    }

    // SUCCESS! Return the fully typed, Zod-validated data back to your app.
    return message.parsed;
  }

  // FAILSAFE: If the loop finishes all 3 turns without ever returning, throw an error
  throw new Error("Model hit max turns without finishing");
}


/*
curl -X POST http://localhost:3000/api/extract -H "Content-Type: application/json" -d "{\"textToExtract\":\"Tata Motors announced on 12 January that it will open a new plant in Pune, said CEO Shailesh Chandra.\"}"

curl -X POST http://localhost:3000/api/extract -H "Content-Type: application/json" -d "{\"textToExtract\":\"Hi Ravi, the meeting with Infosys is moved to Friday at the Hyderabad office. Regards, Priya\"}"
*/