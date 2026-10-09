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
          "Classify the text into one category and list the key entities (people, places, organizations, things) mentioned in it.",
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