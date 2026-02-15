export type ResumeTextExtractionPage = {
  pageNumber: number;
  text: string;
};

export type ResumeTextExtractionResult = {
  combinedText: string;
  pages: ResumeTextExtractionPage[];
};

function normalizePageText(value: string): string {
  return value
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export async function extractTextFromPdf(
  pdfBuffer: Buffer,
): Promise<ResumeTextExtractionResult> {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const loadingTask = pdfjs.getDocument({
    data: new Uint8Array(pdfBuffer),
    useWorkerFetch: false,
    isEvalSupported: false,
    disableWorker: true,
  });
  const pdfDocument = await loadingTask.promise;
  const pages: ResumeTextExtractionPage[] = [];

  for (let pageNumber = 1; pageNumber <= pdfDocument.numPages; pageNumber += 1) {
    const page = await pdfDocument.getPage(pageNumber);
    const textContent = await page.getTextContent();
    const pageText = textContent.items
      .map((item) => {
        if (typeof item !== "object" || item === null || !("str" in item)) {
          return "";
        }

        const maybeText = (item as { str?: unknown }).str;
        return typeof maybeText === "string" ? maybeText : "";
      })
      .join("\n");

    pages.push({
      pageNumber,
      text: normalizePageText(pageText),
    });
  }

  return {
    combinedText: pages.map((page) => page.text).filter(Boolean).join("\n\n"),
    pages,
  };
}
