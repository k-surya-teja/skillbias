import { NextResponse } from "next/server";
import {
  analyzeResumeVisual,
  ResumeVisualAnalysisError,
} from "@/lib/resume-visual/analyzeResume";

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const fileValue = formData.get("resumeFile") ?? formData.get("file");

    if (!(fileValue instanceof File) || fileValue.size === 0) {
      return NextResponse.json(
        {
          ok: false,
          message: "Upload a resume file using field name `resumeFile`.",
        },
        { status: 400 },
      );
    }

    const buffer = Buffer.from(await fileValue.arrayBuffer());
    const result = await analyzeResumeVisual({
      fileName: fileValue.name || "resume.pdf",
      mimeType: fileValue.type || "",
      buffer,
    });

    return NextResponse.json({
      ok: true,
      message: "Resume visual analysis generated successfully.",
      data: {
        submittedAt: new Date().toISOString(),
        fileName: fileValue.name || null,
        provider: result.provider,
        sourceType: result.metadata.sourceType,
        pageCount: result.metadata.pageCount,
        usedMock: result.metadata.usedMock,
        analysis: result.analysis,
      },
    });
  } catch (error) {
    if (error instanceof ResumeVisualAnalysisError) {
      return NextResponse.json(
        {
          ok: false,
          message: error.message,
        },
        { status: error.status },
      );
    }

    const message =
      error instanceof Error
        ? error.message
        : "Unable to process visual resume analysis request.";

    return NextResponse.json(
      {
        ok: false,
        message,
      },
      { status: 500 },
    );
  }
}
