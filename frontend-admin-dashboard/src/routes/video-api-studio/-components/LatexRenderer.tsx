import { useMemo } from 'react';
import katex from 'katex';
import 'katex/dist/katex.min.css';

interface LatexRendererProps {
    text: string;
    className?: string;
}

export function LatexRenderer({ text, className }: LatexRendererProps) {
    const renderedContent = useMemo(() => {
        // Regex to match $$...$$ (display mode) or $...$ (inline mode)
        const parts = text.split(/(\$\$[\s\S]*?\$\$|\$[\s\S]*?\$)/g);

        return parts.map((part, index) => {
            if (part.startsWith('$$') && part.endsWith('$$')) {
                const math = part.slice(2, -2);
                try {
                    const html = katex.renderToString(math, {
                        displayMode: true,
                        throwOnError: false,
                    });
                    // eslint-disable-next-line react/no-danger
                    return <span key={index} dangerouslySetInnerHTML={{ __html: html }} />;
                } catch (e) {
                    return <span key={index}>{part}</span>;
                }
            } else if (part.startsWith('$') && part.endsWith('$')) {
                const math = part.slice(1, -1);
                try {
                    const html = katex.renderToString(math, {
                        displayMode: false,
                        throwOnError: false,
                    });
                    // eslint-disable-next-line react/no-danger
                    return <span key={index} dangerouslySetInnerHTML={{ __html: html }} />;
                } catch (e) {
                    return <span key={index}>{part}</span>;
                }
            } else {
                return <span key={index}>{part}</span>;
            }
        });
    }, [text]);

    return <div className={className}>{renderedContent}</div>;
}
