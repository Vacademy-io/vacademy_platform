/* eslint-disable */
// @ts-nocheck
import { useState, useEffect, useRef, ChangeEvent, Fragment } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import { Canvas, StaticCanvas } from "fabric";
import {
    UploadSimple as Upload,
    DownloadSimple as Download,
    CaretLeft as ChevronLeft,
    CaretRight as ChevronRight,
    WarningCircle as AlertCircle,
    ArrowsClockwise as RefreshCcw,
    CircleNotch as Loader2,
    Calculator as CalculatorIcon,
    Pen,
    Hash,
    ArrowCounterClockwise as RotateCcw,
    NoteBlank as StickyNote,
} from "@phosphor-icons/react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
    AlertDialog,
    AlertDialogDescription,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MagnifyingGlassMinus, MagnifyingGlassPlus, X, SidebarSimple, ListNumbers, ArrowUUpLeft, ArrowUUpRight, Info, PaperPlaneTilt } from "@phosphor-icons/react";
import { PDFDocument } from "pdf-lib";
// Lazy-load heavy libs where used
import Calculator from "./calculator";
import { Progress } from "@/components/ui/progress";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ColorPicker } from "@/components/ui/color-picker";
import useCanvasTools from "../-hooks/tools";
import useFabric from "../-hooks/canvas";
import Dropzone, { useDropzone } from "react-dropzone";
import ImportFileImage from '@/assets/svgs/import-file.svg';
import { DashboardLoader } from "@/components/core/dashboard-loader";
import { toast } from "sonner";
import { ProgressBar } from "@/components/design-system/progress-bar";
import Evaluation from "./evaluation";
import { useNavigate, useParams, useRouter } from "@tanstack/react-router";
import { useTimerStore } from "@/stores/evaluation/timer-store";
import {
    submitEvlauationMarks,
    releaseEvaluationResult,
    saveEvaluationDraft,
    getEvaluationDraft,
    EvaluationDraftState,
} from "../../evaluations/-services/evaluation-service";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useInstituteQuery } from "@/services/student-list-section/getInstituteDetails";
import { getTokenDecodedData, getTokenFromCookie } from "@/lib/auth/sessionUtility";
import { TokenKey } from "@/constants/auth/tokens";
import { useFileUpload } from "@/hooks/use-file-upload";
import { getPublicUrl } from "@/services/upload_file";
import { cn } from "@/lib/utils";
import { MyButton } from "@/components/design-system/button";
import { MyDialog } from "@/components/design-system/dialog";
import { useMarksStore, feedbackKey } from "@/stores/evaluation/marks-store";
import { LoadingOverlay, UploadingOverlay } from "./Overlay";
import { readEvalReturnUrl, clearEvalReturnUrl } from "../-utils/eval-return";

pdfjs.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.8.69/pdf.worker.mjs`;

// Decode a data: URL (e.g. from canvas.toDataURL) into raw bytes for pdf-lib.
const dataUrlToUint8 = (dataUrl: string): Uint8Array => {
    const base64 = dataUrl.split(",")[1] || "";
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes;
};

// Help text for the tool guide dialog. Tool rows reuse the live `tools` list (so
// icons stay in sync); this keys a short description by the tool's label.
const TOOL_HELP: Record<string, string> = {
    Select: "Select, move or resize any annotation on the page.",
    Pen: "Draw free-hand. Default colour is green; pick another while drawing.",
    Tick: "Stamp a green tick.",
    Cross: "Stamp a red cross.",
    Text: "Add a text comment box.",
    Box: "Draw a rectangle.",
    Circle: "Draw a circle.",
    Delete: "Delete the selected annotation(s).",
};

// The non-tool controls (toolbar actions + the bottom bar).
const CONTROL_HELP = [
    { icon: ListNumbers, label: "Marks number", description: "Insert a numeric mark (0–9, fractions, decimals)." },
    { icon: Upload, label: "Upload", description: "Load an evaluated PDF from your device and continue on it." },
    { icon: Download, label: "Download", description: "Download the annotated answer sheet." },
    { icon: RefreshCcw, label: "Reset", description: "Clear all annotations from every page." },
    { icon: ArrowUUpLeft, label: "Undo", description: "Undo the last change on this page (bottom bar)." },
    { icon: ArrowUUpRight, label: "Redo", description: "Redo the last undone change (bottom bar)." },
    { icon: ChevronLeft, label: "Page navigation", description: "Move to the previous or next page (bottom bar)." },
    { icon: MagnifyingGlassPlus, label: "Zoom", description: "Zoom in, out, or reset to fit (bottom bar)." },
    { icon: PaperPlaneTilt, label: "Submit", description: "Submit the evaluation — marks and feedback are required." },
];

interface PDFEvaluatorProps {
    isFreeTool: boolean;
    file?: File;
    questionData?: any;
    fileId?: string;
    attemptId?: string;
    assessmentId?: string;
    instituteId?: string;
    examType?: string;
    assessmentVisibility?: string;
}

const PDFEvaluator = ({
    isFreeTool = true,
    file,
    fileId,
    questionData,
    assessmentId,
    attemptId,
    instituteId,
    examType,
    assessmentVisibility,
}: PDFEvaluatorProps) => {
    // File states
    const [pdfFile, setPdfFile] = useState<File | null>(file);
    const [pdfUrl, setPdfUrl] = useState<string | null>(null);
    const [error, setError] = useState("");
    const navigate = useNavigate();

    // PDF states
    const [numPages, setNumPages] = useState<number>(0);
    const [pageNumber, setPageNumber] = useState(1);
    const [scale, setScale] = useState(1.0);
    const [pagesVisited, setPagesVisited] = useState<number[]>([]);
    const [docLoaded, setDocLoaded] = useState(false);
    const [prevPageNumber, setPrevPageNumber] = useState(1);
    const [loadingDoc, setLoadingDoc] = useState(true);
    const [progress, setProgress] = useState<number>(0);
    const [uploadingProgress, setUploadingProgress] = useState<number>(0);
    const [dimensions, setDimensions] = useState({
        width: 600,
        height: 800,
    });
    const router = useRouter();
    const { startTimer, stopTimer, currentTime, startTimestamp, setElapsedTime } = useTimerStore();
    const { marksData, resetMarks, feedbackByQuestion, addOrUpdateMark, setQuestionFeedback } =
        useMarksStore();

    // --- Draft (save-for-later) state ---
    // Draft is saved ONLY when the evaluator clicks "Save draft" — no background
    // polling. Keeps the network quiet and gives the user explicit control.
    const [isSavingDraft, setIsSavingDraft] = useState(false);
    // ISO timestamp of the last successful save/restore — powers the "Draft saved …" hint.
    const [draftSavedAt, setDraftSavedAt] = useState<string | null>(null);
    // Prevents overlapping/duplicate draft saves (e.g. double-clicks).
    const savingDraftRef = useRef(false);
    // Ensures we only attempt the one-time draft restore per mount.
    const restoreAttemptedRef = useRef(false);

    // Submit is allowed once the evaluator has awarded at least one mark. Remarks
    // are optional.
    const canSubmit = marksData.length > 0;
    const { uploadFile, isUploading: isUploadingFile } = useFileUpload();
    const [isUploading, setIsUploading] = useState<boolean>(false);
    // Canvas states
    const [fabricCanvas, setFabricCanvas] = useState<Canvas | null>(null);
    const [annotations, setAnnotations] = useState<{ [key: number]: any }>({});
    const canvasUtils = useFabric(fabricCanvas);
    const { tools, numbers } = useCanvasTools(fabricCanvas);

    // Jump to page state
    const [jumpPage, setJumpPage] = useState<number | "">("");

    // Loading state
    const [isLoading, setIsLoading] = useState(false);

    // Zoom state — default to 90% so the full page fits on screen without scrolling.
    const [zoomLevel, setZoomLevel] = useState(0.9);

    // Render the PDF page bitmap at a high pixel density so scanned / handwritten
    // answer sheets stay sharp and legible. The displayed CSS size is unchanged,
    // so the Fabric annotation overlay (sized to the rendered page) stays aligned.
    const renderPixelRatio =
        typeof window !== "undefined" ? Math.max(3, window.devicePixelRatio || 1) : 3;

    // Bound the workspace to the visible viewport so the PDF pane scrolls inside
    // its own area (independent of the page) when zoomed — instead of growing the
    // whole layout. Measured (not a fixed calc) so it adapts to the responsive
    // navbar height and any container padding above it.
    const [workspaceHeight, setWorkspaceHeight] = useState<number | undefined>(() =>
        typeof window !== "undefined" ? window.innerHeight - 72 : undefined,
    );

    // Evaluation panel state — persistent by default so the marks panel fills the
    // workspace instead of leaving a large empty area on the right.
    const [showEvaluationPanel, setShowEvaluationPanel] = useState(true);

    // Refs
    const fileInputRef = useRef<HTMLInputElement | null>(null);
    const canvasRef = useRef(null);
    const canvasContainerRef = useRef<HTMLDivElement | null>(null);
    const pdfViewerRef = useRef<HTMLDivElement | null>(null);
    const toolbarRef = useRef<HTMLDivElement | null>(null);
    const rootRef = useRef<HTMLDivElement | null>(null);

    // Undo / redo history (per page). Stacks hold canvas JSON snapshots; the guard
    // flag prevents programmatic loads (page changes, undo/redo, reset) from being
    // recorded as new user edits.
    const undoStack = useRef<string[]>([]);
    const redoStack = useRef<string[]>([]);
    const isRestoringRef = useRef(false);
    // Set when a new PDF is loaded from the device so the canvas re-measures to the
    // newly-rendered page size on its next render.
    const pendingResizeRef = useRef(false);
    const [canUndo, setCanUndo] = useState(false);
    const [canRedo, setCanRedo] = useState(false);

    const syncHistoryFlags = () => {
        setCanUndo(undoStack.current.length > 1);
        setCanRedo(redoStack.current.length > 0);
    };

    const [openCalc, setOpenCalc] = useState(false);
    const [isToolbarOpen, setIsToolbarOpen] = useState(true);

    const [isSubmitDialogOpen, setIsSubmitDialogOpen] = useState(false);
    const [isResetDialogOpen, setIsResetDialogOpen] = useState(false);
    const [isHelpDialogOpen, setIsHelpDialogOpen] = useState(false);

    const { getRootProps, getInputProps, isDragActive } = useDropzone({
        onDrop: (acceptedFiles) => handleFile(acceptedFiles[0]),
        accept: {
            "application/pdf": [".pdf"],
        },
        maxFiles: 1,
        onDropRejected: (errors) => {
            console.log(errors);
            setError("Invalid file type. Please upload a PDF file.");
        },
    });

    const handleFile = (file: File) => {
        const fileUrl = URL.createObjectURL(file);
        setPdfFile(file);
        setPdfUrl(fileUrl);
        setPageNumber(1);
        setPrevPageNumber(1);
        setNumPages(0);
        setAnnotations({});

        // Start a fresh annotation layer on the uploaded PDF (any marks already
        // baked into the file stay as part of the page image and aren't editable).
        if (fabricCanvas) {
            isRestoringRef.current = true;
            fabricCanvas.clear();
            isRestoringRef.current = false;
            undoStack.current = [JSON.stringify(fabricCanvas.toJSON())];
        } else {
            undoStack.current = [];
        }
        redoStack.current = [];
        syncHistoryFlags();

        // The replacement page may be a different size — re-measure on next render.
        pendingResizeRef.current = true;
    };

    const handleFileInput = (e: ChangeEvent<HTMLInputElement>) => {
        if (typeof e?.target?.files === "undefined" || e.target.files?.length === 0) return;
        // @ts-expect-error : //TODO: fix this
        handleFile(e.target.files[0] as File);
    };

    // Canvas setup — create the Fabric canvas once the <canvas> element + a PDF are
    // available. Crucially, this effect does NOT dispose on dep changes, so loading
    // a different PDF (e.g. a device-uploaded evaluated sheet) reuses the same
    // canvas instead of tearing it down. Disposal is handled on unmount below.
    useEffect(() => {
        if (pdfFile && canvasRef.current && !fabricCanvas) {
            const canvas = new Canvas(canvasRef.current, {
                width: 600,
                height: 800,
                selection: true,
                renderOnAddRemove: true,
            });
            setFabricCanvas(canvas);
        }
    }, [pdfFile, loadingDoc]);

    // Window-resize handling + dispose, tied to the canvas instance (the canvas is
    // created once, so the cleanup effectively runs only on unmount).
    useEffect(() => {
        if (!fabricCanvas) return;
        const handleResize = () => {
            fabricCanvas.setDimensions({
                width: canvasContainerRef.current?.clientWidth || 800,
                height: canvasContainerRef.current?.clientHeight || 1100,
            });
            fabricCanvas.requestRenderAll();
        };
        window.addEventListener("resize", handleResize);
        return () => {
            window.removeEventListener("resize", handleResize);
            fabricCanvas.dispose();
        };
    }, [fabricCanvas]);

    useEffect(() => {
        setTimeout(() => {
            loadPDF();
            setLoadingDoc(false);
        }, 50);
    }, [fabricCanvas]);

    // Record an undo snapshot on every user edit, and seed the baseline for the
    // first page. Programmatic loads set isRestoringRef so they aren't recorded.
    useEffect(() => {
        if (!fabricCanvas) return;

        undoStack.current = [JSON.stringify(fabricCanvas.toJSON())];
        redoStack.current = [];
        syncHistoryFlags();

        const recordHistory = () => {
            if (isRestoringRef.current) return;
            undoStack.current.push(JSON.stringify(fabricCanvas.toJSON()));
            redoStack.current = [];
            syncHistoryFlags();
        };

        fabricCanvas.on("object:added", recordHistory);
        fabricCanvas.on("object:modified", recordHistory);
        fabricCanvas.on("object:removed", recordHistory);

        return () => {
            fabricCanvas.off("object:added", recordHistory);
            fabricCanvas.off("object:modified", recordHistory);
            fabricCanvas.off("object:removed", recordHistory);
        };
    }, [fabricCanvas]);

    // Keep the workspace height pinned to the viewport (top offset accounts for the
    // navbar/chrome above it), so the PDF pane gets a real bounded height and its
    // internal overflow-auto scrolls on its own instead of the whole page.
    useEffect(() => {
        const measure = () => {
            const top = rootRef.current?.getBoundingClientRect().top ?? 0;
            setWorkspaceHeight(Math.max(window.innerHeight - top, 320));
        };
        measure();
        window.addEventListener("resize", measure);
        return () => window.removeEventListener("resize", measure);
        // Re-measure once the PDF view actually mounts the root (e.g. after a file
        // is chosen in the standalone tool), not just on first render.
    }, [loadingDoc, pdfFile]);

    // Save annotations when changing pages
    useEffect(() => {
        if (fabricCanvas) {
            // Save current page annotations before loading new ones
            const currentAnnotations = fabricCanvas.toJSON();

            // Always save the current state, even if it appears empty
            setAnnotations((prev) => ({
                ...prev,
                [prevPageNumber]: currentAnnotations, // Use previous page number reference
            }));

            // Clearing + loading fire canvas events — guard them so they don't get
            // recorded as user edits in the undo history.
            isRestoringRef.current = true;
            fabricCanvas.clear();

            const loadPromise = annotations[pageNumber]
                ? fabricCanvas.loadFromJSON(annotations[pageNumber])
                : Promise.resolve();

            loadPromise.then(() => {
                fabricCanvas.requestRenderAll();
                // Reset undo/redo to this page's freshly-loaded baseline.
                undoStack.current = [JSON.stringify(fabricCanvas.toJSON())];
                redoStack.current = [];
                isRestoringRef.current = false;
                syncHistoryFlags();
            });

            // Update previous page reference
            setPrevPageNumber(pageNumber);
        }
    }, [pageNumber]);

    // Mark a page visited as soon as it's ENTERED (covers the initial page and
    // the final page the evaluator lands on) — not when leaving it.
    useEffect(() => {
        setPagesVisited((prev) => (prev.includes(pageNumber) ? prev : [...prev, pageNumber]));
    }, [pageNumber]);

    useEffect(() => {
        const handleBeforeUnload = (e: BeforeUnloadEvent) => {
            e.preventDefault();
            const message =
                "Changes you made may not be saved. Are you sure you want to leave this page?";
            e.returnValue = message;
            return message;
        };

        window.addEventListener("beforeunload", handleBeforeUnload);

        return () => {
            window.removeEventListener("beforeunload", handleBeforeUnload);
        };
    }, []);

    useEffect(() => {
        const unsubscribe = router.subscribe("onBeforeNavigate", (event) => {
            if (pdfFile) {
                const confirmMessage =
                    "Changes you made may not be saved. Are you sure you want to leave this page?";

                if (!window.confirm(confirmMessage)) {
                    event.preventDefault();
                }
            }
        });

        return () => {
            unsubscribe();
        };
    }, [annotations, router]);

    useEffect(() => {
        startTimer();

        return () => {
            stopTimer();
        };
    }, [startTimer, stopTimer]);

    // ---------------------------------------------------------------------------
    // Draft (save-for-later): persist the full EDITABLE evaluator state so a
    // faculty can pause and resume grading later from any device — instead of the
    // old download-PDF / re-upload dance (which also baked ticks into the image and
    // made them un-editable). We store raw Fabric annotations per page + marks +
    // feedback + timer, never a flattened PDF; the flattened PDF is still only
    // produced on the final Submit.
    // ---------------------------------------------------------------------------
    const buildDraftState = (): EvaluationDraftState => {
        // Include unsaved edits on the live page alongside the per-page snapshots.
        const perPageAnnotations: { [key: number]: any } = { ...annotations };
        if (fabricCanvas) {
            perPageAnnotations[pageNumber] = fabricCanvas.toJSON();
        }
        return {
            version: 1,
            annotations: perPageAnnotations,
            marksData: marksData.map((m) => ({
                section_id: m.section_id,
                question_id: m.question_id,
                status: m.status,
                marks: m.marks,
            })),
            feedbackByQuestion,
            elapsedSeconds: currentTime(),
            pageNumber,
            pagesVisited,
            savedAt: new Date().toISOString(),
        };
    };

    // Save the current progress on demand (only from the "Save draft" button).
    const persistDraft = async () => {
        if (isFreeTool || !attemptId) return;
        if (savingDraftRef.current || isUploading || isLoading) return;

        savingDraftRef.current = true;
        setIsSavingDraft(true);
        try {
            const draft = buildDraftState();
            await saveEvaluationDraft(assessmentId, instituteId, attemptId, draft);
            setDraftSavedAt(draft.savedAt);
            toast.success("Draft saved", {
                description: "You can safely leave and resume this evaluation later.",
                duration: 3000,
            });
        } catch (error) {
            console.error("Failed to save evaluation draft:", error);
            toast.error("Couldn't save draft. Please try again.");
        } finally {
            savingDraftRef.current = false;
            setIsSavingDraft(false);
        }
    };

    // One-time draft restore. Runs when the annotation canvas is ready so we can
    // paint the current page's saved marks. Also clears any stale marks/timer left
    // in the (session-global) stores by a previously-opened attempt.
    useEffect(() => {
        if (isFreeTool || !attemptId || restoreAttemptedRef.current) return;
        if (!fabricCanvas) return;
        restoreAttemptedRef.current = true;

        // Fresh baseline before we (maybe) hydrate from a draft.
        resetMarks();
        setElapsedTime(0);

        (async () => {
            try {
                const draft = await getEvaluationDraft(attemptId);
                if (!draft) return;

                const restoredAnnotations = draft.annotations || {};
                setAnnotations(restoredAnnotations);

                (draft.marksData || []).forEach((m) => addOrUpdateMark(m));
                Object.entries(draft.feedbackByQuestion || {}).forEach(([key, value]) => {
                    const sep = key.indexOf("__");
                    if (sep > 0) {
                        setQuestionFeedback(key.slice(0, sep), key.slice(sep + 2), value as string);
                    }
                });
                if (typeof draft.elapsedSeconds === "number") setElapsedTime(draft.elapsedSeconds);
                if (Array.isArray(draft.pagesVisited) && draft.pagesVisited.length) {
                    setPagesVisited(draft.pagesVisited);
                }

                // Paint the page currently on screen (page 1 on open).
                const currentPageAnnotations = restoredAnnotations[pageNumber];
                if (currentPageAnnotations && fabricCanvas) {
                    isRestoringRef.current = true;
                    fabricCanvas.clear();
                    await fabricCanvas.loadFromJSON(currentPageAnnotations);
                    fabricCanvas.requestRenderAll();
                    undoStack.current = [JSON.stringify(fabricCanvas.toJSON())];
                    redoStack.current = [];
                    isRestoringRef.current = false;
                    syncHistoryFlags();
                }

                setDraftSavedAt(draft.savedAt || null);
                toast.success("Draft restored", {
                    description: "We loaded your saved progress. Continue where you left off.",
                    duration: 4000,
                });
            } catch (error) {
                console.error("Failed to restore evaluation draft:", error);
            }
        })();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [fabricCanvas, isFreeTool, attemptId]);

    // Short, local "last saved" label for the draft hint.
    const formatSavedAt = (iso: string) => {
        try {
            return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
        } catch {
            return "";
        }
    };

    // PDF navigation
    const changePage = (offset: number) => {
        setPageNumber((prevPageNumber) => {
            const newPageNumber = prevPageNumber + offset;
            return Math.max(1, Math.min(newPageNumber, numPages));
        });
    };

    const handleJumpPage = () => {
        if (jumpPage && jumpPage > 0 && jumpPage <= numPages) {
            setPageNumber(jumpPage);
        }
    };

    // Build the evaluated PDF by overlaying ONLY the annotation layer onto the
    // ORIGINAL PDF pages with pdf-lib. The student's original page content is kept
    // natively (never re-rasterized), so the answer sheet retains its full original
    // quality; we render each page's Fabric annotations to a transparent, high-res
    // PNG offscreen and stamp it on top. Because the annotation canvas spans the
    // full displayed page, drawing it full-page maps the coordinates automatically.
    const buildEvaluatedPdfBytes = async (): Promise<Uint8Array> => {
        if (!pdfFile) throw new Error("No PDF file available for annotation.");

        // Snapshot annotations per page, including unsaved edits on the live page.
        const perPageAnnotations: { [key: number]: any } = { ...annotations };
        if (fabricCanvas) {
            perPageAnnotations[pageNumber] = fabricCanvas.toJSON();
        }

        const pdfDoc = await PDFDocument.load(await pdfFile.arrayBuffer());
        const pageCount = pdfDoc.getPageCount();

        // Render in the SAME coordinate space the annotations were drawn in — the
        // live canvas's logical size (zoom is only a CSS transform, so this is
        // always the un-zoomed page size). Using this rather than `dimensions`
        // state avoids any drift and guarantees the export looks like the 100% view.
        const canvasWidth = (fabricCanvas && fabricCanvas.width) || dimensions.width;
        const canvasHeight = (fabricCanvas && fabricCanvas.height) || dimensions.height;

        for (let i = 0; i < pageCount; i++) {
            const pageAnnotations = perPageAnnotations[i + 1]; // annotations are 1-based
            if (!pageAnnotations) continue;

            // Render this page's annotations onto a transparent offscreen canvas.
            const offscreen = document.createElement("canvas");
            const staticCanvas = new StaticCanvas(offscreen, {
                width: canvasWidth,
                height: canvasHeight,
                enableRetinaScaling: false,
            });
            await staticCanvas.loadFromJSON(pageAnnotations);
            // Force a 1:1 viewport so the export is unaffected by any on-screen zoom.
            staticCanvas.setViewportTransform([1, 0, 0, 1, 0, 0]);
            staticCanvas.renderAll();

            // No marks on this page → leave the original page completely untouched.
            if (staticCanvas.getObjects().length === 0) {
                staticCanvas.dispose();
                continue;
            }

            // multiplier=3 keeps thin strokes / text crisp without affecting the
            // original page (which stays native vector/image content).
            const pngDataUrl = staticCanvas.toDataURL({ format: "png", multiplier: 3 });
            staticCanvas.dispose();

            const overlay = await pdfDoc.embedPng(dataUrlToUint8(pngDataUrl));
            const page = pdfDoc.getPage(i);
            const { width, height } = page.getSize();
            page.drawImage(overlay, { x: 0, y: 0, width, height });
        }

        return pdfDoc.save();
    };

    // Download the evaluated PDF (UI/UX unchanged — only the generation differs).
    const downloadAnnotatedPDF = async () => {
        if (!pdfFile) return;
        try {
            // Keep state in sync with the live canvas for the current page.
            if (fabricCanvas) {
                const currentAnnotations = fabricCanvas.toJSON();
                setAnnotations((prev) => ({
                    ...prev,
                    [pageNumber]: currentAnnotations,
                }));
            }

            setIsLoading(true);
            setError("Generating PDF, please wait...");

            const bytes = await buildEvaluatedPdfBytes();
            const blob = new Blob([bytes], { type: "application/pdf" });
            const url = URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.href = url;
            link.download = `evaluated-${pdfFile.name}`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);

            setIsLoading(false);
            setError("");
        } catch (error) {
            console.error("Error generating annotated PDF:", error);
            setError("Failed to generate annotated PDF. Please try again.");
            setIsLoading(false);
        }
    };

    // Used by handleSubmit to upload the evaluated artifact — same Blob contract.
    const generateAnnotatedPDF = async (): Promise<Blob> => {
        const bytes = await buildEvaluatedPdfBytes();
        return new Blob([bytes], { type: "application/pdf" });
    };

    const handleZoomIn = () => {
        setZoomLevel((prevZoom) => Math.min(prevZoom + 0.1, 3)); // Max zoom level of 3
    };

    const handleZoomOut = () => {
        setZoomLevel((prevZoom) => Math.max(prevZoom - 0.1, 0.5)); // Min zoom level of 50%
    };

    const handleResetZoom = () => {
        setZoomLevel(0.9); // Reset to the default 90% fit
    };

    // Restore the previous canvas snapshot. Guarded so the reload itself isn't
    // recorded as a new edit.
    const handleUndo = () => {
        if (!fabricCanvas || undoStack.current.length <= 1) return;
        const current = undoStack.current.pop();
        redoStack.current.push(current);
        const target = undoStack.current[undoStack.current.length - 1];
        isRestoringRef.current = true;
        fabricCanvas.clear();
        fabricCanvas.loadFromJSON(target).then(() => {
            fabricCanvas.requestRenderAll();
            isRestoringRef.current = false;
            syncHistoryFlags();
        });
    };

    const handleRedo = () => {
        if (!fabricCanvas || redoStack.current.length === 0) return;
        const target = redoStack.current.pop();
        undoStack.current.push(target);
        isRestoringRef.current = true;
        fabricCanvas.clear();
        fabricCanvas.loadFromJSON(target).then(() => {
            fabricCanvas.requestRenderAll();
            isRestoringRef.current = false;
            syncHistoryFlags();
        });
    };

    // Clear all annotations (the current page's canvas + every saved page) in
    // place — no page reload.
    const handleResetAnnotations = () => {
        canvasUtils.clearCanvas();
        setAnnotations({});
        // Reset history to the now-empty baseline.
        undoStack.current = fabricCanvas ? [JSON.stringify(fabricCanvas.toJSON())] : [];
        redoStack.current = [];
        syncHistoryFlags();
        setIsResetDialogOpen(false);
        toast.success("All annotations cleared");
    };

    async function loadPDF() {
        if (!loadingDoc || !pdfUrl) return;
        const abc = document.querySelector(".react-pdf__Document");

        const width = abc?.clientWidth || 600;
        const height = abc?.clientHeight || 800;

        fabricCanvas?.setWidth(width);
        fabricCanvas?.setHeight(height);

        setDimensions({ width, height });
    }

    // Resize the annotation canvas to the currently-rendered page (used after a
    // device-uploaded PDF replaces the original, since its page size may differ).
    const remeasureCanvasToPdf = () => {
        const doc = document.querySelector(".react-pdf__Document");
        const width = doc?.clientWidth || dimensions.width;
        const height = doc?.clientHeight || dimensions.height;
        fabricCanvas?.setWidth(width);
        fabricCanvas?.setHeight(height);
        setDimensions({ width, height });
        fabricCanvas?.requestRenderAll();
    };

    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            // Check if text is currently selected
            const isTextSelected = window.getSelection()?.toString().trim() !== "";

            // Check if the active element is an input, textarea, or has contenteditable attribute
            const activeTag = document.activeElement?.tagName.toLowerCase();
            const isInputFocused =
                activeTag === "input" ||
                activeTag === "textarea" ||
                document.activeElement?.getAttribute("contenteditable") === "true";

            // Check if the active canvas object is a text object with an active cursor
            const isTextObjectActive =
                fabricCanvas?.getActiveObject()?.type === "i-text" &&
                (fabricCanvas?.getActiveObject() as fabric.IText)?.isEditing;

            // Only proceed with delete if none of the above conditions are true
            if (
                (event.key === "Delete" || event.key === "Backspace") &&
                fabricCanvas &&
                !isTextSelected &&
                !isInputFocused &&
                !isTextObjectActive
            ) {
                event.preventDefault();
                canvasUtils.deleteSelectedShape();
            }
        };

        window.addEventListener("keydown", handleKeyDown);

        return () => {
            window.removeEventListener("keydown", handleKeyDown);
        };
    }, [fabricCanvas, canvasUtils]);

    const handleSubmit = async () => {
        // Guard: never submit an evaluation without marks.
        if (!canSubmit) {
            setIsSubmitDialogOpen(false);
            toast.error("Please award marks before submitting.");
            return;
        }
        const accessToken = getTokenFromCookie(TokenKey.accessToken);
        const tokenData = getTokenDecodedData(accessToken);
        setIsLoading(true);

        try {
            const annotatedPdfBlob = await generateAnnotatedPDF();
            setIsLoading(false);
            setIsUploading(true);
            setUploadingProgress(0);
            const progressInterval = setInterval(() => {
                setUploadingProgress((prev) => Math.min(prev + Math.random() * 10, 90));
            }, 200);
            const evaluatedFileId = await uploadFile({
                file: new File([annotatedPdfBlob], `evaluated-${file?.name}`),
                setIsUploading,
                userId: "your-user-id",
                source: instituteId,
                sourceId: "EVALUATIONS",
            });
            const data_json = {
                timeTakenInSeconds: currentTime(),
                attemptId,
                evaluationStartTime: startTimestamp,
                evaluatedFileId,
                setId: "",
                assessmentId,
                evaluatorUserId: tokenData?.user,
            };
            console.log(fileId);
            const payload = {
                set_id: "",
                // file_id IS the evaluated artifact — the backend stores it on
                // student_attempt.evaluated_file_id (the file shown to the learner).
                // Send the annotated PDF, NOT the student's original answer
                // (`fileId`), which stays in attemptData.
                file_id: evaluatedFileId,
                data_json: JSON.stringify(data_json),
                // Merge the learner-facing feedback into each question's marks entry.
                request: marksData.map((mark) => ({
                    ...mark,
                    evaluator_feedback:
                        feedbackByQuestion[feedbackKey(mark.section_id, mark.question_id)] ||
                        undefined,
                })),
            };
            if (evaluatedFileId) {
                const publicUrl = await getPublicUrl(evaluatedFileId);
                console.log(publicUrl);

                const response = await submitEvlauationMarks(
                    assessmentId,
                    instituteId,
                    attemptId,
                    payload,
                );
                console.log(response);

                // Auto-release the result for this student so it's visible right
                // after evaluation. Best-effort — a release failure shouldn't block
                // the (already successful) marks submission.
                try {
                    await releaseEvaluationResult(assessmentId, instituteId, attemptId);
                } catch (releaseError) {
                    console.error("Failed to auto-release result:", releaseError);
                }

                resetMarks();
                toast.success("Evaluation Submitted", {
                    description: "The answer sheet evaluation has been completed and submitted.",
                    duration: 3000,
                });

                setIsUploading(false);
                clearInterval(progressInterval);
                // Return to wherever the admin launched the evaluator from (e.g.
                // the assessment slide). Falls back to the assessment-details page
                // using the REAL play_mode / visibility — never hardcoded values.
                const returnUrl = readEvalReturnUrl();
                if (returnUrl) {
                    clearEvalReturnUrl();
                    window.location.assign(returnUrl);
                } else {
                    navigate({
                        to: "/evaluation/evaluations/assessment-details/$assessmentId/$examType/$assesssmentType",
                        params: {
                            assessmentId,
                            examType: examType || "EXAM",
                            assesssmentType: assessmentVisibility || "PRIVATE",
                        },
                    });
                }
            }
        } catch (error) {
            console.log(error);
            toast.error("Error submitting evaluation");
            setUploadingProgress(0);
            setIsUploading(false);
        }

        // Show success toast

        // router.navigate({ to: "/evaluation/evaluations" });
        // Go back to last route

        // TODO: Add actual submission logic here
        // For example, sending evaluation data to backend
    };

    if (!pdfFile && !pdfUrl) {
        return (
            <div className="flex h-full flex-col items-center justify-center gap-y-4 p-4">
                <Card className="w-full max-w-lg">
                    <CardHeader>
                        <CardTitle className="text-lg font-semibold">
                            Upload answer sheet
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="flex w-full flex-col items-center gap-2">
                            <div
                                {...getRootProps()}
                                className={`w-full cursor-pointer rounded-lg border-2 border-dashed border-primary-500 p-6 ${isDragActive ? "bg-primary-50" : "bg-white"
                                    } transition-colors duration-200 ease-in-out`}
                            >
                                <input {...getInputProps()} />
                                <div className="flex flex-col items-center justify-center gap-4">
                                    <ImportFileImage />

                                    <p className="text-center text-base text-neutral-600">
                                        Drag and drop a PDF file here, or click to select one
                                    </p>
                                </div>
                            </div>

                            {error && (
                                <AlertDialog>
                                    <AlertCircle className="size-6 text-red-400" />
                                    <AlertDialogDescription className="text-red-500">
                                        {error}
                                    </AlertDialogDescription>
                                </AlertDialog>
                            )}
                        </div>
                    </CardContent>
                </Card>
            </div>
        );
    }

    return (
        <div
            ref={rootRef}
            className="flex w-full p-6 lg:p-8"
            style={{ /* design-lint-ignore: dynamic viewport-bounded workspace height */ height: workspaceHeight }}
        >
            <div className="relative flex min-h-0 min-w-0 flex-1 flex-col gap-2">
                {/* Loading overlay */}
                {isLoading && <LoadingOverlay numPages={numPages} pageNumber={pageNumber} />}
                {isUploading && <UploadingOverlay progress={uploadingProgress} />}

                {/* Horizontal tool bar */}
                <Card
                    className={cn(
                        "w-full shrink-0 rounded-xl border-neutral-200 shadow-sm transition-all",
                        !isToolbarOpen && "hidden",
                    )}
                    ref={toolbarRef}
                >
                    <CardContent className="flex flex-row flex-wrap items-center gap-2 p-2">
                        <span className="px-1 text-2xs font-medium uppercase tracking-wide text-neutral-400">
                            Tools
                        </span>
                        <div className="mx-1 h-8 w-px bg-neutral-200" aria-hidden="true" />
                        <div className="flex flex-row items-center gap-1">
                            {tools.map((tool, index) => {
                                // if (tool.label === "Pen") return null;
                                return (
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        key={index}
                                        onClick={
                                            tool.label === "Pen"
                                                ? () => canvasUtils.addPenTool("green")
                                                : tool.action
                                        }
                                        className="size-10 rounded-lg transition-colors hover:bg-neutral-100"
                                        disabled={isLoading}
                                        aria-label={tool.label}
                                        title={tool.label}
                                    >
                                        <tool.icon className={tool.color} aria-hidden="true" />
                                    </Button>
                                );
                            })}
                            <div className="mx-1 h-8 w-px bg-neutral-200" aria-hidden="true" />
                            <Popover>
                                <PopoverTrigger asChild>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="size-10 rounded-lg hover:bg-neutral-100"
                                        aria-label="Insert marks number"
                                        title="Insert marks number"
                                    >
                                        <ListNumbers className="size-5" aria-hidden="true" />
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-64 p-2" side="right">
                                    <div className="grid grid-cols-5 gap-2">
                                        {numbers.map(({ value, action }) => (
                                            <MyButton
                                                key={value}
                                                scale="small"
                                                layoutVariant="floating"
                                                buttonType="text"
                                                onClick={action}
                                                value={value.toString()}
                                                disabled={isLoading}
                                                className="border border-primary-400 text-base hover:bg-primary-300"
                                            >
                                                {value}
                                            </MyButton>
                                        ))}
                                    </div>
                                </PopoverContent>
                            </Popover>
                            <div className="mx-1 h-8 w-px bg-neutral-200" aria-hidden="true" />
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept="application/pdf"
                                onChange={handleFileInput}
                                className="hidden"
                            />
                            <Button
                                onClick={() => fileInputRef.current?.click()}
                                variant="ghost"
                                className="h-10 gap-1.5 rounded-lg px-3 text-sm font-medium text-neutral-700 hover:bg-neutral-100"
                                disabled={isLoading}
                                aria-label="Upload evaluated PDF"
                                title="Upload an evaluated PDF to continue on it"
                            >
                                <Upload className="size-4" aria-hidden="true" />
                                Upload
                            </Button>
                            <Button
                                onClick={downloadAnnotatedPDF}
                                variant="ghost"
                                className="h-10 gap-1.5 rounded-lg px-3 text-sm font-medium text-neutral-700 hover:bg-neutral-100"
                                disabled={isLoading}
                                aria-label="Download annotated PDF"
                                title="Download annotated PDF"
                            >
                                <Download className="size-4" aria-hidden="true" />
                                Download
                            </Button>
                            <Button
                                variant="ghost"
                                size="icon"
                                className="size-10 rounded-lg hover:bg-neutral-100"
                                aria-label="Reset annotations"
                                title="Reset annotations"
                                disabled={isLoading}
                                onClick={() => setIsResetDialogOpen(true)}
                            >
                                <RefreshCcw className="size-4" aria-hidden="true" />
                            </Button>
                            <AlertDialog
                                open={isResetDialogOpen}
                                onOpenChange={setIsResetDialogOpen}
                            >
                                <AlertDialogContent>
                                    <AlertDialogHeader>
                                        <AlertDialogTitle>Reset annotations?</AlertDialogTitle>
                                        <AlertDialogDescription>
                                            This removes all your marks and annotations from every
                                            page of this answer sheet. This can&apos;t be undone.
                                        </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                                        <AlertDialogAction
                                            onClick={handleResetAnnotations}
                                            className="bg-danger-500 text-white hover:bg-danger-400"
                                        >
                                            Reset annotations
                                        </AlertDialogAction>
                                    </AlertDialogFooter>
                                </AlertDialogContent>
                            </AlertDialog>
                            <Button
                                variant="ghost"
                                className="h-10 gap-1.5 rounded-lg px-3 text-sm font-medium text-neutral-700 hover:bg-neutral-100"
                                aria-label="Tool guide"
                                title="What does each button do?"
                                onClick={() => setIsHelpDialogOpen(true)}
                            >
                                <Info className="size-4" aria-hidden="true" />
                                Help
                            </Button>
                            {/* Submit confirmation — opened from the grading sidebar's
                                "Submit evaluation" button (controlled via state). */}
                            <AlertDialog
                                open={isSubmitDialogOpen}
                                onOpenChange={setIsSubmitDialogOpen}
                            >
                                <AlertDialogContent>
                                    <AlertDialogHeader>
                                        <AlertDialogTitle>Confirm Submission</AlertDialogTitle>
                                        <AlertDialogDescription>
                                            Are you sure you want to submit this evaluation? This
                                            action cannot be undone.
                                        </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                                        <AlertDialogAction
                                            onClick={handleSubmit}
                                            className="bg-primary-500 text-white hover:bg-primary-400"
                                        >
                                            {(isUploading || isUploadingFile) && (
                                                <Loader2 className="size-6 animate-spin text-primary-500" />
                                            )}
                                            Continue
                                        </AlertDialogAction>
                                    </AlertDialogFooter>
                                </AlertDialogContent>
                            </AlertDialog>
                        </div>

                        <MyDialog
                            heading="Tool guide"
                            open={isHelpDialogOpen}
                            onOpenChange={setIsHelpDialogOpen}
                        >
                            <div className="max-h-96 space-y-5 overflow-y-auto pr-1">
                                <div>
                                    <p className="mb-2 text-2xs font-medium uppercase tracking-wide text-neutral-500">
                                        Annotation tools
                                    </p>
                                    <ul className="space-y-3">
                                        {tools.map((tool) => (
                                            <li
                                                key={tool.label}
                                                className="flex items-start gap-3"
                                            >
                                                <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-neutral-100 text-neutral-700">
                                                    <tool.icon
                                                        className="size-4"
                                                        aria-hidden="true"
                                                    />
                                                </span>
                                                <div>
                                                    <p className="text-sm font-medium text-neutral-800">
                                                        {tool.label}
                                                    </p>
                                                    <p className="text-xs text-neutral-500">
                                                        {TOOL_HELP[tool.label]}
                                                    </p>
                                                </div>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                                <div>
                                    <p className="mb-2 text-2xs font-medium uppercase tracking-wide text-neutral-500">
                                        Controls
                                    </p>
                                    <ul className="space-y-3">
                                        {CONTROL_HELP.map((item) => (
                                            <li
                                                key={item.label}
                                                className="flex items-start gap-3"
                                            >
                                                <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-neutral-100 text-neutral-700">
                                                    <item.icon
                                                        className="size-4"
                                                        aria-hidden="true"
                                                    />
                                                </span>
                                                <div>
                                                    <p className="text-sm font-medium text-neutral-800">
                                                        {item.label}
                                                    </p>
                                                    <p className="text-xs text-neutral-500">
                                                        {item.description}
                                                    </p>
                                                </div>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            </div>
                        </MyDialog>
                    </CardContent>
                </Card>

                {/* PDF Viewer */}
                <div className="flex min-h-0 w-full flex-1">
                    <Card className="flex h-full w-full flex-col overflow-hidden">
                        <CardHeader className="shrink-0 border-b border-neutral-200 bg-white py-2">
                            <div className="flex items-center justify-between">
                                <CardTitle className="text-base font-semibold">
                                    Answer Sheet Evaluation
                                </CardTitle>

                                <div className="flex items-center gap-x-2">
                                    {canvasUtils.isDrawingMode && (
                                        <>
                                            <ColorPicker
                                                onChange={canvasUtils.addPenTool}
                                                value={canvasUtils.penColor}
                                                className="size-6 rounded-full p-0"
                                            />
                                            <Button onClick={canvasUtils.clearCanvas}>Clear</Button>
                                            <Button onClick={canvasUtils.disableDrawingMode}>
                                                Exit
                                            </Button>
                                        </>
                                    )}
                                </div>

                                <div className="flex items-center gap-2">
                                    <MyButton
                                        buttonType="primary"
                                        scale="medium"
                                        onClick={() => setShowEvaluationPanel(true)}
                                        className={cn(isFreeTool && "hidden")}
                                        aria-label="Open grading panel"
                                    >
                                        Grade
                                    </MyButton>
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent className="min-h-0 flex-1 overflow-auto bg-neutral-100 p-4">
                            {loadingDoc ? (
                                <div className="flex h-full items-center justify-center">
                                    <DashboardLoader />
                                </div>
                            ) : (
                                <div
                                    ref={pdfViewerRef}
                                    className="relative mx-auto"
                                    style={{ /* design-lint-ignore: dynamic PDF page dimensions scaled by zoom */
                                        width: dimensions.width * zoomLevel,
                                        height: dimensions.height * zoomLevel,
                                    }}
                                >
                                    <div
                                        style={{ /* design-lint-ignore: dynamic canvas sizing */
                                            // overflowY: "auto",
                                            // overflowX: "auto",
                                            maxHeight: "fit-content",
                                            // width: "600px",
                                        }}
                                    >
                                        <div
                                            ref={canvasContainerRef}
                                            className="relative flex justify-start rounded-lg"
                                            style={{ /* design-lint-ignore: dynamic zoom transform */
                                                transform: `scale(${zoomLevel})`,
                                                transformOrigin: "top left",
                                            }}
                                        >
                                            <ProgressBar progress={progress} />
                                            <Document
                                                file={pdfUrl || file}
                                                onLoadSuccess={({ numPages }) => {
                                                    setNumPages(numPages);
                                                    setDocLoaded(true);
                                                }}
                                                onLoadProgress={({ loaded, total }) => {
                                                    setProgress((loaded / total) * 100);
                                                }}
                                                onLoadError={(error) => console.log(error)}
                                                className="absolute min-w-fit"
                                            >
                                                <Page
                                                    pageNumber={pageNumber}
                                                    scale={scale}
                                                    devicePixelRatio={renderPixelRatio}
                                                    renderTextLayer={false}
                                                    renderAnnotationLayer={false}
                                                    className="max-h-fit shadow-lg"
                                                    onRenderSuccess={() => {
                                                        if (pendingResizeRef.current) {
                                                            pendingResizeRef.current = false;
                                                            remeasureCanvasToPdf();
                                                        }
                                                    }}
                                                />
                                            </Document>

                                            <canvas
                                                ref={canvasRef}
                                                className="absolute left-0 top-0 z-10"
                                            />
                                        </div>
                                    </div>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>
            </div>

            {/* Evaluation Panel (right column). Fixed header + scrollable content
                (which grows to fill the height, so no dead gap) + pinned action footer. */}
            {showEvaluationPanel && (
                    <div className="flex w-full shrink-0 flex-col border-l border-neutral-200 bg-white sm:w-96 lg:w-1/4">
                        <div className="flex shrink-0 items-center justify-between border-b border-neutral-200 px-4 py-3">
                            <div className="flex flex-col">
                                <span className="text-2xs font-medium uppercase tracking-wide text-neutral-500">
                                    Grading
                                </span>
                                <h2 className="text-base font-semibold text-neutral-900">
                                    Evaluation
                                </h2>
                            </div>
                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => setShowEvaluationPanel(false)}
                                className="hover:bg-neutral-100"
                                aria-label="Close evaluation panel"
                                title="Close panel"
                            >
                                <X className="size-5" aria-hidden="true" />
                            </Button>
                        </div>
                        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto p-4">
                            <Evaluation
                                totalPages={numPages}
                                pagesVisited={pagesVisited}
                                currentPage={pageNumber}
                                questionData={questionData}
                            />
                        </div>
                        {/* Save-draft + Submit at the end of the grading sidebar.
                            Stacked full-width so neither label ever clips in the
                            narrow panel; Submit (primary) leads, Save draft is the
                            lighter fallback for finishing later. */}
                        {!isFreeTool && (
                            <div className="shrink-0 space-y-2 border-t border-neutral-200 bg-white p-4">
                                <MyButton
                                    buttonType="primary"
                                    scale="medium"
                                    onClick={() => setIsSubmitDialogOpen(true)}
                                    disable={isLoading || !canSubmit}
                                    className="w-full"
                                >
                                    Submit evaluation
                                </MyButton>
                                <MyButton
                                    buttonType="secondary"
                                    scale="medium"
                                    onClick={persistDraft}
                                    disable={isSavingDraft || isLoading || isUploading}
                                    className="w-full"
                                >
                                    {isSavingDraft ? "Saving draft…" : "Save draft"}
                                </MyButton>
                                {(draftSavedAt || !canSubmit) && (
                                    <p className="text-center text-xs text-neutral-400">
                                        {draftSavedAt
                                            ? `Draft saved ${formatSavedAt(draftSavedAt)} · resume anytime`
                                            : "Award marks to submit, or save a draft to finish later."}
                                    </p>
                                )}
                            </div>
                        )}
                    </div>
                )}

            {/* Bottom floating page + zoom controls */}
            <div className="pointer-events-none fixed inset-x-0 bottom-4 z-30 flex justify-center">
                <div className="pointer-events-auto flex items-center gap-1 rounded-full border border-neutral-200 bg-white px-2 py-1 shadow-lg">
                    <button
                        onClick={handleUndo}
                        disabled={!canUndo || isLoading}
                        aria-label="Undo"
                        title="Undo"
                        className="cursor-pointer rounded-full p-2 text-neutral-700 transition-colors hover:bg-neutral-100 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                        <ArrowUUpLeft className="size-4" aria-hidden="true" />
                    </button>
                    <button
                        onClick={handleRedo}
                        disabled={!canRedo || isLoading}
                        aria-label="Redo"
                        title="Redo"
                        className="cursor-pointer rounded-full p-2 text-neutral-700 transition-colors hover:bg-neutral-100 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                        <ArrowUUpRight className="size-4" aria-hidden="true" />
                    </button>
                    <div className="mx-1 h-5 w-px bg-neutral-200" aria-hidden="true" />
                    <button
                        onClick={() => changePage(-1)}
                        disabled={pageNumber <= 1 || isLoading}
                        aria-label="Previous page"
                        title="Previous page"
                        className="cursor-pointer rounded-full p-2 text-neutral-700 transition-colors hover:bg-neutral-100 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                        <ChevronLeft className="size-4" aria-hidden="true" />
                    </button>
                    <span className="min-w-14 text-center text-xs font-medium tabular-nums text-neutral-700">
                        {pageNumber} / {numPages || "--"}
                    </span>
                    <button
                        onClick={() => changePage(1)}
                        disabled={pageNumber >= numPages || isLoading}
                        aria-label="Next page"
                        title="Next page"
                        className="cursor-pointer rounded-full p-2 text-neutral-700 transition-colors hover:bg-neutral-100 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                        <ChevronRight className="size-4" aria-hidden="true" />
                    </button>
                    <div className="mx-1 h-5 w-px bg-neutral-200" aria-hidden="true" />
                    <button
                        onClick={handleZoomOut}
                        disabled={isLoading}
                        aria-label="Zoom out"
                        title="Zoom out"
                        className="cursor-pointer rounded-full p-2 text-neutral-700 transition-colors hover:bg-neutral-100 disabled:opacity-40"
                    >
                        <MagnifyingGlassMinus size={16} aria-hidden="true" />
                    </button>
                    <button
                        onClick={handleResetZoom}
                        disabled={isLoading}
                        aria-label="Reset zoom"
                        title="Reset zoom"
                        className="min-w-12 cursor-pointer rounded-full px-2 py-1 text-center text-xs font-medium tabular-nums text-neutral-700 transition-colors hover:bg-neutral-100 disabled:opacity-40"
                    >
                        {Math.round(zoomLevel * 100)}%
                    </button>
                    <button
                        onClick={handleZoomIn}
                        disabled={isLoading}
                        aria-label="Zoom in"
                        title="Zoom in"
                        className="cursor-pointer rounded-full p-2 text-neutral-700 transition-colors hover:bg-neutral-100 disabled:opacity-40"
                    >
                        <MagnifyingGlassPlus size={16} aria-hidden="true" />
                    </button>
                </div>
            </div>
        </div>
    );
};

export default PDFEvaluator;
