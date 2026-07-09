import SimplePDFViewer from "@/components/common/simple-pdf-viewer";

const IMAGE_EXT = /\.(png|jpe?g|gif|webp|bmp|svg|heic|heif|avif)$/i;

/**
 * Whether a file should be shown as an image. Prefers the MIME type from
 * media-service; falls back to the filename extension. Admin uploads for
 * answer sheets allow PDF / JPEG / PNG, so anything non-image is treated as a
 * PDF for rendering.
 */
export function isImageFile(
  fileType?: string | null,
  fileName?: string | null
): boolean {
  if (fileType && fileType.toLowerCase().startsWith("image/")) return true;
  if (fileName && IMAGE_EXT.test(fileName.trim())) return true;
  return false;
}

interface FilePreviewProps {
  url: string;
  fileName?: string;
  fileType?: string;
}

/**
 * Renders a media-service file in its actual format: images inline, everything
 * else (PDF) in the in-app PDF viewer. Keeps the learner side in lockstep with
 * whatever the admin uploaded instead of assuming a PDF.
 */
export function FilePreview({ url, fileName, fileType }: FilePreviewProps) {
  if (isImageFile(fileType, fileName)) {
    return (
      <div className="flex size-full items-center justify-center overflow-auto bg-neutral-100 p-4">
        <img
          src={url}
          alt={fileName || "Attachment"}
          className="max-h-full max-w-full object-contain"
        />
      </div>
    );
  }
  return <SimplePDFViewer pdfUrl={url} fileName={fileName} />;
}

export default FilePreview;
