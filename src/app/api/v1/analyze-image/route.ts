import { NextRequest, NextResponse } from "next/server";
import { checkApiKey } from "@/lib/api-auth";
import { callGeminiImageAnalysis, GeminiAIError } from "@/lib/ai-matching";
import { uploadImageFromBase64, STORAGE_CONSENT_NOTICE } from "@/lib/storage";
import crypto from "node:crypto";

// ─── Types ────────────────────────────────────────────────────────────────────

interface AnalyzeImageRequestBody {
  imageBase64: string;
  imageType: "ear" | "nose" | "throat" | "general";
  additionalContext?: string;
}

// ─── Route ────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest): Promise<NextResponse> {
  const authError = await checkApiKey(req);
  if (authError) return authError;

  try {
    const body: AnalyzeImageRequestBody = await req.json();
    const { imageBase64, imageType, additionalContext } = body;

    // Validate required fields
    if (!imageBase64 || typeof imageBase64 !== "string") {
      return NextResponse.json(
        { status: "error", message: "imageBase64 is required.", code: "MISSING_IMAGE" },
        { status: 400 }
      );
    }

    if (!imageType || !["ear", "nose", "throat", "general"].includes(imageType)) {
      return NextResponse.json(
        {
          status: "error",
          message: "imageType is required and must be one of: ear, nose, throat, general.",
          code: "INVALID_IMAGE_TYPE",
        },
        { status: 400 }
      );
    }

    // Strip data URL prefix (e.g. "data:image/jpeg;base64,") for validation
    const stripped = imageBase64.replace(/^data:image\/[a-zA-Z+]+;base64,/, "");

    // Validate base64 characters
    if (!/^[A-Za-z0-9+/]+=*$/.test(stripped)) {
      return NextResponse.json(
        { status: "error", message: "imageBase64 contains invalid characters.", code: "INVALID_BASE64" },
        { status: 400 }
      );
    }

    // Check decoded size — reject if > 4 MB
    if (Buffer.from(stripped, "base64").length > 4 * 1024 * 1024) {
      return NextResponse.json(
        { status: "error", message: "Image exceeds the 4 MB size limit.", code: "IMAGE_TOO_LARGE" },
        { status: 413 }
      );
    }

    // Generate referenceId early so it can be used in both storage and response
    const referenceId = "img_" + crypto.randomBytes(8).toString("hex");

    // Call Gemini image analysis
    let result;
    try {
      result = await callGeminiImageAnalysis(stripped, imageType, additionalContext);
    } catch (error) {
      if (error instanceof GeminiAIError) {
        if (error.code === "AI_QUOTA_EXCEEDED") {
          return NextResponse.json(
            {
              status: "error",
              message: error.message,
              code: error.code,
            },
            { status: 429 }
          );
        }
        return NextResponse.json(
          {
            status: "error",
            message: error.message,
            code: "IMAGE_ANALYSIS_FAILED",
          },
          { status: 500 }
        );
      }
      throw error; // re-throw unexpected errors to outer catch
    }

    // Persist the image to iDrive E2 storage (non-fatal — do not fail the request)
    // uploadImageFromBase64 expects the original value (with or without the data URL prefix).
    // If the caller sent a raw base64 string (no prefix), reconstruct a minimal data URL
    // so the storage lib can parse the mime type.
    let storedImageKey: string | null = null;
    let storageNote: string | undefined;

    try {
      // If imageBase64 already has a data URL prefix, pass it as-is.
      // Otherwise prepend a generic JPEG prefix so storage.ts can parse it.
      const uploadPayload = imageBase64.startsWith("data:")
        ? imageBase64
        : `data:image/jpeg;base64,${stripped}`;

      const uploaded = await uploadImageFromBase64(uploadPayload, "analysis", referenceId);
      storedImageKey = uploaded.key;
    } catch (storageErr) {
      console.error("[/api/v1/analyze-image] storage upload failed:", storageErr);
      storageNote = "Image analysis completed but image could not be persisted to storage.";
    }

    return NextResponse.json({
      status: "success",
      data: {
        imageType,
        analysis: {
          findings: result.findings,
          possibleConditions: result.possibleConditions,
          urgencyScore: result.urgencyScore,
          nextSteps: result.nextSteps,
          specialistReviewNeeded: result.specialistReviewNeeded,
        },
        disclaimer: result.disclaimer,
        consentNotice: STORAGE_CONSENT_NOTICE,
        storedImageKey,
        ...(storageNote ? { storageNote } : {}),
        referenceId,
        processedAt: new Date().toISOString(),
      },
    });
  } catch (err) {
    console.error("[/api/v1/analyze-image]", err);
    return NextResponse.json(
      { status: "error", message: "Internal server error" },
      { status: 500 }
    );
  }
}

// ─── CORS preflight ───────────────────────────────────────────────────────────

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization, X-API-Key",
    },
  });
}
