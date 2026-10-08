import { openai } from "./openai"

export async function extract(req:string){
    const completion = await openai.chat.completions.create({
        model:"gpt-5-nano",
        messages:[
            {role:"system", content:"give it a category name based on the kind of input and give me 3 entities from the input"},
            {role:"user", content:req}
        ]
    })
    return completion.choices[0].message.content
}
