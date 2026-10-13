import { openai } from "./openai";
import { zodResponseFormat } from "openai/helpers/zod";
import { ExtractionSchema, type Extraction } from "./schema";

export async function extract(text: string): Promise<Extraction> {
  const completion = await openai.chat.completions.parse({
    model: "gpt-5-nano",
    messages: [
      {
        role: "system",
        content:
          "Classify the text into one category. Extract named entities into the matching group: people, organizations, locations, and dates(any date or time reference, like 'Friday' or '12 Jan'). Leave a group as an empty list if nothing fits. Do not include general words that aren't named entities.",
      },
      { role: "user", content: text },
    ],
    response_format: zodResponseFormat(ExtractionSchema, "extraction"),
  });

  const result = completion.choices[0].message.parsed;

  if (!result) {
    throw new Error("Model did not return a valid extraction");
  }

  return result;
}