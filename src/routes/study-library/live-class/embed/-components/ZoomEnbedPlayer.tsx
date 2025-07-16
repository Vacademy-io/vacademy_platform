import { useState, useEffect, useRef } from "react";

interface ZoomEmbedPlayerProps {
  recordingUrl?: string;
}

/**
 * Zoom share links usually contain the path `/rec/share/` which renders a HTML page that
 * cannot be embedded due to X-Frame-Options headers. The actual embeddable player lives
 * under `/rec/play/`. This helper converts the share link to a play link and appends
 * the passcode if provided.
 */
const transformZoomRecordingUrl = (url: string): string => {
  // Convert /rec/share/… to /rec/play/… if needed
  if (url.includes("/rec/share/")) {
    return url.replace("/rec/share/", "/rec/play/");
  }
  return url;
};

const getEmbedUrl = (baseUrl: string, password?: string) => {
  let embedUrl = transformZoomRecordingUrl(baseUrl);
  if (password) {
    const hasQuery = embedUrl.includes("?");
    embedUrl = `${embedUrl}${hasQuery ? "&" : "?"}pwd=${encodeURIComponent(password)}`;
  }
  return embedUrl;
};

const ZoomEmbedPlayer = ({ recordingUrl }: ZoomEmbedPlayerProps) => {
  const embedUrl = recordingUrl ? getEmbedUrl(recordingUrl) : undefined;
  const [iframeLoaded, setIframeLoaded] = useState<boolean>(false);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);

  // Detect iframe load success
  useEffect(() => {
    if (!embedUrl) return;
    const timer = setTimeout(() => {
      if (!iframeLoaded) {
        // If the iframe hasn't loaded within 5s, likely blocked, so show fallback
        setIframeLoaded(false);
      }
    }, 5000);
    return () => clearTimeout(timer);
  }, [embedUrl, iframeLoaded]);

  if (!embedUrl) {
    return <div className="text-red-500">Recording link not provided.</div>;
  }

  return (
    <div className="w-full flex flex-col items-center justify-center gap-4">
      {/* Iframe player */}
      {embedUrl && (
        <div className="relative w-full" style={{ paddingTop: "56.25%" }}>
          {!iframeLoaded && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black text-white z-[1]">
              <svg className="animate-spin h-8 w-8 text-primary-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4l3-3-3-3v4a8 8 0 00-8 8h4l-3 3 3 3H4z"></path>
              </svg>
              <span className="text-sm">Connecting to Zoom...</span>
            </div>
          )}
          <iframe
            ref={iframeRef}
            onLoad={() => setIframeLoaded(true)}
            src={embedUrl}
            sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-presentation"
            allow="autoplay; fullscreen"
            allowFullScreen
            className="absolute top-0 left-0 w-full h-full rounded-lg border border-neutral-200"
            title="Zoom Recording"
          />
        </div>
      )}
    </div>
  );
};

export default ZoomEmbedPlayer;
