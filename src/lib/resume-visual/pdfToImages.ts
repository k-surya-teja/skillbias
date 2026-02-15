import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export type ResumePageImage = {
  pageNumber: number;
  mimeType: "image/png";
  dataBase64: string;
};

export type PdfToImagesResult = {
  pages: ResumePageImage[];
};

type PdfToImagesOptions = {
  maxPages?: number;
  dpi?: number;
};

async function assertBinaryInstalled(binaryName: string): Promise<void> {
  try {
    await execFileAsync("which", [binaryName]);
  } catch {
    throw new Error(
      `${binaryName} is not installed. Install poppler (pdftoppm) to enable visual page rendering.`,
    );
  }
}

export async function convertPdfToImages(
  pdfBuffer: Buffer,
  options: PdfToImagesOptions = {},
): Promise<PdfToImagesResult> {
  const dpi = options.dpi ?? 144;
  const maxPages = options.maxPages ?? 3;

  await assertBinaryInstalled("pdftoppm");

  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "resume-visual-img-"));
  const inputPdfPath = path.join(tempDir, "resume.pdf");
  const outputPrefix = path.join(tempDir, "page");

  try {
    await fs.writeFile(inputPdfPath, pdfBuffer);
    await execFileAsync("pdftoppm", [
      "-png",
      "-r",
      String(dpi),
      inputPdfPath,
      outputPrefix,
    ]);

    const files = await fs.readdir(tempDir);
    const pageFiles = files
      .filter((file) => /^page-\d+\.png$/i.test(file))
      .sort((a, b) => {
        const aPage = Number(a.match(/(\d+)/)?.[1] ?? 0);
        const bPage = Number(b.match(/(\d+)/)?.[1] ?? 0);
        return aPage - bPage;
      })
      .slice(0, Math.max(1, maxPages));

    if (pageFiles.length === 0) {
      throw new Error("No PDF pages were rendered into images.");
    }

    const pages: ResumePageImage[] = [];

    for (const fileName of pageFiles) {
      const pageNumber = Number(fileName.match(/(\d+)/)?.[1] ?? 0);
      const imageBuffer = await fs.readFile(path.join(tempDir, fileName));
      pages.push({
        pageNumber,
        mimeType: "image/png",
        dataBase64: imageBuffer.toString("base64"),
      });
    }

    return { pages };
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true });
  }
}
