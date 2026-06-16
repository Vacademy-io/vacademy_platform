import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import SimplePDFViewer from "@/components/common/simple-pdf-viewer";
import { DashboardLoader } from "@/components/core/dashboard-loader";

interface EvaluatedReportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pdfUrl: string | null;
  remark?: string | null;
  title?: string;
}

/**
 * In-app viewer for an evaluated / submitted answer PDF. Renders the PDF with
 * the react-pdf viewer (zoom, page nav) and, when provided, shows the teacher's
 * remark above it — so the learner sees both on one screen instead of opening a
 * new browser tab.
 */
export function EvaluatedReportDialog({
  open,
  onOpenChange,
  pdfUrl,
  remark,
  title,
}: EvaluatedReportDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="flex max-w-5xl flex-col gap-0 overflow-hidden p-0"
        style={{ /* design-lint-ignore: viewport-relative height for the in-app PDF viewer */ height: "90vh" }}
      >
        <DialogHeader className="shrink-0 border-b border-neutral-200 px-4 py-3">
          <DialogTitle className="text-base font-semibold">
            {title || "Evaluated answer"}
          </DialogTitle>
        </DialogHeader>

        {remark && remark.trim().length > 0 && (
          <div className="shrink-0 border-b border-primary-100 bg-primary-50 px-4 py-3">
            <p className="text-2xs font-semibold uppercase tracking-wide text-primary-500">
              Evaluator remark
            </p>
            <p className="mt-1 whitespace-pre-line text-sm text-neutral-700">
              {remark}
            </p>
          </div>
        )}

        <div className="min-h-0 flex-1 bg-neutral-100">
          {pdfUrl ? (
            <SimplePDFViewer pdfUrl={pdfUrl} />
          ) : (
            <div className="flex h-full items-center justify-center">
              <DashboardLoader />
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default EvaluatedReportDialog;
