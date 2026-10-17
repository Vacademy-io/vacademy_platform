import React from "react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";

interface LatexSymbol {
  label: string;
  insert: string;
}

interface SymbolGroup {
  name: string;
  symbols: LatexSymbol[];
}

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
  const { t } = useTranslation("chatFeatureB");

  const SYMBOL_GROUPS: SymbolGroup[] = [
    {
      name: t("latexToolbar.groupArithmetic"),
      symbols: [
        { label: "√", insert: "\\sqrt{}" },
        { label: "x²", insert: "^{2}" },
        { label: "xₙ", insert: "_{n}" },
        { label: "÷", insert: "\\frac{}{}" },
        { label: "±", insert: "\\pm" },
      ],
    },
    {
      name: t("latexToolbar.groupRelations"),
      symbols: [
        { label: "≠", insert: "\\neq" },
        { label: "≤", insert: "\\leq" },
        { label: "≥", insert: "\\geq" },
      ],
    },
    {
      name: t("latexToolbar.groupCalculus"),
      symbols: [
        { label: "∫", insert: "\\int_{a}^{b}" },
        { label: "Σ", insert: "\\sum_{i=1}^{n}" },
        { label: "lim", insert: "\\lim_{x \\to }" },
        { label: "dx", insert: "\\frac{d}{dx}" },
        { label: "∂", insert: "\\partial" },
      ],
    },
    {
      name: t("latexToolbar.groupGreek"),
      symbols: [
        { label: "π", insert: "\\pi" },
        { label: "α", insert: "\\alpha" },
        { label: "β", insert: "\\beta" },
        { label: "θ", insert: "\\theta" },
      ],
    },
    {
      name: t("latexToolbar.groupOther"),
      symbols: [{ label: "∞", insert: "\\infty" }],
    },
  ];

  if (!visible) return null;

  return (
    <div className="w-full flex flex-wrap gap-1 px-1 py-1 bg-muted/30 rounded-lg border border-border/50">
      {SYMBOL_GROUPS.map((group) => (
        <React.Fragment key={group.name}>
          {/* Subtle section header */}
          <span className="w-full text-caption uppercase tracking-wider text-muted-foreground/60 font-medium px-0.5 mt-0.5 first:mt-0">
            {group.name}
          </span>
          {group.symbols.map((item) => (
            <button
              key={item.label}
              className="h-7 min-w-8 px-1.5 text-xs font-mono rounded bg-background hover:bg-primary/10 hover:text-primary border border-border/50 transition-colors"
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
