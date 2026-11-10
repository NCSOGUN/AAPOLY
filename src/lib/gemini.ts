import { GoogleGenerativeAI } from "@google/generative-ai";

const VALID_SPECIALTIES = [
  "ENT",
  "Otology",
  "Rhinology",
  "Laryngology",
  "Audiology",
  "Head and Neck Surgery",
  "Paediatric ENT",
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
  const model = client.getGenerativeModel({ model: "gemini-flash-latest" });

  const prompt = `Given this clinical description: "${diagnosis}"

Extract:
1) relevant medical specialties. You MUST return only names from this exact list: ${VALID_SPECIALTIES.join(", ")}
2) relevant services/procedures the patient may need (e.g. Audiometry, Nasal Endoscopy, CT Scan, Hearing Test)
3) brief reasoning explaining your choices

Return ONLY valid JSON, no markdown, no code fences:
{"specialties": ["ExactNameFromList"], "services": ["service1"], "reasoning": "brief explanation"}`;

  try {
    const result = await model.generateContent(prompt);
    const text = result.response.text().trim();

    // Strip any accidental markdown code fences
    const cleaned = text
      .replace(/^```(?:json)?\n?/i, "")
      .replace(/\n?```$/i, "")
      .trim();

    const parsed: DiagnosisExtraction = JSON.parse(cleaned);

    // Validate / filter specialties to known list (case-insensitive)
    const validLower = VALID_SPECIALTIES.map((v) => v.toLowerCase());
    const filtered = {
      specialties: (parsed.specialties ?? []).filter((s: string) =>
        validLower.includes(s.toLowerCase())
      ),
      services: parsed.services ?? [],
      reasoning: parsed.reasoning ?? "",
    };

    // If nothing matched, return ENT as safe default
    if (filtered.specialties.length === 0) {
      filtered.specialties = ["ENT"];
      filtered.reasoning =
        (filtered.reasoning || "") +
        " (No exact specialty match found; defaulting to ENT.)";
    }

    return filtered;
  } catch (err) {
    console.error("[Gemini] extraction error:", err);
    // Graceful fallback: return ENT as default specialty
    return {
      specialties: ["ENT"],
      services: [],
      reasoning:
        "Could not extract specialties from the clinical description; defaulting to ENT.",
    };
  }
}
