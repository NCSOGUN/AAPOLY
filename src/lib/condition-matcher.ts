import { prisma } from "./prisma";

export interface MatchResult {
  conditionId: string;
  name: string;
  commonName: string;
  category: string;
  score: number;           // 0–100
  matchedKeywords: string[];
  matchedSymptoms: string[];
}

/**
 * Fast local symptom/keyword matcher against the Condition table.
 * No AI involved — purely string matching with scoring.
 *
 * Score breakdown:
 *   +20 per matched primary symptom
 *   +10 per matched secondary symptom
 *   +5  per matched keyword
 *   +15 if affectedArea matches category
 *   +10 if onset pattern matches
 *
 * Returns top matches sorted by score descending.
 */
export async function matchConditions(
  inputText: string,
  affectedArea?: string,   // "ear" | "nose" | "throat" | "head_neck" | "paediatric"
  onsetPattern?: string,   // "sudden" | "gradual" | "episodic" | "chronic"
  topN = 5
): Promise<MatchResult[]> {
  const normalised = inputText.toLowerCase();
  const tokens = normalised
    .split(/[\s,.\-;]+/)
    .filter((t) => t.length > 2);

  // Load candidates — if affectedArea given, start with that category
  const conditions = await prisma.condition.findMany({
    where: affectedArea
      ? {
          OR: [
            { category: affectedArea },
            { affectedAreas: { has: affectedArea } },
          ],
        }
      : undefined,
    select: {
      id: true,
      name: true,
      commonName: true,
      category: true,
      subcategory: true,
      symptoms: true,
      keywords: true,
      affectedAreas: true,
      onsetPattern: true,
      urgencyScore: true,
    },
  });

  const scored: MatchResult[] = [];

  for (const c of conditions) {
    let score = 0;
    const matchedKeywords: string[] = [];
    const matchedSymptoms: string[] = [];

    const symptoms = c.symptoms as {
      primary: string[];
      secondary: string[];
      rare: string[];
    };

    // Match primary symptoms (+20 each)
    for (const sym of symptoms.primary ?? []) {
      const symNorm = sym.toLowerCase();
      if (
        normalised.includes(symNorm) ||
        tokens.some((t) => symNorm.includes(t) || t.includes(symNorm.split(" ")[0]))
      ) {
        score += 20;
        matchedSymptoms.push(sym);
      }
    }

    // Match secondary symptoms (+10 each)
    for (const sym of symptoms.secondary ?? []) {
      const symNorm = sym.toLowerCase();
      if (normalised.includes(symNorm)) {
        score += 10;
        matchedSymptoms.push(sym);
      }
    }

    // Match keywords (+5 each)
    for (const kw of c.keywords ?? []) {
      const kwNorm = kw.toLowerCase();
      if (
        normalised.includes(kwNorm) ||
        tokens.some((t) => kwNorm.includes(t))
      ) {
        score += 5;
        if (!matchedKeywords.includes(kw)) matchedKeywords.push(kw);
      }
    }

    // Bonus: category matches affectedArea
    if (affectedArea && c.category === affectedArea) score += 15;

    // Bonus: onset pattern match
    if (onsetPattern && c.onsetPattern === onsetPattern) score += 10;

    if (score > 0) {
      scored.push({
        conditionId: c.id,
        name: c.name,
        commonName: c.commonName,
        category: c.category,
        score,
        matchedKeywords,
        matchedSymptoms,
      });
    }
  }

  // Sort by score descending, return top N
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, topN);
}

/**
 * Load a full condition record by ID.
 */
export async function getConditionById(id: string) {
  return prisma.condition.findUnique({ where: { id } });
}
