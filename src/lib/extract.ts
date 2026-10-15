import { openai } from "./openai";
import { zodResponseFormat } from "openai/helpers/zod";
import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";
import { ExtractionSchema, type Extraction } from "./schema";
import { tools, runTool } from "./tools";

// ============================================================================
// MAIN FUNCTION: Takes messy text and extracts structured data using an AI agent
// ============================================================================
export async function extract(text: string): Promise<Extraction> {
  
  // 1. CHAT HISTORY SETUP: We start the conversation with instructions (system)
  // and the raw text we want to analyze (user).
  const messages: ChatCompletionMessageParam[] = [
    {
      role: "system",
      content:
        "Classify the text into one category. Extract named entities into people, organizations, locations, and dates. For each date, keep the original words in 'text'. Use the get_current_date tool to convert relative dates (like 'Friday') into YYYY-MM-DD in 'isoDate'. If a date can't be worked out, set isoDate to null. Leave a group empty if nothing fits.",
    },
    { role: "user", content: text },
  ];

  // 2. SAFETY BACKSTOP: Prevents the AI from looping forever (max 3 round trips)
  const maxTurns = 3;

  // 3. THE AGENT LOOP: Each iteration of this loop is ONE round trip to OpenAI
  for (let turn = 0; turn < maxTurns; turn++) {
    
    // Call OpenAI and tell it: 
    // - Use these tools (if needed)
    // - FORCE the final output to match our Zod schema using .parse()
    const completion = await openai.chat.completions.parse({
      model: "gpt-5-nano",
      messages,
      tools,
      response_format: zodResponseFormat(ExtractionSchema, "extraction"),
    });

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