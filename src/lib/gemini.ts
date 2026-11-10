import { GoogleGenerativeAI } from "@google/generative-ai";

const VALID_SPECIALTIES = [
  "ENT",
  "Otology",
  "Rhinology",
  "Laryngology",
  "Audiology",
  "Head & Neck Surgery",
  "Facial Plastics",
];

export interface DiagnosisExtraction {
  specialties: string[];
  services: string[];
  reasoning: string;
}

function getClient(): GoogleGenerativeAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY environment variable is not set");
  return new GoogleGenerativeAI(apiKey);
}

/**
 * Use Gemini to extract relevant specialties and services from a clinical diagnosis.
 */
export async function extractSpecialtiesFromDiagnosis(
  diagnosis: string
): Promise<DiagnosisExtraction> {
  const client = getClient();
  const model = client.getGenerativeModel({ model: "gemini-1.5-flash" });

  const prompt = `Given this clinical description: "${diagnosis}"

Extract:
1) relevant medical specialties from this list ONLY: ${VALID_SPECIALTIES.join(", ")}
2) relevant services/procedures the patient may need (free text, e.g. Audiometry, Nasal Endoscopy, CT Scan)
3) brief reasoning explaining the extraction

Return ONLY valid JSON in this exact format with no markdown, no code fences, no extra text:
{"specialties": ["specialty1", "specialty2"], "services": ["service1", "service2"], "reasoning": "brief explanation"}`;

  try {
    const result = await model.generateContent(prompt);
    const text = result.response.text().trim();

    // Strip any accidental markdown code fences
    const cleaned = text
      .replace(/^```(?:json)?\n?/i, "")
      .replace(/\n?```$/i, "")
      .trim();

    const parsed: DiagnosisExtraction = JSON.parse(cleaned);

    // Validate / filter specialties to known list
    const filtered = {
      specialties: (parsed.specialties ?? []).filter((s: string) =>
        VALID_SPECIALTIES.map((v) => v.toLowerCase()).includes(s.toLowerCase())
      ),
      services: parsed.services ?? [],
      reasoning: parsed.reasoning ?? "",
    };

    return filtered;
  } catch {
    // Graceful fallback: return ENT as default specialty
    return {
      specialties: ["ENT"],
      services: [],
      reasoning:
        "Could not extract specialties from the clinical description; defaulting to ENT.",
    };
  }
}
