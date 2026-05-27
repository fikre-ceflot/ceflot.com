import { GoogleGenAI, Type } from "@google/genai";
import { BOQItem } from "../types";

// Get API key from environment with multiple fallback attempts for compatibility
const getApiKey = () => {
  // Try VITE_ prefix first (standard for Vite)
  if (import.meta.env.VITE_GEMINI_API_KEY) return import.meta.env.VITE_GEMINI_API_KEY;
  // Try process.env (AI Studio Build convention)
  const key = process.env.GEMINI_API_KEY;
  if (key && key !== 'undefined' && key !== 'null') return key;
  return null;
};

export async function generateAISchedule(
  projectContext: { name: string; start_date: string; end_date: string },
  items: BOQItem[]
): Promise<{ 
  tasks: { id: string; start_date: string; end_date: string }[],
  dependencies: { task_id: string; predecessor_id: string; link_type: string; lag_days: number }[]
}> {
  const apiKey = getApiKey();
  if (!apiKey) {
    throw new Error('AI Scheduling is currently unavailable: GEMINI_API_KEY is not configured in environment variables.');
  }

  const ai = new GoogleGenAI({ apiKey });

  const prompt = `
    You are an expert construction project scheduler. 
    Project Name: ${projectContext.name}
    Planned Project Period: ${projectContext.start_date} to ${projectContext.end_date}
    
    Current Bill of Quantities (BOQ) Items to be scheduled:
    ${items.map(i => `- [ID: ${i.id}] ${i.description} (Unit: ${i.unit}, Qty: ${i.contract_qty})`).join('\n')}
    
    Requirements:
    1. Provide a realistic construction timeline.
    2. Assign start and end dates (YYYY-MM-DD) for EVERY task provided in the list above.
    3. Dates MUST be within the project period: ${projectContext.start_date} to ${projectContext.end_date}.
    4. Tasks should be sequenced logically (e.g., Preliminaries first, then Site Clearance, Foundation, Structure, Finishes).
    5. Suggest a comprehensive set of dependencies between these tasks.
    6. Use standard construction link types: 'FS' (Finish-to-Start), 'SS' (Start-to-Start), etc.
    
    CRITICAL: You MUST use the exact IDs provided in the list above for both tasks and predecessors.
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            tasks: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  id: { type: Type.STRING },
                  start_date: { type: Type.STRING },
                  end_date: { type: Type.STRING }
                },
                required: ["id", "start_date", "end_date"]
              }
            },
            dependencies: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  task_id: { type: Type.STRING },
                  predecessor_id: { type: Type.STRING },
                  link_type: { type: Type.STRING },
                  lag_days: { type: Type.NUMBER }
                },
                required: ["task_id", "predecessor_id", "link_type", "lag_days"]
              }
            }
          },
          required: ["tasks", "dependencies"]
        }
      }
    });

    const text = response.text;
    if (!text) {
      throw new Error("AI returned an empty response.");
    }
    
    let result;
    try {
      result = JSON.parse(text);
    } catch (parseErr) {
      console.error("Failed to parse AI response:", text);
      throw new Error("AI returned invalid JSON format.");
    }

    // Basic validation of result structure
    if (!result.tasks || !Array.isArray(result.tasks)) {
       throw new Error("AI response is missing tasks array.");
    }

    return result;
  } catch (err: any) {
    console.error("AI Scheduling Service Error:", err);
    if (err.message?.includes("API key")) {
      throw new Error("AI Service authentication failed. Please check your GEMINI_API_KEY.");
    }
    throw err;
  }
}
