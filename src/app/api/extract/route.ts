import { extract } from "@/lib/extract";

export async function POST(req:Request){
    try{
    const data = await req.json()

    if (!data.textToExtract){
        return Response.json(
            { error:"missing the input"}, {status:400})
    } 
    const result = await extract(data.textToExtract);

    return Response.json(result);
    }catch(error){
         console.error(error)
         return Response.json({error: "something went wrong"}, {status:500})
    }
}