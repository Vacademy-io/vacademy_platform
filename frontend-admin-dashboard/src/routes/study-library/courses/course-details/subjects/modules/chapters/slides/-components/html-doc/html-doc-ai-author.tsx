import { useEffect, useMemo, useRef, useState } from 'react';
import {
    MagicWand,
    Code,
    Spinner,
    Image as ImageIcon,
    FilePdf,
    X,
    ArrowArcLeft,
    ArrowArcRight,
} from '@phosphor-icons/react';
import { toast } from 'sonner';
import { MyButton } from '@/components/design-system/button';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { UploadFileInS3, getPublicUrl } from '@/services/upload_file';
import { getTokenFromCookie, getTokenDecodedData } from '@/lib/auth/sessionUtility';
import { TokenKey } from '@/constants/auth/tokens';
import { useInstituteDetailsStore } from '@/stores/students/students-list/useInstituteDetailsStore';
import { useToolCostPreview } from '@/components/common/ai-credits/useToolCostPreview';
import { Slide } from '../../-hooks/use-slides';
import { getInitialHtmlDocContent } from './html-doc-utils';
import { generateHtmlDocumentStream, HTML_CONTENT_TYPES } from './html-doc-ai-service';
import { HtmlSlidePreview } from '@/components/html-slide/html-slide-preview';

type HtmlDocAiAuthorProps = {
    slide: Slide;
    isLearnerView?: boolean;
    onHtmlChange: (slideId: string, html: string) => void;
};

type UploadedImage = { url: string; name: string };
type UploadedPdf = { fileId: string; name: string };

function currentUserId(): string {
    const data = getTokenDecodedData(getTokenFromCookie(TokenKey.accessToken));
    return (data as unknown as { userId?: string; sub?: string })?.userId || data?.sub || '';
}

/**
 * Authoring surface for the HTML Document slide type — no rich-text editor.
 * The admin supplies materials (images, a PDF, key points) + picks the content
 * sections they want, then AI generates a creative, self-contained HTML page
 * (rendered in a sandboxed iframe). Editing is conversational: each instruction
 * produces a new, revertible version.
 */
export function HtmlDocAiAuthor({ slide, isLearnerView = false, onHtmlChange }: HtmlDocAiAuthorProps) {
    const initial = useMemo(() => getInitialHtmlDocContent(slide), [slide.id]); // eslint-disable-line react-hooks/exhaustive-deps
    // Version history (in-session). versions[versionIndex] is the live doc.
    const [versions, setVersions] = useState<string[]>(initial ? [initial] : []);
    const [versionIndex, setVersionIndex] = useState(initial ? 0 : -1);

    const [prompt, setPrompt] = useState('');
    const [keyPoints, setKeyPoints] = useState('');
    const [contentTypes, setContentTypes] = useState<string[]>([]);
    const [images, setImages] = useState<UploadedImage[]>([]);
    const [pdf, setPdf] = useState<UploadedPdf | null>(null);
    const [isGenerating, setIsGenerating] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const [showSource, setShowSource] = useState(false);
    const [testResult, setTestResult] = useState<string | null>(null);
    // Live-stream buffer while generating (null = not streaming).
    const [streamingHtml, setStreamingHtml] = useState<string | null>(null);
    const abortRef = useRef<AbortController | null>(null);
    const streamTsRef = useRef(0);

    // Institute brand kit — applied so slides across a course share an identity.
    const { instituteDetails } = useInstituteDetailsStore();
    const brandColor = instituteDetails?.institute_theme_code || '';
    const brandName = instituteDetails?.institute_name || '';
    const [brandLogoUrl, setBrandLogoUrl] = useState('');
    const [useBrand, setUseBrand] = useState(true);
    const hasBrand = !!(brandColor || brandLogoUrl);

    useEffect(() => {
        const fileId = instituteDetails?.institute_logo_file_id;
        if (!fileId) return;
        let active = true;
        void getPublicUrl(fileId).then((url) => {
            if (active && url) setBrandLogoUrl(url);
        });
        return () => {
            active = false;
        };
    }, [instituteDetails?.institute_logo_file_id]);

    const slideIdRef = useRef(slide.id);
    slideIdRef.current = slide.id;
    const imageInputRef = useRef<HTMLInputElement | null>(null);
    const pdfInputRef = useRef<HTMLInputElement | null>(null);

    const html = (versionIndex >= 0 ? versions[versionIndex] : '') ?? '';
    const hasContent = !!html.trim();

    // Per-generation credit cost (read live from cached tool-pricing rates).
    // Create and edit are priced differently.
    const { credits: costCredits } = useToolCostPreview(
        hasContent ? 'html_document_edit' : 'html_document',
        {}
    );

    const commit = (next: string) => onHtmlChange(slideIdRef.current, next);

    const pushVersion = (next: string) => {
        setVersions((prev) => {
            const trimmed = prev.slice(0, versionIndex + 1);
            const updated = [...trimmed, next];
            setVersionIndex(updated.length - 1);
            return updated;
        });
        commit(next);
    };

    const goToVersion = (idx: number) => {
        const target = versions[idx];
        if (target === undefined) return;
        setVersionIndex(idx);
        commit(target);
    };

    const toggleType = (key: string) =>
        setContentTypes((prev) =>
            prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
        );

    const onPickImages = async (files: FileList | null) => {
        if (!files || !files.length) return;
        setIsUploading(true);
        try {
            const userId = currentUserId();
            const uploaded: UploadedImage[] = [];
            for (const file of Array.from(files)) {
                const fileId = await UploadFileInS3(file, () => {}, userId, 'STUDENTS', undefined, true);
                if (!fileId) continue;
                const url = await getPublicUrl(fileId);
                if (url) uploaded.push({ url, name: file.name });
            }
            if (uploaded.length) setImages((prev) => [...prev, ...uploaded]);
        } catch {
            toast.error('Some images failed to upload.');
        } finally {
            setIsUploading(false);
            if (imageInputRef.current) imageInputRef.current.value = '';
        }
    };

    const onPickPdf = async (files: FileList | null) => {
        const file = files?.[0];
        if (!file) return;
        setIsUploading(true);
        try {
            const fileId = await UploadFileInS3(file, () => {}, currentUserId(), 'STUDENTS');
            if (fileId) setPdf({ fileId, name: file.name });
        } catch {
            toast.error('PDF failed to upload.');
        } finally {
            setIsUploading(false);
            if (pdfInputRef.current) pdfInputRef.current.value = '';
        }
    };

    const runGenerate = async () => {
        const text = prompt.trim();
        const kp = keyPoints
            .split('\n')
            .map((s) => s.trim())
            .filter(Boolean);
        // For a first generation we need SOMETHING to work from.
        if (!hasContent && !text && !contentTypes.length && !kp.length && !pdf) {
            toast.error('Describe the page, pick sections, add key points, or attach a PDF.');
            return;
        }
        setIsGenerating(true);
        setStreamingHtml('');
        streamTsRef.current = 0;
        const controller = new AbortController();
        abortRef.current = controller;
        try {
            const generated = await generateHtmlDocumentStream(
                {
                    prompt: text,
                    currentHtml: hasContent ? html : null,
                    brand:
                        useBrand && hasBrand
                            ? { primaryColor: brandColor, logoUrl: brandLogoUrl, name: brandName }
                            : null,
                    contentTypes: hasContent ? undefined : contentTypes,
                    keyPoints: kp,
                    imageUrls: images.map((i) => i.url),
                    referenceFileIds: pdf ? [pdf.fileId] : undefined,
                },
                {
                    signal: controller.signal,
                    onDelta: (acc) => {
                        // Throttle preview refreshes — re-rendering the iframe on
                        // every token would thrash. ~3/sec is enough to feel live.
                        const now = Date.now();
                        if (now - streamTsRef.current > 350) {
                            streamTsRef.current = now;
                            setStreamingHtml(acc);
                        }
                    },
                }
            );
            pushVersion(generated);
            setPrompt('');
            toast.success(hasContent ? 'Updated.' : 'Document created.');
        } catch (e) {
            if ((e as Error)?.name === 'AbortError') {
                toast.info('Generation cancelled.');
            } else {
                toast.error(e instanceof Error ? e.message : 'Generation failed.');
            }
        } finally {
            abortRef.current = null;
            setStreamingHtml(null);
            setIsGenerating(false);
        }
    };

    const cancelGenerate = () => abortRef.current?.abort();

    if (isLearnerView) {
        return (
            <div className="mx-auto w-full max-w-5xl px-4 pb-10">
                <HtmlSlidePreview html={html} />
            </div>
        );
    }

    return (
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-4 px-4 pb-10">
            {/* Compose / edit controls */}
            <div className="rounded-lg border border-primary-100 bg-primary-50 p-3">
                <div className="mb-2 flex items-center gap-2 text-subtitle font-semibold text-primary-500">
                    <MagicWand className="size-4" />
                    {hasContent ? 'Edit with AI' : 'Create with AI'}
                </div>

                {/* Materials (create) — attach reference PDF + images, pick sections */}
                {!hasContent && (
                    <div className="mb-3 flex flex-col gap-3">
                        <div className="flex flex-wrap items-center gap-2">
                            <input
                                ref={imageInputRef}
                                type="file"
                                accept="image/*"
                                multiple
                                className="hidden"
                                onChange={(e) => void onPickImages(e.target.files)}
                            />
                            <input
                                ref={pdfInputRef}
                                type="file"
                                accept="application/pdf"
                                className="hidden"
                                onChange={(e) => void onPickPdf(e.target.files)}
                            />
                            <MyButton
                                buttonType="secondary"
                                scale="small"
                                disable={isUploading}
                                onClick={() => imageInputRef.current?.click()}
                            >
                                <ImageIcon className="size-4" /> Add images
                            </MyButton>
                            <MyButton
                                buttonType="secondary"
                                scale="small"
                                disable={isUploading || !!pdf}
                                onClick={() => pdfInputRef.current?.click()}
                            >
                                <FilePdf className="size-4" /> Attach PDF
                            </MyButton>
                            {isUploading && <Spinner className="size-4 animate-spin text-primary-500" />}
                        </div>
                        {pdf && (
                            <p className="text-caption text-neutral-400">
                                Grounding in a PDF adds a per-page conversion charge on top of the
                                generation cost.
                            </p>
                        )}

                        {/* Uploaded material chips */}
                        {(images.length > 0 || pdf) && (
                            <div className="flex flex-wrap gap-2">
                                {pdf && (
                                    <span
                                        className="flex items-center gap-1 rounded-md border border-neutral-200 bg-white px-2 py-1 text-caption text-neutral-600"
                                        title="Grounding in a PDF adds a per-page conversion charge"
                                    >
                                        <FilePdf className="size-3.5 text-danger-500" />
                                        {pdf.name}
                                        <button type="button" onClick={() => setPdf(null)}>
                                            <X className="size-3.5 text-neutral-400 hover:text-danger-500" />
                                        </button>
                                    </span>
                                )}
                                {images.map((img, i) => (
                                    <span
                                        key={img.url}
                                        className="flex items-center gap-1 rounded-md border border-neutral-200 bg-white px-2 py-1 text-caption text-neutral-600"
                                    >
                                        <ImageIcon className="size-3.5 text-primary-500" />
                                        {img.name}
                                        <button
                                            type="button"
                                            onClick={() =>
                                                setImages((prev) => prev.filter((_, j) => j !== i))
                                            }
                                        >
                                            <X className="size-3.5 text-neutral-400 hover:text-danger-500" />
                                        </button>
                                    </span>
                                ))}
                            </div>
                        )}

                        {/* Content-type chips */}
                        <div className="flex flex-col gap-1.5">
                            <span className="text-caption font-medium text-neutral-500">
                                Include (optional)
                            </span>
                            <div className="flex flex-wrap gap-2">
                                {HTML_CONTENT_TYPES.map((ct) => {
                                    const on = contentTypes.includes(ct.key);
                                    return (
                                        <button
                                            key={ct.key}
                                            type="button"
                                            onClick={() => toggleType(ct.key)}
                                            className={cn(
                                                'rounded-full border px-3 py-1 text-caption transition-colors',
                                                on
                                                    ? 'border-primary-500 bg-primary-500 text-white'
                                                    : 'border-neutral-300 bg-white text-neutral-600 hover:border-primary-300'
                                            )}
                                        >
                                            {ct.label}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Key points */}
                        <Textarea
                            value={keyPoints}
                            onChange={(e) => setKeyPoints(e.target.value)}
                            placeholder="Optional key points to cover — one per line"
                            className="min-h-16 resize-y border-neutral-300 text-caption"
                        />
                    </div>
                )}

                {/* Brand kit toggle — keeps slides across a course on-brand */}
                {hasBrand && (
                    <label className="mb-2 flex w-fit cursor-pointer items-center gap-2 text-caption text-neutral-600">
                        <input
                            type="checkbox"
                            checked={useBrand}
                            onChange={(e) => setUseBrand(e.target.checked)}
                            className="accent-primary-500"
                        />
                        <span className="flex items-center gap-1.5">
                            Match {brandName || 'institute'} brand
                            {brandColor && (
                                <span
                                    className="size-3 rounded-full border border-neutral-200"
                                    // Dynamic institute brand color from settings.
                                    style={{ backgroundColor: brandColor }}
                                />
                            )}
                        </span>
                    </label>
                )}

                {/* Prompt / instruction */}
                <div className="flex items-end gap-2">
                    <Textarea
                        value={prompt}
                        onChange={(e) => setPrompt(e.target.value)}
                        disabled={isGenerating}
                        placeholder={
                            hasContent
                                ? 'Describe a change — e.g. "make the quiz harder and add a drag-drop game"'
                                : 'Describe the page — e.g. "an interactive lesson on photosynthesis"'
                        }
                        className="min-h-16 flex-1 resize-y border-neutral-300 text-body focus-visible:ring-primary-200"
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                                e.preventDefault();
                                void runGenerate();
                            }
                        }}
                    />
                    {isGenerating ? (
                        <MyButton buttonType="secondary" scale="medium" onClick={cancelGenerate}>
                            <X className="size-4" /> Cancel
                        </MyButton>
                    ) : (
                        <MyButton
                            buttonType="primary"
                            scale="medium"
                            disable={isUploading}
                            onClick={() => void runGenerate()}
                        >
                            <MagicWand className="size-4" />
                            {hasContent ? 'Update' : 'Generate'}
                            {costCredits != null && (
                                <span className="ml-1 rounded-full bg-white/20 px-1.5 py-0.5 text-caption">
                                    {costCredits} {costCredits === 1 ? 'credit' : 'credits'}
                                </span>
                            )}
                        </MyButton>
                    )}
                </div>
                <p className="mt-2 text-caption text-neutral-400">
                    Authored by AI so the page can be freely creative — animations, interactive
                    quizzes and games all run. ⌘/Ctrl + Enter to generate.
                </p>
            </div>

            {/* Result */}
            {streamingHtml !== null ? (
                <div className="overflow-hidden rounded-lg border border-primary-200">
                    <div className="flex items-center justify-between border-b border-primary-100 bg-primary-50 px-3 py-2">
                        <span className="flex items-center gap-2 text-caption font-medium text-primary-500">
                            <Spinner className="size-4 animate-spin" /> Building your page…
                        </span>
                        <MyButton buttonType="secondary" scale="small" onClick={cancelGenerate}>
                            <X className="size-4" /> Cancel
                        </MyButton>
                    </div>
                    {streamingHtml.trim() ? (
                        <HtmlSlidePreview html={streamingHtml} />
                    ) : (
                        <div className="flex items-center justify-center gap-2 py-16 text-caption text-neutral-400">
                            <Spinner className="size-4 animate-spin" /> Starting…
                        </div>
                    )}
                </div>
            ) : hasContent ? (
                <div className="overflow-hidden rounded-lg border border-neutral-200">
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-neutral-100 bg-neutral-50 px-3 py-2">
                        {/* Version history */}
                        <div className="flex items-center gap-1">
                            <button
                                type="button"
                                title="Previous version"
                                disabled={versionIndex <= 0}
                                onClick={() => goToVersion(versionIndex - 1)}
                                className="rounded p-1 text-neutral-500 hover:bg-neutral-100 disabled:opacity-40"
                            >
                                <ArrowArcLeft className="size-4" />
                            </button>
                            <div className="flex items-center gap-1">
                                {versions.map((_, i) => (
                                    <button
                                        key={i}
                                        type="button"
                                        title={`Version ${i + 1}`}
                                        onClick={() => goToVersion(i)}
                                        className={cn(
                                            'rounded px-1.5 py-0.5 text-caption',
                                            i === versionIndex
                                                ? 'bg-primary-500 text-white'
                                                : 'text-neutral-500 hover:bg-neutral-100'
                                        )}
                                    >
                                        v{i + 1}
                                    </button>
                                ))}
                            </div>
                            <button
                                type="button"
                                title="Next version"
                                disabled={versionIndex >= versions.length - 1}
                                onClick={() => goToVersion(versionIndex + 1)}
                                className="rounded p-1 text-neutral-500 hover:bg-neutral-100 disabled:opacity-40"
                            >
                                <ArrowArcRight className="size-4" />
                            </button>
                        </div>
                        <MyButton
                            buttonType="secondary"
                            scale="small"
                            onClick={() => setShowSource((s) => !s)}
                        >
                            <Code className="size-4" />
                            {showSource ? 'Hide HTML' : 'View / edit HTML'}
                        </MyButton>
                    </div>
                    {showSource ? (
                        <div className="p-3">
                            <Textarea
                                value={html}
                                onChange={(e) => {
                                    // Edit the live version in place.
                                    const next = e.target.value;
                                    setVersions((prev) => {
                                        const updated = [...prev];
                                        updated[versionIndex] = next;
                                        return updated;
                                    });
                                    commit(next);
                                }}
                                spellCheck={false}
                                className="min-h-80 resize-y whitespace-pre font-mono text-caption"
                            />
                        </div>
                    ) : (
                        <>
                            {testResult && (
                                <div className="border-b border-success-100 bg-success-50 px-3 py-1.5 text-caption text-success-600">
                                    ✓ Reports results to the gradebook — you scored {testResult} in
                                    this preview.
                                </div>
                            )}
                            <HtmlSlidePreview
                                html={html}
                                onResult={(r) => {
                                    const parts: string[] = [];
                                    if (typeof r.score === 'number' && typeof r.maxScore === 'number')
                                        parts.push(`${r.score}/${r.maxScore}`);
                                    else if (typeof r.wrong === 'number')
                                        parts.push(`${r.wrong} wrong`);
                                    setTestResult(parts.join(' · ') || 'completed');
                                }}
                            />
                        </>
                    )}
                </div>
            ) : (
                <div
                    className={cn(
                        'flex flex-col items-center justify-center rounded-lg border border-dashed border-neutral-200 py-16 text-center',
                        isGenerating && 'opacity-60'
                    )}
                >
                    <MagicWand className="size-8 text-neutral-300" />
                    <p className="mt-3 text-body font-medium text-neutral-500">
                        {isGenerating ? 'Creating your page…' : 'No content yet'}
                    </p>
                    <p className="mt-1 max-w-sm text-caption text-neutral-400">
                        {isGenerating
                            ? 'The AI is designing a rich, self-contained page from your materials. This can take up to a minute.'
                            : 'Add materials and describe what you want, then generate.'}
                    </p>
                </div>
            )}
        </div>
    );
}
