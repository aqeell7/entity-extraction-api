import { z } from "zod";

export const ExtractionSchema = z.object({
    category: z.enum(["news","email","review","story","other"]),
    entities: z.array(z.string())
})

export type Extraction = z.infer<typeof ExtractionSchema>