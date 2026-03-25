import React from "react";
import { cn } from "@/lib/utils";

interface LatexSymbol {
  label: string;
  insert: string;
}

interface SymbolGroup {
  name: string;
  symbols: LatexSymbol[];
}

const SYMBOL_GROUPS: SymbolGroup[] = [
  {
    name: "Arithmetic",
    symbols: [
      { label: "\u221A", insert: "\\sqrt{}" },
      { label: "x\u00B2", insert: "^{2}" },
      { label: "x\u2099", insert: "_{n}" },
      { label: "\u00F7", insert: "\\frac{}{}" },
      { label: "\u00B1", insert: "\\pm" },
    ],
  },
  {
    name: "Relations",
    symbols: [
      { label: "\u2260", insert: "\\neq" },
      { label: "\u2264", insert: "\\leq" },
      { label: "\u2265", insert: "\\geq" },
    ],
  },
  {
    name: "Calculus",
    symbols: [
      { label: "\u222B", insert: "\\int_{a}^{b}" },
      { label: "\u03A3", insert: "\\sum_{i=1}^{n}" },
      { label: "lim", insert: "\\lim_{x \\to }" },
      { label: "dx", insert: "\\frac{d}{dx}" },
      { label: "\u2202", insert: "\\partial" },
    ],
  },
  {
    name: "Greek",
    symbols: [
      { label: "\u03C0", insert: "\\pi" },
      { label: "\u03B1", insert: "\\alpha" },
      { label: "\u03B2", insert: "\\beta" },
      { label: "\u03B8", insert: "\\theta" },
    ],
  },
  {
    name: "Other",
    symbols: [{ label: "\u221E", insert: "\\infty" }],
  },
];

export interface LatexToolbarProps {
  /** Whether the toolbar is visible */
  visible: boolean;
  /**
   * Called when a symbol is clicked.
   * The parent is responsible for wrapping the LaTeX string in `$...$`
   * delimiters if the input is not already in a math context.
   */
  onInsert: (latex: string) => void;
  /**
   * Current input value — used to check whether the cursor is already
   * inside a `$` math context so the parent can decide on delimiter wrapping.
   * (Kept as a prop for parity with the original inline implementation.)
   */
  inputValue?: string;
}

/**
 * A toolbar of grouped math symbol buttons for quick LaTeX insertion.
 *
 * Renders grouped sections (Arithmetic, Relations, Calculus, Greek, Other)
 * with subtle headers. The `onInsert` callback receives the raw LaTeX
 * string; the consumer decides whether to wrap it in `$...$`.
 */
export const LatexToolbar: React.FC<LatexToolbarProps> = ({
  visible,
  onInsert,
}) => {
  if (!visible) return null;

  return (
    <div className="w-full flex flex-wrap gap-1 px-1 py-1 bg-muted/30 rounded-lg border border-border/50">
      {SYMBOL_GROUPS.map((group) => (
        <React.Fragment key={group.name}>
          {/* Subtle section header */}
          <span className="w-full text-[9px] uppercase tracking-wider text-muted-foreground/60 font-medium px-0.5 mt-0.5 first:mt-0">
            {group.name}
          </span>
          {group.symbols.map((item) => (
            <button
              key={item.label}
              className="h-7 min-w-[32px] px-1.5 text-xs font-mono rounded bg-background hover:bg-primary/10 hover:text-primary border border-border/50 transition-colors"
              onClick={() => onInsert(item.insert)}
              title={item.insert}
            >
              {item.label}
            </button>
          ))}
        </React.Fragment>
      ))}
    </div>
  );
};
