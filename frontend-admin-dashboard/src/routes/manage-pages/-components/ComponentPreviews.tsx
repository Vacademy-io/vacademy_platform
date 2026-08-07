/**
 * Lightweight admin-canvas preview components.
 * These render the component's actual props visually, with NO data fetching
 * and NO interactive side-effects. They are used inside the CanvasRenderer.
 */
import React from 'react';
import {
    BookOpen, Brain, Briefcase, Certificate, ChartLineUp, ChatsCircle, Check,
    Clock, Code, Globe, GraduationCap, Lightbulb, Medal, Rocket, ShieldCheck,
    Sparkle, Star, Target, Trophy, UsersThree, Wrench,
} from '@phosphor-icons/react';

import { renderHtmlSection } from '../-utils/catalogue-html';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import { PRODUCT_PAGE_OPEN_URL, AUDIENCE_CAMPAIGN_OPEN_URL } from '@/constants/urls';
import { getCurrentInstituteId } from '@/lib/auth/instituteUtils';

interface P { props: any }

/** Live product-page courses on the canvas. Fetches the same anonymous
 *  endpoint the learner uses, so the editor shows the real course list, real
 *  prices and real images instead of placeholders that could disagree with the
 *  published page. */
const ProductPageOfferPreview: React.FC<P> = ({ props }) => {
    const instituteId = getCurrentInstituteId();
    const code = props.productPageCode;
    const { data, isLoading } = useQuery({
        queryKey: ['PP_OFFER_PREVIEW', code, instituteId],
        queryFn: async () =>
            (await axios.get(`${PRODUCT_PAGE_OPEN_URL}/by-code?code=${code}&instituteId=${instituteId}`)).data,
        enabled: !!code && !!instituteId,
        staleTime: 60_000,
    });
    const cols = Math.min(Math.max(Number(props.columns) || 3, 1), 4);
    const allMappings = ((data?.mappings || []) as any[])
        .filter((m) => (m.status ?? 'ACTIVE') === 'ACTIVE')
        .sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0));
    // The canvas shows the FIRST page only. A book-store product page can carry
    // 150+ courses; rendering them all made the editor unusable (and misrepresented
    // what a visitor actually sees, which is one paginated page at a time).
    const perPage = Number(props.pageSize) > 0 ? Math.floor(Number(props.pageSize)) : allMappings.length;
    // Mirrors the learner rule exactly: an uncapped carousel stops at
    // railMaxCards (default 12, 0 = every course) and ends with a link to the
    // product page. Without this the canvas showed all 127 cards for a rail a
    // visitor sees 12 of — the editor would be lying about the live page.
    const previewIsCarousel = props.layout === 'carousel';
    const railCap = props.railMaxCards === undefined ? 12 : Math.max(Number(props.railMaxCards) || 0, 0);
    const railCapped = previewIsCarousel && !(Number(props.pageSize) > 0) && railCap > 0;
    const mappings = allMappings.slice(0, railCapped ? Math.min(railCap, perPage) : perPage);
    const hiddenCount = allMappings.length - mappings.length;
    const totalPages = perPage > 0 ? Math.ceil(allMappings.length / perPage) : 1;

    // Mirrors the learner header contract: align left/center, compact/large
    // scale, optional "See all" affordance (inert on the canvas).
    const isLeft = props.align === 'left';
    const compactHeader = props.headerScale === 'md';
    const titleClass = compactHeader ? 'catalogue-h3 text-catalogue-text-primary' : 'catalogue-h2 text-catalogue-text-primary';
    const subtitleClass = compactHeader ? 'mt-1 text-sm text-catalogue-text-muted' : 'catalogue-lead text-catalogue-text-muted';
    const seeAll = props.showViewAll ? (
        <span className="inline-flex shrink-0 items-center gap-1 text-sm font-semibold text-catalogue-brand-ink">
            {props.viewAllLabel || 'See all'} →
        </span>
    ) : null;
    const shell = (children: React.ReactNode) => (
        <section className="catalogue-section" style={props.backgroundColor ? { backgroundColor: props.backgroundColor } : undefined}>
            <div className="catalogue-shell">
                {(props.title || props.subtitle || seeAll) &&
                    (isLeft ? (
                        <div className="catalogue-section-header flex items-end justify-between gap-4 text-left">
                            <div className="min-w-0">
                                {props.title && <h2 className={titleClass}>{props.title}</h2>}
                                {props.subtitle && <p className={subtitleClass}>{props.subtitle}</p>}
                            </div>
                            {seeAll}
                        </div>
                    ) : (
                        <div className="catalogue-section-header text-center">
                            {props.title && <h2 className={titleClass}>{props.title}</h2>}
                            {props.subtitle && <p className={`${subtitleClass} catalogue-measure`}>{props.subtitle}</p>}
                            {seeAll && <div className="mt-2">{seeAll}</div>}
                        </div>
                    ))}
                {children}
            </div>
        </section>
    );

    if (!code) {
        return shell(
            <div className="rounded-catalogue-lg border border-dashed border-catalogue-border p-8 text-center text-sm text-catalogue-text-muted">
                Pick a product page in the properties panel to show its courses here.
            </div>
        );
    }
    if (isLoading) {
        return shell(<div className="p-6 text-center text-sm text-catalogue-text-muted">Loading courses…</div>);
    }
    if (mappings.length === 0) {
        return shell(
            <div className="rounded-catalogue-lg border border-dashed border-catalogue-border p-8 text-center text-sm text-catalogue-text-muted">
                This product page has no active courses yet.
            </div>
        );
    }
    const isCarousel = props.layout === 'carousel';
    return shell(
        <>
        <div
            style={
                isCarousel
                    ? { display: 'flex', gap: 24, overflowX: 'auto', paddingBottom: 12 }
                    : { display: 'grid', gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: 24 }
            }
        >
            {mappings.map((m, i) => {
                // Mirror the learner rule: sentinel level/session names are
                // placeholders, not information.
                const SENTINELS = new Set(['default', 'none', 'null', 'undefined', '']);
                const tagChips = String(m.tags || '').split(',').map((t) => t.trim()).filter(Boolean);
                const chips = [...tagChips, m.level_name, m.session_name]
                    .filter((c: any) => c && !SENTINELS.has(String(c).trim().toLowerCase()))
                    .slice(0, 3);
                const price = m.payment_plan?.actual_price;
                const mrp = m.payment_plan?.elevated_price;
                return (
                    <div
                        key={m.id || i}
                        className="catalogue-card-elevated flex flex-col p-5 text-left"
                        style={isCarousel ? { flex: `0 0 calc((100% - ${(cols - 1) * 24}px) / ${cols})`, minWidth: 250 } : undefined}
                    >
                        {props.showImage !== false && (
                            // 2:1, matching the live offer card — the builder
                            // preview must reserve the same band the learner sees.
                            <div className="mb-4 aspect-[2/1] w-full rounded-catalogue-lg bg-catalogue-bg-muted" />
                        )}
                        {props.showChips !== false && chips.length > 0 && (
                            <div className="mb-2 flex flex-wrap gap-1.5">
                                {chips.map((c: string, j: number) => (
                                    <span key={j} className="inline-flex items-center rounded-full bg-primary-50 px-3 py-1 text-xs font-medium text-catalogue-brand-ink ring-1 ring-primary-100">{c}</span>
                                ))}
                            </div>
                        )}
                        <h3 className="mb-1.5 line-clamp-2 text-base font-semibold leading-snug text-catalogue-text-primary">{m.package_name || 'Course'}</h3>
                        {props.showPrice !== false && typeof price === 'number' && (
                            <div className="mb-3 flex items-baseline gap-2">
                                <span className="text-sm font-bold text-catalogue-text-primary">{price === 0 ? 'Free' : `${m.payment_plan?.currency || ''} ${price}`}</span>
                                {typeof mrp === 'number' && mrp > price && (
                                    <span className="text-xs text-catalogue-text-muted line-through">{mrp}</span>
                                )}
                            </div>
                        )}
                        {/* Mirrors the learner card: browse CTA beside the buy CTA. */}
                        <div className="mt-auto flex flex-wrap gap-2">
                            {props.showViewCourse !== false && (
                                <span className="catalogue-btn catalogue-btn-secondary catalogue-btn-sm flex-1 justify-center">
                                    {props.viewCourseLabel || 'View course'}
                                </span>
                            )}
                            <span className="catalogue-btn catalogue-btn-primary catalogue-btn-sm flex-1 justify-center">
                                {props.ctaLabel || 'Enrol now'}
                            </span>
                        </div>
                    </div>
                );
            })}
        </div>
        {hiddenCount > 0 && (
            <p className="mt-4 text-center text-caption text-catalogue-text-muted">
                {railCapped
                    ? `+ ${hiddenCount} more course(s) — the row ends with a card linking to the full product page.`
                    : `+ ${hiddenCount} more course(s) — visitors page through ${totalPages} pages${
                          isCarousel
                              ? ', scrolling each row sideways'
                              : props.scrollable
                                ? ', scrolling inside the section'
                                : ''
                      }.`}
            </p>
        )}
        </>
    );
};

/** Canvas preview for `leadForm` — fetches the campaign's real form fields
 *  from the same anonymous endpoint the learner uses, rendered inert. */
const LeadFormPreview: React.FC<P> = ({ props }) => {
    const instituteId = getCurrentInstituteId();
    const audienceId = props.audienceId;
    const { data, isLoading } = useQuery({
        queryKey: ['LEAD_FORM_PREVIEW', audienceId, instituteId],
        queryFn: async () =>
            (await axios.get(`${AUDIENCE_CAMPAIGN_OPEN_URL}/${instituteId}/${audienceId}`)).data,
        enabled: !!audienceId && !!instituteId,
        staleTime: 60_000,
    });
    const fields = ((data?.institute_custom_fields || []) as any[])
        .filter((f) => f?.custom_field && f.status !== 'DELETED')
        .sort((a, b) => (a.individual_order ?? 0) - (b.individual_order ?? 0));
    const isLeft = props.align === 'left';
    return (
        <section className="catalogue-section" style={props.backgroundColor ? { backgroundColor: props.backgroundColor } : undefined}>
            <div className="catalogue-shell-narrow">
                {(props.title || props.subtitle) && (
                    <div className={`catalogue-section-header ${isLeft ? 'text-left' : 'text-center'}`}>
                        {props.title && <h2 className="catalogue-h2 text-catalogue-text-primary">{props.title}</h2>}
                        {props.subtitle && <p className="catalogue-lead text-catalogue-text-muted">{props.subtitle}</p>}
                    </div>
                )}
                <div className={props.layout === 'bare' ? '' : 'catalogue-card-elevated p-6'}>
                    {!audienceId ? (
                        <p className="p-4 text-center text-sm text-catalogue-text-muted">
                            Pick a campaign in the properties panel — its form fields render here.
                        </p>
                    ) : isLoading ? (
                        <p className="p-4 text-center text-sm text-catalogue-text-muted">Loading form fields…</p>
                    ) : fields.length === 0 ? (
                        <p className="p-4 text-center text-sm text-catalogue-text-muted">
                            This campaign has no form fields yet — add them in Audience Manager.
                        </p>
                    ) : (
                        <div className="space-y-4">
                            {fields.map((f: any, i: number) => (
                                <div key={i}>
                                    <p className="mb-1.5 text-sm font-medium text-catalogue-text-secondary">
                                        {f.custom_field.fieldName}
                                        {f.custom_field.isMandatory && <span className="ms-1 text-catalogue-brand-ink">*</span>}
                                    </p>
                                    <div className="h-10 rounded-catalogue-md border border-catalogue-border bg-catalogue-bg-muted" />
                                </div>
                            ))}
                            <span className="catalogue-btn catalogue-btn-primary w-full justify-center">
                                {props.submitLabel || 'Submit'}
                            </span>
                        </div>
                    )}
                </div>
            </div>
        </section>
    );
};

/** Canvas preview for `detailBlocks`.
 *
 *  Mirrors the learner markup at reduced padding. The catalogue tokens are
 *  byte-synced between the apps, so `catalogue-hairline-grid` behaves
 *  identically here — and referencing the literal class strings in admin source
 *  is what keeps admin's own Tailwind purge from dropping the rules (the
 *  safelist in tailwind.config.mjs is the belt; this is the braces). */
const DetailBlocksPreview: React.FC<P> = ({ props }) => {
    const blocks: any[] = Array.isArray(props.blocks) ? props.blocks.filter((b: any) => b?.title) : [];
    const cols = Math.min(Math.max(Number(props.columns) || 3, 1), 3);
    const specCols = Math.min(Math.max(Number(props.specColumns) || 4, 1), 4);

    if (blocks.length === 0) {
        return (
            <section className="catalogue-section">
                <div className="catalogue-shell">
                    <div className="rounded-catalogue-lg border border-dashed border-catalogue-border p-8 text-center text-sm text-catalogue-text-muted">
                        Add a block for each programme you want to document.
                    </div>
                </div>
            </section>
        );
    }

    return (
        <section className="catalogue-section">
            <div className="catalogue-shell">
                {(props.headerText || props.subheading) && (
                    <div className="catalogue-section-header text-center">
                        {props.headerText && <h2 className="catalogue-h2 text-catalogue-text-primary">{props.headerText}</h2>}
                        {props.subheading && <p className="catalogue-lead catalogue-measure text-catalogue-text-muted">{props.subheading}</p>}
                    </div>
                )}
                <div className="space-y-10">
                    {blocks.map((b: any, i: number) => {
                        const items = Array.isArray(b.items) ? b.items.filter((x: any) => x?.title) : [];
                        const specs = Array.isArray(b.specs) ? b.specs.filter((x: any) => x?.label) : [];
                        const variant = b.headerVariant || 'subtle';
                        const isSolid = variant === 'solid' && !b.headerColor;
                        const headerClass = isSolid ? 'bg-primary-500' : variant === 'tint' ? 'bg-primary-50' : 'bg-catalogue-bg-muted';
                        return (
                            <article key={i} className="catalogue-block-anchor">
                                <div
                                    className={`rounded-t-catalogue-lg border border-b-0 border-catalogue-border px-6 py-5 ${headerClass}`}
                                    style={b.headerColor ? { backgroundColor: b.headerColor } : undefined}
                                >
                                    {b.tag && (
                                        <span className={`mb-2 inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide-08 ${isSolid ? 'bg-catalogue-bg-elevated/15 text-white' : 'bg-primary-50 text-catalogue-brand-ink ring-1 ring-primary-100'}`}>
                                            {b.tag}
                                        </span>
                                    )}
                                    <h3 className={`catalogue-h3 ${isSolid ? 'text-white' : 'text-catalogue-text-primary'}`}>{b.title}</h3>
                                    {b.description && (
                                        <p className={`catalogue-measure-start mt-2 text-sm leading-relaxed ${isSolid ? 'text-white/85' : 'text-catalogue-text-secondary'}`}>
                                            {b.description}
                                        </p>
                                    )}
                                </div>
                                <div className="overflow-hidden rounded-b-catalogue-lg border border-catalogue-border bg-catalogue-bg">
                                    {items.length > 0 && (
                                        <div className="catalogue-hairline-grid" style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}>
                                            {items.map((it: any, j: number) => (
                                                <div key={j} className="px-5 py-4">
                                                    <h4 className="mb-1 text-sm font-semibold text-catalogue-text-primary">{it.title}</h4>
                                                    {it.description && <p className="text-xs leading-relaxed text-catalogue-text-secondary">{it.description}</p>}
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                    {specs.length > 0 && (
                                        <dl className="catalogue-hairline-grid" style={{ gridTemplateColumns: `repeat(${specCols}, 1fr)` }}>
                                            {specs.map((s: any, j: number) => (
                                                <div key={j} className="px-5 py-3">
                                                    <dt className="mb-1 text-xs font-semibold uppercase tracking-wide-08 text-catalogue-text-muted">{s.label}</dt>
                                                    <dd className="text-sm font-medium text-catalogue-text-secondary">{s.value}</dd>
                                                </div>
                                            ))}
                                        </dl>
                                    )}
                                    {b.note && (
                                        <p className={`px-5 py-3 text-sm text-catalogue-text-secondary ${b.noteTone === 'info' ? 'bg-primary-50' : b.noteTone === 'plain' ? 'bg-catalogue-bg-muted' : 'bg-warning-50'}`}>
                                            {b.note}
                                        </p>
                                    )}
                                </div>
                            </article>
                        );
                    })}
                </div>
            </div>
        </section>
    );
};

/** Live, sanitized, shadow-scoped render of an htmlBlock on the canvas —
 *  same safety layer the learner renderer uses (catalogue-html.ts). */
const HtmlBlockLivePreview = ({ props }: P) => {
    const hostRef = React.useRef<HTMLDivElement>(null);
    React.useEffect(() => {
        if (hostRef.current) renderHtmlSection(hostRef.current, props.html || '', props.css || '');
    }, [props.html, props.css]);
    return <div ref={hostRef} className="catalogue-html-section" />;
};

// Mirrors the learner JsonRenderer FEATURE_ICON_MAP so iconName renders on canvas
const FEATURE_ICON_MAP: Record<string, React.ComponentType<any>> = {
    GraduationCap, Rocket, Target, UsersThree, Code, Brain, Trophy, Lightbulb,
    ShieldCheck, ChartLineUp, Clock, Star, BookOpen, Certificate, ChatsCircle,
    Wrench, Sparkle, Medal, Briefcase, Globe,
};

/** Maps a columnLayout width fraction string to a CSS fr value */
const widthToFr = (w?: string): string => {
    const map: Record<string, string> = {
        '1/2': '1fr',
        '1/3': '1fr',
        '2/3': '2fr',
        '1/4': '1fr',
        '3/4': '3fr',
    };
    return map[w ?? ''] || '1fr';
};

// ─── Structural components ────────────────────────────────────────────────────

const HeaderPreview: React.FC<P> = ({ props }) => {
    const bg = props.backgroundColor || '#4F46E5';
    const fg = props.textColor || '#FFFFFF';
    return (
        <header className="flex items-center justify-between px-6 py-3 shadow-sm" style={{ backgroundColor: bg }}>
            <div className="flex items-center gap-3">
                {props.logo && (
                    <img src={props.logo} alt="logo" className="h-8 w-auto object-contain" />
                )}
                <span className="font-semibold" style={{ color: fg }}>{props.title || ''}</span>
            </div>
            <nav className="flex items-center gap-5">
                {(props.navigation || []).slice(0, 5).map((nav: any, i: number) => (
                    <span key={i} className="text-sm" style={{ color: fg, opacity: 0.8 }}>{nav.label}</span>
                ))}
            </nav>
            <div className="flex items-center gap-2">
                {props.ctaButton?.enabled && (
                    <span className="rounded-lg bg-catalogue-bg-elevated px-4 py-1.5 text-xs font-semibold shadow-sm" style={{ color: bg }}>
                        {props.ctaButton.text || 'Get Started'}
                    </span>
                )}
                {!props.ctaButton?.enabled && (props.authLinks || []).slice(0, 1).map((link: any, i: number) => (
                    <span key={i} className="rounded-lg bg-catalogue-bg-elevated px-4 py-1.5 text-xs font-semibold" style={{ color: bg }}>
                        {link.label}
                    </span>
                ))}
            </div>
        </header>
    );
};

// Mirrors isPlaceholderImage() in the learner HeroSectionComponent: template
// seed paths and raw media-id tokens never resolve to a real image. Returns the
// usable url, or '' when the value can't render.
const usableBgImage = (url?: unknown): string => {
    const trimmed = typeof url === 'string' ? url.trim() : '';
    if (!trimmed || trimmed === 'null' || trimmed === 'undefined') return '';
    if (trimmed.includes('/api/placeholder/')) return '';
    if (trimmed.startsWith('/assets/')) return '';
    if (['course_banner_media_id', 'course_preview_image_media_id', 'thumbnail_file_id'].includes(trimmed)) return '';
    if (trimmed.includes('_') && !trimmed.includes('http') && !trimmed.includes('/')) return '';
    return trimmed;
};

const HeroSectionPreview: React.FC<P> = ({ props }) => {
    const isSplit = props.layout !== 'centered';
    const collage: string[] = (props.right?.imageCollage ?? []).filter(Boolean);
    const hasCollage = collage.length > 0;
    const tags: string[] = (props.left?.tags ?? []).filter(Boolean);

    // The learner renderer gives a usable background image priority over the
    // background color. Previewing the color unconditionally is what made an
    // authored color look applied here while the live page ignored it, so keep
    // the same precedence on the canvas.
    const bgImage = usableBgImage(props.backgroundImage);
    const surfaceStyle: React.CSSProperties = bgImage
        ? { backgroundImage: `url(${bgImage})`, backgroundSize: 'cover', backgroundPosition: 'center' } // design-lint-ignore: page-builder background image
        : { backgroundColor: props.backgroundColor || '#F8FAFC' /* design-lint-ignore: page-builder default color */ };

    const visibleButtons = (props.left?.buttons ?? []).filter((b: any) => b?.text?.trim());
    const visibleChips = (props.statChips ?? []).filter(
        (c: any) => c?.value?.trim() || c?.label?.trim(),
    );

    const textBlock = (
        <div className="space-y-3">
            {props.eyebrow?.text && (
                props.eyebrow.style === 'plain' ? (
                    <span className="text-caption font-semibold uppercase tracking-wider text-blue-600">
                        {props.eyebrow.text}
                    </span>
                ) : (
                    <span className="inline-flex items-center gap-2 rounded-full border border-catalogue-border bg-catalogue-bg-subtle px-3 py-1 text-caption font-semibold uppercase tracking-wider text-catalogue-text-secondary">
                        <span className="size-1.5 rounded-full bg-blue-500" />
                        {props.eyebrow.text}
                    </span>
                )
            )}
            {tags.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                    {tags.map((tag, i) => (
                        <span key={i} className="rounded-full border border-blue-100 bg-blue-50 px-2.5 py-0.5 text-caption font-semibold uppercase tracking-wider text-blue-600">
                            {tag}
                        </span>
                    ))}
                </div>
            )}
            <h1 className="catalogue-h1 leading-tight text-catalogue-text-primary">
                {props.left?.title || 'Hero Title'}
            </h1>
            {props.left?.subheading && (
                <p className="text-base font-medium text-catalogue-text-secondary">{props.left.subheading}</p>
            )}
            {props.left?.description && (
                <div
                    className="text-sm text-catalogue-text-secondary leading-relaxed [&_p]:mb-1"
                    dangerouslySetInnerHTML={{ __html: props.left.description }}
                />
            )}
            {/* Multi-CTA mirrors the learner contract: non-blank buttons[] replace the legacy single button */}
            {visibleButtons.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                    {visibleButtons.slice(0, 3).map((b: any, i: number) => (
                        <span
                            key={i}
                            className={
                                (b.variant ?? (i === 0 ? 'primary' : 'secondary')) === 'primary'
                                    ? 'inline-block rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm'
                                    : 'inline-block rounded-lg border border-catalogue-border-strong px-5 py-2.5 text-sm font-semibold text-catalogue-text-primary'
                            }
                        >
                            {b.text}
                        </span>
                    ))}
                </div>
            ) : (
                props.left?.button?.enabled && (
                    <span className="inline-block rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm">
                        {props.left.button.text || 'Get Started'}
                    </span>
                )
            )}
            {visibleChips.length > 0 && (
                <div className="flex flex-wrap gap-2 pt-1">
                    {visibleChips.slice(0, 4).map((c: any, i: number) => (
                        <span key={i} className="rounded-xl border border-catalogue-border bg-catalogue-bg-elevated px-3 py-1.5 text-center shadow-sm">
                            <span className="block text-sm font-bold text-catalogue-text-primary">{c.value}</span>
                            <span className="block text-caption text-catalogue-text-secondary">{c.label}</span>
                        </span>
                    ))}
                </div>
            )}
            {(props.trust?.text || props.trust?.rating) && (
                <div className="pt-1 text-caption text-catalogue-text-secondary">
                    {props.trust?.rating ? `★ ${Number(props.trust.rating).toFixed(1)} · ` : ''}
                    {props.trust?.text || ''}
                </div>
            )}
        </div>
    );

    if (isSplit && hasCollage) {
        const imgs = [...collage, '', '', '', '', ''].slice(0, 5);
        return (
            <section
                className="w-full overflow-hidden"
                style={surfaceStyle}
            >
                <div className="mx-auto flex max-w-6xl items-stretch gap-6 px-8 py-10">
                    <div className="flex flex-1 flex-col justify-center">{textBlock}</div>
                    <div
                        className="shrink-0 overflow-hidden rounded-xl"
                        style={{
                            flex: 1,
                            display: 'grid',
                            gridTemplateColumns: '2fr 1fr 1fr',
                            gridTemplateRows: '120px 120px',
                            gap: 6,
                            gridTemplateAreas: '"a b c" "a d e"',
                        }}
                    >
                        {(['a', 'b', 'c', 'd', 'e'] as const).map((area, idx) => (
                            <div
                                key={area}
                                className="overflow-hidden rounded-lg bg-catalogue-bg-muted"
                                style={{ gridArea: area }}
                            >
                                {imgs[idx] ? (
                                    <img src={imgs[idx]} alt="" className="size-full object-cover" />
                                ) : (
                                    <div className="flex size-full items-center justify-center text-[10px] text-gray-300">
                                        Photo {idx + 1}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            </section>
        );
    }

    return (
        <section
            className={`w-full py-10 px-8 ${isSplit ? '' : 'text-center'}`}
            style={surfaceStyle}
        >
            <div className={`mx-auto max-w-6xl ${isSplit ? 'grid grid-cols-2 gap-8 items-center' : 'flex flex-col items-center gap-4'}`}>
                {textBlock}
                {isSplit && (
                    <div className="flex h-56 items-center justify-center overflow-hidden rounded-xl bg-catalogue-bg-muted shadow-sm">
                        {props.right?.image ? (
                            <img
                                src={props.right.image}
                                alt={props.right.alt || ''}
                                className="h-full w-full object-cover"
                            />
                        ) : (
                            <span className="text-sm text-catalogue-text-muted">Image area</span>
                        )}
                    </div>
                )}
            </div>
        </section>
    );
};

const FooterPreview: React.FC<P> = ({ props }) => {
    const bg = props.backgroundColor || '#F9FAFB';
    const fg = props.textColor || '#374151';
    // Collect all right sections (supports rightSection1/2/3, legacy rightSection, and rightSections[])
    const rightCols: any[] = [];
    if (props.rightSection1) rightCols.push(props.rightSection1);
    if (props.rightSection2) rightCols.push(props.rightSection2);
    if (props.rightSection3) rightCols.push(props.rightSection3);
    if (rightCols.length === 0 && props.rightSection) rightCols.push(props.rightSection);
    if (rightCols.length === 0 && props.rightSections?.length > 0) rightCols.push(...props.rightSections.slice(0, 3));

    const totalCols = 1 + rightCols.length;
    const gridClass = totalCols === 2 ? 'grid-cols-2' : totalCols === 3 ? 'grid-cols-3' : 'grid-cols-4';

    return (
        <footer className="border-t px-8 py-8" style={{ backgroundColor: bg }}>
            <div className={`mx-auto max-w-6xl grid ${gridClass} gap-8`}>
                <div>
                    <h3 className="mb-2 text-sm font-semibold" style={{ color: fg }}>
                        {props.leftSection?.title || 'Platform'}
                    </h3>
                    <div
                        className="text-sm"
                        style={{ color: fg, opacity: 0.7 }}
                        dangerouslySetInnerHTML={{ __html: props.leftSection?.text || '' }}
                    />
                </div>
                {rightCols.map((section: any, i: number) => (
                    <div key={i}>
                        <h3 className="mb-2 text-sm font-semibold" style={{ color: fg }}>{section.title}</h3>
                        {(section.links || []).slice(0, 5).map((l: any, j: number) => (
                            <p key={j} className="text-xs" style={{ color: fg, opacity: 0.6 }}>{l.label}</p>
                        ))}
                    </div>
                ))}
            </div>
            <div className="mt-6 border-t pt-4 text-center text-xs" style={{ color: fg, opacity: 0.5 }}>
                {props.bottomNote || '© 2025'}
            </div>
        </footer>
    );
};

// ─── Stats / Social Proof ────────────────────────────────────────────────────

const StatsPreview: React.FC<P> = ({ props }) => {
    const bg = props.backgroundColor || props.styles?.backgroundColor || '#FFFFFF';
    // Heading/description default to white on a dark section bg (matches the
    // learner StatsHighlightsComponent) unless an explicit textColor is set.
    const darkBg = (() => {
        const raw = String(bg).trim().replace(/^#/, '');
        if (!/^[0-9a-fA-F]{6}$/.test(raw)) return false;
        const r = parseInt(raw.slice(0, 2), 16), g = parseInt(raw.slice(2, 4), 16), b = parseInt(raw.slice(4, 6), 16);
        return (0.299 * r + 0.587 * g + 0.114 * b) / 255 < 0.55;
    })();
    const fg = props.textColor || props.styles?.textColor || (darkBg ? '#FFFFFF' : '#111827'); // design-lint-ignore: page-builder default colors
    // Support both formats: flat stats[] and grouped groups[].stats[]
    const useGroups = props.groups && props.groups.length > 0;
    const displayStats: any[] = useGroups
        ? props.groups.flatMap((g: any) => g.stats || [])
        : (props.stats || []);

    return (
        <section className="py-12 px-8" style={{ backgroundColor: bg }}>
            {props.headerText && (
                <h2 className="mb-6 text-center catalogue-h2" style={{ color: fg }}>{props.headerText}</h2>
            )}
            {props.description && (
                <p className="mb-6 text-center text-sm" style={{ color: fg, opacity: 0.65 }}>{props.description}</p>
            )}
            {useGroups ? (
                <div className="mx-auto max-w-4xl space-y-4">
                    {(props.groups || []).map((group: any, gi: number) => (
                        <div key={gi} className="rounded-lg border border-catalogue-border bg-catalogue-bg-elevated p-4">
                            {group.description && (
                                <p className="mb-3 text-center text-xs font-semibold text-blue-600">{group.description}</p>
                            )}
                            <div className="flex flex-wrap justify-center gap-6">
                                {(group.stats || []).slice(0, 5).map((s: any, i: number) => (
                                    <div key={i} className="text-center">
                                        <div className="text-2xl font-bold text-blue-600">{s.value}</div>
                                        <div className="mt-0.5 text-xs" style={{ color: fg, opacity: 0.65 }}>{s.label}</div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                <div className="mx-auto flex max-w-4xl flex-wrap justify-center gap-10">
                    {displayStats.length > 0 ? displayStats.slice(0, 6).map((s: any, i: number) => (
                        <div key={i} className="text-center">
                            <div className="text-3xl font-bold text-blue-600">{s.value}</div>
                            <div className="mt-1 text-sm" style={{ color: fg, opacity: 0.65 }}>{s.label}</div>
                        </div>
                    )) : (
                        <p className="text-sm text-catalogue-text-muted">No stats added yet</p>
                    )}
                </div>
            )}
        </section>
    );
};

const TestimonialPreview: React.FC<P> = ({ props }) => {
    const bg = props.backgroundColor || props.styles?.backgroundColor || '#F9FAFB';
    const fg = props.textColor || props.styles?.textColor || '#111827';
    return (
        <section className="py-12 px-8" style={{ backgroundColor: bg }}>
            {props.headerText && (
                <h2 className="mb-6 text-center catalogue-h2" style={{ color: fg }}>{props.headerText}</h2>
            )}
            <div className="mx-auto grid max-w-4xl grid-cols-2 gap-4">
                {(props.testimonials || []).length > 0 ? (
                    (props.testimonials || []).slice(0, 2).map((t: any, i: number) => (
                        <div key={i} className="rounded-xl bg-catalogue-bg-elevated p-5 shadow-sm">
                            <p className="line-clamp-3 text-sm italic text-catalogue-text-secondary">
                                &ldquo;{t.content || t.feedback || t.text || t.quote || 'Testimonial text…'}&rdquo;
                            </p>
                            <p className="mt-3 text-xs font-semibold text-catalogue-text-primary">{t.author || t.name || 'Student'}</p>
                            {t.role && <p className="text-[11px] text-catalogue-text-muted">{t.role}</p>}
                        </div>
                    ))
                ) : (
                    <div className="col-span-2 rounded-xl border-2 border-dashed border-catalogue-border py-10 text-center text-sm text-catalogue-text-muted">
                        Add testimonials in the properties panel
                    </div>
                )}
            </div>
        </section>
    );
};

const MediaShowcasePreview: React.FC<P> = ({ props }) => {
    const isSlider = props.layout === 'slider' && props.slides && props.slides.length > 0;
    const slides: any[] = props.slides || [];
    const media: any[] = props.media || [];
    const hasContent = isSlider ? slides.length > 0 : media.length > 0;

    return (
        <section
            className="py-12 px-8"
            style={{ backgroundColor: props.styles?.backgroundColor || '#F0F9FF' }}
        >
            {props.headerText && (
                <h2 className="mb-2 text-center catalogue-h2 text-catalogue-text-primary">{props.headerText}</h2>
            )}
            {props.description && (
                <p className="mb-6 text-center text-sm text-catalogue-text-secondary">{props.description}</p>
            )}

            {isSlider ? (
                // Slider format — show slides as a strip
                <div className="mx-auto max-w-4xl overflow-hidden rounded-xl">
                    <div className="flex gap-2">
                        {slides.slice(0, 3).map((slide: any, i: number) => (
                            <div
                                key={i}
                                className="relative flex-1 overflow-hidden rounded-xl"
                                style={{ minHeight: 160 }}
                            >
                                {slide.backgroundImage ? (
                                    <img
                                        src={slide.backgroundImage}
                                        alt={slide.heading || ''}
                                        className="h-40 w-full object-cover"
                                    />
                                ) : (
                                    <div className="flex h-40 w-full items-center justify-center bg-gray-800">
                                        <span className="text-xs text-catalogue-text-muted">Slide {i + 1}</span>
                                    </div>
                                )}
                                {slide.heading && (
                                    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 px-3 py-2">
                                        <p className="truncate text-xs font-semibold text-white">{slide.heading}</p>
                                    </div>
                                )}
                            </div>
                        ))}
                        {slides.length > 3 && (
                            <div className="flex flex-1 items-center justify-center rounded-xl bg-catalogue-bg-muted text-xs text-catalogue-text-muted">
                                +{slides.length - 3} more
                            </div>
                        )}
                    </div>
                    <p className="mt-2 text-center text-xs text-catalogue-text-muted">
                        {slides.length} slide{slides.length !== 1 ? 's' : ''} · slider layout
                    </p>
                </div>
            ) : hasContent ? (
                // Media carousel format
                <div className="mx-auto flex max-w-4xl gap-4">
                    {media.slice(0, 3).map((m: any, i: number) => (
                        <div key={i} className="flex-1 overflow-hidden rounded-xl bg-catalogue-bg-elevated shadow-sm">
                            {m.thumbnail ? (
                                <img src={m.thumbnail} alt="" className="h-24 w-full object-cover" />
                            ) : m.type === 'video' ? (
                                <div className="flex h-24 w-full items-center justify-center bg-gray-800 text-white/60">
                                    <span className="text-2xl">▶</span>
                                </div>
                            ) : (
                                <div className="flex h-24 w-full items-center justify-center bg-catalogue-bg-muted text-gray-300 text-2xl">🖼</div>
                            )}
                            <div className="p-2 text-center">
                                <p className="text-xs font-medium text-catalogue-text-primary truncate">{m.caption || m.title || 'Media item'}</p>
                                <p className="text-[10px] capitalize text-catalogue-text-muted">{m.type || 'image'}</p>
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                <div className="mx-auto max-w-4xl rounded-xl border-2 border-dashed border-catalogue-border py-10 text-center text-sm text-catalogue-text-muted">
                    Add slides or media items in the properties panel
                </div>
            )}
        </section>
    );
};

// ─── New component types ──────────────────────────────────────────────────────

const FaqPreview: React.FC<P> = ({ props }) => {
    const bg = props.backgroundColor || '#F9FAFB';
    const fg = props.textColor || '#111827';
    return (
        <section className="py-12 px-8" style={{ backgroundColor: bg }}>
            {props.headerText && (
                <h2 className="mb-2 text-center catalogue-h2" style={{ color: fg }}>{props.headerText}</h2>
            )}
            {props.subheading && (
                <p className="mb-6 text-center text-sm" style={{ color: fg, opacity: 0.65 }}>{props.subheading}</p>
            )}
            <div className="mx-auto max-w-3xl space-y-2">
                {(props.faqs || []).slice(0, 4).map((faq: any, i: number) => (
                    <div key={i} className="flex items-center justify-between rounded-lg border border-catalogue-border bg-catalogue-bg-elevated px-5 py-3">
                        <span className="text-sm font-medium" style={{ color: fg }}>{faq.question}</span>
                        <span className="text-catalogue-text-muted">+</span>
                    </div>
                ))}
            </div>
        </section>
    );
};

const VideoPreview: React.FC<P> = ({ props }) => (
    <section className="py-10 px-8">
        {props.title && (
            <h2 className="mb-4 text-center catalogue-h2 text-catalogue-text-primary">{props.title}</h2>
        )}
        <div className="mx-auto max-w-3xl">
            <div
                className="flex items-center justify-center rounded-xl bg-gray-900 text-white"
                style={{ aspectRatio: '16/9' }}
            >
                {props.url ? (
                    <span className="text-sm opacity-70">▶ {props.url.slice(0, 50)}…</span>
                ) : (
                    <div className="text-center">
                        <div className="mb-2 text-5xl">▶</div>
                        <p className="text-sm opacity-60">Add a video URL in properties</p>
                    </div>
                )}
            </div>
            {props.caption && (
                <p className="mt-2 text-center text-sm text-catalogue-text-secondary">{props.caption}</p>
            )}
        </div>
    </section>
);

const CtaBannerPreview: React.FC<P> = ({ props }) => (
    <section
        className="py-14 px-8 text-center"
        style={{ backgroundColor: props.backgroundColor || '#3B82F6' }}
    >
        <h2 className="catalogue-h2" style={{ color: props.textColor || '#fff' }}>
            {props.heading || 'Call to Action'}
        </h2>
        {props.subheading && (
            <p className="mt-2 text-base opacity-90" style={{ color: props.textColor || '#fff' }}>
                {props.subheading}
            </p>
        )}
        {props.button?.enabled && (
            <span
                className="mt-5 inline-block rounded-lg bg-catalogue-bg-elevated px-7 py-2.5 text-sm font-semibold shadow"
                style={{ color: props.backgroundColor || '#3B82F6' }}
            >
                {props.button.text}
            </span>
        )}
    </section>
);

const PricingPreview: React.FC<P> = ({ props }) => (
    <section className="bg-catalogue-bg-elevated py-12 px-8">
        {props.headerText && (
            <h2 className="mb-2 text-center catalogue-h2 text-catalogue-text-primary">{props.headerText}</h2>
        )}
        {props.subheading && (
            <p className="mb-8 text-center text-sm text-catalogue-text-secondary">{props.subheading}</p>
        )}
        <div className="mx-auto flex max-w-3xl flex-wrap justify-center gap-4">
            {(props.plans || []).slice(0, 3).map((plan: any, i: number) => (
                <div
                    key={i}
                    className={`min-w-[160px] flex-1 rounded-xl border-2 p-5 ${plan.highlighted ? 'border-blue-500 shadow-lg' : 'border-catalogue-border'}`}
                >
                    <h3 className="font-bold text-catalogue-text-primary">{plan.name}</h3>
                    <div className="my-2 text-2xl font-bold text-catalogue-text-primary">{plan.price}</div>
                    <ul className="space-y-1">
                        {(plan.features || []).slice(0, 3).map((f: string, j: number) => (
                            <li key={j} className="flex items-center gap-1 text-xs text-catalogue-text-secondary">
                                <span className="text-green-500">✓</span>{f}
                            </li>
                        ))}
                    </ul>
                </div>
            ))}
        </div>
    </section>
);

const ContactFormPreview: React.FC<P> = ({ props }) => (
    <section className="py-12 px-8" style={{ backgroundColor: props.backgroundColor || '#fff' }}>
        {props.heading && (
            <h2 className="mb-2 text-center catalogue-h2 text-catalogue-text-primary">{props.heading}</h2>
        )}
        {props.subheading && (
            <p className="mb-6 text-center text-sm text-catalogue-text-secondary">{props.subheading}</p>
        )}
        <div className="mx-auto max-w-lg rounded-xl border border-catalogue-border bg-catalogue-bg-elevated p-6 shadow-sm">
            <div className="space-y-3">
                {(props.fields || []).slice(0, 4).map((field: any, i: number) => (
                    <div key={i}>
                        <div className="mb-1 text-xs font-medium text-catalogue-text-secondary">
                            {field.label}{field.required && <span className="ml-0.5 text-red-500">*</span>}
                        </div>
                        <div className={`rounded border border-catalogue-border bg-catalogue-bg-subtle ${field.type === 'textarea' ? 'h-16' : 'h-8'}`} />
                    </div>
                ))}
                <div className="mt-2 h-9 rounded bg-blue-500" />
            </div>
        </div>
    </section>
);

const TeamPreview: React.FC<P> = ({ props }) => (
    <section className="bg-catalogue-bg-elevated py-12 px-8">
        {props.headerText && (
            <h2 className="mb-2 text-center catalogue-h2 text-catalogue-text-primary">{props.headerText}</h2>
        )}
        {props.subheading && (
            <p className="mb-8 text-center text-sm text-catalogue-text-secondary">{props.subheading}</p>
        )}
        <div className="mx-auto grid max-w-4xl grid-cols-3 gap-6">
            {(props.members || []).slice(0, 3).map((m: any, i: number) => (
                <div key={i} className="flex flex-col items-center text-center">
                    {m.avatar ? (
                        <img src={m.avatar} alt={m.name} className="mb-3 size-16 rounded-full object-cover shadow" />
                    ) : (
                        <div className="mb-3 flex size-16 items-center justify-center rounded-full bg-blue-100 text-xl font-bold text-blue-600">
                            {m.name?.[0] || '?'}
                        </div>
                    )}
                    <p className="text-sm font-semibold text-catalogue-text-primary">{m.name}</p>
                    <p className="text-xs text-blue-600">{m.role}</p>
                </div>
            ))}
        </div>
    </section>
);

const AnnouncementPreview: React.FC<P> = ({ props }) => (
    <section className="py-10 px-8" style={{ backgroundColor: props.backgroundColor || '#fff' }}>
        {props.headerText && (
            <h2 className="mb-6 text-center catalogue-h2 text-catalogue-text-primary">{props.headerText}</h2>
        )}
        <div className="mx-auto max-w-3xl space-y-3">
            {(props.announcements || []).slice(0, 3).map((a: any, i: number) => (
                <div key={i} className="rounded-xl border border-catalogue-border bg-catalogue-bg-elevated px-5 py-4">
                    <div className="mb-1 flex items-center gap-2">
                        {a.tag && (
                            <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">
                                {a.tag}
                            </span>
                        )}
                        {a.date && <span className="text-xs text-catalogue-text-muted">{a.date}</span>}
                    </div>
                    <p className="text-sm font-semibold text-catalogue-text-primary">{a.title}</p>
                </div>
            ))}
        </div>
    </section>
);

const GalleryPreview: React.FC<P> = ({ props }) => (
    <section className="bg-catalogue-bg-elevated py-10 px-8">
        {props.headerText && (
            <h2 className="mb-6 text-center catalogue-h2 text-catalogue-text-primary">{props.headerText}</h2>
        )}
        <div className="mx-auto grid max-w-4xl grid-cols-3 gap-3">
            {(props.images || []).slice(0, 6).map((img: any, i: number) => (
                <div key={i} className="overflow-hidden rounded-lg" style={{ aspectRatio: '4/3' }}>
                    {img.src ? (
                        <img src={img.src} alt={img.alt || ''} className="h-full w-full object-cover" />
                    ) : (
                        <div className="flex h-full w-full items-center justify-center bg-catalogue-bg-muted text-xs text-gray-300">
                            Image {i + 1}
                        </div>
                    )}
                </div>
            ))}
        </div>
    </section>
);

// ─── Data-driven placeholder ──────────────────────────────────────────────────

const DataPlaceholder: React.FC<{ label: string; description?: string }> = ({ label, description }) => (
    <div className="flex items-center justify-center border border-dashed border-catalogue-border bg-catalogue-bg-subtle px-6 py-10">
        <div className="text-center">
            <div className="mb-1 text-sm font-semibold text-catalogue-text-secondary">{label}</div>
            <div className="text-xs text-catalogue-text-muted">
                {description || 'Renders live data on the published page'}
            </div>
        </div>
    </div>
);

const MarqueePreview: React.FC<P> = ({ props }) => {
    const bg = props.backgroundColor || '#1e1b4b';
    const fg = props.textColor || '#ffffff';
    const iconColor = props.iconColor || '#facc15';
    const items: Array<{ icon: string; text: string }> = props.items ?? [
        { icon: '⭐', text: 'Top-rated courses' },
        { icon: '⭐', text: '10,000+ learners' },
        { icon: '⭐', text: 'Expert instructors' },
    ];

    return (
        <div className="overflow-hidden py-3" style={{ backgroundColor: bg }}>
            <div className="flex items-center gap-8 px-4">
                {[...items, ...items].slice(0, 8).map((item, i) => (
                    <span key={i} className="flex shrink-0 items-center gap-2 whitespace-nowrap text-sm font-medium" style={{ color: fg }}>
                        {item.icon && <span style={{ color: iconColor }}>{item.icon}</span>}
                        {item.text}
                    </span>
                ))}
                <span className="shrink-0 text-[10px] opacity-50" style={{ color: fg }}>→ scrolling</span>
            </div>
        </div>
    );
};

// ─── Main dispatcher ──────────────────────────────────────────────────────────

export const renderComponentPreview = (
    component: { type: string; props: any },
    _depth = 0
): React.ReactNode => {
    const { type, props } = component;
    switch (type) {
        case 'header':
            return <HeaderPreview props={props} />;
        case 'heroSection':
            return <HeroSectionPreview props={props} />;
        case 'footer':
            return <FooterPreview props={props} />;
        case 'statsHighlights':
            return <StatsPreview props={props} />;
        case 'testimonialSection':
            return <TestimonialPreview props={props} />;
        case 'mediaShowcase':
        case 'MediaShowcaseComponent':
            return <MediaShowcasePreview props={props} />;
        case 'faqSection':
            return <FaqPreview props={props} />;
        case 'videoEmbed':
            return <VideoPreview props={props} />;
        case 'ctaBanner':
            return <CtaBannerPreview props={props} />;
        case 'pricingTable':
            return <PricingPreview props={props} />;
        case 'contactForm':
            return <ContactFormPreview props={props} />;
        case 'teamSection':
            return <TeamPreview props={props} />;
        case 'announcementFeed':
            return <AnnouncementPreview props={props} />;
        case 'imageGallery':
            return <GalleryPreview props={props} />;
        case 'buyRentSection':
            return (
                <section className="py-10 px-8 text-center">
                    <h2 className="mb-5 catalogue-h2 text-catalogue-text-primary">
                        {props.heading || 'Choose Your Path'}
                    </h2>
                    <div className="flex justify-center gap-4">
                        <span className="rounded-lg border px-7 py-3 font-medium text-catalogue-text-primary">
                            {props.buy?.buttonLabel || 'Buy'}
                        </span>
                        <span className="rounded-lg border px-7 py-3 font-medium text-catalogue-text-primary">
                            {props.rent?.buttonLabel || 'Rent'}
                        </span>
                    </div>
                </section>
            );
        case 'courseCatalog':
            return <DataPlaceholder label="Course Catalog" description={`Shows live courses — "${props.title || 'Our Courses'}"`} />;
        case 'bookCatalogue':
            return <DataPlaceholder label="Book Catalogue" description={`Shows live books — "${props.title || 'Book Collection'}"`} />;
        case 'cartComponent':
            return <DataPlaceholder label="Shopping Cart" description="Student cart with items and checkout flow" />;
        case 'courseDetails':
            return <DataPlaceholder label="Course Details" description="Renders the current course's detail data" />;
        case 'bookDetails':
            return <DataPlaceholder label="Book Details" description="Renders the current book's detail data" />;
        case 'policyRenderer':
            return <DataPlaceholder label="Policy Page" description="Renders policy / terms content" />;
        case 'sectionHeading': {
            const shSize = props.size === 'xl' ? 'catalogue-display' : props.size === 'md' ? 'catalogue-h3' : 'catalogue-h2';
            // Guard like the live renderer: a non-string title (hand-authored
            // JSON) renders as text with the highlight skipped, never crashes
            const shTitle: string = typeof props.title === 'string' ? props.title : String(props.title ?? '');
            const hl = props.highlight;
            let shTitleNode: React.ReactNode = shTitle;
            if (hl?.text && typeof props.title === 'string' && shTitle.includes(hl.text)) {
                const idx = shTitle.indexOf(hl.text);
                const hlClass =
                    hl.style === 'underline'
                        ? 'underline decoration-primary-400 decoration-4 underline-offset-8'
                        : hl.style === 'mark'
                          ? 'rounded-md bg-primary-100 px-2 text-catalogue-text-primary'
                          : 'catalogue-text-gradient';
                shTitleNode = (
                    <>
                        {shTitle.slice(0, idx)}
                        <span className={hlClass}>{hl.text}</span>
                        {shTitle.slice(idx + hl.text.length)}
                    </>
                );
            }
            return (
                <section className="px-4 pt-12 pb-4" style={{ backgroundColor: props.backgroundColor || undefined }}>
                    <div className={`mx-auto max-w-3xl ${props.align === 'left' ? 'text-left' : 'text-center'}`}>
                        {props.eyebrow && <span className="catalogue-eyebrow">{props.eyebrow}</span>}
                        <h2 className={`${props.eyebrow ? 'mt-3' : ''} font-bold text-catalogue-text-primary ${shSize}`}>{shTitleNode}</h2>
                        {props.lead && <p className="mt-4 catalogue-lead text-catalogue-text-secondary">{props.lead}</p>}
                    </div>
                </section>
            );
        }
        case 'trustChip': {
            const trustAvatars: string[] = (props.avatars || []).filter(Boolean);
            const trustAlign = props.alignment === 'left' ? 'justify-start' : props.alignment === 'right' ? 'justify-end' : 'justify-center';
            return (
                <div className={`flex px-4 py-6 ${trustAlign}`}>
                    <span className="inline-flex items-center gap-3 rounded-full border border-catalogue-border bg-catalogue-bg-subtle py-2 pl-2.5 pr-5">
                        {trustAvatars.length > 0 && (
                            <span className="flex -space-x-2">
                                {trustAvatars.slice(0, 4).map((src, i) => (
                                    <img key={i} src={src} alt="" className="size-8 rounded-full border-2 border-white object-cover" />
                                ))}
                            </span>
                        )}
                        {props.rating ? (
                            // Clamp like the live renderer so canvas and page agree on stored out-of-range values
                            <span className="text-sm font-semibold text-catalogue-text-primary">★ {Math.min(5, Math.max(0, Number(props.rating))).toFixed(1)}</span>
                        ) : null}
                        {props.text && <span className="text-sm text-catalogue-text-secondary">{props.text}</span>}
                    </span>
                </div>
            );
        }
        case 'spacer': {
            const dividerStyle = props.showDivider ? {
                borderTop: `${props.dividerWidth || '1px'} ${props.dividerStyle || 'solid'} ${props.dividerColor || '#E5E7EB'}`,
                maxWidth: props.maxWidth || '100%',
                margin: '0 auto',
            } : {};
            return (
                <div style={{ height: props.height || '48px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {props.showDivider && <hr style={{ ...dividerStyle, width: '100%' }} />}
                </div>
            );
        }
        case 'tabsAccordion': {
            const items = props.items || [];
            return (
                <section className="py-8 px-6">
                    {props.mode === 'accordion' ? (
                        <div className="mx-auto max-w-2xl space-y-2">
                            {items.map((item: any, i: number) => (
                                <div key={i} className="rounded-lg border border-catalogue-border bg-catalogue-bg-elevated px-4 py-3">
                                    <div className="font-medium text-catalogue-text-primary">{item.title || `Item ${i + 1}`}</div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="mx-auto max-w-2xl">
                            <div className="flex border-b border-catalogue-border">
                                {items.map((item: any, i: number) => (
                                    <div key={i} className={`px-4 py-2 text-sm font-medium ${i === 0 ? 'border-b-2 border-blue-500 text-blue-600' : 'text-catalogue-text-secondary'}`}>
                                        {item.title || `Tab ${i + 1}`}
                                    </div>
                                ))}
                            </div>
                            <div className="p-4 text-sm text-catalogue-text-secondary" dangerouslySetInnerHTML={{ __html: items[0]?.content || 'Tab content' }} />
                        </div>
                    )}
                </section>
            );
        }
        case 'logoCloud': {
            // Mirrors the learner LogoCloudRenderer: honours `display` (the
            // preview used to draw grey "Logo" boxes even in text-ticker mode,
            // so a working announcement band looked broken on the canvas) and
            // hides rows that would not render live, instead of showing
            // phantom placeholders for editor-seeded empty entries.
            const lcDisplay = props.display || 'logo';
            const lcWillRender = (l: any) =>
                lcDisplay === 'label-pill' ? !!(l.label || l.alt) : !!(l.image || l.label);
            const logos = (props.logos || []).filter(lcWillRender);
            const isTicker = props.layout === 'marquee';
            return (
                <section className="py-10 text-center">
                    {props.headerText && <h3 className="mb-6 text-lg font-semibold text-catalogue-text-muted uppercase tracking-wider">{props.headerText}</h3>}
                    <div className={`flex items-center gap-6 ${isTicker ? 'overflow-hidden px-0' : 'flex-wrap justify-center px-8'}`}>
                        {logos.length === 0 ? (
                            <div className="w-full text-sm text-gray-300">
                                {lcDisplay === 'label-pill' ? 'Add ticker items via the property panel' : 'Add logos via the property panel'}
                            </div>
                        ) : logos.map((logo: any, i: number) => {
                            const label = lcDisplay === 'label-pill' ? (logo.label || logo.alt || '') : (logo.label || '');
                            if (lcDisplay === 'label-pill' || (!logo.image && label)) {
                                return (
                                    <span key={i} className="inline-flex shrink-0 items-center rounded-full border border-catalogue-border bg-catalogue-bg-subtle px-4 py-1.5 text-sm font-medium text-catalogue-text-secondary">
                                        {label}
                                    </span>
                                );
                            }
                            return (
                                <div key={i} className={`flex shrink-0 flex-col items-center gap-1 ${props.grayscale ? 'grayscale' : ''}`}>
                                    <div className="h-10 w-24 rounded bg-catalogue-bg-muted">
                                        {logo.image && <img src={logo.image} alt={logo.alt || ''} className="h-full w-full object-contain" />}
                                    </div>
                                    {lcDisplay === 'logo+label' && label && (
                                        <span className="text-caption text-catalogue-text-muted">{label}</span>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </section>
            );
        }
        case 'mapEmbed':
            return (
                <section className="py-6 px-6">
                    {props.title && <h3 className="mb-3 text-lg font-semibold text-catalogue-text-primary">{props.title}</h3>}
                    <div className="flex items-center justify-center rounded bg-catalogue-bg-muted" style={{ height: props.height || '400px', borderRadius: props.borderRadius || '8px' }}>
                        {props.embedUrl ? (
                            <div className="text-sm text-catalogue-text-secondary">Map embed preview</div>
                        ) : (
                            <div className="text-sm text-gray-300">Add a Google Maps embed URL</div>
                        )}
                    </div>
                </section>
            );
        case 'countdownTimer':
            return (
                <section className="py-10 px-8 text-center" style={{ backgroundColor: props.backgroundColor || '#1E293B' }}>
                    <h3 className="mb-6 text-xl font-bold" style={{ color: props.textColor || '#FFFFFF' }}>
                        {props.heading || 'Event Starts In'}
                    </h3>
                    <div className="flex justify-center gap-4">
                        {['Days', 'Hours', 'Mins', 'Secs'].map((unit) => (
                            <div key={unit} className="rounded-lg bg-catalogue-bg-elevated/10 px-5 py-3">
                                <div className="text-3xl font-bold" style={{ color: props.textColor || '#FFFFFF' }}>00</div>
                                <div className="mt-1 text-xs uppercase tracking-wider" style={{ color: props.textColor ? `${props.textColor}99` : '#FFFFFF99' }}>{unit}</div>
                            </div>
                        ))}
                    </div>
                </section>
            );
        case 'textBlock':
            return (
                <section className="py-8 px-6">
                    <div
                        style={{ maxWidth: props.maxWidth || '800px', margin: props.alignment === 'center' ? '0 auto' : props.alignment === 'right' ? '0 0 0 auto' : undefined }}
                        className="max-w-none text-catalogue-text-primary [&_h1]:text-2xl [&_h1]:font-bold [&_h1]:mb-2 [&_h2]:text-xl [&_h2]:font-bold [&_h2]:mb-2 [&_h3]:text-lg [&_h3]:font-semibold [&_h3]:mb-1 [&_p]:mb-3 [&_a]:text-blue-600 [&_a]:underline [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_li]:mb-1"
                        dangerouslySetInnerHTML={{ __html: props.content || '<p>Text block — click to edit content</p>' }}
                    />
                </section>
            );
        case 'featureGrid': {
            const features = props.features || [];
            const cols = props.columns || 3;
            const fg = props.textColor || '#111827';
            // "panel" — tinted-header division cards (mirrors the learner
            // FeatureGridRenderer panel branch).
            if ((props.style || 'cards') === 'panel') {
                const hexDark = (hex?: string) => {
                    const raw = (hex || '').trim().replace(/^#/, '');
                    if (!/^[0-9a-fA-F]{6}$/.test(raw)) return false;
                    const r = parseInt(raw.slice(0, 2), 16), g = parseInt(raw.slice(2, 4), 16), b = parseInt(raw.slice(4, 6), 16);
                    return (0.299 * r + 0.587 * g + 0.114 * b) / 255 < 0.55;
                };
                const pCols = Math.min(Math.max(cols, 1), 3);
                return (
                    <section className="py-10 px-8" style={{ backgroundColor: props.backgroundColor || '#FFFFFF' /* design-lint-ignore: page-builder default color */ }}>
                        {props.headerText && <h2 className="mb-1 text-center catalogue-h2" style={{ color: fg }}>{props.headerText}</h2>}
                        {props.subheading && <p className="mb-8 text-center text-sm" style={{ color: fg, opacity: 0.65 }}>{props.subheading}</p>}
                        <div className="mx-auto max-w-5xl" style={{ display: 'grid', gridTemplateColumns: `repeat(${pCols}, 1fr)`, gap: 20 }}>
                            {features.map((f: any, i: number) => {
                                const IconComp = f.iconName ? FEATURE_ICON_MAP[f.iconName] : undefined;
                                const bullets: string[] = (f.bullets || []).filter(Boolean);
                                const badge: string = f.badge || (f.chips || []).filter(Boolean)[0] || '';
                                const solid = f.headerColor ? hexDark(f.headerColor) : f.headerVariant === 'solid';
                                const headerStyle = f.headerColor
                                    ? { backgroundColor: f.headerColor }
                                    : solid ? { backgroundColor: 'hsl(var(--primary-500))' } : { backgroundColor: 'hsl(var(--primary-50))' };
                                return (
                                    <div key={i} className="catalogue-card-elevated overflow-hidden !p-0 text-left">
                                        <div className="p-5" style={headerStyle}>
                                            {(badge || IconComp) && (
                                                <div className="mb-2 flex items-center justify-between gap-2">
                                                    {badge ? (
                                                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-caption font-semibold uppercase tracking-wider ${solid ? 'bg-catalogue-bg-elevated/15 text-white' : 'bg-primary-100 text-primary-600'}`}>{badge}</span>
                                                    ) : <span />}
                                                    {IconComp && (
                                                        <span className={`inline-flex items-center justify-center rounded-lg p-2 ${solid ? 'bg-catalogue-bg-elevated/15 text-white' : 'bg-primary-100 text-primary-500'}`}>
                                                            <IconComp size={22} weight="duotone" aria-hidden="true" />
                                                        </span>
                                                    )}
                                                </div>
                                            )}
                                            <h3 className={`catalogue-h3 text-lg font-bold ${solid ? 'text-white' : 'text-catalogue-text-primary'}`}>{f.title}</h3>
                                            {f.description && <p className={`mt-1 text-xs leading-relaxed ${solid ? 'text-white/75' : 'text-catalogue-text-secondary'}`}>{f.description}</p>}
                                        </div>
                                        {(bullets.length > 0 || f.link?.text) && (
                                            <div className="p-5">
                                                {bullets.length > 0 && (
                                                    <ul className="space-y-1.5 text-xs text-catalogue-text-secondary">
                                                        {bullets.map((b: string, j: number) => (
                                                            <li key={j} className="flex items-start gap-1.5">
                                                                <Check size={13} weight="bold" className="mt-0.5 shrink-0 text-primary-500" aria-hidden="true" />
                                                                <span>{b}</span>
                                                            </li>
                                                        ))}
                                                    </ul>
                                                )}
                                                {f.link?.text && <div className="mt-3 text-xs font-semibold text-primary-500">{f.link.text} →</div>}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </section>
                );
            }
            // Card skins mirror the learner FeatureGridRenderer so the new
            // Style buttons (glass / gradient-border / tinted) show on canvas
            const fgStyle = props.style || 'cards';
            const cardClass =
                fgStyle === 'cards' ? 'catalogue-card-elevated group p-6' :
                fgStyle === 'bordered' ? 'rounded-xl border-2 border-catalogue-border p-5' :
                fgStyle === 'glass' ? 'catalogue-card-glass p-5' :
                fgStyle === 'gradient-border' ? 'catalogue-card-gradient-border p-5' :
                fgStyle === 'tinted' ? 'catalogue-card-tinted p-5' :
                'p-4';
            // Mirrors the learner default: prose cards left-align, icon tiles centre.
            const fgHasProse = features.some((f: any) => String(f.description || '').length > 60 || (f.bullets?.length ?? 0) > 0);
            const fgLeft = (props.align ?? (fgHasProse ? 'left' : 'center')) === 'left';
            return (
                <section className="py-10 px-8" style={{ backgroundColor: props.backgroundColor || '#FFFFFF' }}>
                    {props.headerText && <h2 className="mb-1 text-center catalogue-h2" style={{ color: fg }}>{props.headerText}</h2>}
                    {props.subheading && <p className="mb-8 text-center text-sm" style={{ color: fg, opacity: 0.65 }}>{props.subheading}</p>}
                    <div className="mx-auto max-w-5xl" style={{ display: 'grid', gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: 20 }}>
                        {features.map((f: any, i: number) => {
                            const IconComp = f.iconName ? FEATURE_ICON_MAP[f.iconName] : undefined;
                            const chips: string[] = (f.chips || []).filter(Boolean);
                            const bullets: string[] = (f.bullets || []).filter(Boolean);
                            return (
                                <div key={i} className={`${fgLeft ? 'text-left' : 'text-center'} ${cardClass}`}>
                                    <div className={`mb-3 flex ${fgLeft ? '' : 'justify-center'}`}>
                                        {IconComp ? (
                                            <span className="inline-flex size-12 items-center justify-center rounded-2xl bg-gradient-to-br from-primary-50 to-primary-100 p-3 text-primary-500 ring-1 ring-primary-100 transition-transform duration-300 group-hover:scale-105">
                                                <IconComp size={props.iconSize === 'small' ? 18 : props.iconSize === 'medium' ? 24 : 28} weight="duotone" aria-hidden="true" />
                                            </span>
                                        ) : f.icon ? (
                                            <span className={props.iconSize === 'large' ? 'text-3xl' : 'text-2xl'}>{f.icon}</span>
                                        ) : null}
                                    </div>
                                    {chips.length > 0 && (
                                        <div className={`mb-2 flex flex-wrap gap-1.5 ${fgLeft ? '' : 'justify-center'}`}>
                                            {chips.map((c, j) => (
                                                <span key={j} className="inline-flex items-center rounded-full bg-primary-50 px-3 py-1 text-xs font-medium text-primary-500 ring-1 ring-primary-100">{c}</span>
                                            ))}
                                        </div>
                                    )}
                                    <h4 className="mb-1 text-sm font-semibold" style={{ color: fg }}>{f.title}</h4>
                                    <p className="text-xs" style={{ color: fg, opacity: 0.6 }}>{f.description}</p>
                                    {bullets.length > 0 && (
                                        <ul className={`mt-2 space-y-1 text-xs ${fgLeft ? '' : 'inline-block text-left'}`} style={{ color: fg, opacity: 0.8 }}>
                                            {bullets.map((b, j) => (
                                                <li key={j} className="flex items-start gap-1.5">
                                                    <Check size={12} weight="bold" className="mt-0.5 shrink-0 text-primary-500" aria-hidden="true" />
                                                    <span>{b}</span>
                                                </li>
                                            ))}
                                        </ul>
                                    )}
                                    {f.link?.text && (
                                        <div className="mt-2 text-xs font-semibold text-primary-500">{f.link.text} →</div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </section>
            );
        }
        case 'imageBlock':
            return (
                <section className="py-6 px-6" style={{ textAlign: (props.alignment as any) || 'center' }}>
                    {props.src ? (
                        <img
                            src={props.src}
                            alt={props.alt || ''}
                            style={{ maxWidth: props.maxWidth || '100%', borderRadius: props.borderRadius || '8px', display: 'inline-block' }}
                            className="h-auto"
                        />
                    ) : (
                        <div className="mx-auto flex h-48 w-80 items-center justify-center rounded-lg border-2 border-dashed border-catalogue-border bg-catalogue-bg-subtle text-sm text-gray-300">
                            Upload an image
                        </div>
                    )}
                    {props.caption && <p className="mt-2 text-xs text-catalogue-text-muted">{props.caption}</p>}
                </section>
            );
        case 'buttonBlock': {
            const btnVariant = props.variant || 'filled';
            const btnBg = props.backgroundColor || '#3B82F6';
            const btnText = props.textColor || (btnVariant === 'filled' ? '#FFFFFF' : btnBg);
            return (
                <section className="py-8 px-6" style={{ textAlign: (props.alignment as any) || 'center' }}>
                    <span
                        className={`inline-block font-medium transition ${props.fullWidth ? 'w-full' : ''}`}
                        style={{
                            padding: props.size === 'small' ? '8px 20px' : props.size === 'large' ? '14px 36px' : '10px 28px',
                            fontSize: props.size === 'small' ? '13px' : props.size === 'large' ? '16px' : '14px',
                            backgroundColor: btnVariant === 'filled' ? btnBg : 'transparent',
                            color: btnText,
                            border: btnVariant === 'outline' ? `2px solid ${btnBg}` : btnVariant === 'ghost' ? 'none' : 'none',
                            borderRadius: props.borderRadius || '8px',
                        }}
                    >
                        {props.text || 'Button'}
                    </span>
                </section>
            );
        }
        case 'newsletterSignup':
            return (
                <section className="py-10 px-8" style={{ backgroundColor: props.backgroundColor || '#F8FAFC' }}>
                    <div className="mx-auto max-w-lg text-center">
                        {props.heading && <h3 className="mb-1 text-xl font-bold text-catalogue-text-primary">{props.heading}</h3>}
                        {props.subheading && <p className="mb-5 text-sm text-catalogue-text-secondary">{props.subheading}</p>}
                        <div className={`flex ${props.layout === 'stacked' ? 'flex-col' : ''} gap-2`}>
                            <div className="flex-1 rounded-lg border border-catalogue-border bg-catalogue-bg-elevated px-4 py-2.5 text-left text-sm text-catalogue-text-muted">
                                {props.placeholder || 'Enter your email'}
                            </div>
                            <span className="rounded-lg bg-blue-500 px-5 py-2.5 text-sm font-medium text-white">
                                {props.buttonText || 'Subscribe'}
                            </span>
                        </div>
                    </div>
                </section>
            );
        case 'stepsProcess': {
            const steps = props.steps || [];
            const isHorizontal = props.layout !== 'vertical';
            const fg = props.textColor || '#111827';
            return (
                <section className="py-10 px-8" style={{ backgroundColor: props.backgroundColor || '#FFFFFF' }}>
                    {props.headerText && <h2 className="mb-1 text-center catalogue-h2" style={{ color: fg }}>{props.headerText}</h2>}
                    {props.subheading && <p className="mb-8 text-center text-sm" style={{ color: fg, opacity: 0.65 }}>{props.subheading}</p>}
                    <div className={`mx-auto max-w-4xl ${isHorizontal ? 'flex items-start justify-center gap-4' : 'flex flex-col gap-6'}`}>
                        {steps.map((step: any, i: number) => (
                            <div key={i} className={`flex ${isHorizontal ? 'flex-1 flex-col items-center text-center' : 'items-start gap-4'}`}>
                                <div className="mb-2 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-500 text-sm font-bold text-white">
                                    {step.number || i + 1}
                                </div>
                                <div>
                                    <h4 className="text-sm font-semibold" style={{ color: fg }}>{step.title}</h4>
                                    <p className="mt-0.5 text-xs" style={{ color: fg, opacity: 0.6 }}>{step.description}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </section>
            );
        }
        case 'columnLayout': {
            const slots: any[][] = props.slots || [[], []];
            const colWidths: string[] = props.columnWidths || [];
            const cols = slots.length;
            const gapLabel = props.gap || 'md';
            // Guard against deeply nested columnLayouts causing infinite recursion
            const maxDepth = 2;
            return (
                <div className="w-full p-3 bg-teal-50 border border-dashed border-teal-300 rounded">
                    <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-teal-600">
                        {cols}-Column Layout · gap: {gapLabel}
                    </div>
                    <div
                        style={{
                            display: 'grid',
                            gridTemplateColumns:
                                Array.isArray(props.columnFr) && props.columnFr.length === cols && props.columnFr.every(Boolean)
                                    ? props.columnFr.join(' ')
                                    : slots.map((_: any, i: number) => widthToFr(colWidths[i])).join(' '),
                            gap: 8,
                        }}
                    >
                        {slots.map((slotComps: any[], i: number) => (
                            <div
                                key={i}
                                style={{ minHeight: 48, borderRadius: 4 }}
                                className="border border-dashed border-teal-300 bg-catalogue-bg-elevated overflow-hidden"
                            >
                                {slotComps.length === 0 ? (
                                    <div className="flex h-12 items-center justify-center text-[10px] text-gray-300">
                                        Slot {i + 1} — empty
                                    </div>
                                ) : _depth >= maxDepth ? (
                                    <div className="flex h-12 items-center justify-center text-[10px] text-teal-400">
                                        {slotComps.length} component{slotComps.length !== 1 ? 's' : ''}
                                    </div>
                                ) : (
                                    slotComps.map((child: any) => (
                                        <div key={child.id} className="scale-[0.85] origin-top">
                                            {renderComponentPreview(child, _depth + 1)}
                                        </div>
                                    ))
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            );
        }
        case 'productCourseGrid': {
            const cols = props.columns || 3;
            return (
                <div className="bg-neutral-50 px-8 py-6">
                    {props.showFilters !== false && (
                        <div className="mb-4 flex flex-wrap gap-2">
                            {['Category', 'Level', 'Price'].map((f) => (
                                <span key={f} className="rounded-full border border-neutral-200 bg-catalogue-bg-elevated px-3 py-1 text-xs text-neutral-600">{f}</span>
                            ))}
                        </div>
                    )}
                    <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}>
                        {Array.from({ length: cols }).map((_, i) => (
                            <div key={i} className="overflow-hidden rounded-xl border border-neutral-200 bg-catalogue-bg-elevated">
                                <div className="flex h-28 items-center justify-center bg-neutral-100 text-neutral-300 text-xs">
                                    Course Image
                                </div>
                                <div className="space-y-2 p-3">
                                    <div className="h-3 w-3/4 rounded bg-neutral-200" />
                                    <div className="h-2.5 w-1/2 rounded bg-neutral-100" />
                                    {props.showPrice !== false && <div className="mt-1 h-3 w-1/3 rounded bg-neutral-200" />}
                                </div>
                            </div>
                        ))}
                    </div>
                    <p className="mt-3 text-center text-[10px] text-neutral-400">Course grid · content loads at runtime</p>
                </div>
            );
        }
        case 'productPageOffer':
            return <ProductPageOfferPreview props={props} />;
        case 'detailBlocks':
            return <DetailBlocksPreview props={props} />;
        case 'leadForm':
            return <LeadFormPreview props={props} />;
        case 'htmlBlock': {
            if (!props.html) {
                return (
                    <div className="bg-gray-900 px-4 py-3">
                        <div className="mb-1 font-mono text-[10px] text-green-400">{'</>'} HTML Block</div>
                        <span className="font-mono text-[10px] text-catalogue-text-secondary">Empty HTML block</span>
                    </div>
                );
            }
            return <HtmlBlockLivePreview props={props} />;
        }
        case 'marquee':
            return <MarqueePreview props={props} />;
        default:
            return (
                <div className="flex items-center justify-center bg-catalogue-bg-subtle py-8 text-sm text-catalogue-text-muted">
                    Unknown component: {type}
                </div>
            );
    }
};
