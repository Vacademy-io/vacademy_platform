import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { RouteMatcher } from "../../-services/route-matcher";
import { useNavigate } from '@tanstack/react-router';
import {
    collectVideoMounts,
    renderHtmlPage,
    type HtmlAction,
    type HtmlVideoMount,
} from '../../-utils/catalogue-html';
import { PLAIN_VIDEO_PLAYER_CSS, PlainVideoPlayer } from './PlainVideoPlayer';

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
 *
 * Video: `<video>` is stripped by the sanitizer, so a page marks a spot with
 * `<div data-vacademy="video" data-src="…" data-poster="…" data-aspect="9:16">`
 * and the site's own play/pause-only player is portalled into it — the same
 * PlainVideoPlayer the typed videoEmbed block uses, so an HTML page never
 * exposes the browser's download menu either. Its stylesheet is injected
 * with the site CSS because utility classes do not reach into a shadow root.
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
    // Read through a ref so the render effect depends on the page CONTENT only:
    // it now sets state (video mounts), and an unstable `navigate` identity in
    // the dependency list would re-render the page — and re-set state — on every
    // commit, i.e. an infinite loop.
    const navigateRef = useRef(navigate);
    navigateRef.current = navigate;
    const [videoMounts, setVideoMounts] = useState<HtmlVideoMount[]>([]);

    useEffect(() => {
        const host = hostRef.current;
        if (!host) return;
        const onAction = (action: HtmlAction) => {
            switch (action.kind) {
                case 'route':
                    // Routes are page slugs within THIS site; '' is the home
                    // page. Going through the router keeps it a client-side
                    // navigation and keeps the tag scope.
                    navigateRef.current({ to: RouteMatcher.pagePath(tagName, action.route) });
                    break;
                case 'lead-form':
                    window.dispatchEvent(
                        new CustomEvent('openAudienceForm', {
                            detail: { audienceId: action.audienceId },
                        })
                    );
                    break;
                case 'enrol':
                    if (action.courseId) navigateRef.current({ to: `${RouteMatcher.basePath(tagName)}/course/${action.courseId}` });
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
        const teardown = renderHtmlPage(host, html || '', css || '', {
            siteCss: `${PLAIN_VIDEO_PLAYER_CSS}\n${siteCss || ''}`,
            onAction,
        });
        // Placeholders keep whatever the author put inside (a poster <img> is
        // the editor preview); the real player replaces it here.
        const mounts = host.shadowRoot ? collectVideoMounts(host.shadowRoot) : [];
        mounts.forEach((m) => m.el.replaceChildren());
        setVideoMounts(mounts);
        return () => {
            teardown();
            setVideoMounts([]);
        };
    }, [html, css, siteCss, tagName]);

    return (
        <>
            <div ref={hostRef} className="catalogue-html-section" />
            {videoMounts.map((m, i) =>
                createPortal(
                    <PlainVideoPlayer src={m.src} poster={m.poster} title={m.title} paddingBottom={m.paddingBottom} />,
                    m.el,
                    `${i}-${m.src}`,
                ),
            )}
        </>
    );
};

export default HtmlPageSection;
