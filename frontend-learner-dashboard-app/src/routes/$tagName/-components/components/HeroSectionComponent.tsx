import React, { useState, useEffect, useMemo } from "react";
import { useNavigate } from "@tanstack/react-router";
import { getPublicUrlWithoutLogin } from "@/services/upload_file";

interface HeroSectionProps {
  layout: "split" | "centered";
  backgroundImage?: string;
  backgroundColor?: string;
  left?: {
    title?: string;
    description?: string;
    button?: {
      text: string;
      action: string;
      target: string;
      enabled?: boolean;
      backgroundColor?: string;
    };
  };
  right?: {
    image?: string;
    alt?: string;
  };
  styles?: {
    padding?: string;
    backgroundColor?: string;
    roundedEdges?: boolean;
    textAlign?: "left" | "center" | "right";
  };
  courseData?: {
    title?: string;
    description?: string | null;
    previewImage?: string;
    bannerImage?: string;
    duration?: string;
    instructor?: string;
  };
}

// Centralized enabled check - defaults to false if not provided
const isHeroButtonEnabled = (button?: { enabled?: boolean | string | number }) => {
  if (!button) return false;
  const { enabled } = button;
  if (enabled === undefined || enabled === null) return false;
  if (typeof enabled === "string") return enabled.toLowerCase() === "true";
  if (typeof enabled === "number") return enabled !== 0;
  return enabled === true;
};

// Check if image URL is a placeholder or invalid
const isPlaceholderImage = (imageUrl?: string | null): boolean => {
  if (!imageUrl) return true;
  const trimmed = imageUrl.trim();
  if (trimmed === '' || trimmed === 'null' || trimmed === 'undefined') return true;
  if (trimmed.includes('/api/placeholder/')) return true;
  if (['course_banner_media_id', 'course_preview_image_media_id', 'thumbnail_file_id'].includes(trimmed)) return true;
  // Raw media ID check (contains underscores, no http/https, no slashes)
  if (trimmed.includes('_') && !trimmed.includes('http') && !trimmed.includes('/')) return true;
  return false;
};

export const HeroSectionComponent: React.FC<HeroSectionProps> = ({
  layout,
  backgroundImage,
  backgroundColor,
  left,
  right,
  styles = {},
  courseData,
}) => {
  const { roundedEdges = false, textAlign = "left" } = styles;

  return useMemo(() => {
    const heroTitle = courseData?.title || left?.title || "";
    const heroDescription = (courseData?.description?.trim()) ? courseData.description : (left?.description?.trim() || "");
    const heroImage = courseData?.previewImage || courseData?.bannerImage || right?.image || "";
    const heroImageAlt = right?.alt || courseData?.title || "Course preview";
    const isHeroImagePlaceholder = isPlaceholderImage(heroImage);
    const isBackgroundImagePlaceholder = isPlaceholderImage(backgroundImage);

    const commonProps = {
      layout,
      left,
      right,
      courseData,
      heroTitle,
      heroDescription,
      heroImageAlt,
      roundedEdges,
      textAlign,
      backgroundColor,
    };

    if (isHeroImagePlaceholder) {
      return <HeroSectionPlaceholder {...commonProps} />;
    }

    return (
      <HeroSectionWithState 
        {...commonProps}
        heroImage={heroImage}
        heroBackgroundImage={backgroundImage}
        isHeroImagePlaceholder={isHeroImagePlaceholder}
        isBackgroundImagePlaceholder={isBackgroundImagePlaceholder}
      />
    );
  }, [layout, backgroundImage, left, right, courseData, roundedEdges, textAlign]);
};

// Placeholder component - no state management
const HeroSectionPlaceholder: React.FC<{
  layout: "split" | "centered";
  left?: HeroSectionProps['left'];
  heroTitle: string;
  heroDescription: string;
  heroImageAlt: string;
  roundedEdges: boolean;
  textAlign: "left" | "center" | "right";
  right?: HeroSectionProps['right'];
  courseData?: HeroSectionProps['courseData'];
  backgroundColor?: string;
}> = ({
  layout,
  left,
  courseData,
  heroTitle,
  heroDescription,
  roundedEdges,
  textAlign,
  backgroundColor,
}) => {
  const navigate = useNavigate();

  const handleButtonClick = (button: { action: string; target: string }) => {
    if (button.action === "navigate" && button.target) {
      navigate({ to: button.target });
    } else if (button.action === "openLeadCollection") {
      window.dispatchEvent(new CustomEvent('openLeadCollection', { detail: { source: 'heroSection' } }));
    }
  };

  return (
    <section
      className={`w-full py-12 md:py-20 ${roundedEdges ? "rounded-lg" : ""} overflow-hidden`}
      style={{ textAlign, backgroundColor: backgroundColor || '#f8fafc' }}
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {layout === "split" ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12 items-center">
            {/* Left Content */}
            {(left || courseData) && (
              <div className="space-y-5">
                {heroTitle && (
                  <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-gray-900 leading-tight">
                    {heroTitle}
                  </h1>
                )}
                {heroDescription && (
                  <div
                    className="text-lg sm:text-xl text-gray-600 leading-relaxed"
                    dangerouslySetInnerHTML={{ __html: heroDescription }}
                  />
                )}
                {isHeroButtonEnabled(left?.button) && left?.button && (
                  <button
                    onClick={() => handleButtonClick(left.button!)}
                    className="mt-3 px-8 py-3.5 rounded-lg text-base font-semibold text-white transition-all duration-200 hover:opacity-90 active:scale-[0.98] shadow-md"
                    style={{ backgroundColor: left.button.backgroundColor || 'var(--primary-500, #3B82F6)' }}
                  >
                    {left.button.text}
                  </button>
                )}
              </div>
            )}
          </div>
        ) : (
          /* Centered Layout */
          <div className="text-center space-y-5 max-w-3xl mx-auto">
            {(left || courseData) && (
              <>
                {heroTitle && (
                  <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-gray-900 leading-tight">
                    {heroTitle}
                  </h1>
                )}
                {heroDescription && (
                  <div
                    className="text-lg sm:text-xl text-gray-600 leading-relaxed"
                    dangerouslySetInnerHTML={{ __html: heroDescription }}
                  />
                )}
                {isHeroButtonEnabled(left?.button) && left?.button && (
                  <button
                    onClick={() => handleButtonClick(left.button!)}
                    className="mt-3 px-8 py-3.5 rounded-lg text-base font-semibold text-white transition-all duration-200 hover:opacity-90 active:scale-[0.98] shadow-md"
                    style={{ backgroundColor: left.button.backgroundColor || 'var(--primary-500, #3B82F6)' }}
                  >
                    {left.button.text}
                  </button>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </section>
  );
};

// State management component - for valid images
const HeroSectionWithState: React.FC<{
  layout: "split" | "centered";
  left?: HeroSectionProps['left'];
  right?: HeroSectionProps['right'];
  courseData?: HeroSectionProps['courseData'];
  heroImage: string;
  heroImageAlt: string;
  heroBackgroundImage?: string;
  isHeroImagePlaceholder: boolean;
  isBackgroundImagePlaceholder: boolean;
  roundedEdges: boolean;
  textAlign: "left" | "center" | "right";
  heroTitle: string;
  heroDescription: string;
  backgroundColor?: string;
}> = ({
  layout,
  left,
  right,
  courseData,
  heroImage,
  heroImageAlt,
  isHeroImagePlaceholder,
  isBackgroundImagePlaceholder,
  heroBackgroundImage,
  roundedEdges,
  textAlign,
  heroTitle,
  heroDescription,
  backgroundColor,
}) => {
  const navigate = useNavigate();
  const [resolvedImageUrl, setResolvedImageUrl] = useState<string>(heroImage);
  const [resolvedBgUrl, setResolvedBgUrl] = useState<string | null>(heroBackgroundImage || null);

  // Resolve image URLs
  useEffect(() => {
    if (isHeroImagePlaceholder && isBackgroundImagePlaceholder) return;

    let isMounted = true;
    
    const resolveImageUrl = async (imageUrl: string) => {
      if (!imageUrl || imageUrl.includes('/api/placeholder/') || imageUrl.includes('http')) {
        return imageUrl;
      }
      try {
        const resolvedUrl = await getPublicUrlWithoutLogin(imageUrl);
        return resolvedUrl || imageUrl;
      } catch {
        return imageUrl;
      }
    };

    const loadImages = async () => {
      if (!isHeroImagePlaceholder) {
        const resolvedUrl = await resolveImageUrl(heroImage);
        if (isMounted) setResolvedImageUrl(resolvedUrl);
      }
      if (!isBackgroundImagePlaceholder && heroBackgroundImage) {
        const resolvedBg = await resolveImageUrl(heroBackgroundImage);
        if (isMounted) setResolvedBgUrl(resolvedBg);
      }
    };

    loadImages();
    return () => { isMounted = false; };
  }, [heroImage, heroBackgroundImage, isHeroImagePlaceholder, isBackgroundImagePlaceholder]);

  const handleButtonClick = (button: { action: string; target: string }) => {
    if (button.action === "navigate" && button.target) {
      navigate({ to: button.target });
    } else if (button.action === "openLeadCollection") {
      window.dispatchEvent(new CustomEvent('openLeadCollection', { detail: { source: 'heroSection' } }));
    }
  };

  const hasBgImage = !!(resolvedBgUrl && !isBackgroundImagePlaceholder);

  return (
    <section
      className={`w-full py-12 md:py-20 ${roundedEdges ? "rounded-lg" : ""} overflow-hidden`}
      style={{
        textAlign,
        backgroundColor: hasBgImage ? undefined : (backgroundColor || '#f8fafc'),
        ...(hasBgImage ? {
          backgroundImage: `url(${resolvedBgUrl})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        } : {}),
      }}
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {layout === "split" ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12 items-center">
            {/* Left Content */}
            {(left || courseData) && (
              <div className="space-y-5">
                {heroTitle && (
                  <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-gray-900 leading-tight">
                    {heroTitle}
                  </h1>
                )}
                {heroDescription && (
                  <div
                    className="text-lg sm:text-xl text-gray-600 leading-relaxed"
                    dangerouslySetInnerHTML={{ __html: heroDescription }}
                  />
                )}
                {isHeroButtonEnabled(left?.button) && left?.button && (
                  <button
                    onClick={() => handleButtonClick(left.button!)}
                    className="mt-3 px-8 py-3.5 rounded-lg text-base font-semibold text-white transition-all duration-200 hover:opacity-90 active:scale-[0.98] shadow-md"
                    style={{ backgroundColor: left.button.backgroundColor || 'var(--primary-500, #3B82F6)' }}
                  >
                    {left.button.text}
                  </button>
                )}
              </div>
            )}

            {/* Right Content - Image */}
            {(right || courseData) && heroImage && !isHeroImagePlaceholder && (
              <div className="flex justify-center lg:justify-end">
                <img
                  src={resolvedImageUrl || heroImage}
                  alt={heroImageAlt}
                  className="w-full h-auto max-h-[400px] lg:max-h-[480px] rounded-xl object-contain"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none';
                  }}
                />
              </div>
            )}
          </div>
        ) : (
          /* Centered Layout */
          <div className="text-center space-y-5 max-w-3xl mx-auto">
            {(left || courseData) && (
              <>
                {heroTitle && (
                  <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-gray-900 leading-tight">
                    {heroTitle}
                  </h1>
                )}
                {heroDescription && (
                  <div
                    className="text-lg sm:text-xl text-gray-600 leading-relaxed"
                    dangerouslySetInnerHTML={{ __html: heroDescription }}
                  />
                )}
                {isHeroButtonEnabled(left?.button) && left?.button && (
                  <button
                    onClick={() => handleButtonClick(left.button!)}
                    className="mt-3 px-8 py-3.5 rounded-lg text-base font-semibold text-white transition-all duration-200 hover:opacity-90 active:scale-[0.98] shadow-md"
                    style={{ backgroundColor: left.button.backgroundColor || 'var(--primary-500, #3B82F6)' }}
                  >
                    {left.button.text}
                  </button>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </section>
  );
};
