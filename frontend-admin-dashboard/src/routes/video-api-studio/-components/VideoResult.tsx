import { useState, useCallback, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CheckCircle2, Copy, Check, Code2, Link2, Download, Loader2, ExternalLink } from 'lucide-react';
import { AIContentPlayer } from '@/components/ai-video-player/AIContentPlayer';
import {
    ContentType,
    getContentTypeLabel,
    requiresAudio,
    requestVideoRender,
    getVideoUrls,
} from '../-services/video-generation';
import { LatexRenderer } from './LatexRenderer';
import { toast } from 'sonner';

interface VideoResultProps {
    videoId: string;
    htmlUrl: string;
    audioUrl?: string;
    wordsUrl?: string;
    contentType?: ContentType;
    prompt: string;
    apiKey?: string;
}

type RenderState = 'idle' | 'submitting' | 'rendering' | 'done' | 'error';

export function VideoResult({
    videoId,
    htmlUrl,
    audioUrl,
    wordsUrl,
    contentType = 'VIDEO',
    prompt,
    apiKey,
}: VideoResultProps) {
    const [copiedUrl, setCopiedUrl] = useState(false);
    const [copiedEmbed, setCopiedEmbed] = useState(false);
    const [renderState, setRenderState] = useState<RenderState>('idle');
    const [videoDownloadUrl, setVideoDownloadUrl] = useState<string | null>(null);
    const [renderError, setRenderError] = useState<string | null>(null);
    const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

    const showDownload = (contentType === 'VIDEO' || requiresAudio(contentType)) && !!apiKey;

    // Check if video_url already exists on mount
    useEffect(() => {
        if (!apiKey) return;
        getVideoUrls(videoId, apiKey)
            .then((urls) => {
                if (urls.video_url) {
                    setVideoDownloadUrl(urls.video_url);
                    setRenderState('done');
                }
            })
            .catch(() => {});
    }, [videoId, apiKey]);

    // Cleanup polling on unmount
    useEffect(() => {
        return () => {
            if (pollingRef.current) clearInterval(pollingRef.current);
        };
    }, []);

    // Build the shareable URL
    const baseUrl = window.location.origin;
    const shareableUrl = `${baseUrl}/content/${videoId}?timeline=${encodeURIComponent(htmlUrl)}${audioUrl ? `&audio=${encodeURIComponent(audioUrl)}` : ''}${wordsUrl ? `&words=${encodeURIComponent(wordsUrl)}` : ''}`;

    const embedCode = `<iframe
  src="${shareableUrl}"
  width="100%"
  height="600"
  frameborder="0"
  allowfullscreen
  allow="autoplay; fullscreen"
  style="border-radius: 12px; overflow: hidden;"
></iframe>`;

    const handleCopyUrl = async () => {
        try {
            await navigator.clipboard.writeText(shareableUrl);
            setCopiedUrl(true);
            setTimeout(() => setCopiedUrl(false), 2000);
        } catch (error) {
            console.error('Failed to copy URL:', error);
        }
    };

    const handleCopyEmbed = async () => {
        try {
            await navigator.clipboard.writeText(embedCode);
            setCopiedEmbed(true);
            setTimeout(() => setCopiedEmbed(false), 2000);
        } catch (error) {
            console.error('Failed to copy embed code:', error);
        }
    };

    const handleRequestRender = useCallback(async () => {
        if (!apiKey || renderState === 'submitting' || renderState === 'rendering') return;

        setRenderState('submitting');
        setRenderError(null);

        try {
            await requestVideoRender(videoId, apiKey);
            setRenderState('rendering');
            toast.info('Video rendering started. This takes 2-5 minutes.');

            // Poll for completion
            let attempts = 0;
            const MAX_ATTEMPTS = 120; // 20 minutes at 10s interval
            pollingRef.current = setInterval(async () => {
                attempts++;
                if (attempts > MAX_ATTEMPTS) {
                    if (pollingRef.current) clearInterval(pollingRef.current);
                    setRenderState('error');
                    setRenderError('Render is taking too long. Please check history later.');
                    return;
                }

                try {
                    const urls = await getVideoUrls(videoId, apiKey);
                    if (urls.video_url) {
                        if (pollingRef.current) clearInterval(pollingRef.current);
                        setVideoDownloadUrl(urls.video_url);
                        setRenderState('done');
                        toast.success('Video ready for download!');
                    }
                } catch {
                    // ignore polling errors, keep trying
                }
            }, 10_000);
        } catch (error) {
            setRenderState('error');
            setRenderError(error instanceof Error ? error.message : 'Failed to start render');
            toast.error('Failed to start video render');
        }
    }, [videoId, apiKey, renderState]);

    const contentLabel = getContentTypeLabel(contentType);

    return (
        <div className="flex flex-col xl:flex-row gap-4 w-full items-start">
            {/* Left Column: Content Player */}
            <div className="flex-grow w-full xl:w-[70%] min-w-0">
                <div
                    className="flex overflow-hidden rounded-xl border-2 bg-black shadow-lg w-full"
                    style={{
                        aspectRatio: '16/9',
                        maxHeight: 'calc(100vh - 200px)',
                    }}
                >
                    <AIContentPlayer
                        timelineUrl={htmlUrl}
                        audioUrl={audioUrl}
                        wordsUrl={wordsUrl}
                        width={1920}
                        height={1080}
                        onDownloadClick={
                            showDownload && renderState === 'idle'
                                ? handleRequestRender
                                : videoDownloadUrl
                                  ? () => window.open(videoDownloadUrl, '_blank')
                                  : undefined
                        }
                    />
                </div>
            </div>

            {/* Right Column: Prompt, Status & Actions */}
            <div className="w-full xl:w-[30%] shrink-0 space-y-4">
                <div className="flex flex-col gap-4 rounded-xl border bg-card p-4 shadow-sm">
                    {/* Status & Content Label */}
                    <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="secondary" className="shrink-0 text-xs font-medium">
                            {contentLabel}
                        </Badge>
                        <Badge variant="outline" className="h-5 gap-1 bg-green-50 text-green-700 border-green-200">
                            <CheckCircle2 className="size-3" />
                            Ready
                        </Badge>
                    </div>

                    {/* Prompt Text */}
                    <div className="space-y-1">
                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                            Origin Prompt
                        </p>
                        <div className="text-sm text-foreground bg-muted/30 p-3 rounded-lg border border-border/50">
                            <LatexRenderer text={prompt} className="whitespace-pre-wrap max-h-48 overflow-y-auto" />
                        </div>
                    </div>

                    <hr className="border-border" />

                    {/* Actions Form */}
                    <div className="space-y-3">
                        {/* Share URL */}
                        <div className="space-y-1.5">
                            <label className="flex items-center gap-1.5 text-xs font-medium text-foreground">
                                <Link2 className="size-3.5" />
                                Shareable URL
                            </label>
                            <div className="flex items-center w-full rounded-md border bg-background px-2 py-0.5 shadow-sm">
                                <Input
                                    value={shareableUrl}
                                    readOnly
                                    className="h-8 flex-1 border-0 bg-transparent p-0 text-xs font-mono focus-visible:ring-0 focus-visible:ring-offset-0 shadow-none outline-none"
                                    onClick={(e) => e.currentTarget.select()}
                                />
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={handleCopyUrl}
                                    className="size-7 ml-1 shrink-0"
                                    title="Copy Link"
                                >
                                    {copiedUrl ? (
                                        <Check className="size-4 text-green-600" />
                                    ) : (
                                        <Copy className="size-4" />
                                    )}
                                </Button>
                            </div>
                        </div>

                        {/* Embed Code Trigger */}
                        <div className="space-y-1.5">
                            <label className="flex items-center gap-1.5 text-xs font-medium text-foreground">
                                <Code2 className="size-3.5" />
                                Embed Content
                            </label>
                            <Popover>
                                <PopoverTrigger asChild>
                                    <Button variant="outline" size="sm" className="w-full h-9 gap-2 shadow-sm justify-start">
                                        <Code2 className="size-4" />
                                        Get Embed Code
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-80 sm:w-96" align="end" side="left">
                                    <div className="space-y-3">
                                        <div className="flex items-center justify-between">
                                            <h4 className="font-medium text-sm">Embed Code</h4>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={handleCopyEmbed}
                                                className="h-7 gap-1.5 text-xs"
                                            >
                                                {copiedEmbed ? (
                                                    <>
                                                        <Check className="size-3 text-green-600" />
                                                        Copied!
                                                    </>
                                                ) : (
                                                    <>
                                                        <Copy className="size-3" />
                                                        Copy
                                                    </>
                                                )}
                                            </Button>
                                        </div>
                                        <pre className="max-h-48 overflow-auto rounded-lg bg-muted p-3 font-mono text-xs text-muted-foreground border">
                                            {embedCode}
                                        </pre>
                                        <p className="text-xs text-muted-foreground">
                                            Paste this code into your website to embed the content.
                                        </p>
                                    </div>
                                </PopoverContent>
                            </Popover>
                        </div>

                        {/* Download as Video */}
                        {showDownload && (
                            <div className="space-y-1.5">
                                <label className="flex items-center gap-1.5 text-xs font-medium text-foreground">
                                    <Download className="size-3.5" />
                                    Download Video
                                </label>

                                {renderState === 'done' && videoDownloadUrl ? (
                                    <a
                                        href={videoDownloadUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="flex items-center gap-2 w-full h-9 px-3 rounded-md border bg-green-50 text-green-700 text-sm font-medium hover:bg-green-100 transition-colors"
                                    >
                                        <Download className="size-4" />
                                        Download MP4
                                        <ExternalLink className="size-3 ml-auto" />
                                    </a>
                                ) : renderState === 'rendering' || renderState === 'submitting' ? (
                                    <div className="flex items-center gap-2 rounded-lg border bg-muted/30 p-3">
                                        <Loader2 className="size-4 animate-spin text-muted-foreground shrink-0" />
                                        <span className="text-xs text-muted-foreground">
                                            {renderState === 'submitting'
                                                ? 'Starting render...'
                                                : 'Rendering video (2-5 min)...'}
                                        </span>
                                    </div>
                                ) : (
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className="w-full h-9 gap-2 shadow-sm justify-start"
                                        onClick={handleRequestRender}
                                    >
                                        <Download className="size-4" />
                                        Render & Download MP4
                                    </Button>
                                )}

                                {renderState === 'error' && renderError && (
                                    <div className="space-y-1.5 rounded-md border border-destructive/30 bg-destructive/5 p-2">
                                        <p className="text-xs text-destructive">{renderError}</p>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            className="h-7 text-xs"
                                            onClick={handleRequestRender}
                                        >
                                            Retry
                                        </Button>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
