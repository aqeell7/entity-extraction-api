import { z } from "zod";

export const ExtractionSchema = z.object({
    category: z.enum(["news","email","review","story","other"]),
    entities:z.object({
        people: z.array(z.string()),
        organization: z.array(z.string()),
        locations: z.array(z.string()),
        dates: z.array(z.string())
    })
})

export type Extraction = z.infer<typeof ExtractionSchema>