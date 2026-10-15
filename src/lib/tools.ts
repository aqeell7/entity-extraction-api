import type { ChatCompletionTool } from "openai/resources/chat/completions";

export const tools: ChatCompletionTool[] = [
  {
    type: "function",
    function: {
      name: "get_current_date",
      description:
        "Returns today's date and weekday. Call this before turning relative dates like 'Friday' or 'tomorrow' into real dates.",
      parameters: {
        type: "object",
        properties: {},
        required: [],
        additionalProperties: false,
      },
      strict: true,
    },
  },
];

export function runTool(name: string): string {
  if (name === "get_current_date") {
    const now = new Date();
    return JSON.stringify({
      today: now.toLocaleDateString("en-CA"), // gives YYYY-MM-DD
      weekday: now.toLocaleDateString("en-US", { weekday: "long" }),
    });
  }
  return JSON.stringify({ error: `Unknown tool: ${name}` });
}