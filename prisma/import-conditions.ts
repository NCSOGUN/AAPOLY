import { PrismaClient } from "@prisma/client";
import * as fs from "fs";
import * as path from "path";

const prisma = new PrismaClient();

async function main() {
  console.log("📥 Importing ENT conditions dataset...");

  const filePath = path.join(__dirname, "data", "conditions.json");
  const raw = fs.readFileSync(filePath, "utf-8");
  const conditions = JSON.parse(raw);

  console.log(`   Found ${conditions.length} conditions`);

  let created = 0;
  let updated = 0;

  for (const c of conditions) {
    await prisma.condition.upsert({
      where: { id: c.id },
      update: {
        name: c.name,
        commonName: c.commonName,
        category: c.category,
        subcategory: c.subcategory,
        icdCode: c.icdCode ?? null,
        description: c.description,
        symptoms: c.symptoms,
        affectedAreas: c.affectedAreas ?? [],
        onsetPattern: c.onsetPattern,
        typicalDuration: c.typicalDuration,
        ageGroups: c.ageGroups ?? [],
        riskFactors: c.riskFactors ?? [],
        causes: c.causes,
        redFlags: c.redFlags ?? [],
        diagnosticClues: c.diagnosticClues ?? [],
        differentialDiagnosis: c.differentialDiagnosis ?? [],
        investigations: c.investigations,
        treatment: c.treatment,
        referralThreshold: c.referralThreshold,
        referralThresholdReason: c.referralThresholdReason,
        specialistNeeded: c.specialistNeeded ?? [],
        urgencyScore: c.urgencyScore,
        urgencyRationale: c.urgencyRationale,
        patientAdvice: c.patientAdvice,
        preventionTips: c.preventionTips ?? [],
        complications: c.complications ?? [],
        relatedConditions: c.relatedConditions ?? [],
        keywords: c.keywords ?? [],
        nigeriaContext: c.nigeriaContext,
      },
      create: {
        id: c.id,
        name: c.name,
        commonName: c.commonName,
        category: c.category,
        subcategory: c.subcategory,
        icdCode: c.icdCode ?? null,
        description: c.description,
        symptoms: c.symptoms,
        affectedAreas: c.affectedAreas ?? [],
        onsetPattern: c.onsetPattern,
        typicalDuration: c.typicalDuration,
        ageGroups: c.ageGroups ?? [],
        riskFactors: c.riskFactors ?? [],
        causes: c.causes,
        redFlags: c.redFlags ?? [],
        diagnosticClues: c.diagnosticClues ?? [],
        differentialDiagnosis: c.differentialDiagnosis ?? [],
        investigations: c.investigations,
        treatment: c.treatment,
        referralThreshold: c.referralThreshold,
        referralThresholdReason: c.referralThresholdReason,
        specialistNeeded: c.specialistNeeded ?? [],
        urgencyScore: c.urgencyScore,
        urgencyRationale: c.urgencyRationale,
        patientAdvice: c.patientAdvice,
        preventionTips: c.preventionTips ?? [],
        complications: c.complications ?? [],
        relatedConditions: c.relatedConditions ?? [],
        keywords: c.keywords ?? [],
        nigeriaContext: c.nigeriaContext,
      },
    });

    // Track creates vs updates (simple heuristic — first run all are creates)
    created++;
  }

  console.log(`✅ Done: ${created} conditions imported`);

  // Print a quick summary
  const counts = await prisma.condition.groupBy({
    by: ["category"],
    _count: { id: true },
    orderBy: { _count: { id: "desc" } },
  });
  console.log("\n📊 By category:");
  for (const row of counts) {
    console.log(`   ${row.category}: ${row._count.id}`);
  }

  const emergencies = await prisma.condition.count({
    where: { referralThreshold: "emergency" },
  });
  console.log(`\n🚨 Emergency conditions: ${emergencies}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
