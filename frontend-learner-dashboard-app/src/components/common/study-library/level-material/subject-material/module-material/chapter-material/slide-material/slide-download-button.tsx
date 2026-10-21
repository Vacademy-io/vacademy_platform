import { useState } from "react";
import { useTranslation } from "react-i18next";
import { DownloadSimple, SpinnerGap } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useSlideDownloadPermission } from "@/hooks/useSlideDownloadPermission";

/**
 * A Download button for a slide's own file, shown only when Content Protection
 * (SLIDE_DOWNLOAD_PERMISSION_SETTING) lets this user's role download `typeKey`.
 * The learner defaults for the types it is used with (DOCUMENT_DOC, AUDIO) are
 * off, so nothing shows until an institute switches them on.
 *
 * Source: `html` (an editor-authored document, saved as an .html file) or `url`
 * (fetched as a blob so the file keeps a real name and extension; when the
 * fetch is refused — e.g. CORS — the file opens in a new tab instead).
 */

const MIME_EXT: Record<string, string> = {
  "audio/mpeg": "mp3",
  "audio/mp3": "mp3",
  "audio/mp4": "m4a",
  "audio/x-m4a": "m4a",
  "audio/aac": "aac",
  "audio/wav": "wav",
  "audio/x-wav": "wav",
  "audio/ogg": "ogg",
  "audio/webm": "webm",
  "application/msword": "doc",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
  "application/pdf": "pdf",
  "text/html": "html",
};

/** A file name from the slide title: no path or reserved characters, never empty. */
const safeBaseName = (title: string | null | undefined): string =>
  (title || "")
    .replace(/[\\/:*?"<>|]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120) || "download";

/** The extension in a URL's path ("…/file.docx?sig=…" → "docx"), if it has one. */
const extFromUrl = (url: string): string | null => {
  try {
    const path = new URL(url, window.location.href).pathname;
    const m = path.match(/\.([A-Za-z0-9]{1,5})$/);
    return m ? m[1]!.toLowerCase() : null;
  } catch {
    return null;
  }
};

const saveBlob = (blob: Blob, name: string) => {
  const objectUrl = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = objectUrl;
  link.download = name;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.setTimeout(() => window.URL.revokeObjectURL(objectUrl), 1000);
};

interface SlideDownloadButtonProps {
  /** SlideDownloadTypeKey the permission is read for (DOCUMENT_DOC, AUDIO…). */
  typeKey: string;
  /** The slide title, used for the file name. */
  title?: string | null;
  /** A file to download. */
  url?: string | null;
  /** Or an editor-authored HTML document, saved as an .html file. */
  html?: string | null;
  /** Expected type when the server does not say ("audio/mpeg"). */
  mimeType?: string;
  className?: string;
}

export const SlideDownloadButton = ({
  typeKey,
  title,
  url,
  html,
  mimeType,
  className,
}: SlideDownloadButtonProps) => {
  const { t } = useTranslation("libraryCommonA");
  const { canDownload } = useSlideDownloadPermission();
  const [busy, setBusy] = useState(false);

  if (!canDownload(typeKey) || (!url && !html)) return null;

  const download = async () => {
    const base = safeBaseName(title);
    if (html) {
      const doc = /<html[\s>]/i.test(html)
        ? html
        : `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${base}</title></head><body>${html}</body></html>`;
      saveBlob(new Blob([doc], { type: "text/html;charset=utf-8" }), `${base}.html`);
      return;
    }
    if (!url) return;
    setBusy(true);
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const blob = await response.blob();
      const type = (blob.type || mimeType || "").toLowerCase().split(";")[0]!.trim();
      const ext = MIME_EXT[type] || extFromUrl(url) || (mimeType ? MIME_EXT[mimeType] : undefined);
      saveBlob(blob, ext ? `${base}.${ext}` : base);
    } catch {
      // The file host refused a cross-origin fetch: let the browser open it.
      window.open(url, "_blank", "noopener,noreferrer");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={download}
      disabled={busy}
      className={cn("gap-1.5", className)}
    >
      {busy ? (
        <SpinnerGap className="size-4 animate-spin" aria-hidden />
      ) : (
        <DownloadSimple className="size-4" aria-hidden />
      )}
      {t("common.download")}
    </Button>
  );
};
