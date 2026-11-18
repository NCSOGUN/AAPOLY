/**
 * Import new facilities from improvement/add.json
 * Maps the JSON structure to the Prisma Facility schema.
 *
 * Run: npx ts-node --compiler-options '{"module":"CommonJS"}' prisma/import-facilities.ts
 */
import { PrismaClient } from "@prisma/client";
import * as fs from "fs";
import * as path from "path";

const prisma = new PrismaClient();

// Map specialties from add.json descriptions → our DB specialty names
function mapSpecialties(rawSpecialties: string[]): string[] {
  const mapped = new Set<string>();

  for (const raw of rawSpecialties) {
    const r = raw.toLowerCase();

    if (r.includes("ear") || r.includes("ent") || r.includes("nose") || r.includes("throat")) {
      mapped.add("ENT");
    }
    if (r.includes("otolog")) mapped.add("Otology");
    if (r.includes("rhinolog")) mapped.add("Rhinology");
    if (r.includes("laryngolog")) mapped.add("Laryngology");
    if (r.includes("audiol") || r.includes("audiometry") || r.includes("hearing")) {
      mapped.add("Audiology");
    }
    if (r.includes("head and neck") || r.includes("head & neck")) {
      mapped.add("Head and Neck Surgery");
    }
    if (r.includes("paediatric ent") || r.includes("pediatric ent")) {
      mapped.add("Paediatric ENT");
    }
    if (r.includes("general") && (r.includes("surgery") || r.includes("surgical"))) {
      mapped.add("General Surgery");
    }
    if (r.includes("paediatric") || r.includes("neonatolog") || r.includes("nicu") || r.includes("child")) {
      mapped.add("Paediatrics");
    }
    if (r.includes("obstetric") || r.includes("gynaecolog") || r.includes("gynecolog") || r.includes("maternity")) {
      mapped.add("Obstetrics & Gynaecology");
    }
    if (r.includes("internal medicine") || r.includes("cardiology") || r.includes("neurology") ||
        r.includes("endocrinolog") || r.includes("nephrology")) {
      mapped.add("Internal Medicine");
    }
    if (r.includes("cardiology") || r.includes("cardiac")) {
      mapped.add("Cardiology");
    }
    if (r.includes("nephrology") || r.includes("dialysis") || r.includes("kidney")) {
      mapped.add("Nephrology");
    }
    if (r.includes("orthopaedic") || r.includes("orthopedic") || r.includes("trauma")) {
      mapped.add("Orthopaedics");
    }
    if (r.includes("ophthalm") || r.includes("eye")) {
      mapped.add("Ophthalmology");
    }
    if (r.includes("radiology") || r.includes("imaging") || r.includes("x-ray") || r.includes("ct scan") || r.includes("mri")) {
      mapped.add("Radiology");
    }
    if (r.includes("psychiatry") || r.includes("mental health") || r.includes("behavioural") ||
        r.includes("psychology") || r.includes("addiction")) {
      mapped.add("Psychiatry");
    }
  }

  return Array.from(mapped);
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
}

async function main() {
  console.log("📥 Importing facilities from improvement/add.json...");

  const filePath = path.join(__dirname, "../improvement/add.json");
  const raw = fs.readFileSync(filePath, "utf-8");
  const data = JSON.parse(raw);

  const hospitals = data.hospitals as Array<{
    name: string;
    category: string;
    address: string;
    coordinates: { latitude: number; longitude: number };
    hotlines: string[];
    specialties: string[];
  }>;

  console.log(`   Found ${hospitals.length} facilities to import`);

  // Load all existing specialties from DB
  const dbSpecialties = await prisma.specialty.findMany();
  const specialtyMap: Record<string, string> = {};
  for (const s of dbSpecialties) {
    specialtyMap[s.name] = s.id;
  }

  let created = 0;
  let skipped = 0;

  for (const h of hospitals) {
    const baseSlug = slugify(h.name);

    // Check for duplicate slug — append city suffix if needed
    let slug = baseSlug;
    const existing = await prisma.facility.findUnique({ where: { slug } });
    if (existing) {
      slug = `${baseSlug}-abeokuta`;
      const existing2 = await prisma.facility.findUnique({ where: { slug } });
      if (existing2) {
        console.log(`  ⏭  Skip (already exists): ${h.name}`);
        skipped++;
        continue;
      }
    }

    // Determine accreditation — public hospitals are accredited
    const isPublic = h.category.toLowerCase().includes("public") ||
                     h.category.toLowerCase().includes("federal") ||
                     h.category.toLowerCase().includes("state") ||
                     h.category.toLowerCase().includes("teaching");

    const phone = h.hotlines[0] ?? null;

    const facility = await prisma.facility.create({
      data: {
        slug,
        name: h.name,
        address: h.address,
        city: "Abeokuta",
        state: "Ogun",
        country: "Nigeria",
        latitude: h.coordinates.latitude,
        longitude: h.coordinates.longitude,
        phone,
        accredited: isPublic,
        notes: h.category,
      },
    });

    // Link specialties
    const specialtyNames = mapSpecialties(h.specialties);
    for (const spName of specialtyNames) {
      const spId = specialtyMap[spName];
      if (!spId) continue;

      await prisma.facilitySpecialty.upsert({
        where: {
          facilityId_specialtyId: { facilityId: facility.id, specialtyId: spId },
        },
        update: {},
        create: { facilityId: facility.id, specialtyId: spId },
      });
    }

    console.log(`  ✅ ${h.name} [${specialtyNames.join(", ") || "no specialties mapped"}]`);
    created++;
  }

  console.log(`\n🎉 Done: ${created} created, ${skipped} skipped`);

  const total = await prisma.facility.count();
  console.log(`📊 Total facilities in DB: ${total}`);

  const entCount = await prisma.facility.count({
    where: { specialties: { some: { specialty: { name: "ENT" } } } },
  });
  console.log(`🏥 Facilities with ENT specialty: ${entCount}`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
