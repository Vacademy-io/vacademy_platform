import { useMemo } from 'react';
import katex from 'katex';
import 'katex/dist/katex.min.css';

interface MathHtmlProps {
    html: string;
    className?: string;
}

// $$…$$ (display) or $…$ (inline). Non-greedy so adjacent formulas on one line
// stay separate.
const MATH_SPAN = /\$\$([\s\S]+?)\$\$|\$([^$\n]+?)\$/g;

/**
 * Render generated question HTML with its LaTeX typeset.
 *
 * Questions from a JEE or CBSE corpus are mostly formulas, and showing the raw
 * source — `$$\int_{e^2}^{e^4} \frac{1}{x}…$$` — makes a paper impossible to
 * review, let alone print. KaTeX is already a dependency.
 *
 * Renders with `throwOnError: false` so a malformed formula degrades to the
 * original source in red rather than blanking the whole question: a teacher can
 * still read it and hit Rewrite.
 */
export const MathHtml = ({ html, className }: MathHtmlProps) => {
    const rendered = useMemo(() => {
        if (!html) return '';
        return html.replace(MATH_SPAN, (match, display: string, inline: string) => {
            const expression = (display ?? inline ?? '').trim();
            if (!expression) return match;
            try {
                return katex.renderToString(expression, {
                    displayMode: Boolean(display),
                    throwOnError: false,
                    strict: false,
                    output: 'html',
                });
            } catch {
                // Keep the source visible — silently dropping a formula would
                // hide the fact that the question is broken.
                return match;
            }
        });
    }, [html]);

    return (
        <div
            className={className}
            // Content is generated question HTML: text, <img> whose src we
            // substituted ourselves from our own S3, and KaTeX's own markup.
            dangerouslySetInnerHTML={{ __html: rendered }}
        />
    );
};
