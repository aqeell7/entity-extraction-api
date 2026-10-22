import OpenAI from "openai";

// ============================================================================
// PRICING DICTIONARY: Price per 1 million tokens (Input vs Output) in USD
// ============================================================================
const PRICES_PER_MILLION: Record<string, { input: number; output: number }> = {
  "gpt-5-nano": { input: 0.05, output: 0.4 },
  "gpt-5-mini": { input: 0.25, output: 2.0 },
};

// HOW TO REMEMBER `Record<string, ...>`:
// Think of `Record<KeyType, ValueType>` as TypeScript shorthand for a dictionary object:
// - `Record<string, ...>` means: "The keys of this object must be **strings** (like 'gpt-5-nano')."
// - `{ input: number; output: number }` means: "The value attached to each key must be an object containing an `input` number and an `output` number."
// So this tells TypeScript: "This is a dictionary where the model name is a string, and its value is a pricing object with input and output numbers."

type Usage = { prompt_tokens: number; completion_tokens: number };

// ============================================================================
// COST CALCULATOR: Figures out how much a specific API call cost based on tokens used
// ============================================================================
export function calculateCost(model: string, usage?: Usage): number {
  
  // Safety check: If OpenAI didn't return usage data for some reason, cost is 0.
  if (!usage) return 0;

  // FINDING THE MATCHING MODEL:
  // OpenAI often returns model names with date stamps (e.g., "gpt-5-nano-2025-08-07").
  // Object.keys finds our base name ("gpt-5-nano") by checking if the model starts with it.
  const key = Object.keys(PRICES_PER_MILLION).find((name) => model.startsWith(name));
  
  // If we don't recognize the model name at all, log a warning and return 0.
  if (!key) {
    console.warn(`no price listed for model ${model}`);
    return 0;
  }

  // Grab the pricing rates for the matched model key
  const price = PRICES_PER_MILLION[key];
  
  // TOKEN COST MATH:
  // (Prompt tokens / 1,000,000 * input price) + (Completion tokens / 1,000,000 * output price)
  return (
    (usage.prompt_tokens / 1_000_000) * price.input +
    (usage.completion_tokens / 1_000_000) * price.output
  );
}