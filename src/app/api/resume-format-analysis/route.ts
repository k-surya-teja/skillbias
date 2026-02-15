import { NextResponse } from "next/server";
import {
  analyzeLayoutWithFastApi,
  generateRecruiterFormattingFeedback,
} from "@/lib/resume-format-analysis";

export async function POST(request: Request) {
  try {
    const groqApiKey = process.env.GROQ_API_KEY;
    if (!groqApiKey) {
      return NextResponse.json(
        {
          ok: false,
          message: "Server is not configured. Set GROQ_API_KEY.",
        },
        { status: 500 },
      );
    }

    const formData = await request.formData();
    const resumeFileValue = formData.get("resumeFile");
    const userPromptValue = formData.get("userPrompt");
    const userPrompt = typeof userPromptValue === "string" ? userPromptValue.trim() : "";

    if (!(resumeFileValue instanceof File) || resumeFileValue.size === 0) {
      return NextResponse.json(
        {
          ok: false,
          message: "Upload a PDF resume using field name `resumeFile`.",
        },
        { status: 400 },
      );
    }

    const fileName = resumeFileValue.name || "resume.pdf";
    if (!fileName.toLowerCase().endsWith(".pdf")) {
      return NextResponse.json(
        {
          ok: false,
          message: "Formatting analysis currently supports PDF files only.",
        },
        { status: 400 },
      );
    }

    const fileBuffer = Buffer.from(await resumeFileValue.arrayBuffer());
    const layout = await analyzeLayoutWithFastApi({
      fileName,
      buffer: fileBuffer,
    });

    const feedback = await generateRecruiterFormattingFeedback({
      groqApiKey,
      layout,
      contextPrompt: userPrompt,
    });

    return NextResponse.json({
      ok: true,
      message: "Resume formatting analysis generated successfully.",
      data: {
        fileName,
        submittedAt: new Date().toISOString(),
        layout,
        feedback,
      },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to process formatting analysis.";
    return NextResponse.json(
      {
        ok: false,
        message,
      },
      { status: 500 },
    );
  }
}

