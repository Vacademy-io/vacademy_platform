import { useEffect, useMemo, useRef, useState } from "react";

const HEIGHT_MSG = "vac-html-slide-height";
const MAX_HEIGHT = 20000;

// Result protocol: creative HTML slides post these to report interactive
// outcomes (quiz score, game completion) so the platform can record them.
export type SlideResult = {
  score?: number;
  maxScore?: number;
  wrong?: number;
  timesSec?: number[];
};

// Injected into the sandboxed document so it can report its height (the frame
// has an opaque origin, so we can't read it directly — but postMessage works
// across origins). Also opens links in a new tab.
const RESIZE_SCRIPT = `<script>(function(){
  function post(){try{
    var h=Math.max(document.documentElement.scrollHeight, document.body?document.body.scrollHeight:0);
    parent.postMessage({type:'${HEIGHT_MSG}',height:h},'*');
  }catch(e){}}
  window.addEventListener('load',post);
  window.addEventListener('resize',post);
  try{new ResizeObserver(post).observe(document.documentElement);}catch(e){}
  setTimeout(post,300);setTimeout(post,1200);
  document.addEventListener('click',function(e){
    var a=e.target&&e.target.closest?e.target.closest('a[href]'):null;
    if(a){a.setAttribute('target','_blank');a.setAttribute('rel','noopener');}
  },true);
})();</script>`;

function withResizeScript(html: string): string {
  if (!html) return `<!DOCTYPE html><html><body></body></html>`;
  if (/<\/body>/i.test(html)) return html.replace(/<\/body>/i, `${RESIZE_SCRIPT}</body>`);
  return `${html}${RESIZE_SCRIPT}`;
}

/**
 * Renders a creative HTML document slide inside a sandboxed iframe.
 * `sandbox="allow-scripts"` WITHOUT `allow-same-origin` gives the document a
 * unique opaque origin: its CSS/JS/animations run but it is fully isolated from
 * the learner app (cannot read the parent DOM, cookies, or storage).
 */
export const HtmlSlideIframe = ({
  html,
  onLoad,
  onProgress,
  onComplete,
}: {
  html: string;
  onLoad?: () => void;
  onProgress?: (percent: number) => void;
  onComplete?: (result: SlideResult) => void;
}) => {
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const [height, setHeight] = useState(480);
  const srcDoc = useMemo(() => withResizeScript(html), [html]);
  // Keep latest handlers without re-subscribing the listener.
  const onProgressRef = useRef(onProgress);
  onProgressRef.current = onProgress;
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      if (e.source !== iframeRef.current?.contentWindow) return;
      const data = e.data as { type?: string; height?: number; percent?: number } & SlideResult;
      if (data?.type === HEIGHT_MSG && typeof data.height === "number") {
        setHeight(Math.min(Math.max(data.height, 120), MAX_HEIGHT));
      } else if (data?.type === "vacademy:progress" && typeof data.percent === "number") {
        onProgressRef.current?.(data.percent);
      } else if (data?.type === "vacademy:complete") {
        onCompleteRef.current?.({
          score: data.score,
          maxScore: data.maxScore,
          wrong: data.wrong,
          timesSec: Array.isArray(data.timesSec) ? data.timesSec : undefined,
        });
      }
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  return (
    <iframe
      ref={iframeRef}
      title="Document"
      sandbox="allow-scripts allow-popups allow-popups-to-escape-sandbox"
      srcDoc={srcDoc}
      onLoad={onLoad}
      className="w-full border-0 bg-white"
      allow="autoplay; fullscreen"
      // Height is driven by the document's reported content height (dynamic).
      style={{ height }}
    />
  );
};
