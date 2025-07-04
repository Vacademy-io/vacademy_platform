import {
  DocumentLoadEvent,
  PageChangeEvent,
  Viewer,
} from "@react-pdf-viewer/core";
import { Worker } from "@react-pdf-viewer/core";

import { defaultLayoutPlugin } from "@react-pdf-viewer/default-layout";
import { pageNavigationPlugin } from "@react-pdf-viewer/page-navigation";
import type {
  ToolbarProps,
  ToolbarSlot,
  TransformToolbarSlot,
} from "@react-pdf-viewer/toolbar";

import "@react-pdf-viewer/core/lib/styles/index.css";
import "@react-pdf-viewer/default-layout/lib/styles/index.css";
import "@react-pdf-viewer/page-navigation/lib/styles/index.css";
import { forwardRef, useImperativeHandle } from "react";

export interface PdfViewerComponentRef {
  jumpToPage: (pageIndex: number) => void;
}

export const PdfViewerComponent = forwardRef<PdfViewerComponentRef, {
  pdfUrl: string;
  handleDocumentLoad: (e: DocumentLoadEvent) => void;
  handlePageChange: (e: PageChangeEvent) => void;
  initialPage?: number;
}>(({
  pdfUrl,
  handleDocumentLoad,
  handlePageChange,
  initialPage = 0
}, ref) => {
  // Create page navigation plugin instance
  const pageNavigationPluginInstance = pageNavigationPlugin();
  const { jumpToPage } = pageNavigationPluginInstance;

  // Expose jumpToPage function through ref
  useImperativeHandle(ref, () => ({
    jumpToPage: (pageIndex: number) => {
      jumpToPage(pageIndex);
    },
  }), [jumpToPage]);

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
      <div className="w-full h-[calc(100vh-170px)] !max-w-none !mx-0 !px-0">
        <Viewer
          fileUrl={pdfUrl}
          onDocumentLoad={handleDocumentLoad}
          onPageChange={handlePageChange}
          plugins={[defaultLayoutPluginInstance, pageNavigationPluginInstance]}
          initialPage={initialPage}
        />
      </div>
    </Worker>
  );
});