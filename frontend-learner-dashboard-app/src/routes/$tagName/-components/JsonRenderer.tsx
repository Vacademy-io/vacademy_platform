import React, { useEffect, useRef, useState } from "react";
import { Page, GlobalSettings, CourseCatalogueData } from "../-types/course-catalogue-types";
import { buildComponentStyle, buildResponsiveCSS, getHoverClass, type ComponentStyle } from "../-utils/style-utils";
import { CatalogueLink } from "./CatalogueLink";
import { HeaderComponent } from "./components/HeaderComponent";
import { BannerComponent } from "./components/BannerComponent";
import { CourseCatalogComponent } from "./components/CourseCatalogComponent";
// Removed CourseRecommendationsComponent import as it's not used
// Removed CourseDetailsComponent import as it's not used
import { FooterComponent } from "./components/FooterComponent";
import { HeroSectionComponent } from "./components/HeroSectionComponent";
import { MediaShowcaseComponent } from "./components/MediaShowcaseComponent";
import { StatsHighlightsComponent } from "./components/StatsHighlightsComponent";
import { TestimonialSectionComponent } from "./components/TestimonialSectionComponent";
import { CartComponent } from "./components/CartComponent";
import { BuyRentSectionComponent } from "./components/BuyRentSectionComponent";
import { BookCatalogueComponent } from "./components/BookCatalogueComponent";
import { BookDetailsComponent } from "./components/BookDetailsComponent";
import { Policy } from "./components/Policy";

interface JsonRendererProps {
  page: Page;
  globalSettings: GlobalSettings;
  instituteId: string;
  tagName: string;
  courseData?: any; // Course data for dynamic content
  catalogueData?: CourseCatalogueData; // Full catalogue data for route matching
  isPreviewMode?: boolean; // When true, shows component selection UI for admin editor
  selectedComponentId?: string | null; // Currently selected component to highlight
  onComponentClick?: (componentId: string, pageId: string) => void; // Callback for component click in preview mode
}

export const JsonRenderer: React.FC<JsonRendererProps> = ({
  page,
  globalSettings,
  instituteId,
  tagName,
  courseData,
  catalogueData,
  isPreviewMode = false,
  selectedComponentId = null,
  onComponentClick,
}) => {
  const renderComponent = (component: any) => {
    const { type, props, id, enabled = true, showCondition } = component;

    // Check if component is enabled
    if (!enabled) {
      return null;
    }

    // Check conditional rendering based on showCondition
    if (showCondition) {
      const { field, value } = showCondition;
      // Support nested field paths like "globalSettings.courseCatalogeType.enabled"
      // If field starts with "globalSettings.", remove it since we already have globalSettings
      const fieldPath = field.startsWith('globalSettings.') ? field.substring('globalSettings.'.length) : field;
      const fieldParts = fieldPath.split('.');
      let currentValue: any = globalSettings;

      for (const part of fieldParts) {
        if (currentValue && typeof currentValue === 'object' && part in currentValue) {
          currentValue = currentValue[part];
        } else {
          currentValue = undefined;
          break;
        }
      }

      // Normalize boolean values for comparison (handle both boolean true and string "true")
      const normalizedCurrentValue = typeof currentValue === 'boolean' ? currentValue : currentValue;
      const normalizedExpectedValue = typeof value === 'boolean' ? value : (value === 'true' || value === true);


      // Check if condition matches
      if (normalizedCurrentValue !== normalizedExpectedValue) {
        console.log(`[JsonRenderer] Component ${id} HIDDEN - condition not met`);
        return null;
      }

      console.log(`[JsonRenderer] Component ${id} SHOWN - condition met`);
    }

    switch (type) {
      case "header":
        return (
          <HeaderComponent
            key={id}
            {...props}
            navigation={props.navigation}
            authLinks={props.authLinks}
            catalogueData={catalogueData}
            tagName={tagName}
          />
        );
      case "banner":
        return <BannerComponent key={id} {...props} />;
      case "courseCatalog":
        return (
          <CourseCatalogComponent
            key={id}
            {...props}
            instituteId={instituteId}
            globalSettings={globalSettings}
            tagName={tagName}
          />
        );
      case "bookCatalogue":
        return (
          <BookCatalogueComponent
            key={id}
            {...props}
            instituteId={instituteId}
            globalSettings={globalSettings}
            tagName={tagName}
          />
        );
      case "courseDetails":
        // Skip course details component - it shows hardcoded data after footer
        return null;
      case "bookDetails":
        return (
          <BookDetailsComponent
            key={id}
            {...props}
            courseData={courseData}
          />
        );
      case "courseRecommendations":
        // Skip course recommendations component - user doesn't want "you may also like" section
        return null;
      case "footer":
        return (
          <FooterComponent
            key={id}
            {...props}
            catalogueData={catalogueData}
            tagName={tagName}
          />
        );
      case "heroSection":
        return <HeroSectionComponent key={id} {...props} courseData={courseData} />;
      case "mediaShowcase":
      case "MediaShowcaseComponent":
        console.log(`[JsonRenderer] Rendering MediaShowcaseComponent ${id}:`, {
          layout: props?.layout,
          slidesLength: props?.slides?.length,
          autoplay: props?.autoplay,
          autoplayInterval: props?.autoplayInterval,
          hasSlides: !!props?.slides
        });
        return <MediaShowcaseComponent key={id} {...props} />;
      case "statsHighlights":
        return <StatsHighlightsComponent key={id} {...props} />;
      case "testimonialSection":
        return <TestimonialSectionComponent key={id} {...props} />;
      case "cartComponent":
        return <CartComponent key={id} {...props} instituteId={instituteId} />;
      case "buyRentSection":
        return <BuyRentSectionComponent key={id} {...props} tagName={tagName} />;
      case "policyRenderer":
        return <Policy key={id} {...props} />;

      case "faqSection":
        return <FaqSectionRenderer key={id} {...props} />;
      case "videoEmbed":
        return <VideoEmbedRenderer key={id} {...props} />;
      case "ctaBanner":
        return <CtaBannerRenderer key={id} {...props} />;
      case "pricingTable":
        return <PricingTableRenderer key={id} {...props} />;
      case "contactForm":
        return <ContactFormRenderer key={id} {...props} />;
      case "teamSection":
        return <TeamSectionRenderer key={id} {...props} />;
      case "announcementFeed":
        return <AnnouncementFeedRenderer key={id} {...props} />;
      case "imageGallery":
        return <ImageGalleryRenderer key={id} {...props} />;

      case "spacer":
        return <SpacerRenderer key={id} {...props} />;
      case "tabsAccordion":
        return <TabsAccordionRenderer key={id} {...props} />;
      case "logoCloud":
        return <LogoCloudRenderer key={id} {...props} />;
      case "mapEmbed":
        return <MapEmbedRenderer key={id} {...props} />;
      case "countdownTimer":
        return <CountdownTimerRenderer key={id} {...props} />;
      case "textBlock":
        return <TextBlockRenderer key={id} {...props} />;
      case "featureGrid":
        return <FeatureGridRenderer key={id} {...props} />;
      case "imageBlock":
        return <ImageBlockRenderer key={id} {...props} />;
      case "buttonBlock":
        return <ButtonBlockRenderer key={id} {...props} />;
      case "newsletterSignup":
        return <NewsletterSignupRenderer key={id} {...props} />;
      case "stepsProcess":
        return <StepsProcessRenderer key={id} {...props} />;

      case "columnLayout": {
        const {
          slots = [] as any[][],
          columnWidths = [] as string[],
          gap = 'md',
          align = 'top',
          stackOnMobile = true,
        } = props;
        const gapMap: Record<string, string> = { none: '0', sm: '0.5rem', md: '1rem', lg: '2rem' };
        const alignMap: Record<string, string> = { top: 'start', center: 'center', bottom: 'end', stretch: 'stretch' };
        const widthToFr = (w?: string) => {
          const map: Record<string, string> = { '1/2': '1fr', '1/3': '1fr', '2/3': '2fr', '1/4': '1fr', '3/4': '3fr' };
          return map[w ?? ''] || '1fr';
        };
        const gridCols = slots.map((_: any, i: number) => widthToFr(columnWidths[i])).join(' ');
        // Use a CSS custom property so the @media rule in index.css can override it
        // on mobile (inline styles can't be overridden by regular rules, but CSS
        // custom properties cascade normally and can be overridden with !important).
        return (
          <div
            key={id}
            className={stackOnMobile ? 'grid-layout-responsive' : ''}
            style={{
              '--catalogue-grid-cols': gridCols,
              display: 'grid',
              gridTemplateColumns: 'var(--catalogue-grid-cols)',
              gap: gapMap[gap] || '1rem',
              alignItems: alignMap[align] || 'start',
            } as React.CSSProperties}
          >
            {slots.map((slotComponents: any[], slotIndex: number) => (
              <div key={slotIndex} className="min-w-0">
                {slotComponents.map((child: any) => renderComponent(child))}
              </div>
            ))}
          </div>
        );
      }

      default:
        console.warn(`Unknown component type: ${type}`);
        return null;
    }
  };

  // Check if page has a header component to add appropriate top padding
  const hasHeader = page.components.some(
    (component) => component.type === 'header' && component.enabled !== false
  );

  return (
    <div
      className={`page w-full ${hasHeader ? 'pt-16 md:pt-20' : ''}`}
      data-page-id={page.id}
    >
      {page.components.map((component) => {
        const rendered = renderComponent(component);
        if (!rendered) return null;

        const componentStyle = buildComponentStyle(component.style);
        const responsiveCSS = buildResponsiveCSS(component.id, component.style);
        const hoverClass = getHoverClass(component.style);
        const hasOverlay = component.style?.backgroundImage && component.style?.backgroundOverlay;
        const hasStyle = component.style && Object.keys(component.style).length > 0;

        if (isPreviewMode) {
          const isSelected = component.id === selectedComponentId;
          return (
            <div
              key={component.id}
              id={component.anchorId || undefined}
              data-component-id={component.id}
              data-cid={component.id}
              onClick={() => onComponentClick?.(component.id, page.id)}
              className={`relative ${component.style?.customClass || ''} ${hoverClass} ${isSelected ? 'outline outline-2 outline-blue-500 outline-offset-[-2px]' : 'hover:outline hover:outline-1 hover:outline-blue-300 hover:outline-offset-[-1px]'}`}
              style={{ cursor: 'pointer', ...componentStyle }}
            >
              {responsiveCSS && <style dangerouslySetInnerHTML={{ __html: responsiveCSS }} />}
              {hasOverlay && (
                <div style={{ position: 'absolute', inset: 0, backgroundColor: component.style!.backgroundOverlay, zIndex: 0, borderRadius: componentStyle.borderRadius }} />
              )}
              <div style={{ pointerEvents: 'none', position: hasOverlay ? 'relative' : undefined, zIndex: hasOverlay ? 1 : undefined }}>
                {rendered}
              </div>
              {isSelected && (
                <div className="absolute top-0 left-0 z-50 bg-blue-500 text-white text-xs px-2 py-0.5 rounded-br-md font-medium select-none">
                  {component.type}
                </div>
              )}
            </div>
          );
        }

        // Normal (non-preview) rendering with style wrapper
        if (hasStyle) {
          return (
            <ComponentStyleWrapper key={component.id} component={component} componentStyle={componentStyle} responsiveCSS={responsiveCSS} hoverClass={hoverClass}>
              {rendered}
            </ComponentStyleWrapper>
          );
        }

        // Plain rendering — still add anchor ID if present
        if (component.anchorId) {
          return <div key={component.id} id={component.anchorId}>{rendered}</div>;
        }
        return <React.Fragment key={component.id}>{rendered}</React.Fragment>;
      })}
    </div>
  );
};

/* ─── Inline renderers for new component types ───────────────────────────── */

const FaqSectionRenderer: React.FC<any> = ({ headerText, subheading, faqs = [], backgroundColor = '#F9FAFB' }) => {
  const [openIndex, setOpenIndex] = React.useState<number | null>(null);
  return (
    <section style={{ backgroundColor }} className="py-16 px-4">
      <div className="mx-auto max-w-3xl">
        {headerText && <h2 className="mb-2 text-center text-3xl font-bold text-gray-900">{headerText}</h2>}
        {subheading && <p className="mb-10 text-center text-gray-500">{subheading}</p>}
        <div className="space-y-3">
          {faqs.map((faq: any, i: number) => (
            <div key={i} className="rounded-lg border border-gray-200 bg-white overflow-hidden">
              <button
                onClick={() => setOpenIndex(openIndex === i ? null : i)}
                className="flex w-full items-center justify-between px-6 py-4 text-left font-medium text-gray-900 hover:bg-gray-50"
              >
                <span>{faq.question}</span>
                <span className="ml-4 text-gray-400 text-xl">{openIndex === i ? '−' : '+'}</span>
              </button>
              {openIndex === i && (
                <div className="border-t border-gray-100 px-6 py-4 text-gray-600 leading-relaxed">
                  {faq.answer}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

const VideoEmbedRenderer: React.FC<any> = ({ url = '', title, caption, aspectRatio = '16:9', autoplay = false }) => {
  const getEmbedUrl = (rawUrl: string) => {
    if (!rawUrl) return '';
    const ytMatch = rawUrl.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/))([A-Za-z0-9_-]{11})/);
    if (ytMatch) return `https://www.youtube.com/embed/${ytMatch[1]}${autoplay ? '?autoplay=1' : ''}`;
    const vimeoMatch = rawUrl.match(/vimeo\.com\/(\d+)/);
    if (vimeoMatch) return `https://player.vimeo.com/video/${vimeoMatch[1]}${autoplay ? '?autoplay=1' : ''}`;
    return rawUrl;
  };
  const padMap: Record<string, string> = { '16:9': '56.25%', '4:3': '75%', '1:1': '100%', '9:16': '177.78%' };
  const embedUrl = getEmbedUrl(url);
  return (
    <section className="py-12 px-4">
      <div className="mx-auto max-w-4xl">
        {title && <h2 className="mb-6 text-center text-2xl font-bold text-gray-900">{title}</h2>}
        {embedUrl ? (
          <div className="relative w-full overflow-hidden rounded-xl shadow-lg" style={{ paddingBottom: padMap[aspectRatio] || '56.25%' }}>
            <iframe src={embedUrl} className="absolute inset-0 size-full" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen title={title || 'Video'} />
          </div>
        ) : (
          <div className="flex items-center justify-center rounded-xl bg-gray-100 text-gray-400" style={{ aspectRatio: aspectRatio.replace(':', '/') }}>
            No video URL configured
          </div>
        )}
        {caption && <p className="mt-3 text-center text-sm text-gray-500">{caption}</p>}
      </div>
    </section>
  );
};

const CtaBannerRenderer: React.FC<any> = ({ heading, subheading, backgroundColor = '#3B82F6', textColor = '#FFFFFF', layout = 'centered', button }) => {
  const isSplit = layout === 'split';
  return (
    <section style={{ backgroundColor }} className="py-14 px-4">
      <div className={`mx-auto max-w-5xl flex ${isSplit ? 'items-center justify-between gap-8 flex-wrap' : 'flex-col items-center text-center'}`}>
        <div className={isSplit ? 'flex-1' : ''}>
          {heading && <h2 style={{ color: textColor }} className="text-3xl font-bold">{heading}</h2>}
          {subheading && <p style={{ color: textColor, opacity: 0.85 }} className="mt-2 text-lg">{subheading}</p>}
        </div>
        {button?.enabled && (
          <CatalogueLink to={button.target || '#'} className="mt-4 inline-block rounded-lg bg-white px-8 py-3 font-semibold shadow-md transition hover:opacity-90" style={{ color: backgroundColor }}>
            {button.text}
          </CatalogueLink>
        )}
      </div>
    </section>
  );
};

const PricingTableRenderer: React.FC<any> = ({ headerText, subheading, plans = [] }) => (
  <section className="py-16 px-4 bg-white">
    <div className="mx-auto max-w-5xl">
      {headerText && <h2 className="mb-2 text-center text-3xl font-bold text-gray-900">{headerText}</h2>}
      {subheading && <p className="mb-12 text-center text-gray-500">{subheading}</p>}
      <div className={`grid gap-6 ${plans.length === 2 ? 'md:grid-cols-2' : 'md:grid-cols-3'}`}>
        {plans.map((plan: any, i: number) => (
          <div key={i} className={`relative flex flex-col rounded-2xl border-2 p-8 ${plan.highlighted ? 'border-primary-500 shadow-xl' : 'border-gray-200'}`}>
            {plan.highlighted && <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full px-4 py-1 text-xs font-semibold text-white" style={{ backgroundColor: 'var(--primary-500, #3B82F6)' }}>Recommended</div>}
            <h3 className="text-xl font-bold text-gray-900">{plan.name}</h3>
            {plan.description && <p className="mt-1 text-sm text-gray-500">{plan.description}</p>}
            <div className="mt-4 flex items-baseline gap-1">
              <span className="text-4xl font-bold text-gray-900">{plan.price}</span>
              {plan.period && <span className="text-gray-500">{plan.period}</span>}
            </div>
            <ul className="mt-6 flex-1 space-y-3">
              {(plan.features || []).map((f: string, j: number) => (
                <li key={j} className="flex items-center gap-2 text-sm text-gray-700">
                  <span className="text-green-500">✓</span>{f}
                </li>
              ))}
            </ul>
            {plan.buttonText && (
              <CatalogueLink to={plan.buttonTarget || '#'} className={`mt-8 block rounded-lg py-3 text-center font-semibold transition ${plan.highlighted ? 'text-white hover:opacity-90' : 'border border-gray-300 text-gray-900 hover:bg-gray-50'}`} style={plan.highlighted ? { backgroundColor: 'var(--primary-500, #3B82F6)' } : undefined}>
                {plan.buttonText}
              </CatalogueLink>
            )}
          </div>
        ))}
      </div>
    </div>
  </section>
);

const ContactFormRenderer: React.FC<any> = ({ heading, subheading, fields = [], submitLabel = 'Send Message', successMessage, backgroundColor = '#FFFFFF' }) => {
  const [submitted, setSubmitted] = React.useState(false);
  const [formData, setFormData] = React.useState<Record<string, string>>({});
  const handleSubmit = (e: React.FormEvent) => { e.preventDefault(); setSubmitted(true); };
  return (
    <section style={{ backgroundColor }} className="py-16 px-4">
      <div className="mx-auto max-w-2xl">
        {heading && <h2 className="mb-2 text-center text-3xl font-bold text-gray-900">{heading}</h2>}
        {subheading && <p className="mb-10 text-center text-gray-500">{subheading}</p>}
        {submitted ? (
          <div className="rounded-xl border border-green-200 bg-green-50 p-8 text-center text-green-700 font-medium">
            {successMessage || 'Thank you! We\'ll be in touch soon.'}
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5 rounded-xl border border-gray-200 bg-white p-8 shadow-sm">
            {fields.map((field: any) => (
              <div key={field.name}>
                <label className="mb-1 block text-sm font-medium text-gray-700">{field.label}{field.required && <span className="ml-1 text-red-500">*</span>}</label>
                {field.type === 'textarea' ? (
                  <textarea required={field.required} rows={4} value={formData[field.name] || ''} onChange={(e) => setFormData({ ...formData, [field.name]: e.target.value })} className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:border-blue-500 focus:outline-none" />
                ) : (
                  <input type={field.type} required={field.required} value={formData[field.name] || ''} onChange={(e) => setFormData({ ...formData, [field.name]: e.target.value })} className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:border-blue-500 focus:outline-none" />
                )}
              </div>
            ))}
            <button type="submit" className="w-full rounded-lg py-3 font-semibold text-white transition hover:opacity-90" style={{ backgroundColor: 'var(--primary-500, #3B82F6)' }}>
              {submitLabel}
            </button>
          </form>
        )}
      </div>
    </section>
  );
};

const TeamSectionRenderer: React.FC<any> = ({ headerText, subheading, members = [], columns = 3 }) => (
  <section className="py-16 px-4 bg-white">
    <div className="mx-auto max-w-6xl">
      {headerText && <h2 className="mb-2 text-center text-3xl font-bold text-gray-900">{headerText}</h2>}
      {subheading && <p className="mb-12 text-center text-gray-500">{subheading}</p>}
      <div className={`grid gap-8 ${columns === 2 ? 'sm:grid-cols-2' : columns === 4 ? 'sm:grid-cols-2 lg:grid-cols-4' : 'sm:grid-cols-2 lg:grid-cols-3'}`}>
        {members.map((m: any, i: number) => (
          <div key={i} className="flex flex-col items-center text-center">
            {m.avatar ? (
              <img src={m.avatar} alt={m.name} className="mb-4 size-24 rounded-full object-cover shadow-md" />
            ) : (
              <div className="mb-4 flex size-24 items-center justify-center rounded-full bg-blue-100 text-2xl font-bold text-blue-600">
                {m.name?.[0] || '?'}
              </div>
            )}
            <h3 className="text-lg font-semibold text-gray-900">{m.name}</h3>
            <p className="text-sm font-medium text-blue-600">{m.role}</p>
            {m.bio && <p className="mt-2 text-sm text-gray-500">{m.bio}</p>}
          </div>
        ))}
      </div>
    </div>
  </section>
);

const AnnouncementFeedRenderer: React.FC<any> = ({ headerText, subheading, announcements = [], layout = 'list', showDate = true, showTag = true, backgroundColor = '#FFFFFF' }) => (
  <section style={{ backgroundColor }} className="py-16 px-4">
    <div className="mx-auto max-w-4xl">
      {headerText && <h2 className="mb-2 text-center text-3xl font-bold text-gray-900">{headerText}</h2>}
      {subheading && <p className="mb-10 text-center text-gray-500">{subheading}</p>}
      <div className={layout === 'grid' ? 'grid gap-6 sm:grid-cols-2' : 'space-y-4'}>
        {announcements.map((a: any, i: number) => (
          <div key={i} className={`rounded-xl border border-gray-200 bg-white p-6 shadow-sm ${layout === 'list' ? 'flex items-start gap-4' : ''}`}>
            <div className="flex-1">
              <div className="mb-2 flex flex-wrap items-center gap-3">
                {showTag && a.tag && <span className="rounded-full bg-blue-100 px-3 py-0.5 text-xs font-semibold text-blue-700">{a.tag}</span>}
                {showDate && a.date && <span className="text-xs text-gray-400">{new Date(a.date).toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: 'numeric' })}</span>}
              </div>
              <h3 className="text-base font-semibold text-gray-900">{a.title}</h3>
              {a.summary && <p className="mt-1 text-sm text-gray-600">{a.summary}</p>}
            </div>
          </div>
        ))}
      </div>
    </div>
  </section>
);

const ImageGalleryRenderer: React.FC<any> = ({ headerText, images = [], columns = 3, showCaptions = false }) => (
  <section className="py-12 px-4 bg-white">
    <div className="mx-auto max-w-6xl">
      {headerText && <h2 className="mb-8 text-center text-3xl font-bold text-gray-900">{headerText}</h2>}
      <div className={`grid gap-4 ${columns === 2 ? 'sm:grid-cols-2' : columns === 4 ? 'sm:grid-cols-2 lg:grid-cols-4' : 'sm:grid-cols-2 lg:grid-cols-3'}`}>
        {images.map((img: any, i: number) => (
          <div key={i} className="group overflow-hidden rounded-xl">
            {img.src ? (
              <img src={img.src} alt={img.alt || ''} className="w-full object-cover transition group-hover:scale-105" style={{ aspectRatio: '4/3' }} />
            ) : (
              <div className="flex w-full items-center justify-center rounded-xl bg-gray-100 text-gray-300" style={{ aspectRatio: '4/3' }}>No image</div>
            )}
            {showCaptions && img.caption && <p className="mt-2 text-center text-sm text-gray-500">{img.caption}</p>}
          </div>
        ))}
      </div>
    </div>
  </section>
);

/* ─── Spacer / Divider ─────────────────────────────────────────────────── */

const SpacerRenderer: React.FC<any> = ({ height = '48px', showDivider = false, dividerStyle = 'solid', dividerColor = '#E5E7EB', dividerWidth = '1px', maxWidth = '100%' }) => (
  <div style={{ height, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
    {showDivider && (
      <hr style={{ borderTop: `${dividerWidth} ${dividerStyle} ${dividerColor}`, maxWidth, width: '100%', margin: '0 auto' }} />
    )}
  </div>
);

/* ─── Tabs / Accordion ─────────────────────────────────────────────────── */

const TabsAccordionRenderer: React.FC<any> = ({ mode = 'tabs', items = [], defaultOpen = 0, allowMultiple = false, backgroundColor = '#FFFFFF' }) => {
  const [activeTab, setActiveTab] = React.useState(defaultOpen);
  const [openIndices, setOpenIndices] = React.useState<Set<number>>(new Set([defaultOpen]));

  const toggleAccordion = (i: number) => {
    setOpenIndices((prev) => {
      const next = new Set(prev);
      if (next.has(i)) {
        next.delete(i);
      } else {
        if (!allowMultiple) next.clear();
        next.add(i);
      }
      return next;
    });
  };

  if (mode === 'accordion') {
    return (
      <section style={{ backgroundColor }} className="py-12 px-4">
        <div className="mx-auto max-w-3xl space-y-2">
          {items.map((item: any, i: number) => (
            <div key={i} className="rounded-lg border border-gray-200 bg-white overflow-hidden">
              <button onClick={() => toggleAccordion(i)} className="flex w-full items-center justify-between px-5 py-4 text-left font-medium text-gray-800 hover:bg-gray-50">
                {item.title}
                <span className={`text-gray-400 transition-transform ${openIndices.has(i) ? 'rotate-180' : ''}`}>&#9662;</span>
              </button>
              {openIndices.has(i) && (
                <div className="px-5 pb-4 text-sm text-gray-600" dangerouslySetInnerHTML={{ __html: item.content || '' }} />
              )}
            </div>
          ))}
        </div>
      </section>
    );
  }

  return (
    <section style={{ backgroundColor }} className="py-12 px-4">
      <div className="mx-auto max-w-3xl">
        <div className="flex border-b border-gray-200">
          {items.map((item: any, i: number) => (
            <button key={i} onClick={() => setActiveTab(i)}
              className={`px-5 py-3 text-sm font-medium transition-colors ${i === activeTab ? 'border-b-2 border-blue-500 text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}>
              {item.title}
            </button>
          ))}
        </div>
        {items[activeTab] && (
          <div className="p-5 text-gray-600" dangerouslySetInnerHTML={{ __html: items[activeTab].content || '' }} />
        )}
      </div>
    </section>
  );
};

/* ─── Logo Cloud ───────────────────────────────────────────────────────── */

const LogoCloudRenderer: React.FC<any> = ({ headerText, subheading, logos = [], layout = 'grid', grayscale = true, columns = 5 }) => (
  <section className="py-12 px-4">
    <div className="mx-auto max-w-5xl text-center">
      {headerText && <h3 className="mb-2 text-lg font-semibold uppercase tracking-wider text-gray-400">{headerText}</h3>}
      {subheading && <p className="mb-8 text-sm text-gray-500">{subheading}</p>}
      {layout === 'marquee' ? (
        <div className="overflow-hidden">
          <div className="catalogue-marquee flex items-center gap-12">
            {[...logos, ...logos].map((logo: any, i: number) => (
              <LogoItem key={i} logo={logo} grayscale={grayscale} />
            ))}
          </div>
        </div>
      ) : (
        <div className={`grid items-center justify-items-center gap-8 grid-cols-2 sm:grid-cols-3 ${columns >= 4 ? 'md:grid-cols-4' : ''} ${columns >= 5 ? 'lg:grid-cols-5' : ''} ${columns >= 6 ? 'xl:grid-cols-6' : ''}`}>
          {logos.map((logo: any, i: number) => (
            <LogoItem key={i} logo={logo} grayscale={grayscale} />
          ))}
        </div>
      )}
    </div>
  </section>
);

const LogoItem: React.FC<{ logo: any; grayscale: boolean }> = ({ logo, grayscale }) => {
  const img = logo.image ? (
    <img src={logo.image} alt={logo.alt || ''} className={`h-10 w-auto object-contain transition ${grayscale ? 'grayscale hover:grayscale-0' : ''}`} />
  ) : null;
  if (logo.url && img) return <a href={logo.url} target="_blank" rel="noopener noreferrer">{img}</a>;
  return img;
};

/* ─── Map Embed ────────────────────────────────────────────────────────── */

const MapEmbedRenderer: React.FC<any> = ({ embedUrl, height = '400px', borderRadius = '8px', title }) => (
  <section className="py-8 px-4">
    <div className="mx-auto max-w-5xl">
      {title && <h3 className="mb-4 text-xl font-semibold text-gray-800">{title}</h3>}
      {embedUrl ? (
        <iframe
          src={embedUrl}
          width="100%"
          height={height}
          style={{ border: 0, borderRadius }}
          allowFullScreen
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
          title={title || 'Map'}
        />
      ) : (
        <div className="flex items-center justify-center rounded bg-gray-100 text-gray-400" style={{ height, borderRadius }}>
          No map URL configured
        </div>
      )}
    </div>
  </section>
);

/* ─── Countdown Timer ──────────────────────────────────────────────────── */

const CountdownTimerRenderer: React.FC<any> = ({ targetDate, heading, expiredMessage, backgroundColor = '#1E293B', textColor = '#FFFFFF', style = 'cards' }) => {
  const [timeLeft, setTimeLeft] = React.useState({ days: 0, hours: 0, minutes: 0, seconds: 0 });
  const [expired, setExpired] = React.useState(false);

  React.useEffect(() => {
    if (!targetDate || isNaN(new Date(targetDate).getTime())) return;
    const tick = () => {
      const diff = new Date(targetDate).getTime() - Date.now();
      if (diff <= 0) { setExpired(true); return; }
      setTimeLeft({
        days: Math.floor(diff / (1000 * 60 * 60 * 24)),
        hours: Math.floor((diff / (1000 * 60 * 60)) % 24),
        minutes: Math.floor((diff / (1000 * 60)) % 60),
        seconds: Math.floor((diff / 1000) % 60),
      });
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [targetDate]);

  if (expired) {
    return (
      <section style={{ backgroundColor }} className="py-12 px-4 text-center">
        <p className="text-xl font-semibold" style={{ color: textColor }}>{expiredMessage || 'The event has started!'}</p>
      </section>
    );
  }

  const units = [
    { label: 'Days', value: timeLeft.days },
    { label: 'Hours', value: timeLeft.hours },
    { label: 'Mins', value: timeLeft.minutes },
    { label: 'Secs', value: timeLeft.seconds },
  ];

  return (
    <section style={{ backgroundColor }} className="py-12 px-4 text-center">
      {heading && <h3 className="mb-8 text-xl font-bold" style={{ color: textColor }}>{heading}</h3>}
      <div className="flex justify-center gap-4">
        {units.map(({ label, value }) => (
          <div key={label} className={style === 'cards' ? 'rounded-xl bg-white/10 px-6 py-4' : 'px-4'}>
            <div className="text-4xl font-bold tabular-nums" style={{ color: textColor }}>
              {String(value).padStart(2, '0')}
            </div>
            <div className="mt-1 text-xs uppercase tracking-wider" style={{ color: `${textColor}99` }}>
              {label}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
};

/* ─── Text Block ───────────────────────────────────────────────────────── */

const TextBlockRenderer: React.FC<any> = ({ content = '', maxWidth = '800px', alignment = 'center' }) => (
  <section className="py-8 px-4 sm:px-6 lg:px-8">
    <div
      className="catalogue-rich-text max-w-none"
      style={{
        maxWidth,
        margin: alignment === 'center' ? '0 auto' : alignment === 'right' ? '0 0 0 auto' : undefined,
      }}
      dangerouslySetInnerHTML={{ __html: content }}
    />
  </section>
);

/* ─── Feature Grid ─────────────────────────────────────────────────────── */

const FeatureGridRenderer: React.FC<any> = ({
  headerText, subheading, columns = 3, features = [], style = 'cards', iconSize = 'large', backgroundColor = '#FFFFFF',
}) => {
  const sizeMap: Record<string, string> = { small: 'text-xl', medium: 'text-2xl', large: 'text-3xl' };
  const cardClass =
    style === 'cards' ? 'rounded-xl border border-gray-100 bg-white p-6 shadow-sm hover:shadow-md transition-shadow' :
    style === 'bordered' ? 'rounded-xl border-2 border-gray-200 p-6' :
    'p-6';

  return (
    <section style={{ backgroundColor }} className="py-16 px-4 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl">
        {headerText && <h2 className="mb-2 text-center text-3xl font-bold text-gray-900">{headerText}</h2>}
        {subheading && <p className="mb-10 text-center text-lg text-gray-500">{subheading}</p>}
        <div
          className={`grid gap-6 grid-cols-1 sm:grid-cols-2 ${columns >= 3 ? 'lg:grid-cols-3' : ''} ${columns >= 4 ? 'xl:grid-cols-4' : ''}`}
        >
          {features.map((f: any, i: number) => (
            <div key={i} className={`text-center ${cardClass}`}>
              <div className={`mb-4 ${sizeMap[iconSize] || 'text-3xl'}`}>{f.image ? <img src={f.image} alt={f.title || ''} className="mx-auto h-12 w-12 object-contain" /> : (f.icon || '⭐')}</div>
              <h4 className="mb-2 text-lg font-semibold text-gray-800">{f.title}</h4>
              <p className="text-sm leading-relaxed text-gray-500">{f.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

/* ─── Image Block ──────────────────────────────────────────────────────── */

const ImageBlockRenderer: React.FC<any> = ({ src, alt = '', caption, linkUrl, linkTarget = '_blank', alignment = 'center', maxWidth = '100%', borderRadius = '8px', aspectRatio = 'auto' }) => {
  if (!src) return null;
  const imgStyle: React.CSSProperties = { maxWidth, borderRadius, width: '100%', aspectRatio: aspectRatio !== 'auto' ? aspectRatio : undefined, objectFit: aspectRatio !== 'auto' ? 'cover' : undefined };
  const img = <img src={src} alt={alt} style={imgStyle} className="h-auto" loading="lazy" />;
  const wrapped = linkUrl ? <CatalogueLink to={linkUrl} target={linkTarget}>{img}</CatalogueLink> : img;

  return (
    <section className="py-6 px-4 sm:px-6 lg:px-8" style={{ textAlign: alignment as any }}>
      <div style={{ display: 'inline-block', maxWidth }}>
        {wrapped}
        {caption && <p className="mt-3 text-sm text-gray-500">{caption}</p>}
      </div>
    </section>
  );
};

/* ─── Button Block ─────────────────────────────────────────────────────── */

const ButtonBlockRenderer: React.FC<any> = ({ text = 'Button', url = '#', target = '_self', variant = 'filled', size = 'large', alignment = 'center', backgroundColor = '', textColor = '', borderRadius = '8px', fullWidth = false }) => {
  const bg = backgroundColor || 'var(--primary-500, #3B82F6)';
  const fg = textColor || (variant === 'filled' ? '#FFFFFF' : bg);
  const padding = size === 'small' ? '10px 24px' : size === 'large' ? '16px 40px' : '12px 32px';
  const fontSize = size === 'small' ? '14px' : size === 'large' ? '18px' : '16px';

  return (
    <section className="py-8 px-4 sm:px-6 lg:px-8" style={{ textAlign: alignment as any }}>
      <CatalogueLink
        to={url || '#'}
        target={target}
        className={`inline-block font-semibold transition-all duration-200 hover:opacity-90 active:scale-[0.98] ${fullWidth ? 'w-full text-center' : ''}`}
        style={{
          padding,
          fontSize,
          backgroundColor: variant === 'filled' ? bg : 'transparent',
          color: fg,
          border: variant === 'outline' ? `2px solid ${bg}` : 'none',
          borderRadius,
          textDecoration: 'none',
        }}
      >
        {text}
      </CatalogueLink>
    </section>
  );
};

/* ─── Newsletter Signup ────────────────────────────────────────────────── */

const NewsletterSignupRenderer: React.FC<any> = ({ heading, subheading, placeholder = 'Enter your email', buttonText = 'Subscribe', layout = 'inline', backgroundColor = '#F8FAFC', successMessage }) => {
  const [email, setEmail] = React.useState('');
  const [submitted, setSubmitted] = React.useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (email) setSubmitted(true);
  };

  return (
    <section style={{ backgroundColor }} className="py-14 px-4 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-lg text-center">
        {heading && <h3 className="mb-2 text-2xl font-bold text-gray-900">{heading}</h3>}
        {subheading && <p className="mb-6 text-gray-500">{subheading}</p>}
        {submitted ? (
          <p className="text-lg font-medium text-green-600">{successMessage || 'Thank you for subscribing!'}</p>
        ) : (
          <form onSubmit={handleSubmit} className={`flex ${layout === 'stacked' ? 'flex-col' : ''} gap-3`}>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={placeholder}
              className="flex-1 rounded-lg border border-gray-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
            />
            <button
              type="submit"
              className="rounded-lg bg-blue-500 px-6 py-3 text-sm font-semibold text-white transition hover:bg-blue-600 active:scale-[0.98]"
              style={{ backgroundColor: 'var(--primary-500, #3B82F6)' }}
            >
              {buttonText}
            </button>
          </form>
        )}
      </div>
    </section>
  );
};

/* ─── Steps / Process ──────────────────────────────────────────────────── */

const StepsProcessRenderer: React.FC<any> = ({ headerText, subheading, layout = 'horizontal', steps = [], connectorStyle = 'line', backgroundColor = '#FFFFFF', accentColor }) => {
  const accent = accentColor || 'var(--primary-500, #3B82F6)';
  const isHorizontal = layout !== 'vertical';

  const connectorEl = (i: number) => {
    if (i === steps.length - 1 || connectorStyle === 'none') return null;
    if (isHorizontal) {
      return (
        <div className="hidden sm:flex flex-1 items-center px-2">
          <div className="h-0.5 w-full" style={{
            background: connectorStyle === 'dashed' ? `repeating-linear-gradient(to right, ${accent} 0, ${accent} 6px, transparent 6px, transparent 12px)` :
                         connectorStyle === 'dots' ? `repeating-linear-gradient(to right, ${accent} 0, ${accent} 4px, transparent 4px, transparent 12px)` :
                         accent,
          }} />
        </div>
      );
    }
    return (
      <div className="ml-5 flex justify-center" style={{ height: 24 }}>
        <div className="w-0.5" style={{
          height: '100%',
          background: connectorStyle === 'dashed' ? `repeating-linear-gradient(to bottom, ${accent} 0, ${accent} 6px, transparent 6px, transparent 12px)` : accent,
        }} />
      </div>
    );
  };

  return (
    <section style={{ backgroundColor }} className="py-16 px-4 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-5xl">
        {headerText && <h2 className="mb-2 text-center text-3xl font-bold text-gray-900">{headerText}</h2>}
        {subheading && <p className="mb-10 text-center text-lg text-gray-500">{subheading}</p>}
        <div className={isHorizontal ? 'flex flex-col sm:flex-row items-start justify-center' : 'flex flex-col'}>
          {steps.map((step: any, i: number) => (
            <React.Fragment key={i}>
              <div className={`flex ${isHorizontal ? 'flex-1 flex-col items-center text-center' : 'items-start gap-4'}`}>
                <div
                  className="mb-3 flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-base font-bold text-white shadow-md"
                  style={{ backgroundColor: accent }}
                >
                  {step.icon || step.number || i + 1}
                </div>
                <div className={isHorizontal ? '' : 'pt-1'}>
                  <h4 className="text-lg font-semibold text-gray-800">{step.title}</h4>
                  <p className="mt-1 text-sm leading-relaxed text-gray-500">{step.description}</p>
                </div>
              </div>
              {connectorEl(i)}
            </React.Fragment>
          ))}
        </div>
      </div>
    </section>
  );
};

/* ─── Component Style Wrapper with scroll animation ────────────────────── */

const ComponentStyleWrapper: React.FC<{
  component: any;
  componentStyle: React.CSSProperties;
  responsiveCSS: string;
  hoverClass: string;
  children: React.ReactNode;
}> = ({ component, componentStyle, responsiveCSS, hoverClass, children }) => {
  const ref = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(false);

  const entrance = component.style?.animation?.entrance;
  const hasEntrance = entrance?.type && entrance.type !== 'none';
  const hasOverlay = component.style?.backgroundImage && component.style?.backgroundOverlay;

  useEffect(() => {
    if (!hasEntrance || !ref.current) {
      setIsVisible(true);
      return;
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.1 }
    );
    observer.observe(ref.current);
    return () => observer.disconnect();
  }, [hasEntrance]);

  const animationStyle: React.CSSProperties = hasEntrance
    ? isVisible
      ? {
          animation: `catalogue-${entrance!.type} ${entrance!.duration ?? 600}ms ${entrance!.easing ?? 'ease-out'} ${entrance!.delay ?? 0}ms both`,
        }
      : { opacity: 0 }
    : {};

  return (
    <div
      ref={ref}
      id={component.anchorId || undefined}
      data-cid={component.id}
      className={`${component.style?.customClass || ''} ${hoverClass}`}
      style={{ ...componentStyle, ...animationStyle, position: hasOverlay ? 'relative' : undefined }}
    >
      {responsiveCSS && <style dangerouslySetInnerHTML={{ __html: responsiveCSS }} />}
      {hasOverlay && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            backgroundColor: component.style!.backgroundOverlay,
            zIndex: 0,
            borderRadius: componentStyle.borderRadius,
          }}
        />
      )}
      <div style={{ position: hasOverlay ? 'relative' : undefined, zIndex: hasOverlay ? 1 : undefined }}>
        {children}
      </div>
    </div>
  );
};
