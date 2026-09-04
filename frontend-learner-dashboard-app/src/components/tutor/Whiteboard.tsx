import { useEffect, useRef } from "react";
import { animateDiagram, isElementOp, mountMediaTask, renderOp, revealAllSteps, typesetFormulas, type BoardOp } from "./boardRenderer";
import { getPublicUrl } from "@/services/upload_file";
import "@/styles/tutor-board.css";

interface WhiteboardProps {
  /** Cumulative element ops for the current board (topic). */
  ops: BoardOp[];
  /** Live ops from the teacher during a turn: highlight / annotate. */
  liveOps: BoardOp[];
  /** Bumps whenever the board is cleared so entrance animations replay. */
  boardKey: string;
  teacherName?: string;
  /** Bumps when the narration ends: every stepped diagram part still hidden is shown. */
  revealKey?: number;
}

/**
 * The whiteboard. Elements are appended (never re-rendered) so an element that
 * is already on the board keeps its place while new ones write themselves in;
 * live highlights toggle a class on the target by data-op-id. After each
 * insertion formulas are typeset and media tasks get their player.
 */
export const Whiteboard: React.FC<WhiteboardProps> = ({ ops, liveOps, boardKey, teacherName, revealKey }) => {
  const rootRef = useRef<HTMLDivElement>(null);
  const renderedRef = useRef<Set<string>>(new Set());
  const lastKeyRef = useRef(boardKey);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    if (lastKeyRef.current !== boardKey) {
      root.innerHTML = "";
      renderedRef.current = new Set();
      lastKeyRef.current = boardKey;
    }
    for (const op of ops) {
      if (!isElementOp(op)) continue;
      const id = String(op.id ?? "");
      if (id && renderedRef.current.has(id)) continue;
      const html = renderOp(op);
      if (!html) continue;
      const tmp = document.createElement("div");
      tmp.innerHTML = html;
      const el = tmp.firstElementChild as HTMLElement | null;
      if (!el) continue;
      // Annotations dock next to their target when it exists.
      const target = op.op === "annotate" ? root.querySelector<HTMLElement>(`[data-op-id="${CSS.escape(String(op.target ?? ""))}"]`) : null;
      if (target) target.insertAdjacentElement("afterend", el);
      else root.appendChild(el);
      if (id) renderedRef.current.add(id);
      // eslint-disable-next-line @typescript-eslint/no-unused-expressions
      el.offsetHeight; // reflow so the entrance animation plays
      el.classList.add("tb-enter");
      if (el.classList.contains("tb-media-task")) void mountMediaTask(el, getPublicUrl);
      if (op.op === "svg") animateDiagram(el, (op.parts as Array<{ id?: unknown; step?: unknown }>) || []);
    }
    typesetFormulas(root);
    root.scrollTo({ top: root.scrollHeight, behavior: "smooth" });
  }, [ops, boardKey]);

  useEffect(() => {
    if (rootRef.current && revealKey) revealAllSteps(rootRef.current);
  }, [revealKey]);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    root.querySelectorAll(".tb-live").forEach((n) => n.remove());
    root.querySelectorAll(".tb-highlight").forEach((n) => n.classList.remove("tb-highlight"));
    for (const op of liveOps) {
      if (op.op === "highlight" || op.op === "unhighlight") {
        const t = root.querySelector<HTMLElement>(`[data-op-id="${CSS.escape(String(op.target ?? ""))}"], #${CSS.escape(String(op.target ?? ""))}`);
        if (t) t.classList.toggle("tb-highlight", op.op === "highlight");
      } else if (op.op === "annotate") {
        const t = root.querySelector<HTMLElement>(`[data-op-id="${CSS.escape(String(op.target ?? ""))}"]`);
        const html = renderOp(op);
        if (!html) continue;
        const tmp = document.createElement("div");
        tmp.innerHTML = html;
        const el = tmp.firstElementChild as HTMLElement | null;
        if (!el) continue;
        el.classList.add("tb-live", "tb-enter");
        if (t) t.insertAdjacentElement("afterend", el);
        else root.appendChild(el);
      }
    }
  }, [liveOps]);

  return (
    <div className="tutor-board-preview relative h-full">
      <div ref={rootRef} className="tutor-board h-full overflow-y-auto" aria-live="polite" aria-label={teacherName ? `${teacherName}'s whiteboard` : "whiteboard"} />
    </div>
  );
};
