import { useEffect, useMemo, useRef, useState } from 'react';
import { cn } from '@/lib/utils';

export type SlideResult = {
    score?: number;
    maxScore?: number;
    wrong?: number;
    timesSec?: number[];
};

type HtmlSlidePreviewProps = {
    /** Raw HTML string (full document or fragment) authored by AI. */
    html: string;
    className?: string;
    /**
     * When true, the iframe auto-grows to its content and the OUTER page
     * scrolls (seamless, no nested scrollbar). When false, the iframe keeps a
     * fixed height and scrolls internally (use inside height-constrained cards).
     */
    autoResize?: boolean;
    /** Fires when the previewed doc reports an interactive result (quiz/game). */
    onResult?: (result: SlideResult) => void;
};

const HEIGHT_MSG = 'vac-html-slide-height';
const MAX_HEIGHT = 20000;

// A tiny script injected into the sandboxed document so it can report its
// height to us (the frame has an opaque origin, so we can't read it directly —
// but postMessage works across origins). Also opens links in a new tab.
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
  // The page is shown at full height with NO internal scroll, so scroll-reveal
  // entrance animations (opacity:0 revealed on scroll / IntersectionObserver)
  // never fire and their content stays invisible. Snap any such faded-in-place
  // element to visible. Only touches rendered elements faded via an opacity
  // transition — leaves display:none / visibility:hidden content (quiz answers,
  // tabs) alone.
  function revealAll(){try{
    var els=document.querySelectorAll('body *');
    for(var i=0;i<els.length;i++){var el=els[i];
      if(el.offsetParent===null)continue;
      var cs=getComputedStyle(el);
      if(cs.visibility==='hidden')continue;
      if(parseFloat(cs.opacity)<0.05 && cs.transition && cs.transition.indexOf('opacity')>-1){
        el.style.setProperty('opacity','1','important');
        el.style.setProperty('transform','none','important');
      }
    }
    post();
  }catch(e){}}
  setTimeout(revealAll,700);setTimeout(revealAll,1800);
})();</script>`;

/** Inject the resize script just before </body> (or append for fragments). */
function withResizeScript(html: string): string {
    if (!html) return `<!DOCTYPE html><html><body></body></html>`;
    if (/<\/body>/i.test(html)) return html.replace(/<\/body>/i, `${RESIZE_SCRIPT}</body>`);
    return `${html}${RESIZE_SCRIPT}`;
}

/**
 * Renders AI-authored HTML inside a sandboxed iframe. `sandbox="allow-scripts"`
 * WITHOUT `allow-same-origin` gives the document a unique opaque origin: its
 * CSS/JS/animations run and are fully isolated from the app (it cannot read the
 * parent DOM, cookies, or storage). This is what lets HTML slides be freely
 * creative without risking the host page.
 */
export function HtmlSlidePreview({
    html,
    className,
    autoResize = true,
    onResult,
}: HtmlSlidePreviewProps) {
    const iframeRef = useRef<HTMLIFrameElement | null>(null);
    const [height, setHeight] = useState(480);
    const srcDoc = useMemo(() => withResizeScript(html), [html]);
    const onResultRef = useRef(onResult);
    onResultRef.current = onResult;

    useEffect(() => {
        const onMessage = (e: MessageEvent) => {
            if (e.source !== iframeRef.current?.contentWindow) return;
            const data = e.data as { type?: string; height?: number } & SlideResult;
            if (data?.type === HEIGHT_MSG && typeof data.height === 'number') {
                if (autoResize) setHeight(Math.min(Math.max(data.height, 120), MAX_HEIGHT));
            } else if (data?.type === 'vacademy:complete') {
                onResultRef.current?.({
                    score: data.score,
                    maxScore: data.maxScore,
                    wrong: data.wrong,
                    timesSec: Array.isArray(data.timesSec) ? data.timesSec : undefined,
                });
            }
        };
        window.addEventListener('message', onMessage);
        return () => window.removeEventListener('message', onMessage);
    }, [autoResize]);

    return (
        <iframe
            ref={iframeRef}
            title="HTML document preview"
            // no allow-same-origin: opaque origin keeps the document isolated
            sandbox="allow-scripts allow-popups allow-popups-to-escape-sandbox"
            srcDoc={srcDoc}
            className={cn('w-full border-0 bg-white', autoResize ? '' : 'h-full', className)}
            // Height is driven by the document's reported content height (dynamic).
            style={autoResize ? { height } : undefined}
        />
    );
}
