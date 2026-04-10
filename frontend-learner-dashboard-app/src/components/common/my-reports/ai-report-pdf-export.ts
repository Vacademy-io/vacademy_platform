import html2canvas from "html2canvas";
import jsPDF from "jspdf";

interface ConceptualGap {
  concept: string;
  evidence: string;
  suggestion: string;
}

interface ExportOptions {
  assessmentId: string;
  assessmentName: string;
  conceptualGaps?: ConceptualGap[];
}

/**
 * Generate a presentable PDF from the AI report DOM element.
 *
 * Strategy:
 * 1. Deep-clone the visible report container (live UI is untouched).
 * 2. Replace problematic interactive sections (accordion, flashcards)
 *    with plain HTML built from the data.
 * 3. Place off-screen at fixed 800px width (screen-size independent).
 * 4. Capture via html2canvas → paginate into A4 via jsPDF.
 */
export async function generateReportPdf(
  containerEl: HTMLElement,
  options: ExportOptions
): Promise<void> {
  const { assessmentId, conceptualGaps } = options;

  // ── 1. Clone the container ──
  const clone = containerEl.cloneNode(true) as HTMLElement;

  // ── 2. Prepare the clone ──
  prepareCloneForPdf(clone, conceptualGaps);

  // ── 3. Mount off-screen with fixed width ──
  // Use 1000px to give md: breakpoints (768px) plenty of room with padding
  const CAPTURE_WIDTH = 1000;
  const wrapper = document.createElement("div");
  wrapper.style.position = "absolute";
  wrapper.style.top = "-9999px";
  wrapper.style.left = "-9999px";
  wrapper.style.width = `${CAPTURE_WIDTH}px`;
  wrapper.style.minWidth = `${CAPTURE_WIDTH}px`;
  wrapper.style.backgroundColor = "#ffffff";
  wrapper.style.padding = "40px";
  wrapper.style.boxSizing = "border-box";
  wrapper.style.fontFamily =
    '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  wrapper.style.fontSize = "16px";
  wrapper.style.lineHeight = "1.6";
  wrapper.appendChild(clone);
  document.body.appendChild(wrapper);

  try {
    // Let layout settle (images, SVG charts, fonts)
    await new Promise((r) => setTimeout(r, 800));

    // ── 5. Capture with html2canvas ──
    // Let html2canvas measure the natural dimensions from the wrapper
    const canvas = await html2canvas(wrapper, {
      scale: 2,
      useCORS: true,
      logging: false,
      backgroundColor: "#ffffff",
      windowWidth: CAPTURE_WIDTH,
    });

    // ── 6. Paginate into A4 PDF ──
    const pdf = new jsPDF({
      orientation: "portrait",
      unit: "mm",
      format: "a4",
      compress: true,
    });

    const pdfWidth = pdf.internal.pageSize.getWidth(); // 210mm
    const pdfHeight = pdf.internal.pageSize.getHeight(); // 297mm
    const margin = 10; // mm
    const usableHeight = pdfHeight - margin * 2;

    // Convert canvas pixels → PDF mm
    const pxPerMm = canvas.width / (pdfWidth - margin * 2);
    const pageHeightPx = usableHeight * pxPerMm;
    const totalPages = Math.ceil(canvas.height / pageHeightPx);

    for (let i = 0; i < totalPages; i++) {
      if (i > 0) pdf.addPage();

      // White background
      pdf.setFillColor(255, 255, 255);
      pdf.rect(0, 0, pdfWidth, pdfHeight, "F");

      // Slice this page from the full canvas
      const sourceY = i * pageHeightPx;
      const sourceH = Math.min(pageHeightPx, canvas.height - sourceY);

      const pageCanvas = document.createElement("canvas");
      pageCanvas.width = canvas.width;
      pageCanvas.height = Math.ceil(pageHeightPx);
      const ctx = pageCanvas.getContext("2d");
      if (ctx) {
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, pageCanvas.width, pageCanvas.height);
        ctx.drawImage(
          canvas,
          0,
          sourceY,
          canvas.width,
          sourceH,
          0,
          0,
          canvas.width,
          sourceH
        );
      }

      const imgData = pageCanvas.toDataURL("image/jpeg", 0.92);
      const imgHeight = sourceH / pxPerMm;

      pdf.addImage(
        imgData,
        "JPEG",
        margin,
        margin,
        pdfWidth - margin * 2,
        imgHeight,
        undefined,
        "FAST"
      );
    }

    pdf.save(`AI_Assessment_Report_${assessmentId}.pdf`);
  } finally {
    if (document.body.contains(wrapper)) {
      document.body.removeChild(wrapper);
    }
  }
}

// ─── Clone Preparation ───

function prepareCloneForPdf(
  clone: HTMLElement,
  conceptualGaps?: ConceptualGap[]
): void {
  // ── Remove interactive elements ──
  clone.querySelectorAll("button").forEach((btn) => btn.remove());
  clone.querySelectorAll("[data-no-print]").forEach((el) => el.remove());

  // ── Replace the accordion-based Conceptual Gaps with a plain HTML version ──
  // Find the accordion container and replace it entirely
  const accordionEl = clone.querySelector('[data-orientation="vertical"]') // Radix accordion root
    || clone.querySelector('[role="region"]')?.closest('[class*="accordion"]');

  if (accordionEl && conceptualGaps && conceptualGaps.length > 0) {
    // Replace the accordion with a static list
    const replacement = buildConceptualGapsStatic(conceptualGaps);
    accordionEl.parentNode?.replaceChild(replacement, accordionEl);
  } else if (accordionEl) {
    // No data to replace with — just remove the broken accordion
    accordionEl.remove();
  }

  // ── Fix responsive classes that don't apply off-screen ──
  const responsiveMap: Record<string, string> = {
    "md\\:grid-cols-2": "1fr 1fr",
    "md\\:grid-cols-3": "repeat(3, 1fr)",
    "md\\:grid-cols-4": "repeat(4, 1fr)",
    "grid-cols-2": "1fr 1fr",
  };
  for (const [cls, val] of Object.entries(responsiveMap)) {
    clone.querySelectorAll(`.${cls}`).forEach((el) => {
      (el as HTMLElement).style.gridTemplateColumns = val;
    });
  }
  clone.querySelectorAll(".md\\:flex-row").forEach((el) => {
    (el as HTMLElement).style.flexDirection = "row";
  });
}

// ─── Conceptual Gaps (static, replaces accordion) ───

function buildConceptualGapsStatic(gaps: ConceptualGap[]): HTMLElement {
  const container = document.createElement("div");

  gaps.forEach((gap, i) => {
    const item = document.createElement("div");
    item.style.borderBottom = i < gaps.length - 1 ? "1px solid #e5e7eb" : "none";
    item.style.padding = "16px 0";

    const title = document.createElement("div");
    title.textContent = gap.concept;
    title.style.fontSize = "16px";
    title.style.fontWeight = "600";
    title.style.color = "#1f2937";
    title.style.marginBottom = "10px";
    item.appendChild(title);

    const evidence = document.createElement("div");
    evidence.style.fontSize = "14px";
    evidence.style.marginBottom = "6px";
    evidence.style.lineHeight = "1.5";
    const evLabel = document.createElement("span");
    evLabel.textContent = "Evidence: ";
    evLabel.style.fontWeight = "600";
    evLabel.style.color = "#dc2626";
    evidence.appendChild(evLabel);
    const evText = document.createElement("span");
    evText.textContent = gap.evidence;
    evText.style.color = "#404040";
    evidence.appendChild(evText);
    item.appendChild(evidence);

    const suggestion = document.createElement("div");
    suggestion.style.fontSize = "14px";
    suggestion.style.lineHeight = "1.5";
    const sugLabel = document.createElement("span");
    sugLabel.textContent = "Suggestion: ";
    sugLabel.style.fontWeight = "600";
    sugLabel.style.color = "#059669";
    suggestion.appendChild(sugLabel);
    const sugText = document.createElement("span");
    sugText.textContent = gap.suggestion;
    sugText.style.color = "#404040";
    suggestion.appendChild(sugText);
    item.appendChild(suggestion);

    container.appendChild(item);
  });

  return container;
}

