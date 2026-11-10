import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Starting seed...");

  // ============================================
  // 1. Create Specialties
  // ============================================
  const specialtiesData = [
    { name: "ENT", code: "ENT", description: "Ear, Nose and Throat" },
    { name: "Otology", code: "OTO", description: "Ear disorders and hearing" },
    { name: "Rhinology", code: "RHI", description: "Nose and sinus disorders" },
    { name: "Laryngology", code: "LAR", description: "Throat and voice disorders" },
    { name: "Head and Neck Surgery", code: "HNS", description: "Head and neck surgical conditions" },
    { name: "Audiology", code: "AUD", description: "Hearing assessment and management" },
    { name: "Paediatric ENT", code: "PENT", description: "ENT conditions in children" },
    { name: "General Surgery", code: "GS", description: "General surgical services" },
    { name: "Paediatrics", code: "PAED", description: "Child health" },
    { name: "Obstetrics & Gynaecology", code: "OBGYN", description: "Women's health and maternity" },
    { name: "Internal Medicine", code: "IM", description: "Adult internal medicine" },
    { name: "Orthopaedics", code: "ORTHO", description: "Bones, joints and trauma" },
    { name: "Ophthalmology", code: "OPH", description: "Eye care" },
    { name: "Radiology", code: "RAD", description: "Medical imaging" },
    { name: "Psychiatry", code: "PSY", description: "Mental health" },
    { name: "Cardiology", code: "CARD", description: "Heart conditions" },
    { name: "Nephrology", code: "NEPH", description: "Kidney conditions" },
  ];

  const specialties: Record<string, string> = {};

  for (const item of specialtiesData) {
    const specialty = await prisma.specialty.upsert({
      where: { name: item.name },
      update: {},
      create: item,
    });
    specialties[item.name] = specialty.id;
  }

  console.log("✅ Specialties created");

  // ============================================
  // 2. Create Facilities
  // ============================================
  const facilities = [
    {
      name: "Federal Medical Centre (FMC) Abeokuta",
      slug: "fmc-abeokuta",
      address: "Olabisi Onabanjo Way, Idi-Aba, Abeokuta",
      city: "Abeokuta",
      latitude: 7.144071,
      longitude: 3.38045,
      accredited: true,
      notes: "Major tertiary hospital with confirmed ENT department",
      specialtyNames: ["ENT", "Otology", "Rhinology", "Laryngology", "General Surgery", "Paediatrics", "Obstetrics & Gynaecology", "Internal Medicine", "Orthopaedics", "Ophthalmology", "Radiology"],
    },
    {
      name: "Olabisi Onabanjo University Teaching Hospital (OOUTH)",
      slug: "oouth-sagamu",
      address: "Hospital Road, Sagamu",
      city: "Sagamu",
      latitude: 6.849044,
      longitude: 3.653023,
      accredited: true,
      notes: "Teaching hospital with confirmed ENT / Otorhinolaryngology department",
      specialtyNames: ["ENT", "Otology", "Rhinology", "Laryngology", "General Surgery", "Paediatrics", "Obstetrics & Gynaecology", "Ophthalmology", "Cardiology", "Nephrology"],
    },
    {
      name: "Babcock University Teaching Hospital (BUTH)",
      slug: "buth-ilishan",
      address: "Babcock Road, Ilishan-Remo",
      city: "Ilishan-Remo",
      latitude: 6.891086,
      longitude: 3.717291,
      accredited: true,
      notes: "Private teaching hospital",
      specialtyNames: ["ENT", "General Surgery", "Paediatrics", "Obstetrics & Gynaecology", "Internal Medicine", "Ophthalmology", "Radiology"],
    },
    {
      name: "Sacred Heart Hospital",
      slug: "sacred-heart-lantoro",
      address: "Lantoro Road, Lantoro, Abeokuta South",
      city: "Abeokuta",
      latitude: 7.16324,
      longitude: 3.36283,
      accredited: true,
      notes: "Catholic missionary hospital (est. 1895), ~300 beds. Has ENT services",
      specialtyNames: ["ENT", "General Surgery", "Paediatrics", "Obstetrics & Gynaecology", "Ophthalmology"],
    },
    {
      name: "Federal Neuro-Psychiatric Hospital Aro",
      slug: "neuro-psychiatric-aro",
      address: "Aro, Abeokuta",
      city: "Abeokuta",
      latitude: 7.15,
      longitude: 3.35,
      accredited: true,
      notes: "Specialist psychiatric hospital with Lantoro annex",
      specialtyNames: ["Psychiatry"],
    },
    {
      name: "Abeokuta State Hospital",
      slug: "abeokuta-state-hospital",
      address: "Abeokuta",
      city: "Abeokuta",
      latitude: 7.155,
      longitude: 3.345,
      accredited: true,
      notes: "Premier state hospital",
      specialtyNames: ["General Surgery", "Paediatrics", "Obstetrics & Gynaecology", "Internal Medicine"],
    },
    {
      name: "Ijebu Ode State Hospital",
      slug: "ijebu-ode-state-hospital",
      address: "Olisa Street, Odo Esa, Ijebu-Ode",
      city: "Ijebu-Ode",
      latitude: 6.81314,
      longitude: 3.92486,
      accredited: true,
      notes: "Full-service state hospital",
      specialtyNames: ["General Surgery", "Paediatrics", "Obstetrics & Gynaecology", "Internal Medicine"],
    },
    {
      name: "Ota State Hospital",
      slug: "ota-state-hospital",
      address: "Sango Idiroko Road, Onipanu, Ota",
      city: "Ota",
      latitude: 6.682626,
      longitude: 3.209063,
      accredited: true,
      notes: "Modern state hospital",
      specialtyNames: ["General Surgery", "Paediatrics", "Obstetrics & Gynaecology", "Internal Medicine"],
    },
    {
      name: "Ilaro State Hospital",
      slug: "ilaro-state-hospital",
      address: "Ilaro",
      city: "Ilaro",
      latitude: 6.89,
      longitude: 3.02,
      accredited: true,
      notes: "Serves Yewa communities",
      specialtyNames: ["General Surgery", "Paediatrics", "Obstetrics & Gynaecology", "Internal Medicine"],
    },
    {
      name: "Isara State Hospital",
      slug: "isara-state-hospital",
      address: "Isara",
      city: "Isara",
      latitude: 6.99,
      longitude: 3.68,
      accredited: true,
      notes: "Serves Remo North area",
      specialtyNames: ["General Surgery", "Paediatrics", "Obstetrics & Gynaecology", "Internal Medicine"],
    },
    {
      name: "General Hospital Iperu",
      slug: "general-hospital-iperu",
      address: "Iperu",
      city: "Iperu",
      latitude: 6.91,
      longitude: 3.67,
      accredited: true,
      notes: "Community general hospital",
      specialtyNames: ["General Surgery", "Paediatrics", "Obstetrics & Gynaecology", "Internal Medicine"],
    },
    {
      name: "Olikoye Ransome-Kuti Memorial Hospital",
      slug: "olikoye-ransome-kuti",
      address: "Asero, Abeokuta",
      city: "Abeokuta",
      latitude: 7.16,
      longitude: 3.36,
      accredited: true,
      notes: "Memorial hospital in Asero",
      specialtyNames: ["General Surgery", "Paediatrics", "Obstetrics & Gynaecology", "Internal Medicine"],
    },
    {
      name: "Oba Ademola Maternity Hospital",
      slug: "oba-ademola-maternity",
      address: "Ijemo, Abeokuta",
      city: "Abeokuta",
      latitude: 7.15,
      longitude: 3.34,
      accredited: true,
      notes: "Specialized maternity hospital",
      specialtyNames: ["Obstetrics & Gynaecology", "Paediatrics"],
    },
    {
      name: "Angel & Eagle Specialist Hospital",
      slug: "angel-eagle-abeokuta",
      address: "9B Sikiru Jimoh Road, GRA Ibara, Abeokuta",
      city: "Abeokuta",
      latitude: 7.145,
      longitude: 3.35,
      accredited: false,
      notes: "Private multi-specialty hospital",
      specialtyNames: ["General Surgery", "Internal Medicine", "Paediatrics"],
    },
    {
      name: "Beachland Specialist Hospital",
      slug: "beachland-arepo",
      address: "16 Al-Firdaus Estate, Arepo, Off Lagos-Ibadan Expressway",
      city: "Arepo",
      latitude: 6.75,
      longitude: 3.45,
      accredited: false,
      notes: "Private specialist hospital",
      specialtyNames: ["General Surgery", "Internal Medicine", "Paediatrics"],
    },
    {
      name: "St. Luke Specialist Hospital",
      slug: "st-luke-ijebu-ode",
      address: "13 Prince Ademola Dada Drive, Off Molipa Express, Ijebu-Ode",
      city: "Ijebu-Ode",
      latitude: 6.82,
      longitude: 3.92,
      accredited: false,
      notes: "Private specialist hospital",
      specialtyNames: ["General Surgery", "Internal Medicine"],
    },
    {
      name: "Faith Specialist Hospital",
      slug: "faith-specialist-ota",
      address: "Idiroko Road, Ota Ogun State Housing Estate",
      city: "Ota",
      latitude: 6.69,
      longitude: 3.23,
      accredited: false,
      notes: "Strong in orthopaedic care",
      specialtyNames: ["Orthopaedics", "General Surgery", "Internal Medicine"],
    },
  ];

  for (const facility of facilities) {
    const { specialtyNames, ...facilityData } = facility;

    const created = await prisma.facility.upsert({
      where: { slug: facility.slug },
      update: {
        name: facilityData.name,
        address: facilityData.address,
        city: facilityData.city,
        latitude: facilityData.latitude,
        longitude: facilityData.longitude,
        accredited: facilityData.accredited,
        notes: facilityData.notes,
      },
      create: {
        ...facilityData,
        state: "Ogun",
        country: "Nigeria",
      },
    });

    // Link specialties
    for (const specialtyName of specialtyNames) {
      const specialtyId = specialties[specialtyName];
      if (!specialtyId) continue;

      await prisma.facilitySpecialty.upsert({
        where: {
          facilityId_specialtyId: {
            facilityId: created.id,
            specialtyId,
          },
        },
        update: {},
        create: {
          facilityId: created.id,
          specialtyId,
        },
      });
    }
  }

  console.log("✅ Facilities created and linked to specialties");
  console.log("🎉 Seed completed successfully!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
