import { useRef, useState, type RefObject } from 'react';

export interface UseExportPagesToPdfOptions {
    /**
     * Ref to a container holding `.page`-class A4 divs (e.g. the output of
     * <PrintablePaperPages />). Each child .page is captured and added as a
     * single PDF page.
     */
    pagesContainerRef: RefObject<HTMLElement | null>;
    /** Filename including .pdf extension. */
    filename: string;
}

/**
 * html2canvas + jsPDF capture pipeline, lazy-loaded so the libs don't bloat
 * the main bundle. Mirrors the logic in ExportHandlerQuestionPaper but
 * decoupled from question-papers-specific UI so any flow can render its
 * pages and call exportToPdf().
 */
export function useExportPagesToPdf({
    pagesContainerRef,
    filename,
}: UseExportPagesToPdfOptions) {
    const [exporting, setExporting] = useState(false);
    const [progress, setProgress] = useState(0);
    const cancelRef = useRef<{ cancel: boolean }>({ cancel: false });

    const optimizeImage = (canvas: HTMLCanvasElement): string => {
        const optimized = document.createElement('canvas');
        const ctx = optimized.getContext('2d');
        // A4 at ~200 DPI — same target as ExportHandlerQuestionPaper.
        optimized.width = 1654;
        optimized.height = 2339;
        if (ctx) {
            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = 'high';
            ctx.drawImage(
                canvas,
                0,
                0,
                canvas.width,
                canvas.height,
                0,
                0,
                optimized.width,
                optimized.height
            );
        }
        return optimized.toDataURL('image/jpeg', 0.8);
    };

    const exportToPdf = async (): Promise<void> => {
        if (!pagesContainerRef.current) return;

        setExporting(true);
        setProgress(0);
        cancelRef.current.cancel = false;

        try {
            const { default: jsPDF } = await import('jspdf');
            const pdf = new jsPDF({
                orientation: 'portrait',
                unit: 'mm',
                format: 'a4',
                compress: true,
            });

            const pageEls = Array.from(
                pagesContainerRef.current.querySelectorAll<HTMLElement>('.page')
            );
            const total = pageEls.length;
            if (total === 0) {
                throw new Error('Nothing to export — no .page elements found.');
            }

            const { default: html2canvas } = await import('html2canvas');

            for (let i = 0; i < pageEls.length; i++) {
                if (cancelRef.current.cancel) {
                    throw new Error('PDF generation cancelled');
                }

                const el = pageEls[i]!;
                // Temporarily hoist the page on-screen so html2canvas captures
                // the actual painted layout rather than the off-screen wrapper.
                const prev = {
                    position: el.style.position,
                    top: el.style.top,
                    left: el.style.left,
                    padding: el.style.padding,
                    visibility: el.style.visibility,
                    width: el.style.width,
                    height: el.style.height,
                    backgroundColor: el.style.backgroundColor,
                };
                el.style.position = 'fixed';
                el.style.top = '0';
                el.style.left = '0';
                el.style.padding = '40px';
                el.style.visibility = 'visible';
                el.style.width = '210mm';
                el.style.height = '297mm';
                el.style.backgroundColor = 'white';

                await new Promise((r) => setTimeout(r, 100));

                const canvas = await html2canvas(el, {
                    scale: 1.5,
                    allowTaint: true,
                    useCORS: true,
                    backgroundColor: 'white',
                    width: el.offsetWidth,
                    height: el.offsetHeight,
                    windowWidth: el.offsetWidth,
                    windowHeight: el.offsetHeight,
                });

                const imgData = optimizeImage(canvas);

                if (i > 0) pdf.addPage();

                pdf.addImage({
                    imageData: imgData,
                    format: 'JPEG',
                    x: 0,
                    y: 0,
                    width: pdf.internal.pageSize.getWidth(),
                    height: pdf.internal.pageSize.getHeight(),
                    compression: 'FAST',
                    rotation: 0,
                });

                Object.assign(el.style, prev);
                setProgress(Math.round(((i + 1) / total) * 100));
            }

            const datauri = pdf.output('datauristring');
            const blob = await fetch(datauri).then((r) => r.blob());
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = filename;
            link.click();
            URL.revokeObjectURL(url);
        } finally {
            setExporting(false);
            setTimeout(() => setProgress(0), 1000);
        }
    };

    const cancelExport = () => {
        cancelRef.current.cancel = true;
    };

    return { exporting, progress, exportToPdf, cancelExport };
}
