import { useEffect, useRef } from "react";
import { renderAsync } from "docx-preview";
import { DashboardLoader } from "@/components/core/dashboard-loader";

interface DocViewerProps {
  docUrl: string;
  documentId: string;
}

export const DocViewer = ({ docUrl, documentId }: DocViewerProps) => {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const loadDocument = async () => {
      if (!containerRef.current) return;

      try {
        console.log("Loading document from URL:", docUrl);
        const response = await fetch(docUrl);
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        console.log("Document fetched successfully");
        
        const blob = await response.blob();
        console.log("Document blob created:", blob.type, blob.size);
        
        const arrayBuffer = await blob.arrayBuffer();
        console.log("Array buffer created, size:", arrayBuffer.byteLength);

        await renderAsync(arrayBuffer, containerRef.current, undefined, {
          className: "docx-viewer",
          inWrapper: true,
          ignoreWidth: false,
          ignoreHeight: false,
          ignoreFonts: false,
          breakPages: true,
          useBase64URL: true,
        });
        console.log("Document rendered successfully");
      } catch (error) {
        console.error("Error loading DOC file:", error);
        if (containerRef.current) {
          containerRef.current.innerHTML = `
            <div class="flex h-[500px] items-center justify-center">
              <p class="text-red-500">Failed to load document: ${error instanceof Error ? error.message : 'Unknown error'}</p>
            </div>
          `;
        }
      }
    };

    loadDocument();
  }, [docUrl, documentId]);

  return (
    <div className="h-full w-full overflow-auto bg-white p-4">
      <div ref={containerRef} className="min-h-[500px]">
        <DashboardLoader />
      </div>
    </div>
  );
};