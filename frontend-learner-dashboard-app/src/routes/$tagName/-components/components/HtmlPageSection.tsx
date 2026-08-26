import { useEffect, useRef } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { renderHtmlPage, type HtmlAction } from '../../-utils/catalogue-html';

/**
 * A whole page pasted from elsewhere — ChatGPT/Claude, an agency, an old site.
 *
 * Rendered through renderHtmlPage: page-level size caps, SVG allowed, the site
 * stylesheet injected ahead of the page's own, and the action hooks bound.
 * Still a shadow root and still no scripts, so the page stays indexable and
 * keeps the site's header and footer — the reason this is not an iframe.
 *
 * The hooks are what make a pasted page part of the site rather than a
 * screenshot of one: a plain <a href> would escape the router, and `#anchor`
 * cannot work at all because fragment navigation does not see into a shadow
 * root. bindHtmlActions turns both into real navigation, and gives pasted
 * markup a way to reach lead capture and enrolment.
 */
export const HtmlPageSection = ({
    html,
    css,
    siteCss,
    tagName,
}: {
    html?: string;
    css?: string;
    siteCss?: string;
    tagName: string;
}) => {
    const hostRef = useRef<HTMLDivElement>(null);
    const navigate = useNavigate();

    useEffect(() => {
        const host = hostRef.current;
        if (!host) return;
        const onAction = (action: HtmlAction) => {
            switch (action.kind) {
                case 'route':
                    // Routes are page slugs within THIS site; '' is the home
                    // page. Going through the router keeps it a client-side
                    // navigation and keeps the tag scope.
                    navigate({ to: action.route ? `/${tagName}/${action.route}` : `/${tagName}` });
                    break;
                case 'lead-form':
                    window.dispatchEvent(
                        new CustomEvent('openAudienceForm', {
                            detail: { audienceId: action.audienceId },
                        })
                    );
                    break;
                case 'enrol':
                    if (action.courseId) navigate({ to: `/${tagName}/course/${action.courseId}` });
                    break;
                case 'link':
                    window.open(action.href, '_blank', 'noopener,noreferrer');
                    break;
                default:
                    break; // 'scroll' is handled inside the shadow root
            }
        };
        // Returns a teardown that removes the delegated listener — without it,
        // every re-render would stack another one on the same root.
        return renderHtmlPage(host, html || '', css || '', { siteCss, onAction });
    }, [html, css, siteCss, tagName, navigate]);

    return <div ref={hostRef} className="catalogue-html-section" />;
};

export default HtmlPageSection;
