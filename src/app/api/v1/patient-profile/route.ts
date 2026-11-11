import { NextRequest, NextResponse } from "next/server";
import { checkApiKey } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { uploadImageFromBase64, STORAGE_CONSENT_NOTICE } from "@/lib/storage";

/**
 * POST /api/v1/patient-profile
 *
 * Create or update a patient profile.
 * No login required — the profile is identified by email or phone.
 * All fields are optional except at least one of: email, phone.
 *
 * If a passport photo is included (base64), it is uploaded to iDrive E2.
 * The patient must have consented (consentToDataRetention: true) for
 * the profile to be persisted. Without consent, the endpoint returns
 * the profile data without saving it.
 */
export async function POST(req: NextRequest) {
  const authError = await checkApiKey(req);
  if (authError) return authError;

  try {
    const body = await req.json();

    const {
      // Identity
      firstName,
      lastName,
      email,
      phone,
      dateOfBirth,
      gender,
      address,
      city,
      state,
      country,

      // Passport photo (optional — base64 data URL)
      passportPhotoBase64,

      // Medical context
      bloodGroup,
      knownAllergies,
      existingConditions,
      currentMedications,
      previousSurgeries,
      emergencyContact,
      emergencyPhone,

      // Consent — REQUIRED to save
      consentToDataRetention,
      consentToContactByEmail,
    } = body;

    // Must have at least email or phone
    if (!email && !phone) {
      return NextResponse.json(
        {
          status: "error",
          message: "At least one of email or phone is required.",
        },
        { status: 400 }
      );
    }

    // Without explicit consent, don't save — return a dry-run response
    if (!consentToDataRetention) {
      return NextResponse.json({
        status: "success",
        data: {
          saved: false,
          reason: "Profile not saved — user has not consented to data retention.",
          consentNotice: STORAGE_CONSENT_NOTICE,
          message:
            "To save your profile and enable report tracking, set consentToDataRetention: true.",
        },
      });
    }

    // Handle passport photo upload
    let passportPhotoKey: string | null = null;
    let passportPhotoUrl: string | null = null;

    if (passportPhotoBase64) {
      try {
        const uploaded = await uploadImageFromBase64(
          passportPhotoBase64,
          "analysis", // using "analysis" folder — could add "profiles" folder later
          `passport-${email ?? phone}`
        );
        passportPhotoKey = uploaded.key;
        passportPhotoUrl = uploaded.url;
      } catch (uploadErr) {
        console.error("[patient-profile] photo upload failed:", uploadErr);
        // Non-fatal — continue without photo
      }
    }

    // Upsert by email (preferred) or phone
    const whereClause = email ? { email } : { phone: phone as string };

    // Check if profile exists to decide create vs update
    const existing = await prisma.patientProfile.findFirst({
      where: whereClause,
    });

    const profileData = {
      firstName: firstName ?? null,
      lastName: lastName ?? null,
      email: email ?? null,
      phone: phone ?? null,
      dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : null,
      gender: gender ?? null,
      address: address ?? null,
      city: city ?? null,
      state: state ?? null,
      country: country ?? "Nigeria",
      bloodGroup: bloodGroup ?? null,
      knownAllergies: knownAllergies ?? [],
      existingConditions: existingConditions ?? [],
      currentMedications: currentMedications ?? [],
      previousSurgeries: previousSurgeries ?? [],
      emergencyContact: emergencyContact ?? null,
      emergencyPhone: emergencyPhone ?? null,
      consentToDataRetention: true,
      consentToContactByEmail: consentToContactByEmail ?? false,
      consentDate: new Date(),
      ...(passportPhotoKey ? { passportPhotoKey, passportPhotoUrl } : {}),
    };

    let profile;
    if (existing) {
      profile = await prisma.patientProfile.update({
        where: { id: existing.id },
        data: profileData,
      });
    } else {
      profile = await prisma.patientProfile.create({ data: profileData });
    }

    return NextResponse.json(
      {
        status: "success",
        data: {
          saved: true,
          id: profile.id,
          message: "Profile saved. You can link this profile to diagnosis reports using the profile ID.",
          consentNotice: STORAGE_CONSENT_NOTICE,
          hasPhoto: !!passportPhotoKey,
        },
      },
      { status: existing ? 200 : 201 }
    );
  } catch (err) {
    console.error("[POST /api/v1/patient-profile]", err);
    return NextResponse.json(
      { status: "error", message: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/v1/patient-profile?email=...  OR  ?phone=...
 *
 * Look up a patient profile by email or phone.
 * Returns the profile ID which can then be used to link to reports.
 */
export async function GET(req: NextRequest) {
  const authError = await checkApiKey(req);
  if (authError) return authError;

  const { searchParams } = req.nextUrl;
  const email = searchParams.get("email");
  const phone = searchParams.get("phone");
  const profileId = searchParams.get("id");

  if (!email && !phone && !profileId) {
    return NextResponse.json(
      { status: "error", message: "Provide email, phone, or id as query parameter." },
      { status: 400 }
    );
  }

  try {
    const profile = await prisma.patientProfile.findFirst({
      where: profileId
        ? { id: profileId }
        : email
        ? { email }
        : { phone: phone as string },
      include: {
        reports: {
          select: {
            trackingId: true,
            primaryConditionName: true,
            urgencyLevel: true,
            createdAt: true,
            status: true,
          },
          orderBy: { createdAt: "desc" },
          take: 10,
        },
      },
    });

    if (!profile) {
      return NextResponse.json(
        { status: "error", code: "PROFILE_NOT_FOUND", message: "No profile found." },
        { status: 404 }
      );
    }

    // Return profile — omit passportPhotoKey (internal storage key)
    const { passportPhotoKey: _key, passwordHash: _pw, ...safeProfile } = profile as typeof profile & { passwordHash?: string };

    return NextResponse.json({
      status: "success",
      data: {
        ...safeProfile,
        reportCount: profile.reports.length,
      },
    });
  } catch (err) {
    console.error("[GET /api/v1/patient-profile]", err);
    return NextResponse.json(
      { status: "error", message: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization, X-API-Key, X-Hospital-Token",
    },
  });
}
