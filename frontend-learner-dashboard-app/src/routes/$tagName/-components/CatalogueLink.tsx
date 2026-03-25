import React from 'react';
import { useNavigate, useParams } from '@tanstack/react-router';

interface CatalogueLinkProps extends React.AnchorHTMLAttributes<HTMLAnchorElement> {
    /** The route value — can be a page slug ("about-us"), "homepage", full URL, or #anchor */
    to: string;
    children: React.ReactNode;
}

/**
 * Smart link component for catalogue pages.
 * - External URLs (http/https/mailto/tel) → regular <a> with target=_blank
 * - Anchor links (#pricing) → smooth scroll to element
 * - Page + anchor (about-us#team) → navigate to page, then scroll
 * - Internal routes → SPA navigation via TanStack Router
 */
export const CatalogueLink: React.FC<CatalogueLinkProps> = ({ to, children, target, className, style, ...rest }) => {
    const navigate = useNavigate();
    const params = useParams({ strict: false }) as { tagName?: string };
    const tagName = params.tagName || '';

    if (!to || to === '#') {
        return <span className={className} style={style} {...rest}>{children}</span>;
    }

    const isExternal = to.startsWith('http://') || to.startsWith('https://') || to.startsWith('mailto:') || to.startsWith('tel:');

    if (isExternal) {
        return (
            <a href={to} target={target || '_blank'} rel="noopener noreferrer" className={className} style={style} {...rest}>
                {children}
            </a>
        );
    }

    // Parse anchor from route: "about-us#team" → route="about-us", hash="#team"
    // Pure anchor: "#pricing" → route="", hash="#pricing"
    const hashIndex = to.indexOf('#');
    const routePart = hashIndex >= 0 ? to.slice(0, hashIndex) : to;
    const hashPart = hashIndex >= 0 ? to.slice(hashIndex) : '';

    // Pure anchor link on current page
    if (!routePart && hashPart) {
        const handleAnchorClick = (e: React.MouseEvent) => {
            e.preventDefault();
            const el = document.getElementById(hashPart.slice(1));
            if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        };
        return (
            <a href={hashPart} onClick={handleAnchorClick} className={className} style={style} {...rest}>
                {children}
            </a>
        );
    }

    // Internal route (possibly with anchor)
    const normalizedRoute = routePart.toLowerCase().replace(/^\//, '').replace(/\/$/, '').trim();
    const isHome = normalizedRoute === 'home' || normalizedRoute === 'homepage' || normalizedRoute === '' || normalizedRoute === '/';
    const fullPath = isHome ? `/${tagName}` : `/${tagName}/${normalizedRoute}`;
    const fullHref = fullPath + hashPart;

    const handleClick = (e: React.MouseEvent) => {
        if (e.metaKey || e.ctrlKey || target === '_blank') return;
        e.preventDefault();
        navigate({ to: fullPath }).then(() => {
            if (hashPart) {
                // Wait for page render, then scroll to anchor
                requestAnimationFrame(() => {
                    const el = document.getElementById(hashPart.slice(1));
                    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
                });
            }
        });
    };

    return (
        <a href={fullHref} onClick={handleClick} target={target} className={className} style={style} {...rest}>
            {children}
        </a>
    );
};
