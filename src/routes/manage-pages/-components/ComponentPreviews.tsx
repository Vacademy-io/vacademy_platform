/**
 * Lightweight admin-canvas preview components.
 * These render the component's actual props visually, with NO data fetching
 * and NO interactive side-effects. They are used inside the CanvasRenderer.
 */
import React from 'react';

interface P { props: any }

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

const HeaderPreview: React.FC<P> = ({ props }) => (
    <header className="flex items-center justify-between border-b bg-white px-6 py-3">
        <div className="flex items-center gap-3">
            {props.logo && (
                <img src={props.logo} alt="logo" className="h-8 w-auto object-contain" />
            )}
            <span className="font-semibold text-gray-900">{props.title || ''}</span>
        </div>
        <nav className="flex items-center gap-4">
            {(props.navigation || []).slice(0, 5).map((nav: any, i: number) => (
                <span key={i} className="text-sm text-gray-600">{nav.label}</span>
            ))}
            {(props.authLinks || []).slice(0, 2).map((link: any, i: number) => (
                <span key={i} className="rounded-md bg-blue-600 px-3 py-1 text-xs font-medium text-white">
                    {link.label}
                </span>
            ))}
        </nav>
    </header>
);

const HeroSectionPreview: React.FC<P> = ({ props }) => {
    const isSplit = props.layout !== 'centered';
    return (
        <section
            className={`w-full py-10 px-8 ${isSplit ? '' : 'text-center'}`}
            style={{ backgroundColor: props.backgroundColor || '#F8FAFC' }}
        >
            <div className={`mx-auto max-w-6xl ${isSplit ? 'grid grid-cols-2 gap-8 items-center' : 'flex flex-col items-center gap-4'}`}>
                <div className="space-y-3">
                    <h1 className="text-3xl font-bold text-gray-900">
                        {props.left?.title || 'Hero Title'}
                    </h1>
                    {props.left?.description && (
                        <div
                            className="text-gray-600"
                            dangerouslySetInnerHTML={{ __html: props.left.description }}
                        />
                    )}
                    {props.left?.button?.enabled && (
                        <span className="inline-block rounded-md bg-blue-600 px-5 py-2 text-sm font-medium text-white">
                            {props.left.button.text}
                        </span>
                    )}
                </div>
                {isSplit && (
                    <div className="flex h-48 items-center justify-center overflow-hidden rounded-lg bg-gray-100">
                        {props.right?.image ? (
                            <img
                                src={props.right.image}
                                alt={props.right.alt || ''}
                                className="h-full w-full object-cover"
                            />
                        ) : (
                            <span className="text-sm text-gray-400">Image area</span>
                        )}
                    </div>
                )}
            </div>
        </section>
    );
};

const FooterPreview: React.FC<P> = ({ props }) => {
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
        <footer className="border-t bg-gray-50 px-8 py-8">
            <div className={`mx-auto max-w-6xl grid ${gridClass} gap-8`}>
                <div>
                    <h3 className="mb-2 text-sm font-semibold text-gray-900">
                        {props.leftSection?.title || 'Platform'}
                    </h3>
                    <div
                        className="text-sm text-gray-600"
                        dangerouslySetInnerHTML={{ __html: props.leftSection?.text || '' }}
                    />
                </div>
                {rightCols.map((section: any, i: number) => (
                    <div key={i}>
                        <h3 className="mb-2 text-sm font-semibold text-gray-900">{section.title}</h3>
                        {(section.links || []).slice(0, 5).map((l: any, j: number) => (
                            <p key={j} className="text-xs text-gray-500">{l.label}</p>
                        ))}
                    </div>
                ))}
            </div>
            <div className="mt-6 border-t pt-4 text-center text-xs text-gray-400">
                {props.bottomNote || '© 2025'}
            </div>
        </footer>
    );
};

// ─── Stats / Social Proof ────────────────────────────────────────────────────

const StatsPreview: React.FC<P> = ({ props }) => {
    // Support both formats: flat stats[] and grouped groups[].stats[]
    const useGroups = props.groups && props.groups.length > 0;
    const displayStats: any[] = useGroups
        ? props.groups.flatMap((g: any) => g.stats || [])
        : (props.stats || []);

    return (
        <section
            className="py-12 px-8"
            style={{ backgroundColor: props.styles?.backgroundColor || '#fff' }}
        >
            {props.headerText && (
                <h2 className="mb-6 text-center text-2xl font-bold text-gray-900">{props.headerText}</h2>
            )}
            {props.description && (
                <p className="mb-6 text-center text-sm text-gray-500">{props.description}</p>
            )}
            {useGroups ? (
                // Groups format — render each group
                <div className="mx-auto max-w-4xl space-y-4">
                    {(props.groups || []).map((group: any, gi: number) => (
                        <div key={gi} className="rounded-lg border border-gray-200 bg-white p-4">
                            {group.description && (
                                <p className="mb-3 text-center text-xs font-semibold text-blue-600">{group.description}</p>
                            )}
                            <div className="flex flex-wrap justify-center gap-6">
                                {(group.stats || []).slice(0, 5).map((s: any, i: number) => (
                                    <div key={i} className="text-center">
                                        <div className="text-2xl font-bold text-blue-600">{s.value}</div>
                                        <div className="mt-0.5 text-xs text-gray-500">{s.label}</div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                // Flat stats format
                <div className="mx-auto flex max-w-4xl flex-wrap justify-center gap-10">
                    {displayStats.length > 0 ? displayStats.slice(0, 6).map((s: any, i: number) => (
                        <div key={i} className="text-center">
                            <div className="text-3xl font-bold text-blue-600">{s.value}</div>
                            <div className="mt-1 text-sm text-gray-500">{s.label}</div>
                        </div>
                    )) : (
                        <p className="text-sm text-gray-400">No stats added yet</p>
                    )}
                </div>
            )}
        </section>
    );
};

const TestimonialPreview: React.FC<P> = ({ props }) => (
    <section
        className="py-12 px-8"
        style={{ backgroundColor: props.styles?.backgroundColor || '#F9FAFB' }}
    >
        {props.headerText && (
            <h2 className="mb-6 text-center text-2xl font-bold text-gray-900">{props.headerText}</h2>
        )}
        <div className="mx-auto grid max-w-4xl grid-cols-2 gap-4">
            {(props.testimonials || []).length > 0 ? (
                (props.testimonials || []).slice(0, 2).map((t: any, i: number) => (
                    <div key={i} className="rounded-xl bg-white p-5 shadow-sm">
                        <p className="line-clamp-3 text-sm italic text-gray-600">
                            &ldquo;{t.feedback || t.text || t.quote || 'Testimonial text…'}&rdquo;
                        </p>
                        <p className="mt-3 text-xs font-semibold text-gray-900">{t.name || 'Student'}</p>
                        {t.role && <p className="text-[11px] text-gray-400">{t.role}</p>}
                    </div>
                ))
            ) : (
                <div className="col-span-2 rounded-xl border-2 border-dashed border-gray-200 py-10 text-center text-sm text-gray-400">
                    Add testimonials in the properties panel
                </div>
            )}
        </div>
    </section>
);

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
                <h2 className="mb-2 text-center text-2xl font-bold text-gray-900">{props.headerText}</h2>
            )}
            {props.description && (
                <p className="mb-6 text-center text-sm text-gray-500">{props.description}</p>
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
                                        <span className="text-xs text-gray-400">Slide {i + 1}</span>
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
                            <div className="flex flex-1 items-center justify-center rounded-xl bg-gray-100 text-xs text-gray-400">
                                +{slides.length - 3} more
                            </div>
                        )}
                    </div>
                    <p className="mt-2 text-center text-xs text-gray-400">
                        {slides.length} slide{slides.length !== 1 ? 's' : ''} · slider layout
                    </p>
                </div>
            ) : hasContent ? (
                // Media carousel format
                <div className="mx-auto flex max-w-4xl gap-4">
                    {media.slice(0, 3).map((m: any, i: number) => (
                        <div key={i} className="flex-1 overflow-hidden rounded-xl bg-white shadow-sm">
                            {m.thumbnail ? (
                                <img src={m.thumbnail} alt="" className="h-24 w-full object-cover" />
                            ) : m.type === 'video' ? (
                                <div className="flex h-24 w-full items-center justify-center bg-gray-800 text-white/60">
                                    <span className="text-2xl">▶</span>
                                </div>
                            ) : (
                                <div className="flex h-24 w-full items-center justify-center bg-gray-100 text-gray-300 text-2xl">🖼</div>
                            )}
                            <div className="p-2 text-center">
                                <p className="text-xs font-medium text-gray-700 truncate">{m.caption || m.title || 'Media item'}</p>
                                <p className="text-[10px] capitalize text-gray-400">{m.type || 'image'}</p>
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                <div className="mx-auto max-w-4xl rounded-xl border-2 border-dashed border-gray-200 py-10 text-center text-sm text-gray-400">
                    Add slides or media items in the properties panel
                </div>
            )}
        </section>
    );
};

// ─── New component types ──────────────────────────────────────────────────────

const FaqPreview: React.FC<P> = ({ props }) => (
    <section className="py-12 px-8" style={{ backgroundColor: props.backgroundColor || '#F9FAFB' }}>
        {props.headerText && (
            <h2 className="mb-2 text-center text-2xl font-bold text-gray-900">{props.headerText}</h2>
        )}
        {props.subheading && (
            <p className="mb-6 text-center text-sm text-gray-500">{props.subheading}</p>
        )}
        <div className="mx-auto max-w-3xl space-y-2">
            {(props.faqs || []).slice(0, 4).map((faq: any, i: number) => (
                <div key={i} className="flex items-center justify-between rounded-lg border border-gray-200 bg-white px-5 py-3">
                    <span className="text-sm font-medium text-gray-900">{faq.question}</span>
                    <span className="text-gray-400">+</span>
                </div>
            ))}
        </div>
    </section>
);

const VideoPreview: React.FC<P> = ({ props }) => (
    <section className="py-10 px-8">
        {props.title && (
            <h2 className="mb-4 text-center text-2xl font-bold text-gray-900">{props.title}</h2>
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
                <p className="mt-2 text-center text-sm text-gray-500">{props.caption}</p>
            )}
        </div>
    </section>
);

const CtaBannerPreview: React.FC<P> = ({ props }) => (
    <section
        className="py-14 px-8 text-center"
        style={{ backgroundColor: props.backgroundColor || '#3B82F6' }}
    >
        <h2 className="text-2xl font-bold" style={{ color: props.textColor || '#fff' }}>
            {props.heading || 'Call to Action'}
        </h2>
        {props.subheading && (
            <p className="mt-2 text-base opacity-90" style={{ color: props.textColor || '#fff' }}>
                {props.subheading}
            </p>
        )}
        {props.button?.enabled && (
            <span
                className="mt-5 inline-block rounded-lg bg-white px-7 py-2.5 text-sm font-semibold shadow"
                style={{ color: props.backgroundColor || '#3B82F6' }}
            >
                {props.button.text}
            </span>
        )}
    </section>
);

const PricingPreview: React.FC<P> = ({ props }) => (
    <section className="bg-white py-12 px-8">
        {props.headerText && (
            <h2 className="mb-2 text-center text-2xl font-bold text-gray-900">{props.headerText}</h2>
        )}
        {props.subheading && (
            <p className="mb-8 text-center text-sm text-gray-500">{props.subheading}</p>
        )}
        <div className="mx-auto flex max-w-3xl flex-wrap justify-center gap-4">
            {(props.plans || []).slice(0, 3).map((plan: any, i: number) => (
                <div
                    key={i}
                    className={`min-w-[160px] flex-1 rounded-xl border-2 p-5 ${plan.highlighted ? 'border-blue-500 shadow-lg' : 'border-gray-200'}`}
                >
                    <h3 className="font-bold text-gray-900">{plan.name}</h3>
                    <div className="my-2 text-2xl font-bold text-gray-900">{plan.price}</div>
                    <ul className="space-y-1">
                        {(plan.features || []).slice(0, 3).map((f: string, j: number) => (
                            <li key={j} className="flex items-center gap-1 text-xs text-gray-600">
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
            <h2 className="mb-2 text-center text-2xl font-bold text-gray-900">{props.heading}</h2>
        )}
        {props.subheading && (
            <p className="mb-6 text-center text-sm text-gray-500">{props.subheading}</p>
        )}
        <div className="mx-auto max-w-lg rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            <div className="space-y-3">
                {(props.fields || []).slice(0, 4).map((field: any, i: number) => (
                    <div key={i}>
                        <div className="mb-1 text-xs font-medium text-gray-600">
                            {field.label}{field.required && <span className="ml-0.5 text-red-500">*</span>}
                        </div>
                        <div className={`rounded border border-gray-200 bg-gray-50 ${field.type === 'textarea' ? 'h-16' : 'h-8'}`} />
                    </div>
                ))}
                <div className="mt-2 h-9 rounded bg-blue-500" />
            </div>
        </div>
    </section>
);

const TeamPreview: React.FC<P> = ({ props }) => (
    <section className="bg-white py-12 px-8">
        {props.headerText && (
            <h2 className="mb-2 text-center text-2xl font-bold text-gray-900">{props.headerText}</h2>
        )}
        {props.subheading && (
            <p className="mb-8 text-center text-sm text-gray-500">{props.subheading}</p>
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
                    <p className="text-sm font-semibold text-gray-900">{m.name}</p>
                    <p className="text-xs text-blue-600">{m.role}</p>
                </div>
            ))}
        </div>
    </section>
);

const AnnouncementPreview: React.FC<P> = ({ props }) => (
    <section className="py-10 px-8" style={{ backgroundColor: props.backgroundColor || '#fff' }}>
        {props.headerText && (
            <h2 className="mb-6 text-center text-2xl font-bold text-gray-900">{props.headerText}</h2>
        )}
        <div className="mx-auto max-w-3xl space-y-3">
            {(props.announcements || []).slice(0, 3).map((a: any, i: number) => (
                <div key={i} className="rounded-xl border border-gray-200 bg-white px-5 py-4">
                    <div className="mb-1 flex items-center gap-2">
                        {a.tag && (
                            <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">
                                {a.tag}
                            </span>
                        )}
                        {a.date && <span className="text-xs text-gray-400">{a.date}</span>}
                    </div>
                    <p className="text-sm font-semibold text-gray-900">{a.title}</p>
                </div>
            ))}
        </div>
    </section>
);

const GalleryPreview: React.FC<P> = ({ props }) => (
    <section className="bg-white py-10 px-8">
        {props.headerText && (
            <h2 className="mb-6 text-center text-2xl font-bold text-gray-900">{props.headerText}</h2>
        )}
        <div className="mx-auto grid max-w-4xl grid-cols-3 gap-3">
            {(props.images || []).slice(0, 6).map((img: any, i: number) => (
                <div key={i} className="overflow-hidden rounded-lg" style={{ aspectRatio: '4/3' }}>
                    {img.src ? (
                        <img src={img.src} alt={img.alt || ''} className="h-full w-full object-cover" />
                    ) : (
                        <div className="flex h-full w-full items-center justify-center bg-gray-100 text-xs text-gray-300">
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
    <div className="flex items-center justify-center border border-dashed border-gray-200 bg-gray-50 px-6 py-10">
        <div className="text-center">
            <div className="mb-1 text-sm font-semibold text-gray-500">{label}</div>
            <div className="text-xs text-gray-400">
                {description || 'Renders live data on the published page'}
            </div>
        </div>
    </div>
);

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
                    <h2 className="mb-5 text-2xl font-bold text-gray-900">
                        {props.heading || 'Choose Your Path'}
                    </h2>
                    <div className="flex justify-center gap-4">
                        <span className="rounded-lg border px-7 py-3 font-medium text-gray-700">
                            {props.buy?.buttonLabel || 'Buy'}
                        </span>
                        <span className="rounded-lg border px-7 py-3 font-medium text-gray-700">
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
                            gridTemplateColumns: slots.map((_: any, i: number) => widthToFr(colWidths[i])).join(' '),
                            gap: 8,
                        }}
                    >
                        {slots.map((slotComps: any[], i: number) => (
                            <div
                                key={i}
                                style={{ minHeight: 48, borderRadius: 4 }}
                                className="border border-dashed border-teal-300 bg-white overflow-hidden"
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
        default:
            return (
                <div className="flex items-center justify-center bg-gray-50 py-8 text-sm text-gray-400">
                    Unknown component: {type}
                </div>
            );
    }
};
