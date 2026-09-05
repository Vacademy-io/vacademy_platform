import { useEffect, useState } from 'react';
import { CircleNotch, Coins, Sparkle, WarningCircle } from '@phosphor-icons/react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { MyButton } from '@/components/design-system/button';
import {
    estimateTutorCompile,
    type TutorCompileEstimate,
    type TutorCompileOptions,
} from '@/services/tutor';

const KIND_LABEL: Record<string, string> = {
    document: 'Document',
    pdf: 'PDF',
    quiz: 'Quiz',
    ai_video: 'AI video',
    youtube: 'YouTube video',
    video_upload: 'Uploaded video',
    video_link: 'Video link',
    other: 'Not supported',
};

const ACTION_LABEL: Record<string, string> = {
    compile: 'Will prepare',
    up_to_date: 'Already prepared',
    needs_details: 'Needs details',
    free: 'Free',
    skip: 'Skipped',
    unsupported: 'Not supported',
    unpublished: 'Not published',
};

const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));

interface Props {
    packageId: string;
    slideIds?: string[];
    open: boolean;
    options: TutorCompileOptions | null;
    transcribeVideos: boolean;
    onTranscribeVideosChange: (v: boolean) => void;
    ocrPdfs: boolean;
    onOcrPdfsChange: (v: boolean) => void;
    onClose: () => void;
    onConfirm: () => void;
}

/**
 * What "Prepare for teaching" will cost, slide by slide, before any credit is
 * spent: compile credits, transcription minutes for uploaded videos, and the
 * image cap. Prices come from the server, so super-admin overrides apply.
 */
export const TutorCompileEstimateDialog: React.FC<Props> = ({
    packageId,
    slideIds,
    open,
    options,
    transcribeVideos,
    onTranscribeVideosChange,
    ocrPdfs,
    onOcrPdfsChange,
    onClose,
    onConfirm,
}) => {
    const [estimate, setEstimate] = useState<TutorCompileEstimate | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const single = (slideIds?.length ?? 0) === 1;

    useEffect(() => {
        if (!open || !options) return;
        let cancelled = false;
        setLoading(true);
        setError(null);
        estimateTutorCompile(packageId, {
            ...options,
            transcribe_videos: transcribeVideos,
            ocr_pdfs: ocrPdfs,
            slide_ids: slideIds ?? [],
            force: single,
        })
            .then((e) => {
                if (!cancelled) setEstimate(e);
            })
            .catch((e: unknown) => {
                if (!cancelled)
                    setError(e instanceof Error ? e.message : 'Could not estimate the cost');
            })
            .finally(() => {
                if (!cancelled) setLoading(false);
            });
        return () => {
            cancelled = true;
        };
        // options is rebuilt on every render; the inputs that matter are listed.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open, packageId, slideIds?.join(','), transcribeVideos, ocrPdfs, single]);

    const t = estimate?.totals;
    const rows = (estimate?.slides ?? []).filter((r) => r.action !== 'up_to_date' || single);
    const upToDate = estimate?.slides.filter((r) => r.action === 'up_to_date').length ?? 0;
    const insufficient = estimate?.sufficient === false;
    const nothing = !!t && t.to_compile === 0;

    return (
        <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
            <DialogContent className="max-h-screen w-full max-w-3xl overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Coins className="size-5 text-primary-500" />
                        {single ? 'Prepare this slide' : 'Prepare for teaching'}
                        {loading && (
                            <CircleNotch className="size-4 animate-spin text-neutral-400" />
                        )}
                    </DialogTitle>
                </DialogHeader>

                <p className="text-sm text-neutral-600">
                    Documents, PDFs, YouTube videos and AI videos are prepared from their own text
                    for free apart from the compile. Uploaded videos are transcribed first
                    (speech-to-text, charged per minute) and scanned PDFs are read with OCR (charged
                    per page). Nothing is charged until you confirm.
                </p>

                {estimate?.transcription_available && (
                    <div className="flex items-center gap-3 rounded-md border border-neutral-200 bg-neutral-50 px-3 py-2">
                        <Switch
                            id="tutor-transcribe"
                            checked={transcribeVideos}
                            onCheckedChange={onTranscribeVideosChange}
                        />
                        <Label htmlFor="tutor-transcribe" className="text-sm">
                            Transcribe uploaded videos (
                            {fmt(estimate.prices.transcription_per_minute)} credits per minute,
                            minimum {fmt(estimate.prices.transcription_minimum)}
                            ). Off: they need a written description instead.
                        </Label>
                    </div>
                )}
                {estimate?.ocr_available && (
                    <div className="flex items-center gap-3 rounded-md border border-neutral-200 bg-neutral-50 px-3 py-2">
                        <Switch
                            id="tutor-ocr"
                            checked={ocrPdfs}
                            onCheckedChange={onOcrPdfsChange}
                        />
                        <Label htmlFor="tutor-ocr" className="text-sm">
                            Read scanned PDFs with OCR ({fmt(estimate.prices.ocr_per_page)} credits
                            per page). Off: they need a written description instead.
                        </Label>
                    </div>
                )}

                {error && (
                    <p className="flex items-center gap-2 text-sm text-danger-600">
                        <WarningCircle className="size-4" /> {error}
                    </p>
                )}

                {estimate && (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-neutral-200 text-xs uppercase tracking-wide text-neutral-500">
                                    <th className="py-2 pe-3 text-start">Slide</th>
                                    <th className="py-2 pe-3 text-start">Kind</th>
                                    <th className="py-2 pe-3 text-start">What happens</th>
                                    <th className="py-2 pe-3 text-end">Credits</th>
                                </tr>
                            </thead>
                            <tbody>
                                {rows.map((r) => (
                                    <tr
                                        key={r.slide_id}
                                        className="border-b border-neutral-100 align-top"
                                    >
                                        <td className="py-2 pe-3 font-medium text-neutral-800">
                                            {r.title ?? r.slide_id}
                                        </td>
                                        <td className="py-2 pe-3 text-neutral-600">
                                            {KIND_LABEL[r.kind] ?? r.kind}
                                        </td>
                                        <td className="py-2 pe-3 text-neutral-600">
                                            <span
                                                className={
                                                    r.action === 'needs_details'
                                                        ? 'text-warning-700'
                                                        : undefined
                                                }
                                            >
                                                {ACTION_LABEL[r.action] ?? r.action}
                                            </span>
                                            {r.note && (
                                                <span className="block text-xs text-neutral-500">
                                                    {r.note}
                                                    {r.minutes > 0 ? ` · ${r.minutes} min` : ''}
                                                    {r.ocr > 0
                                                        ? ` · ${fmt(r.ocr)} credits OCR`
                                                        : ''}
                                                </span>
                                            )}
                                        </td>
                                        <td className="py-2 pe-3 text-end text-neutral-800">
                                            {r.total > 0 ? fmt(r.total) : '—'}
                                            {r.images_max > 0 && (
                                                <span className="block text-xs text-neutral-400">
                                                    + up to {r.images_max} images
                                                </span>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                                {rows.length === 0 && !loading && (
                                    <tr>
                                        <td
                                            colSpan={4}
                                            className="py-4 text-center text-neutral-500"
                                        >
                                            Nothing to prepare.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                )}

                {t && (
                    <div className="space-y-1 rounded-md border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm">
                        <p className="flex justify-between">
                            <span>
                                {t.to_compile} slide(s) to prepare
                                {upToDate > 0 && !single ? `, ${upToDate} already prepared` : ''}
                                {t.needs_details > 0 ? `, ${t.needs_details} need details` : ''}
                            </span>
                            <span className="font-semibold text-neutral-900">
                                ≈ {fmt(t.required)} credits
                            </span>
                        </p>
                        <p className="text-xs text-neutral-500">
                            {fmt(t.compile_credits)} to compile
                            {t.transcription_minutes > 0
                                ? ` + ${fmt(t.transcription_credits)} for ${t.transcription_minutes} min of transcription`
                                : ''}
                            {t.ocr_pages > 0
                                ? ` + ${fmt(t.ocr_credits)} for OCR of ${t.ocr_pages} page(s)`
                                : ''}
                            {t.images_max > 0
                                ? ` + up to ${fmt(t.images_max_credits)} for AI images (charged per image made)`
                                : ''}
                            . Compiling a slide costs {fmt(estimate!.prices.compile_slide)} credits.
                        </p>
                        {estimate?.balance !== null && estimate?.balance !== undefined && (
                            <p
                                className={`text-xs ${insufficient ? 'text-danger-600' : 'text-neutral-500'}`}
                            >
                                Balance: {fmt(estimate.balance)} credits
                                {insufficient ? ' — not enough for this compile.' : ''}
                            </p>
                        )}
                    </div>
                )}

                <div className="flex justify-end gap-2">
                    <MyButton
                        buttonType="secondary"
                        scale="medium"
                        layoutVariant="default"
                        onClick={onClose}
                    >
                        Cancel
                    </MyButton>
                    <MyButton
                        buttonType="primary"
                        scale="medium"
                        layoutVariant="default"
                        disable={loading || !estimate || insufficient || nothing}
                        onClick={onConfirm}
                    >
                        <Sparkle className="size-4" />
                        {t ? `Prepare (≈ ${fmt(t.required)} credits)` : 'Prepare'}
                    </MyButton>
                </div>
            </DialogContent>
        </Dialog>
    );
};
