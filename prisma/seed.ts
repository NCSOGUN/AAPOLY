import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Seeding database...");

  // ── Specialties ──────────────────────────────────────────────────────────
  const specialtyData = [
    {
      name: "ENT",
      code: "ENT-001",
      description: "Ear, Nose and Throat — general otolaryngology",
    },
    {
      name: "Otology",
      code: "OTO-001",
      description: "Diagnosis and treatment of ear disorders",
    },
    {
      name: "Rhinology",
      code: "RHI-001",
      description: "Nasal cavity, sinuses and related structures",
    },
    {
      name: "Laryngology",
      code: "LAR-001",
      description: "Larynx, voice box and throat disorders",
    },
    {
      name: "Audiology",
      code: "AUD-001",
      description: "Hearing assessment, rehabilitation and hearing aids",
    },
    {
      name: "Head & Neck Surgery",
      code: "HNS-001",
      description: "Surgical treatment of head and neck pathologies",
    },
  ];

  const specialties: Record<string, { id: string; name: string }> = {};

  for (const sp of specialtyData) {
    const specialty = await prisma.specialty.upsert({
      where: { name: sp.name },
      update: {},
      create: sp,
    });
    specialties[sp.name] = specialty;
    console.log(`  ✔ Specialty: ${specialty.name}`);
  }

  // ── Facilities ───────────────────────────────────────────────────────────
  const facilitiesData = [
    {
      name: "Ogun State University Teaching Hospital ENT Unit",
      slug: "ogun-state-university-teaching-hospital-ent",
      address: "OOUTH Campus, Sagamu Road",
      city: "Sagamu",
      state: "Ogun",
      country: "Nigeria",
      latitude: 6.8372,
      longitude: 3.6469,
      phone: "+234 803 300 1234",
      email: "ent@oouth.gov.ng",
      accredited: true,
      accreditationDate: new Date("2022-03-15"),
      notes: "Main ENT referral centre for Ogun State",
      specialties: ["ENT", "Otology", "Head & Neck Surgery", "Audiology"],
      services: [
        "Audiometry",
        "Tympanometry",
        "Nasal Endoscopy",
        "Laryngoscopy",
        "CT Scan",
        "Tonsillectomy",
        "Septoplasty",
        "Cochlear Implant Assessment",
      ],
    },
    {
      name: "Abeokuta ENT & Audiology Centre",
      slug: "abeokuta-ent-audiology-centre",
      address: "15 Ibara Road",
      city: "Abeokuta",
      state: "Ogun",
      country: "Nigeria",
      latitude: 7.1475,
      longitude: 3.3619,
      phone: "+234 807 455 6789",
      email: "info@abeokutaentcentre.ng",
      accredited: true,
      accreditationDate: new Date("2021-09-01"),
      notes: "Specialises in paediatric and adult hearing rehabilitation",
      specialties: ["ENT", "Audiology", "Rhinology"],
      services: [
        "Audiometry",
        "Hearing Aid Fitting",
        "Nasal Endoscopy",
        "FESS",
        "Speech Therapy Referral",
      ],
    },
    {
      name: "Ijebu-Ode Specialist Hospital ENT Department",
      slug: "ijebu-ode-specialist-hospital-ent",
      address: "Oba Sijuade Way",
      city: "Ijebu-Ode",
      state: "Ogun",
      country: "Nigeria",
      latitude: 6.8167,
      longitude: 3.9167,
      phone: "+234 805 211 2233",
      email: "ent@ijebuhospital.gov.ng",
      accredited: false,
      notes: "Government specialist hospital with ENT outpatient clinic",
      specialties: ["ENT", "Laryngology"],
      services: [
        "Laryngoscopy",
        "Microlaryngoscopy",
        "Tracheostomy",
        "Tonsillectomy",
        "Adenoidectomy",
      ],
    },
    {
      name: "Remo ENT & Head-Neck Surgery Clinic",
      slug: "remo-ent-head-neck-surgery-clinic",
      address: "22 Station Road",
      city: "Shagamu",
      state: "Ogun",
      country: "Nigeria",
      latitude: 6.8512,
      longitude: 3.6512,
      phone: "+234 816 777 8900",
      email: "clinic@remoent.ng",
      accredited: true,
      accreditationDate: new Date("2023-01-20"),
      notes: "Private specialist practice with day surgery facilities",
      specialties: ["ENT", "Head & Neck Surgery", "Rhinology"],
      services: [
        "Parotidectomy",
        "Thyroidectomy",
        "Neck Dissection",
        "Nasal Endoscopy",
        "FESS",
        "CT-guided Biopsy",
      ],
    },
    {
      name: "Gateway ENT & Facial Plastics Centre",
      slug: "gateway-ent-facial-plastics-centre",
      address: "Plot 4 Obantoko Estate",
      city: "Abeokuta",
      state: "Ogun",
      country: "Nigeria",
      latitude: 7.1356,
      longitude: 3.3734,
      phone: "+234 909 123 4567",
      email: "admin@gatewayent.ng",
      accredited: true,
      accreditationDate: new Date("2020-07-11"),
      notes: "Comprehensive ENT and facial reconstruction services",
      specialties: ["ENT", "Otology", "Rhinology", "Laryngology", "Audiology"],
      services: [
        "Audiometry",
        "Tympanometry",
        "Mastoidectomy",
        "Cochlear Implant Surgery",
        "Rhinoplasty",
        "Septoplasty",
        "FESS",
        "Voice Therapy",
        "Laryngoscopy",
      ],
    },
  ];

  for (const fd of facilitiesData) {
    const { specialties: specialtyNames, services, ...facilityData } = fd;

    const facility = await prisma.facility.upsert({
      where: { slug: fd.slug },
      update: {},
      create: {
        ...facilityData,
        specialties: {
          create: specialtyNames.map((name) => ({
            specialtyId: specialties[name].id,
          })),
        },
        services: {
          create: services.map((name) => ({ name, available: true })),
        },
      },
    });
    console.log(`  ✔ Facility: ${facility.name}`);
  }

  // ── Admin user ────────────────────────────────────────────────────────────
  const adminEmail = process.env.ADMIN_EMAIL ?? "admin@entcare.ai";
  const adminPassword = process.env.ADMIN_PASSWORD ?? "admin123";
  const hashed = await bcrypt.hash(adminPassword, 12);

  await prisma.adminUser.upsert({
    where: { email: adminEmail },
    update: {},
    create: {
      email: adminEmail,
      password: hashed,
      name: "Admin",
    },
  });
  console.log(`  ✔ Admin user: ${adminEmail}`);

  console.log("✅ Seed complete.");
}

main()
  .catch((e) => {
    console.error("Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
