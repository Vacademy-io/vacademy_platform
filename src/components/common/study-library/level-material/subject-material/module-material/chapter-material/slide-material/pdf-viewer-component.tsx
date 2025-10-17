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

import "@react-pdf-viewer/core/lib/styles/index.css";
import "@react-pdf-viewer/default-layout/lib/styles/index.css";
import "@react-pdf-viewer/page-navigation/lib/styles/index.css";
import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";

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
  // Container ref to control scroll behavior on mobile
  const containerRef = useRef<HTMLDivElement | null>(null);
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

  // Prevent scroll chaining/bounce on iOS at container edges
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    let startY = 0;
    const onTouchStart = (e: TouchEvent) => {
      if (e.touches && e.touches.length > 0) {
        startY = e.touches[0].clientY;
      }
    };

    const onTouchMove = (e: TouchEvent) => {
      const scrollTop = el.scrollTop;
      const scrollHeight = el.scrollHeight;
      const offsetHeight = el.offsetHeight;

      if (!e.touches || e.touches.length === 0) return;
      const currentY = e.touches[0].clientY;
      const isScrollingUp = currentY > startY;

      const isAtTop = scrollTop <= 0;
      const isAtBottom = scrollTop + offsetHeight >= scrollHeight - 1;

      // If trying to scroll beyond edges, prevent default to stop page scroll/bounce
      if ((isAtTop && isScrollingUp) || (isAtBottom && !isScrollingUp)) {
        e.preventDefault();
      }
    };

    el.addEventListener("touchstart", onTouchStart, { passive: true });
    el.addEventListener("touchmove", onTouchMove as EventListener, {
      passive: false,
    });

    return () => {
      el.removeEventListener("touchstart", onTouchStart as EventListener);
      el.removeEventListener("touchmove", onTouchMove as EventListener);
    };
  }, []);

  return (
    <Worker workerUrl="https://unpkg.com/pdfjs-dist@3.11.174/build/pdf.worker.min.js">
      <div
        ref={containerRef}
        className="w-full h-[calc(100dvh-120px)] sm:h-[calc(100dvh-140px)] lg:h-[calc(100dvh-170px)] max-w-full mx-0 px-0 overflow-y-auto overflow-x-hidden overscroll-none custom-scrollbar"
        style={{ touchAction: "pan-y", WebkitOverflowScrolling: "touch" }}
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