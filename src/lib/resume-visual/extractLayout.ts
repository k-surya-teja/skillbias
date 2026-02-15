export type ResumeLayoutPageMeta = {
  pageNumber: number;
  width: number;
  height: number;
  avgFontSize: number;
  largestFontSize: number;
  estimatedColumns: 1 | 2;
  bulletLineCount: number;
  sectionHeaderCandidates: string[];
  avgVerticalGap: number;
  leftAlignmentVariance: number;
};

export type ResumeLayoutMetadata = {
  pageCount: number;
  global: {
    estimatedColumns: 1 | 2;
    dominantFontSize: number;
    largestFontSize: number;
    bulletDensity: number;
    avgVerticalGap: number;
    leftAlignmentVariance: number;
    sectionHeaders: string[];
  };
  pages: ResumeLayoutPageMeta[];
};

type PdfTextLine = {
  text: string;
  x: number;
  y: number;
  fontSize: number;
};

function median(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }

  const sorted = [...values].sort((a, b) => a - b);
  const midpoint = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return (sorted[midpoint - 1] + sorted[midpoint]) / 2;
  }

  return sorted[midpoint];
}

function average(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }

  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function variance(values: number[]): number {
  if (values.length <= 1) {
    return 0;
  }

  const avg = average(values);
  return average(values.map((value) => (value - avg) ** 2));
}

function extractFontSizeFromTransform(transform: unknown): number {
  if (!Array.isArray(transform) || transform.length < 4) {
    return 0;
  }

  const a = Number(transform[0]) || 0;
  const b = Number(transform[1]) || 0;
  const c = Number(transform[2]) || 0;
  const d = Number(transform[3]) || 0;

  const scaleX = Math.hypot(a, b);
  const scaleY = Math.hypot(c, d);
  const size = Math.max(scaleX, scaleY);

  return Number.isFinite(size) ? size : 0;
}

function isLikelySectionHeader(text: string, fontSize: number, medianSize: number) {
  const normalized = text.trim();
  if (!normalized) {
    return false;
  }

  const shortEnough = normalized.length <= 60;
  const headerCasePattern =
    /^[A-Z][A-Za-z\s&/-]{2,}$/.test(normalized) ||
    /^[A-Z\s]{4,}$/.test(normalized) ||
    /:$/.test(normalized);
  const fontIsProminent = fontSize >= medianSize * 1.12;

  return shortEnough && headerCasePattern && fontIsProminent;
}

function normalizeHeaderText(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

export async function extractLayoutFromPdf(
  pdfBuffer: Buffer,
): Promise<ResumeLayoutMetadata> {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const loadingTask = pdfjs.getDocument({
    data: new Uint8Array(pdfBuffer),
    useWorkerFetch: false,
    isEvalSupported: false,
    disableWorker: true,
  });
  const pdfDocument = await loadingTask.promise;
  const pages: ResumeLayoutPageMeta[] = [];
  const allFonts: number[] = [];
  const allHeaders: string[] = [];
  let totalBulletLines = 0;
  let totalLines = 0;

  for (let pageNumber = 1; pageNumber <= pdfDocument.numPages; pageNumber += 1) {
    const page = await pdfDocument.getPage(pageNumber);
    const viewport = page.getViewport({ scale: 1 });
    const textContent = await page.getTextContent();

    const lines: PdfTextLine[] = textContent.items
      .map((item) => {
        if (typeof item !== "object" || item === null) {
          return null;
        }

        const candidate = item as {
          str?: unknown;
          transform?: unknown;
        };

        if (typeof candidate.str !== "string" || !candidate.str.trim()) {
          return null;
        }

        const transformArray = Array.isArray(candidate.transform)
          ? candidate.transform
          : [];

        return {
          text: candidate.str.trim(),
          x: Number(transformArray[4]) || 0,
          y: Number(transformArray[5]) || 0,
          fontSize: extractFontSizeFromTransform(candidate.transform),
        };
      })
      .filter((line): line is PdfTextLine => Boolean(line));

    const fonts = lines.map((line) => line.fontSize).filter((size) => size > 0);
    const medianFont = median(fonts) || 11;
    const largestFont = fonts.length > 0 ? Math.max(...fonts) : medianFont;

    const sectionHeaderCandidates = lines
      .filter((line) => isLikelySectionHeader(line.text, line.fontSize, medianFont))
      .map((line) => normalizeHeaderText(line.text));

    const bulletLines = lines.filter((line) =>
      /^([•\-*]|\d+[.)])\s+/.test(line.text),
    ).length;

    const ySorted = [...lines].sort((a, b) => b.y - a.y);
    const yGaps: number[] = [];
    for (let index = 1; index < ySorted.length; index += 1) {
      const gap = Math.abs(ySorted[index - 1].y - ySorted[index].y);
      if (gap > 0.1 && gap < viewport.height * 0.25) {
        yGaps.push(gap);
      }
    }

    const leftEdges = lines.map((line) => line.x);
    const leftEdgeVariance = variance(leftEdges);

    const rightHalfStarts = lines.filter(
      (line) => line.x > viewport.width * 0.52,
    ).length;
    const leftHalfStarts = lines.length - rightHalfStarts;
    const estimatedColumns: 1 | 2 =
      rightHalfStarts > 10 && leftHalfStarts > 10 ? 2 : 1;

    pages.push({
      pageNumber,
      width: viewport.width,
      height: viewport.height,
      avgFontSize: Number(average(fonts).toFixed(2)),
      largestFontSize: Number(largestFont.toFixed(2)),
      estimatedColumns,
      bulletLineCount: bulletLines,
      sectionHeaderCandidates,
      avgVerticalGap: Number(average(yGaps).toFixed(2)),
      leftAlignmentVariance: Number(leftEdgeVariance.toFixed(2)),
    });

    allFonts.push(...fonts);
    allHeaders.push(...sectionHeaderCandidates);
    totalBulletLines += bulletLines;
    totalLines += lines.length;
  }

  const distinctHeaders = [...new Set(allHeaders)].slice(0, 20);
  const estimatedColumns: 1 | 2 = pages.some((page) => page.estimatedColumns === 2)
    ? 2
    : 1;

  return {
    pageCount: pdfDocument.numPages,
    global: {
      estimatedColumns,
      dominantFontSize: Number(median(allFonts).toFixed(2)),
      largestFontSize: Number((allFonts.length > 0 ? Math.max(...allFonts) : 0).toFixed(2)),
      bulletDensity:
        totalLines > 0 ? Number((totalBulletLines / totalLines).toFixed(4)) : 0,
      avgVerticalGap: Number(average(pages.map((page) => page.avgVerticalGap)).toFixed(2)),
      leftAlignmentVariance: Number(
        average(pages.map((page) => page.leftAlignmentVariance)).toFixed(2),
      ),
      sectionHeaders: distinctHeaders,
    },
    pages,
  };
}
