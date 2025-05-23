import {
  DocumentLoadEvent,
  PageChangeEvent,
  Viewer,
} from "@react-pdf-viewer/core";
import { Worker } from "@react-pdf-viewer/core";

import { defaultLayoutPlugin } from "@react-pdf-viewer/default-layout";
import type {
  ToolbarProps,
  ToolbarSlot,
  TransformToolbarSlot,
} from "@react-pdf-viewer/toolbar";

import "@react-pdf-viewer/core/lib/styles/index.css";
import "@react-pdf-viewer/default-layout/lib/styles/index.css";

export const PdfViewerComponent = ({
  pdfUrl,
  handleDocumentLoad,
  handlePageChange,
  initialPage=0
}: {
  pdfUrl: string;
  handleDocumentLoad: (e: DocumentLoadEvent) => void;
  handlePageChange: (e: PageChangeEvent) => void;
  initialPage?: number;
}) => {
  const transform: TransformToolbarSlot = (slot: ToolbarSlot) => ({
    ...slot,
    Download: () => <></>,
    DownloadMenuItem: () => <></>,
    Open: () => <></>,
    Print: () => <></>,
    SwitchSelectionModeMenuItem: () => <></>,
  });
  const renderToolbar = (
    Toolbar: (props: ToolbarProps) => React.ReactElement
  ) => <Toolbar>{renderDefaultToolbar(transform)}</Toolbar>;
  const defaultLayoutPluginInstance = defaultLayoutPlugin({
    renderToolbar,
  });
  const { renderDefaultToolbar } =
    defaultLayoutPluginInstance.toolbarPluginInstance;

  return (
    <Worker workerUrl="https://unpkg.com/pdfjs-dist@3.11.174/build/pdf.worker.min.js">
      <div className="w-full h-[calc(100vh-170px)]">
        <Viewer
          fileUrl={pdfUrl}
          onDocumentLoad={handleDocumentLoad}
          onPageChange={handlePageChange}
          plugins={[defaultLayoutPluginInstance]}
          initialPage={initialPage}
        />
      </div>
    </Worker>
  );
};
