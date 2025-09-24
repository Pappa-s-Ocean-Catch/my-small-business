import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY!);

export async function POST(request: Request) {
  try {
    const { prompt } = await request.json();

    if (!prompt) {
      return Response.json({ error: "Prompt is required" }, { status: 400 });
    }

    // Use Gemini 2.5 Flash Lite model
    const model = genAI.getGenerativeModel({ 
      model: "gemini-2.0-flash-exp",
      generationConfig: {
        temperature: 0.1, // Low temperature for consistent results
        topP: 0.8,
        topK: 40,
        maxOutputTokens: 8192,
      }
    });

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();

    // Try to extract JSON from the response
    let assignments = "[]";
    try {
      // Look for JSON array in the response
      const jsonMatch = text.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        assignments = jsonMatch[0];
      } else {
        // If no JSON found, return empty array
        assignments = "[]";
      }
    } catch (error) {
      console.error("Error parsing AI response:", error);
      assignments = "[]";
    }

    return Response.json({ 
      assignments,
      rawResponse: text 
    });

  } catch (error) {
    console.error("Error generating AI assignments:", error);
    return Response.json(
      { error: "Failed to generate assignments" },
      { status: 500 }
    );
  }
}
