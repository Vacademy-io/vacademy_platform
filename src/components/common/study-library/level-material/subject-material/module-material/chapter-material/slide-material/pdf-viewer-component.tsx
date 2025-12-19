import {
  DocumentLoadEvent,
  PageChangeEvent,
  Viewer,
  SpecialZoomLevel,
} from "@react-pdf-viewer/core";
import { Worker } from "@react-pdf-viewer/core";

import { defaultLayoutPlugin } from "@react-pdf-viewer/default-layout";
import { pageNavigationPlugin } from "@react-pdf-viewer/page-navigation";
import type {
  ToolbarProps,
  ToolbarSlot,
  TransformToolbarSlot,
} from "@react-pdf-viewer/toolbar";
import { Capacitor } from '@capacitor/core'; // Import Capacitor

import "@react-pdf-viewer/core/lib/styles/index.css";
import "@react-pdf-viewer/default-layout/lib/styles/index.css";
import "@react-pdf-viewer/page-navigation/lib/styles/index.css";
import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";

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
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [containerHeight, setContainerHeight] = useState<string | undefined>(undefined);
  
  // Platform check
  const isIOS = Capacitor.getPlatform() === 'ios';

  const pageNavigationPluginInstance = pageNavigationPlugin();
  const { jumpToPage } = pageNavigationPluginInstance;

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
  ) => (
    <div className="sticky top-0 z-10 bg-white">
      <Toolbar>{renderDefaultToolbar(transform)}</Toolbar>
    </div>
  );
  
  const defaultLayoutPluginInstance = defaultLayoutPlugin({
    renderToolbar,
  });
  
  const { renderDefaultToolbar } =
    defaultLayoutPluginInstance.toolbarPluginInstance;

  // Compute dynamic height for all mobile devices (iOS & Android) to handle URL bars/safe areas
  useEffect(() => {
    const computeHeight = () => {
      const w = window.innerWidth;
      const vh = window.innerHeight;
      
      let headerHeight = 60; 
      let bottomNavHeight = 0;
      
      if (w < 640) {
        headerHeight = 50;
        bottomNavHeight = 60; 
      } else if (w < 1024) {
        headerHeight = 70;
      } else {
        headerHeight = 80;
      }
      
      const totalOffset = headerHeight + bottomNavHeight + 10;
      const h = Math.max(300, vh - totalOffset);
      setContainerHeight(`${h}px`);
    };

    computeHeight();
    window.addEventListener("resize", computeHeight);
    window.addEventListener("orientationchange", computeHeight);
    
    // ResizeObserver is safe on modern browsers (Chrome/Safari/Edge)
    const resizeObserver = new ResizeObserver(computeHeight);
    resizeObserver.observe(document.body);
    
    return () => {
      window.removeEventListener("resize", computeHeight);
      window.removeEventListener("orientationchange", computeHeight);
      resizeObserver.disconnect();
    };
  }, []);

  return (
    <Worker workerUrl="https://unpkg.com/pdfjs-dist@3.11.174/build/pdf.worker.min.js">
      <div
        ref={containerRef}
        className="w-full max-w-full mx-0 px-0 overflow-y-scroll overflow-x-hidden custom-scrollbar"
        style={{
          height: containerHeight || "100%",
          minHeight: "300px",
          // Critical for mobile scrolling:
          touchAction: "pan-y", 
          WebkitOverflowScrolling: "touch",
          // 'contain' stops the bounce on iOS (iOS 16+) and Chrome Android
          // It is safe for Windows/Desktop (simply ignored or prevents pull-refresh)
          overscrollBehavior: "contain", 
          position: "relative",
        }}
      >
        <Viewer
          fileUrl={pdfUrl}
          onDocumentLoad={handleDocumentLoad}
          onPageChange={handlePageChange}
          plugins={[defaultLayoutPluginInstance, pageNavigationPluginInstance]}
          defaultScale={SpecialZoomLevel.PageWidth}
          initialPage={initialPage}
        />
      </div>
    </Worker>
  );
});