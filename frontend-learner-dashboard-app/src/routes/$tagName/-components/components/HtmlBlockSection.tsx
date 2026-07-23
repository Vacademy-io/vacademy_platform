import { useEffect, useRef } from 'react';
import { renderHtmlSection } from '../../-utils/catalogue-html';

/**
 * Renders an htmlBlock (custom HTML/CSS section) inside a shadow root via the
 * shared catalogue-html safety layer: DOMPurify-sanitized markup, scrubbed
 * scoped CSS, and a contained host so the section can style itself freely
 * with theme CSS variables without being able to touch the rest of the page.
 */
export const HtmlBlockSection = ({ html, css }: { html?: string; css?: string }) => {
    const hostRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (hostRef.current) renderHtmlSection(hostRef.current, html || '', css || '');
    }, [html, css]);

    return <div ref={hostRef} className="catalogue-html-section" />;
};

export default HtmlBlockSection;
