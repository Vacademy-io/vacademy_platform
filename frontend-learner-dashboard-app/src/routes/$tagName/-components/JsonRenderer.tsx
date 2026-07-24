import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Page, GlobalSettings, CourseCatalogueData } from "../-types/course-catalogue-types";
import {
  buildComponentStyle,
  buildResponsiveCSS,
  getHoverClass,
  hasSectionShell,
  buildSectionShellStyles,
  type ComponentStyle,
} from "../-utils/style-utils";
import { SectionDecorations, hasDecorations } from "../-utils/catalogue-decorations";
import { CatalogueLink } from "./CatalogueLink";
import {
  GraduationCap,
  Rocket,
  Target,
  UsersThree,
  Code,
  Brain,
  Trophy,
  Lightbulb,
  ShieldCheck,
  ChartLineUp,
  Clock,
  Star,
  BookOpen,
  Certificate,
  ChatsCircle,
  Wrench,
  Sparkle,
  Medal,
  Briefcase,
  Globe,
  Check,
} from "@phosphor-icons/react";
import { HeaderComponent } from "./components/HeaderComponent";
import { HtmlBlockSection } from "./components/HtmlBlockSection";
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
  /** Slot-child rendering (columnLayout columns, accordion/tab slots): same
   *  ComponentStyle treatment as top-level components — children previously
   *  went through bare renderComponent and silently lost their style. */
  const renderChild = (child: any): React.ReactNode => {
    const rendered = renderComponent(child);
    if (!rendered) return null;
    const hasStyle = child.style && Object.keys(child.style).length > 0;
    if (!hasStyle) return <React.Fragment key={child.id}>{rendered}</React.Fragment>;
    return (
      <ComponentStyleWrapper
        key={child.id}
        component={child}
        componentStyle={buildComponentStyle(child.style)}
        responsiveCSS={buildResponsiveCSS(child.id, child.style)}
        hoverClass={getHoverClass(child.style)}
        // Preview iframe: top-level components suppress entrances (preview
        // branch renders statically) — slot children must match, or they
        // hide behind IntersectionObserver gates while editing.
        motionOff={isPreviewMode || (globalSettings as any)?.motion?.personality === 'none'}
      >
        {rendered}
      </ComponentStyleWrapper>
    );
  };

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
        return null;
      }
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
            instituteId={instituteId}
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
        return <MediaShowcaseComponent key={id} {...props} />;
      case "statsHighlights":
        return <StatsHighlightsComponent key={id} {...props} />;
      case "testimonialSection":
        return <TestimonialSectionComponent key={id} {...props} />;
      case "cartComponent":
        return <CartComponent key={id} {...props} instituteId={instituteId} globalSettings={globalSettings} />;
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
        return (
          <TabsAccordionRenderer
            key={id}
            {...props}
            renderSlot={(comps: any[]) => comps.map(renderChild)}
          />
        );
      case "trustChip":
        return <TrustChipRenderer key={id} {...props} />;
      case "sectionHeading":
        return <SectionHeadingRenderer key={id} {...props} />;
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

      case "productCourseGrid":
        // In the catalogue context, render as a standard course catalog grid
        return (
          <CourseCatalogComponent
            key={id}
            {...props}
            instituteId={instituteId}
            globalSettings={globalSettings}
            tagName={tagName}
          />
        );

      case "htmlBlock":
        // Sanitized + shadow-scoped custom HTML/CSS (see catalogue-html.ts) —
        // never raw dangerouslySetInnerHTML: htmlBlock content can come from
        // AI generation or admin paste and renders on the learner domain.
        return (
          <HtmlBlockSection
            key={id}
            html={props.html as string}
            css={props.css as string}
          />
        );

      case "columnLayout": {
        const {
          slots = [] as any[][],
          columnWidths = [] as string[],
          columnFr = undefined as string[] | undefined,
          gap = 'md',
          align = 'top',
          stackOnMobile = true,
          reverseOnMobile = false,
        } = props;
        const gapMap: Record<string, string> = { none: '0', sm: '0.5rem', md: '1rem', lg: '2rem', xl: '3rem', '2xl': '4rem' };
        const alignMap: Record<string, string> = { top: 'start', center: 'center', bottom: 'end', stretch: 'stretch' };
        const widthToFr = (w?: string) => {
          const map: Record<string, string> = { '1/2': '1fr', '1/3': '1fr', '2/3': '2fr', '1/4': '1fr', '3/4': '3fr' };
          return map[w ?? ''] || '1fr';
        };
        // columnFr (true per-column track sizes, e.g. ['3fr','2fr']) takes
        // precedence over the legacy lossy columnWidths fractions. Array.isArray
        // matters: a hand-authored STRING whose length equals the slot count
        // would otherwise pass the guard and crash on .every().
        const gridCols = Array.isArray(columnFr) && columnFr.length === slots.length && columnFr.every(Boolean)
          ? columnFr.join(' ')
          : slots.map((_: any, i: number) => widthToFr(columnWidths[i])).join(' ');
        // Use a CSS custom property so the @media rule in index.css can override it
        // on mobile (inline styles can't be overridden by regular rules, but CSS
        // custom properties cascade normally and can be overridden with !important).
        return (
          <div
            key={id}
            className={`${stackOnMobile ? 'grid-layout-responsive' : ''} ${stackOnMobile && reverseOnMobile ? 'grid-layout-reverse' : ''}`}
            style={{
              '--catalogue-grid-cols': gridCols,
              display: 'grid',
              gridTemplateColumns: 'var(--catalogue-grid-cols)',
              gap: gapMap[gap] || '1rem',
              alignItems: alignMap[align] || 'start',
            } as React.CSSProperties}
          >
            {slots.map((slotComponents: any[], slotIndex: number) => (
              <div
                key={slotIndex}
                className="min-w-0"
                // A sticky child needs travel room: stretch just this slot to
                // the row height, overriding the container's alignItems.
                style={{
                  alignSelf: slotComponents.some((c: any) => c?.style?.sticky?.enabled) ? 'stretch' : undefined,
                }}
              >
                {slotComponents.map((child: any) => renderChild(child))}
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
  // But don't add padding when the page IS the header itself (id="header")
  const hasHeader = page.id !== 'header' && page.components.some(
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
          const shell = hasSectionShell(component.style);
          const shellStyles = shell ? buildSectionShellStyles(component.style!) : null;
          const outerStyle = shellStyles ? shellStyles.canvasStyle : componentStyle;
          const decor = hasDecorations(component.style?.ornaments, component.style?.dividers);
          return (
            <div
              key={component.id}
              id={component.anchorId || undefined}
              data-component-id={component.id}
              data-cid={component.id}
              onClick={() => onComponentClick?.(component.id, page.id)}
              className={`relative ${component.style?.customClass || ''} ${hoverClass} ${isSelected ? 'outline outline-2 outline-blue-500 outline-offset-[-2px]' : 'hover:outline hover:outline-1 hover:outline-blue-300 hover:outline-offset-[-1px]'}`}
              style={{ cursor: 'pointer', ...outerStyle, ...(component.style?.ornaments?.length ? { overflow: 'hidden' } : {}) }}
            >
              {responsiveCSS && <style dangerouslySetInnerHTML={{ __html: responsiveCSS }} />}
              {hasOverlay && (
                <div style={{ position: 'absolute', inset: 0, backgroundColor: component.style!.backgroundOverlay, zIndex: 0, borderRadius: outerStyle.borderRadius }} />
              )}
              {decor && <SectionDecorations ornaments={component.style?.ornaments} dividers={component.style?.dividers} />}
              <div
                style={
                  shellStyles
                    ? { ...shellStyles.contentStyle, pointerEvents: 'none', position: 'relative', zIndex: 1 }
                    : { pointerEvents: 'none', position: hasOverlay || decor ? 'relative' : undefined, zIndex: hasOverlay || decor ? 1 : undefined }
                }
              >
                {rendered}
              </div>
              {isSelected && (
                <div className="absolute top-0 start-0 z-50 bg-primary-500 text-white text-xs px-2 py-0.5 rounded-ee-md font-medium select-none">
                  {component.type}
                </div>
              )}
            </div>
          );
        }

        // Normal (non-preview) rendering with style wrapper
        if (hasStyle) {
          return (
            <ComponentStyleWrapper key={component.id} component={component} componentStyle={componentStyle} responsiveCSS={responsiveCSS} hoverClass={hoverClass} motionOff={(globalSettings as any)?.motion?.personality === 'none'}>
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

/**
 * Text classes for section copy. Token-driven when the section sits on a
 * THEME surface (adapts to dark mode / presets); fixed neutrals when the
 * author set a custom section background — author-colored surfaces must keep
 * a readable pairing in BOTH light and dark mode (token text goes near-white
 * in dark and would vanish on an author-picked light color).
 */
const sectionText = (customBg?: string) =>
  customBg
    ? {
        heading: 'text-gray-900', // design-lint-ignore: fixed neutrals over author-colored surface
        body: 'text-gray-600', // design-lint-ignore: fixed neutrals over author-colored surface
        muted: 'text-gray-500', // design-lint-ignore: fixed neutrals over author-colored surface
      }
    : {
        heading: 'text-catalogue-text-primary',
        body: 'text-catalogue-text-secondary',
        muted: 'text-catalogue-text-muted',
      };

/** Inline style for an author-set section background (undefined otherwise,
 *  letting the token fallback class on the element show through). */
const sectionBg = (customBg?: string): React.CSSProperties | undefined =>
  customBg ? { backgroundColor: customBg } : undefined;

/** Curated icon set for featureGrid/steps — 'iconName' values map here;
 *  anything else falls back to the legacy emoji/text `icon` field. */
const FEATURE_ICON_MAP: Record<string, React.ComponentType<any>> = {
  GraduationCap, Rocket, Target, UsersThree, Code, Brain, Trophy, Lightbulb,
  ShieldCheck, ChartLineUp, Clock, Star, BookOpen, Certificate, ChatsCircle,
  Wrench, Sparkle, Medal, Briefcase, Globe,
};

const FaqSectionRenderer: React.FC<any> = ({ headerText, subheading, faqs = [], backgroundColor }) => {
  const [openIndex, setOpenIndex] = React.useState<number | null>(null);
  const txt = sectionText(backgroundColor);
  return (
    <section style={sectionBg(backgroundColor)} className="py-16 px-4 bg-catalogue-bg-subtle">
      <div className="mx-auto max-w-3xl">
        {headerText && <h2 className={`mb-2 text-center text-3xl font-bold ${txt.heading}`}>{headerText}</h2>}
        {subheading && <p className={`mb-10 text-center ${txt.muted}`}>{subheading}</p>}
        <div className="space-y-3">
          {faqs.map((faq: any, i: number) => (
            <div key={i} data-stagger-item style={{ ['--stagger-i' as any]: i }} className="rounded-lg border border-catalogue-border bg-catalogue-bg overflow-hidden">
              <button
                onClick={() => setOpenIndex(openIndex === i ? null : i)}
                className="flex w-full items-center justify-between px-6 py-4 text-start font-medium text-catalogue-text-primary hover:bg-catalogue-interactive-hover"
              >
                <span>{faq.question}</span>
                <span className="ms-4 text-catalogue-text-muted text-xl">{openIndex === i ? '−' : '+'}</span>
              </button>
              {openIndex === i && (
                <div className="border-t border-catalogue-border-subtle px-6 py-4 text-catalogue-text-secondary leading-relaxed">
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
        {title && <h2 className="mb-6 text-center text-2xl font-bold text-catalogue-text-primary">{title}</h2>}
        {embedUrl ? (
          <div className="relative w-full overflow-hidden rounded-xl shadow-lg" style={{ paddingBottom: padMap[aspectRatio] || '56.25%' }}>
            <iframe src={embedUrl} className="absolute inset-0 size-full" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen title={title || 'Video'} />
          </div>
        ) : (
          <div className="flex items-center justify-center rounded-xl bg-catalogue-bg-muted text-catalogue-text-muted" style={{ aspectRatio: aspectRatio.replace(':', '/') }}>
            No video URL configured
          </div>
        )}
        {caption && <p className="mt-3 text-center text-sm text-catalogue-text-muted">{caption}</p>}
      </div>
    </section>
  );
};

const CtaBannerRenderer: React.FC<any> = ({ heading, subheading, backgroundColor = '#3B82F6', textColor = 'white', layout = 'centered', button }) => { // design-lint-ignore: page-builder default color
  const isSplit = layout === 'split';
  // Intentional white: the button sits on the author-colored banner surface,
  // so it must stay white in every theme/mode (not a token surface).
  const ctaButtonClass = 'mt-4 inline-block rounded-lg bg-white px-8 py-3 font-semibold shadow-md transition hover:opacity-90'; // design-lint-ignore: intentional white over author-colored surface
  return (
    <section style={{ backgroundColor }} className="py-14 px-4">
      <div className={`mx-auto max-w-5xl flex ${isSplit ? 'items-center justify-between gap-8 flex-wrap' : 'flex-col items-center text-center'}`}>
        <div className={isSplit ? 'flex-1' : ''}>
          {heading && <h2 style={{ color: textColor }} className="text-3xl font-bold">{heading}</h2>}
          {subheading && <p style={{ color: textColor, opacity: 0.85 }} className="mt-2 text-lg">{subheading}</p>}
        </div>
        {button?.enabled && (
          <CatalogueLink to={button.target || '#'} className={ctaButtonClass} style={{ color: backgroundColor }}>
            {button.text}
          </CatalogueLink>
        )}
      </div>
    </section>
  );
};

const PricingTableRenderer: React.FC<any> = ({ headerText, subheading, plans = [] }) => (
  <section className="py-16 px-4 bg-catalogue-bg">
    <div className="mx-auto max-w-5xl">
      {headerText && <h2 className="mb-2 text-center text-3xl font-bold text-catalogue-text-primary">{headerText}</h2>}
      {subheading && <p className="mb-12 text-center text-catalogue-text-muted">{subheading}</p>}
      <div className={`grid gap-6 ${plans.length === 2 ? 'md:grid-cols-2' : 'md:grid-cols-3'}`}>
        {plans.map((plan: any, i: number) => (
          <div key={i} data-stagger-item style={{ ['--stagger-i' as any]: i }} className={`relative flex flex-col rounded-2xl border-2 p-8 ${plan.highlighted ? 'border-primary-500 shadow-xl' : 'border-catalogue-border'}`}>
            {plan.highlighted && <div className="absolute -top-3 start-1/2 -translate-x-1/2 rounded-full px-4 py-1 text-xs font-semibold text-white" style={{ backgroundColor: 'hsl(var(--primary-500, 217 91% 60%))' }}>Recommended</div>}
            <h3 className="text-xl font-bold text-catalogue-text-primary">{plan.name}</h3>
            {plan.description && <p className="mt-1 text-sm text-catalogue-text-muted">{plan.description}</p>}
            <div className="mt-4 flex items-baseline gap-1">
              <span className="text-4xl font-bold text-catalogue-text-primary">{plan.price}</span>
              {plan.period && <span className="text-catalogue-text-muted">{plan.period}</span>}
            </div>
            <ul className="mt-6 flex-1 space-y-3">
              {(plan.features || []).map((f: string, j: number) => (
                <li key={j} className="flex items-center gap-2 text-sm text-catalogue-text-secondary">
                  <span className="text-green-500">✓</span>{f}
                </li>
              ))}
            </ul>
            {plan.buttonText && (
              <CatalogueLink to={plan.buttonTarget || '#'} className={`mt-8 block rounded-lg py-3 text-center font-semibold transition ${plan.highlighted ? 'text-white hover:opacity-90' : 'border border-catalogue-border text-catalogue-text-primary hover:bg-catalogue-interactive-hover'}`} style={plan.highlighted ? { backgroundColor: 'hsl(var(--primary-500, 217 91% 60%))' } : undefined}>
                {plan.buttonText}
              </CatalogueLink>
            )}
          </div>
        ))}
      </div>
    </div>
  </section>
);

const ContactFormRenderer: React.FC<any> = ({ heading, subheading, fields = [], submitLabel = 'Send Message', successMessage, backgroundColor }) => {
  const [submitted, setSubmitted] = React.useState(false);
  const [formData, setFormData] = React.useState<Record<string, string>>({});
  const handleSubmit = (e: React.FormEvent) => { e.preventDefault(); setSubmitted(true); };
  const txt = sectionText(backgroundColor);
  return (
    <section style={sectionBg(backgroundColor)} className="py-16 px-4 bg-catalogue-bg">
      <div className="mx-auto max-w-2xl">
        {heading && <h2 className={`mb-2 text-center text-3xl font-bold ${txt.heading}`}>{heading}</h2>}
        {subheading && <p className={`mb-10 text-center ${txt.muted}`}>{subheading}</p>}
        {submitted ? (
          <div className="rounded-xl border border-green-200 bg-green-50 p-8 text-center text-green-700 font-medium">
            {successMessage || 'Thank you! We\'ll be in touch soon.'}
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5 rounded-xl border border-catalogue-border bg-catalogue-bg p-8 shadow-sm">
            {fields.map((field: any) => (
              <div key={field.name}>
                <label className="mb-1 block text-sm font-medium text-catalogue-text-secondary">{field.label}{field.required && <span className="ms-1 text-red-500">*</span>}</label>
                {field.type === 'textarea' ? (
                  <textarea required={field.required} rows={4} value={formData[field.name] || ''} onChange={(e) => setFormData({ ...formData, [field.name]: e.target.value })} className="w-full rounded-lg border border-catalogue-border bg-catalogue-bg text-catalogue-text-primary px-4 py-2.5 text-sm focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 focus:outline-none" />
                ) : (
                  <input type={field.type} required={field.required} value={formData[field.name] || ''} onChange={(e) => setFormData({ ...formData, [field.name]: e.target.value })} className="w-full rounded-lg border border-catalogue-border bg-catalogue-bg text-catalogue-text-primary px-4 py-2.5 text-sm focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 focus:outline-none" />
                )}
              </div>
            ))}
            <button type="submit" className="w-full rounded-lg py-3 font-semibold text-white transition hover:opacity-90" style={{ backgroundColor: 'hsl(var(--primary-500, 217 91% 60%))' }}>
              {submitLabel}
            </button>
          </form>
        )}
      </div>
    </section>
  );
};

const TeamSectionRenderer: React.FC<any> = ({ headerText, subheading, members = [], columns = 3 }) => (
  <section className="py-16 px-4 bg-catalogue-bg">
    <div className="mx-auto max-w-6xl">
      {headerText && <h2 className="mb-2 text-center text-3xl font-bold text-catalogue-text-primary">{headerText}</h2>}
      {subheading && <p className="mb-12 text-center text-catalogue-text-muted">{subheading}</p>}
      <div className={`grid gap-8 ${columns === 2 ? 'sm:grid-cols-2' : columns === 4 ? 'sm:grid-cols-2 lg:grid-cols-4' : 'sm:grid-cols-2 lg:grid-cols-3'}`}>
        {members.map((m: any, i: number) => (
          <div key={i} data-stagger-item style={{ ['--stagger-i' as any]: i }} className="flex flex-col items-center text-center">
            {m.avatar ? (
              <img src={m.avatar} alt={m.name} className="mb-4 size-24 rounded-full object-cover shadow-md" />
            ) : (
              <div className="mb-4 flex size-16 sm:size-20 items-center justify-center rounded-full bg-primary-100 text-2xl font-bold text-primary-600">
                {m.name?.[0] || '?'}
              </div>
            )}
            <h3 className="text-lg font-semibold text-catalogue-text-primary">{m.name}</h3>
            <p className="text-sm font-medium text-primary-600">{m.role}</p>
            {m.bio && <p className="mt-2 text-sm text-catalogue-text-muted">{m.bio}</p>}
          </div>
        ))}
      </div>
    </div>
  </section>
);

const AnnouncementFeedRenderer: React.FC<any> = ({ headerText, subheading, announcements = [], layout = 'list', showDate = true, showTag = true, backgroundColor }) => (
  <section style={sectionBg(backgroundColor)} className="py-16 px-4 bg-catalogue-bg">
    <div className="mx-auto max-w-4xl">
      {headerText && <h2 className={`mb-2 text-center text-3xl font-bold ${sectionText(backgroundColor).heading}`}>{headerText}</h2>}
      {subheading && <p className={`mb-10 text-center ${sectionText(backgroundColor).muted}`}>{subheading}</p>}
      <div className={layout === 'grid' ? 'grid gap-6 sm:grid-cols-2' : 'space-y-4'}>
        {announcements.map((a: any, i: number) => (
          <div key={i} data-stagger-item style={{ ['--stagger-i' as any]: i }} className={`rounded-xl border border-catalogue-border bg-catalogue-bg p-6 shadow-sm ${layout === 'list' ? 'flex items-start gap-4' : ''}`}>
            <div className="flex-1">
              <div className="mb-2 flex flex-wrap items-center gap-3">
                {showTag && a.tag && <span className="rounded-full bg-primary-100 px-3 py-0.5 text-xs font-semibold text-primary-700">{a.tag}</span>}
                {showDate && a.date && <span className="text-xs text-catalogue-text-muted">{new Date(a.date).toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: 'numeric' })}</span>}
              </div>
              <h3 className="text-base font-semibold text-catalogue-text-primary">{a.title}</h3>
              {a.summary && <p className="mt-1 text-sm text-catalogue-text-secondary">{a.summary}</p>}
            </div>
          </div>
        ))}
      </div>
    </div>
  </section>
);

const ImageGalleryRenderer: React.FC<any> = ({ headerText, images = [], columns = 3, showCaptions = false }) => (
  <section className="py-12 px-4 bg-catalogue-bg">
    <div className="mx-auto max-w-6xl">
      {headerText && <h2 className="mb-8 text-center text-3xl font-bold text-catalogue-text-primary">{headerText}</h2>}
      <div className={`grid gap-4 ${columns === 2 ? 'sm:grid-cols-2' : columns === 4 ? 'sm:grid-cols-2 lg:grid-cols-4' : 'sm:grid-cols-2 lg:grid-cols-3'}`}>
        {images.map((img: any, i: number) => (
          <div key={i} data-stagger-item style={{ ['--stagger-i' as any]: i }} className="group overflow-hidden rounded-xl">
            {img.src ? (
              <img src={img.src} alt={img.alt || ''} className="w-full object-cover transition group-hover:scale-105" style={{ aspectRatio: '4/3' }} />
            ) : (
              <div className="flex w-full items-center justify-center rounded-xl bg-catalogue-bg-muted text-catalogue-text-muted" style={{ aspectRatio: '4/3' }}>No image</div>
            )}
            {showCaptions && img.caption && <p className="mt-2 text-center text-sm text-catalogue-text-muted">{img.caption}</p>}
          </div>
        ))}
      </div>
    </div>
  </section>
);

/* ─── Spacer / Divider ─────────────────────────────────────────────────── */

const SpacerRenderer: React.FC<any> = ({ height = '48px', showDivider = false, dividerStyle = 'solid', dividerColor = '#E5E7EB', dividerWidth = '1px', maxWidth = '100%' }) => ( // design-lint-ignore: page-builder default color
  <div style={{ height, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
    {showDivider && (
      <hr style={{ borderTop: `${dividerWidth} ${dividerStyle} ${dividerColor}`, maxWidth, width: '100%', margin: '0 auto' }} />
    )}
  </div>
);

/* ─── Tabs / Accordion ─────────────────────────────────────────────────── */

const TabsAccordionRenderer: React.FC<any> = ({ mode = 'tabs', items = [], defaultOpen = 0, allowMultiple = false, backgroundColor, variant = 'plain', renderSlot }) => {
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

  // Trigger row: icon/numbered label + title + optional right-aligned meta.
  // Numbered prefix + single-line truncation are split-variant styling only;
  // plain/boxed legacy configs (no icon field) keep the bare wrapping title.
  const triggerContent = (item: any, i: number, open: boolean) => {
    const IconComp = item.icon && FEATURE_ICON_MAP[item.icon];
    const compact = variant === 'split';
    return (
      <>
        <span className="flex min-w-0 items-center gap-3">
          {IconComp ? (
            <IconComp size={18} weight="duotone" className="shrink-0 text-primary-500" aria-hidden="true" />
          ) : item.icon ? (
            <span className="shrink-0" aria-hidden="true">{item.icon}</span>
          ) : compact ? (
            <span className="shrink-0 text-sm font-bold text-primary-400">{String(i + 1).padStart(2, '0')}</span>
          ) : null}
          <span className={compact ? 'truncate' : 'min-w-0'}>{item.title}</span>
        </span>
        <span className="ms-4 flex shrink-0 items-center gap-3">
          {item.meta && <span className="text-xs text-catalogue-text-muted">{item.meta}</span>}
          <span className={`text-catalogue-text-muted transition-transform ${open ? 'rotate-180' : ''}`}>&#9662;</span>
        </span>
      </>
    );
  };

  // Panel body: nested components (slot) when configured, else rich text.
  const panelContent = (item: any) =>
    Array.isArray(item.slot) && item.slot.length && renderSlot ? (
      <div className="space-y-4">{renderSlot(item.slot)}</div>
    ) : (
      <div className="text-sm text-catalogue-text-secondary" dangerouslySetInnerHTML={{ __html: item.content || '' }} />
    );

  if (mode === 'accordion' && variant === 'split') {
    // Accordion-with-artifact: trigger list left, open item's panel in a
    // sticky right pane on desktop; stacked accordion on mobile.
    const activeIndex = [...openIndices][0] ?? 0;
    const active = items[activeIndex];
    return (
      <section style={sectionBg(backgroundColor)} className="py-12 px-4 bg-catalogue-bg">
        <div className="mx-auto max-w-6xl lg:grid lg:grid-cols-5 lg:gap-8">
          <div className="space-y-2 lg:col-span-2">
            {items.map((item: any, i: number) => (
              <div key={i} className={`rounded-lg border overflow-hidden ${openIndices.has(i) ? 'border-primary-200 bg-primary-50' : 'border-catalogue-border bg-catalogue-bg'}`}>
                <button onClick={() => setOpenIndices(new Set([i]))} className="flex w-full items-center justify-between px-5 py-4 text-start font-medium text-catalogue-text-primary hover:bg-catalogue-interactive-hover">
                  {triggerContent(item, i, openIndices.has(i))}
                </button>
                {/* Mobile: panel renders inline under the open trigger */}
                {openIndices.has(i) && (
                  <div className="px-5 pb-4 lg:hidden">{panelContent(item)}</div>
                )}
              </div>
            ))}
          </div>
          <div className="hidden lg:block lg:col-span-3">
            <div className="sticky top-24 rounded-xl border border-catalogue-border-subtle bg-catalogue-bg-subtle p-6">
              {active ? panelContent(active) : null}
            </div>
          </div>
        </div>
      </section>
    );
  }

  if (mode === 'accordion') {
    const boxed = variant === 'boxed';
    return (
      <section style={sectionBg(backgroundColor)} className="py-12 px-4 bg-catalogue-bg">
        <div className={`mx-auto max-w-3xl ${boxed ? 'divide-y divide-catalogue-border-subtle rounded-xl border border-catalogue-border overflow-hidden' : 'space-y-2'}`}>
          {items.map((item: any, i: number) => (
            <div key={i} className={boxed ? 'bg-catalogue-bg' : 'rounded-lg border border-catalogue-border bg-catalogue-bg overflow-hidden'}>
              <button onClick={() => toggleAccordion(i)} className="flex w-full items-center justify-between px-5 py-4 text-start font-medium text-catalogue-text-primary hover:bg-catalogue-interactive-hover">
                {triggerContent(item, i, openIndices.has(i))}
              </button>
              {openIndices.has(i) && (
                <div className="px-5 pb-4">{panelContent(item)}</div>
              )}
            </div>
          ))}
        </div>
      </section>
    );
  }

  return (
    <section style={sectionBg(backgroundColor)} className="py-12 px-4 bg-catalogue-bg">
      <div className="mx-auto max-w-3xl">
        <div className="flex border-b border-catalogue-border">
          {items.map((item: any, i: number) => (
            <button key={i} onClick={() => setActiveTab(i)}
              className={`px-5 py-3 text-sm font-medium transition-colors ${i === activeTab ? 'border-b-2 border-primary-500 text-primary-600' : 'text-catalogue-text-muted hover:text-catalogue-text-secondary'}`}>
              {item.title}
            </button>
          ))}
        </div>
        {items[activeTab] && (
          Array.isArray(items[activeTab].slot) && items[activeTab].slot.length && renderSlot ? (
            <div className="p-5 space-y-4">{renderSlot(items[activeTab].slot)}</div>
          ) : (
            <div className="p-5 text-catalogue-text-secondary" dangerouslySetInnerHTML={{ __html: items[activeTab].content || '' }} />
          )
        )}
      </div>
    </section>
  );
};

/* ─── Logo Cloud ───────────────────────────────────────────────────────── */

const MARQUEE_SPEED_MAP: Record<string, string> = { slow: '45s', medium: '30s', fast: '18s' };

// Must match LogoItem's visibility rule — grid cells are pre-filtered so a
// null item never leaves an empty grid track or a dead stagger slot.
const logoWillRender = (logo: any, display: string) =>
  display === 'label-pill' ? !!(logo.label || logo.alt) : !!(logo.image || logo.label);

const LogoCloudRenderer: React.FC<any> = ({ headerText, subheading, logos = [], layout = 'grid', grayscale = true, columns = 5, display = 'logo', tile = 'none', marqueeSpeed = 'medium', logoHeight = 'md' }) => {
  const visible = logos.filter((logo: any) => logoWillRender(logo, display));
  return (
  <section className="py-12 px-4">
    <div className="mx-auto max-w-5xl text-center">
      {headerText && <h3 className="mb-2 text-lg font-semibold uppercase tracking-wider text-catalogue-text-muted">{headerText}</h3>}
      {subheading && <p className="mb-8 text-sm text-catalogue-text-muted">{subheading}</p>}
      {layout === 'marquee' ? (
        <div className="overflow-hidden">
          <div className="catalogue-marquee flex items-center gap-12" style={{ animationDuration: MARQUEE_SPEED_MAP[marqueeSpeed] || '30s' }}>
            {[...visible, ...visible].map((logo: any, i: number) => (
              <LogoItem key={i} logo={logo} grayscale={grayscale} display={display} tile={tile} logoHeight={logoHeight} />
            ))}
          </div>
        </div>
      ) : (
        <div className={`grid items-center justify-items-center gap-8 grid-cols-2 sm:grid-cols-3 ${columns >= 4 ? 'md:grid-cols-4' : ''} ${columns >= 5 ? 'lg:grid-cols-5' : ''} ${columns >= 6 ? 'xl:grid-cols-6' : ''}`}>
          {visible.map((logo: any, i: number) => (
            <div key={i} data-stagger-item style={{ ['--stagger-i' as any]: i }}>
              <LogoItem logo={logo} grayscale={grayscale} display={display} tile={tile} logoHeight={logoHeight} />
            </div>
          ))}
        </div>
      )}
    </div>
  </section>
  );
};

const LOGO_HEIGHT_MAP: Record<string, string> = { sm: 'h-7', md: 'h-10', lg: 'h-14' };

const LogoItem: React.FC<{
  logo: any;
  grayscale: boolean;
  display?: 'logo' | 'logo+label' | 'label-pill';
  tile?: 'none' | 'card' | 'pill';
  logoHeight?: 'sm' | 'md' | 'lg';
}> = ({ logo, grayscale, display = 'logo', tile = 'none', logoHeight = 'md' }) => {
  const h = LOGO_HEIGHT_MAP[logoHeight] || 'h-10';
  // alt is a pill-label source only in the explicit pill mode — legacy configs
  // carry editor-seeded {image:'', alt:'Logo N'} rows that must stay invisible.
  const explicitPill = display === 'label-pill';
  const label = explicitPill ? logo.label || logo.alt || '' : logo.label || '';

  // Label-only pill (orgs without a logo asset, or a text-first wall)
  if (explicitPill || (!logo.image && label)) {
    if (!label) return null;
    const pill = (
      <span className="inline-flex items-center rounded-full border border-catalogue-border bg-catalogue-bg-subtle px-4 py-1.5 text-sm font-medium text-catalogue-text-secondary">
        {label}
      </span>
    );
    return logo.url ? <a href={logo.url} target="_blank" rel="noopener noreferrer">{pill}</a> : pill;
  }

  const img = logo.image ? (
    <img src={logo.image} alt={logo.alt || label || ''} className={`${h} w-auto object-contain transition ${grayscale ? 'grayscale hover:grayscale-0' : ''}`} />
  ) : null;
  if (!img) return null;

  const inner =
    display === 'logo+label' && label ? (
      <span className="flex flex-col items-center gap-2">
        {img}
        <span className="text-xs font-medium text-catalogue-text-muted">{label}</span>
      </span>
    ) : (
      img
    );

  const tiled =
    tile === 'card' ? (
      <span className="inline-flex items-center justify-center rounded-xl border border-catalogue-border-subtle bg-catalogue-bg p-4 shadow-sm">{inner}</span>
    ) : tile === 'pill' ? (
      <span className="inline-flex items-center justify-center rounded-full border border-catalogue-border-subtle bg-catalogue-bg px-5 py-2.5">{inner}</span>
    ) : (
      inner
    );

  if (logo.url) return <a href={logo.url} target="_blank" rel="noopener noreferrer">{tiled}</a>;
  return tiled;
};

/* ─── Trust Chip ───────────────────────────────────────────────────────── */

const TrustChipRenderer: React.FC<any> = ({ text, rating, avatars = [], alignment = 'center' }) => {
  const clamped = rating ? Math.max(0, Math.min(5, Number(rating))) : 0;
  if (!text && !clamped && !avatars.length) return null;
  const justify = alignment === 'left' ? 'justify-start' : alignment === 'right' ? 'justify-end' : 'justify-center';
  return (
    <section className={`flex px-4 py-6 ${justify}`}>
      <div className="inline-flex items-center gap-3 rounded-full border border-catalogue-border-subtle bg-catalogue-bg-subtle py-2 ps-2.5 pe-5">
        {avatars.length > 0 && (
          <span className="flex -space-x-2">
            {avatars.slice(0, 4).map((src: string, i: number) => (
              <img key={i} src={src} alt="" aria-hidden="true" className="h-8 w-8 rounded-full border-2 border-catalogue-bg object-cover" />
            ))}
          </span>
        )}
        {clamped > 0 && (
          <span className="flex items-center gap-1 text-sm font-semibold text-catalogue-text-primary">
            <Star size={15} weight="fill" className="text-warning-500" aria-hidden="true" />
            {clamped.toFixed(1)}
          </span>
        )}
        {text && <span className="text-sm text-catalogue-text-secondary">{text}</span>}
      </div>
    </section>
  );
};

/* ─── Section Heading (D7 primitive) ───────────────────────────────────── */

/** Standalone premium heading block: eyebrow + title (with optional styled
 *  highlight substring) + lead. Drop it above any section that lacks its own
 *  header — one consistent heading voice across the page. */
const SectionHeadingRenderer: React.FC<any> = ({
  eyebrow, title = '', highlight, lead, align = 'center', size = 'lg', backgroundColor,
}) => {
  const txt = sectionText(backgroundColor);
  const sizeClass = size === 'xl' ? 'catalogue-display' : size === 'md' ? 'catalogue-h3' : 'catalogue-h2';

  // Wrap the first occurrence of highlight.text inside the title.
  let titleNode: React.ReactNode = title;
  if (highlight?.text && typeof title === 'string' && title.includes(highlight.text)) {
    const idx = title.indexOf(highlight.text);
    const before = title.slice(0, idx);
    const after = title.slice(idx + highlight.text.length);
    const hlClass =
      highlight.style === 'underline'
        ? 'underline decoration-primary-400 decoration-4 underline-offset-8'
        : highlight.style === 'mark'
          ? 'rounded-md bg-primary-100 px-2 text-gray-900' // design-lint-ignore: fixed dark text — primary-100 highlighter stays light in both modes
          : 'catalogue-text-gradient';
    titleNode = (
      <>
        {before}
        <span className={hlClass}>{highlight.text}</span>
        {after}
      </>
    );
  }

  return (
    <section style={sectionBg(backgroundColor)} className="px-4 pt-14 pb-4 bg-catalogue-bg">
      <div className={`mx-auto max-w-3xl ${align === 'left' ? 'text-start' : 'text-center'}`}>
        {eyebrow && <span className="catalogue-eyebrow">{eyebrow}</span>}
        <h2 className={`${eyebrow ? 'mt-3' : ''} font-bold ${sizeClass} ${txt.heading}`}>{titleNode}</h2>
        {lead && <p className={`mt-4 catalogue-lead ${txt.muted}`}>{lead}</p>}
      </div>
    </section>
  );
};

/* ─── Map Embed ────────────────────────────────────────────────────────── */

const MapEmbedRenderer: React.FC<any> = ({ embedUrl, height = '400px', borderRadius = '8px', title }) => (
  <section className="py-8 px-4">
    <div className="mx-auto max-w-5xl">
      {title && <h3 className="mb-4 text-xl font-semibold text-catalogue-text-primary">{title}</h3>}
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
        <div className="flex items-center justify-center rounded bg-catalogue-bg-muted text-catalogue-text-muted" style={{ height, borderRadius }}>
          No map URL configured
        </div>
      )}
    </div>
  </section>
);

/* ─── Countdown Timer ──────────────────────────────────────────────────── */

const CountdownTimerRenderer: React.FC<any> = ({ targetDate, heading, expiredMessage, backgroundColor = '#1E293B', textColor = 'white', style = 'cards' }) => { // design-lint-ignore: page-builder default color
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
  headerText, subheading, columns = 3, features = [], style = 'cards', iconSize = 'large', backgroundColor, align = 'center',
}) => {
  const sizeMap: Record<string, string> = { small: 'text-xl', medium: 'text-2xl', large: 'text-3xl' };
  const txt = sectionText(backgroundColor);
  const cardClass =
    style === 'cards' ? 'rounded-xl border border-catalogue-border-subtle bg-catalogue-bg p-6 shadow-sm hover:shadow-md transition-shadow' :
    style === 'bordered' ? 'rounded-xl border-2 border-catalogue-border p-6' :
    style === 'glass' ? 'catalogue-card-glass p-6' :
    style === 'gradient-border' ? 'catalogue-card-gradient-border p-6' :
    style === 'tinted' ? 'catalogue-card-tinted p-6' :
    'p-6';
  // Plain/minimal/bordered cards sit directly on the section surface, so
  // their text follows the section pairing; skinned cards (cards/glass/
  // gradient-border/tinted) have their own token surface.
  const cardOnSection = style === 'plain' || style === 'minimal' || style === 'bordered';
  const isLeft = align === 'left';

  return (
    <section style={sectionBg(backgroundColor)} className="py-16 px-4 sm:px-6 lg:px-8 bg-catalogue-bg">
      <div className="mx-auto max-w-6xl">
        {headerText && <h2 className={`mb-2 text-center text-3xl font-bold ${txt.heading}`}>{headerText}</h2>}
        {subheading && <p className={`mb-10 text-center text-lg ${txt.muted}`}>{subheading}</p>}
        <div
          className={`grid gap-6 grid-cols-1 sm:grid-cols-2 ${columns >= 3 ? 'lg:grid-cols-3' : ''} ${columns >= 4 ? 'xl:grid-cols-4' : ''} ${columns >= 5 ? '2xl:grid-cols-5' : ''}`}
        >
          {features.map((f: any, i: number) => {
            const IconComp = f.iconName ? FEATURE_ICON_MAP[f.iconName] : undefined;
            const chips: string[] = (f.chips || []).filter(Boolean);
            const bullets: string[] = (f.bullets || []).filter(Boolean);
            return (
            <div key={i} data-stagger-item style={{ ['--stagger-i' as any]: i }} className={`${isLeft ? 'text-start' : 'text-center'} ${cardClass}`}>
              <div className="mb-4">
                {f.image ? (
                  <img src={f.image} alt={f.title || ''} className={`${isLeft ? '' : 'mx-auto'} w-full max-w-40 h-auto rounded-lg object-cover`} style={{ aspectRatio: '1/1' }} />
                ) : IconComp ? (
                  <span className={`inline-flex items-center justify-center rounded-xl bg-primary-50 p-3 text-primary-500 ${isLeft ? '' : 'mx-auto'}`}>
                    <IconComp size={iconSize === 'small' ? 20 : iconSize === 'medium' ? 26 : 32} weight="duotone" aria-hidden="true" />
                  </span>
                ) : (
                  <span className={sizeMap[iconSize] || 'text-3xl'}>{f.icon || '⭐'}</span>
                )}
              </div>
              {chips.length > 0 && (
                <div className={`mb-2 flex flex-wrap gap-1.5 ${isLeft ? '' : 'justify-center'}`}>
                  {chips.map((c: string, j: number) => (
                    <span key={j} className="catalogue-badge catalogue-badge-primary rounded-full">{c}</span>
                  ))}
                </div>
              )}
              <h4 className={`mb-2 text-lg font-semibold ${cardOnSection ? txt.heading : 'text-catalogue-text-primary'}`}>{f.title}</h4>
              <p className={`text-sm leading-relaxed ${cardOnSection ? txt.muted : 'text-catalogue-text-muted'}`}>{f.description}</p>
              {bullets.length > 0 && (
                <ul className={`mt-3 space-y-1.5 text-sm ${cardOnSection ? txt.body : 'text-catalogue-text-secondary'} ${isLeft ? '' : 'inline-block text-start'}`}>
                  {bullets.map((b: string, j: number) => (
                    <li key={j} className="flex items-start gap-2">
                      <Check size={15} weight="bold" className="mt-0.5 shrink-0 text-primary-500" aria-hidden="true" />
                      <span>{b}</span>
                    </li>
                  ))}
                </ul>
              )}
              {f.link?.text && f.link?.url && (
                <div className={`mt-3 ${isLeft ? '' : 'text-center'}`}>
                  <CatalogueLink to={f.link.url} className="text-sm font-semibold text-primary-500 hover:underline">
                    {f.link.text} →
                  </CatalogueLink>
                </div>
              )}
            </div>
            );
          })}
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
        {caption && <p className="mt-3 text-sm text-catalogue-text-muted">{caption}</p>}
      </div>
    </section>
  );
};

/* ─── Button Block ─────────────────────────────────────────────────────── */

const ButtonBlockRenderer: React.FC<any> = ({ text = 'Button', url = '#', target = '_self', variant = 'filled', size = 'large', alignment = 'center', backgroundColor = '', textColor = '', borderRadius = '8px', fullWidth = false }) => {
  const bg = backgroundColor || 'hsl(var(--primary-500, 217 91% 60%))';
  const fg = textColor || (variant === 'filled' ? 'white' : bg);
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

const NewsletterSignupRenderer: React.FC<any> = ({ heading, subheading, placeholder = 'Enter your email', buttonText = 'Subscribe', layout = 'inline', backgroundColor, successMessage }) => {
  const [email, setEmail] = React.useState('');
  const [submitted, setSubmitted] = React.useState(false);
  const txt = sectionText(backgroundColor);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (email) setSubmitted(true);
  };

  return (
    <section style={sectionBg(backgroundColor)} className="py-14 px-4 sm:px-6 lg:px-8 bg-catalogue-bg-subtle">
      <div className="mx-auto max-w-lg text-center">
        {heading && <h3 className={`mb-2 text-2xl font-bold ${txt.heading}`}>{heading}</h3>}
        {subheading && <p className={`mb-6 ${txt.muted}`}>{subheading}</p>}
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
              className="flex-1 rounded-lg border border-catalogue-border bg-catalogue-bg px-4 py-3 text-sm outline-none transition focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20"
            />
            <button
              type="submit"
              className="rounded-lg px-6 py-3 text-sm font-semibold text-white transition hover:opacity-90 active:scale-[0.98]"
              style={{ backgroundColor: 'hsl(var(--primary-500, 217 91% 60%))' }}
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

const StepsProcessRenderer: React.FC<any> = ({ headerText, subheading, layout = 'horizontal', steps = [], connectorStyle = 'line', backgroundColor, accentColor, variant = 'plain', nodeStyle = 'number', connectorGradient = false }) => {
  const accent = accentColor || 'hsl(var(--primary-500, 217 91% 60%))';
  const isHorizontal = layout !== 'vertical';
  const txt = sectionText(backgroundColor);

  // Node bubble per nodeStyle: numbered circle (default), icon, or plain dot.
  const nodeEl = (step: any, i: number, highlight: boolean) => {
    if (nodeStyle === 'dot') {
      return (
        <span
          className="mt-1.5 block h-3.5 w-3.5 shrink-0 rounded-full border-2 border-catalogue-bg shadow-sm"
          style={{ backgroundColor: accent }}
          aria-hidden="true"
        />
      );
    }
    const IconComp = nodeStyle === 'icon' && step.icon ? FEATURE_ICON_MAP[step.icon] : undefined;
    return (
      <span
        className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-base font-bold text-white shadow-md ${highlight ? 'ring-4 ring-primary-200' : ''}`}
        style={{ backgroundColor: accent }}
      >
        {IconComp ? <IconComp size={20} weight="bold" aria-hidden="true" /> : (nodeStyle === 'icon' && step.icon) ? step.icon : step.number || i + 1}
      </span>
    );
  };

  // Step body card used by the timeline variants.
  const stepCard = (step: any, i: number, highlight: boolean) => {
    const chips: string[] = (step.chips || []).filter(Boolean);
    return (
      <div className={`rounded-xl border p-5 shadow-sm ${highlight ? 'border-primary-200 bg-primary-50' : 'border-catalogue-border-subtle bg-catalogue-bg'}`}>
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h4 className="text-lg font-semibold text-catalogue-text-primary">{step.title}</h4>
          {step.meta && <span className="text-xs font-medium uppercase tracking-wide text-catalogue-text-muted">{step.meta}</span>}
        </div>
        {chips.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {chips.map((c: string, j: number) => (
              <span key={j} className="catalogue-badge catalogue-badge-primary rounded-full">{c}</span>
            ))}
          </div>
        )}
        {step.description && <p className="mt-2 text-sm leading-relaxed text-catalogue-text-secondary">{step.description}</p>}
      </div>
    );
  };

  const railStyle: React.CSSProperties = {
    background: connectorGradient
      ? `linear-gradient(to bottom, ${accent}, transparent)`
      : 'hsl(var(--catalogue-border))',
  };

  if (variant === 'timeline-cards' || variant === 'alternating') {
    const isAlt = variant === 'alternating';
    return (
      <section style={sectionBg(backgroundColor)} className="py-16 px-4 sm:px-6 lg:px-8 bg-catalogue-bg">
        <div className="mx-auto max-w-4xl">
          {headerText && <h2 className={`mb-2 text-center text-3xl font-bold ${txt.heading}`}>{headerText}</h2>}
          {subheading && <p className={`mb-10 text-center text-lg ${txt.muted}`}>{subheading}</p>}
          <div className="relative">
            {/* Rail: left on mobile/timeline, centered on desktop alternating */}
            <div
              className={`absolute bottom-0 top-0 w-0.5 ${isAlt ? 'start-5 md:start-1/2 md:-translate-x-1/2' : 'start-5'}`}
              style={railStyle}
              aria-hidden="true"
            />
            <div className="space-y-8">
              {steps.map((step: any, i: number) => {
                const highlight = step.state === 'highlight';
                const onRight = isAlt && i % 2 === 1;
                return (
                  <div key={i} data-stagger-item style={{ ['--stagger-i' as any]: i }} className="relative">
                    {/* Mobile / timeline-cards: node on the left rail, card beside it */}
                    <div className={`flex items-start gap-4 ${isAlt ? 'md:hidden' : ''}`}>
                      <span className="relative z-10 flex w-10 justify-center">{nodeEl(step, i, highlight)}</span>
                      <div className="min-w-0 flex-1">{stepCard(step, i, highlight)}</div>
                    </div>
                    {/* Desktop alternating: zigzag around the center rail */}
                    {isAlt && (
                      <div className="hidden md:grid md:grid-cols-[1fr_auto_1fr] md:items-start md:gap-4">
                        <div className={onRight ? '' : 'md:order-1'}>{onRight ? null : stepCard(step, i, highlight)}</div>
                        <span className="relative z-10 md:order-2">{nodeEl(step, i, highlight)}</span>
                        <div className={onRight ? 'md:order-3' : ''}>{onRight ? stepCard(step, i, highlight) : null}</div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </section>
    );
  }

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
      <div className="ms-5 flex justify-center" style={{ height: 24 }}>
        <div className="w-0.5" style={{
          height: '100%',
          background: connectorStyle === 'dashed' ? `repeating-linear-gradient(to bottom, ${accent} 0, ${accent} 6px, transparent 6px, transparent 12px)` : accent,
        }} />
      </div>
    );
  };

  return (
    <section style={sectionBg(backgroundColor)} className="py-16 px-4 sm:px-6 lg:px-8 bg-catalogue-bg">
      <div className="mx-auto max-w-5xl">
        {headerText && <h2 className={`mb-2 text-center text-3xl font-bold ${txt.heading}`}>{headerText}</h2>}
        {subheading && <p className={`mb-10 text-center text-lg ${txt.muted}`}>{subheading}</p>}
        <div className={isHorizontal ? 'flex flex-col sm:flex-row items-start justify-center' : 'flex flex-col'}>
          {steps.map((step: any, i: number) => (
            <React.Fragment key={i}>
              <div data-stagger-item style={{ ['--stagger-i' as any]: i }} className={`flex ${isHorizontal ? 'flex-1 flex-col items-center text-center' : 'items-start gap-4'}`}>
                <div
                  className="mb-3 flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-base font-bold text-white shadow-md"
                  style={{ backgroundColor: accent }}
                >
                  {step.icon || step.number || i + 1}
                </div>
                <div className={isHorizontal ? '' : 'pt-1'}>
                  <h4 className={`text-lg font-semibold ${txt.heading}`}>{step.title}</h4>
                  <p className={`mt-1 text-sm leading-relaxed ${txt.muted}`}>{step.description}</p>
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

/** Live prefers-reduced-motion — configured entrance animations must respect
 *  it (WCAG 2.3.3): content shows immediately with zero motion when set. */
const usePrefersReducedMotion = (): boolean => {
  const [reduced, setReduced] = useState(
    () =>
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true,
  );
  useEffect(() => {
    const mq = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    if (!mq) return;
    const onChange = (e: MediaQueryListEvent) => setReduced(e.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);
  return reduced;
};

const ComponentStyleWrapper: React.FC<{
  component: any;
  componentStyle: React.CSSProperties;
  responsiveCSS: string;
  hoverClass: string;
  motionOff?: boolean;
  children: React.ReactNode;
}> = ({ component, componentStyle, responsiveCSS, hoverClass, motionOff, children }) => {
  const ref = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(false);
  const prefersReducedMotion = usePrefersReducedMotion();

  const entrance = component.style?.animation?.entrance;
  // motionOff = global motion personality 'none' — kills entrances, authored
  // delays and stagger ramps entirely (the duration token alone can't: delay
  // ms values live outside it and fill:both hides content during the delay).
  const hasEntrance = !prefersReducedMotion && !motionOff && entrance?.type && entrance.type !== 'none';
  const hasOverlay = component.style?.backgroundImage && component.style?.backgroundOverlay;
  const shell = hasSectionShell(component.style);
  const decor = hasDecorations(component.style?.ornaments, component.style?.dividers);
  // Ornaments can bleed past the box (blobs at negative offsets) — clip them.
  const decorClip = component.style?.ornaments?.length ? { overflow: 'hidden' as const } : {};

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

  // Stagger: cascade the entrance across child items (data-stagger-item)
  // instead of animating the whole section as one block. If the rendered
  // markup has no marked items (renderer without markers, marquee layout),
  // degrade to a normal whole-section entrance instead of animating nothing.
  const stagger = hasEntrance ? entrance?.stagger : undefined;
  const staggerEnabled = !!(stagger && stagger.interval > 0);
  const [hasStaggerItems, setHasStaggerItems] = useState(true);
  useLayoutEffect(() => {
    if (staggerEnabled) setHasStaggerItems(!!ref.current?.querySelector('[data-stagger-item]'));
  }, [staggerEnabled]);
  const hasStagger = staggerEnabled && hasStaggerItems;

  // duration must be nullish-checked: an explicit 0 means "instant", not "use token"
  const durationCss = entrance?.duration != null ? `${entrance.duration}ms` : 'var(--catalogue-motion-duration-md, 600ms)';

  const animationStyle: React.CSSProperties = hasEntrance && !hasStagger
    ? isVisible
      ? {
          animation: `catalogue-${entrance!.type} ${durationCss} ${entrance!.easing ?? 'var(--catalogue-motion-ease, ease-out)'} ${entrance!.delay ?? 0}ms both`,
        }
      : { opacity: 0 }
    : {};

  const staggerCSS = hasStagger
    ? `
[data-cid="${component.id}"] [data-stagger-item] { opacity: 0; }
[data-cid="${component.id}"].catalogue-stagger-go [data-stagger-item] {
  animation: catalogue-${entrance!.type} ${durationCss} ${entrance!.easing ?? 'var(--catalogue-motion-ease, ease-out)'} both;
  animation-delay: calc(${entrance!.delay ?? 0}ms + min(var(--stagger-i, 0), ${stagger!.maxItems ?? 8}) * ${stagger!.interval}ms);
}
@media (prefers-reduced-motion: reduce) {
  [data-cid="${component.id}"] [data-stagger-item] { opacity: 1 !important; animation: none !important; }
}`
    : '';
  const staggerClass = hasStagger && isVisible ? 'catalogue-stagger-go' : '';

  // Section-shell path: full-width background canvas + contained content
  // column. Opt-in via style.layout; legacy configs never reach this branch.
  if (shell) {
    const { canvasStyle, contentStyle } = buildSectionShellStyles(component.style);
    return (
      <div
        ref={ref}
        id={component.anchorId || undefined}
        data-cid={component.id}
        className={`${component.style?.customClass || ''} ${hoverClass} ${staggerClass}`}
        style={{ ...canvasStyle, ...animationStyle, ...decorClip }}
      >
        {responsiveCSS && <style dangerouslySetInnerHTML={{ __html: responsiveCSS }} />}
        {staggerCSS && <style dangerouslySetInnerHTML={{ __html: staggerCSS }} />}
        {hasOverlay && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              backgroundColor: component.style!.backgroundOverlay,
              zIndex: 0,
              borderRadius: canvasStyle.borderRadius,
            }}
          />
        )}
        {decor && <SectionDecorations ornaments={component.style?.ornaments} dividers={component.style?.dividers} />}
        <div style={{ ...contentStyle, position: 'relative', zIndex: 1 }}>
          {children}
        </div>
      </div>
    );
  }

  return (
    <div
      ref={ref}
      id={component.anchorId || undefined}
      data-cid={component.id}
      className={`${component.style?.customClass || ''} ${hoverClass} ${staggerClass}`}
      style={{
        ...componentStyle,
        ...animationStyle,
        // Preserve engine-emitted position (sticky rails); otherwise only go
        // positioned when overlay/decoration children need an anchor.
        position: (componentStyle.position as React.CSSProperties['position']) ?? (hasOverlay || decor ? 'relative' : undefined),
        ...decorClip,
      }}
    >
      {responsiveCSS && <style dangerouslySetInnerHTML={{ __html: responsiveCSS }} />}
      {staggerCSS && <style dangerouslySetInnerHTML={{ __html: staggerCSS }} />}
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
      {decor && <SectionDecorations ornaments={component.style?.ornaments} dividers={component.style?.dividers} />}
      <div style={{ position: hasOverlay || decor ? 'relative' : undefined, zIndex: hasOverlay || decor ? 1 : undefined }}>
        {children}
      </div>
    </div>
  );
};
