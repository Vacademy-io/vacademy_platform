import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Copy, ArrowSquareOut } from "@phosphor-icons/react";
import { toast } from "sonner";
import { getPublicUrl } from "@/services/upload_file";
import { appendYouTubeEmbedOrigin } from "@/utils/youtube-embed";
import { LearnerRecording } from "../-types/types";

interface RecordingPlayerDialogProps {
  recording: LearnerRecording | null;
  title: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// Extracts an 11-char YouTube video id from watch/short/embed URL shapes.
const extractYoutubeId = (url: string): string | null => {
  const match = url.match(
    /(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/
  );
  return match ? match[1]! : null;
};

export const RecordingPlayerDialog = ({
  recording,
  title,
  open,
  onOpenChange,
}: RecordingPlayerDialogProps) => {
  const [s3Url, setS3Url] = useState<string | null>(null);
  const [resolving, setResolving] = useState(false);

  useEffect(() => {
    if (!open || !recording || recording.playback_type !== "S3") {
      setS3Url(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        setResolving(true);
        const idOrUrl = recording.file_id || recording.url;
        const resolved = await getPublicUrl(idOrUrl);
        if (!cancelled) setS3Url(resolved);
      } catch (err) {
        console.error("Failed to resolve recording URL:", err);
        if (!cancelled) toast.error("Failed to load the recording.");
      } finally {
        if (!cancelled) setResolving(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, recording]);

  if (!recording) return null;

  const handleCopyPasscode = async () => {
    if (!recording.passcode) return;
    await navigator.clipboard.writeText(recording.passcode);
    toast.success("Passcode copied");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold text-neutral-800 dark:text-neutral-100">
            {title}
          </DialogTitle>
        </DialogHeader>

        {recording.playback_type === "S3" && (
          <div className="mt-2">
            {resolving || !s3Url ? (
              <div className="flex h-64 items-center justify-center text-neutral-500 dark:text-neutral-400">
                Loading recording…
              </div>
            ) : (
              <video
                src={s3Url}
                controls
                autoPlay
                // Recordings are watch-only: strip the browser's Download control,
                // PiP, and the right-click "Save video as…" menu. (Deterrent, not
                // DRM — the stream itself must remain fetchable to play.)
                controlsList="nodownload noremoteplayback"
                disablePictureInPicture
                onContextMenu={(e) => e.preventDefault()}
                className="w-full rounded-lg bg-black"
                // eslint-disable-next-line react/forbid-dom-props -- viewport-relative cap has no design token
                style={{ maxHeight: "70vh" }}
              />
            )}
          </div>
        )}

        {recording.playback_type === "YOUTUBE" && recording.url && (
          <div className="mt-2 aspect-video w-full overflow-hidden rounded-lg bg-black">
            {extractYoutubeId(recording.url) ? (
              <iframe
                className="h-full w-full"
                src={appendYouTubeEmbedOrigin(
                  `https://www.youtube.com/embed/${extractYoutubeId(recording.url)}`
                )}
                title={title}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                referrerPolicy="strict-origin-when-cross-origin"
              />
            ) : (
              <div className="flex h-full items-center justify-center text-neutral-300">
                Unable to embed this video.
              </div>
            )}
          </div>
        )}

        {recording.playback_type === "ZOOM_CLOUD" && (
          <div className="mt-2 space-y-3 rounded-lg border border-neutral-200 dark:border-neutral-800 p-4">
            <p className="text-sm text-neutral-600 dark:text-neutral-300">
              This recording is hosted on Zoom Cloud. Open it in a new tab to watch.
            </p>
            {recording.passcode && (
              <div className="flex items-center gap-2">
                <span className="text-sm text-neutral-600 dark:text-neutral-300">
                  Passcode: <span className="font-mono font-medium">{recording.passcode}</span>
                </span>
                <Button variant="outline" size="sm" onClick={handleCopyPasscode}>
                  <Copy size={14} className="me-1.5" />
                  Copy
                </Button>
              </div>
            )}
            {recording.expires_at && (
              <p className="text-xs text-neutral-500 dark:text-neutral-400">
                This link may expire around {new Date(recording.expires_at).toLocaleDateString()}.
              </p>
            )}
            {recording.url && (
              <Button
                variant="default"
                size="sm"
                onClick={() => window.open(recording.url, "_blank", "noopener,noreferrer")}
              >
                <ArrowSquareOut size={16} className="me-1.5" />
                Open recording
              </Button>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
