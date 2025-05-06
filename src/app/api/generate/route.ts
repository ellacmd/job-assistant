import OpenAI from 'openai';



const openai = new OpenAI({
    apiKey: process.env.NEXT_PUBLIC_API_KEY,
});

export const runtime = 'edge';

export async function POST(req: Request) {
    try {
        const { jobDescription, resume, tone, length } = await req.json();
 

        const fitScoreResponse = await openai.chat.completions.create({
            model: 'gpt-4',
            messages: [
                {
                    role: 'system',
                    content:
                        "You are a helpful assistant that evaluates how well a candidate's resume matches a job description. Respond ONLY with a number from 0 to 100 representing the fit score, where 100 is a perfect match.",
                },
                {
                    role: 'user',
                    content: `Job Description:\n${jobDescription}\n\nResume:\n${resume}`,
                },
            ],
            max_tokens: 10,
            temperature: 0,
        });
        const fitScoreText =
            fitScoreResponse.choices?.[0]?.message?.content?.match(
                /\d+/
            )?.[0] || '0';
        const fitScore = Math.max(0, Math.min(100, parseInt(fitScoreText, 10)));

        const response = await openai.chat.completions.create({
            model: 'gpt-4',
            stream: true,
            messages: [
                {
                    role: 'system',
                    content: `You are a professional cover letter writer. Generate a tailored cover letter based on the job description and CV provided. The cover letter should have a ${
                        tone?.toLowerCase() || 'professional'
                    } tone and be ${
                        length?.toLowerCase() || 'medium'
                    } in length. Focus on matching the candidate's experience with the job requirements and maintain the specified tone and length.`,
                },
                {
                    role: 'user',
                    content: `Job Description:\n${jobDescription}\n\nResume:\n${resume}`,
                },
            ],
        });

        const stream = response.toReadableStream();
        const headers = new Headers({ 'x-fit-score': fitScore.toString() });
        return new Response(stream, { headers });
    } catch (error: any) {
        return new Response(
            `An error occurred: ${error?.message || 'Unknown error'}`,
            { status: 500 }
        );
    }
}
