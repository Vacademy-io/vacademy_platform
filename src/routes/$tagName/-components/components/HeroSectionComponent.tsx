import React, { useState, useEffect, useMemo } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useDomainRouting } from "@/hooks/use-domain-routing";
// import { useTheme } from "@/hooks/use-theme"; // Not available
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
const isHeroButtonEnabled = (button?: { enabled?: boolean | string | number }) => {
  if (!button) return false;
  const { enabled } = button;
  if (enabled === undefined || enabled === null) {
    return true;
  }
  if (typeof enabled === "string") {
    return enabled.toLowerCase() === "true";
  }
  if (typeof enabled === "number") {
    return enabled !== 0;
  }
  return enabled === true;
};
export const HeroSectionComponent: React.FC<HeroSectionProps> = ({
  layout,
  backgroundImage,
  backgroundColor: jsonBackgroundColor, // Rename to avoid confusion
  left,
  right,
  styles = {},
  courseData,
}) => {
  const domainRouting = useDomainRouting();
  // const { primaryColor } = useTheme(); // Not available
  const primaryColor = "primary"; // Default theme color
  const {
    padding = "40px",
    roundedEdges = true,
    textAlign = "left",
  } = styles;

  // Memoize the component to prevent unnecessary re-renders
  return useMemo(() => {
  // Use course data if available, otherwise fall back to props
  const heroTitle = courseData?.title || left?.title || "";
    // Only use courseData.description if it's explicitly provided and not empty, otherwise don't show description
    const heroDescription = (courseData?.description && courseData.description.trim() !== "") ? courseData.description : "";
    
  const heroImage = courseData?.previewImage || courseData?.bannerImage || right?.image || "";
  const heroImageAlt = right?.alt || courseData?.title || "Course preview";
  const heroBackgroundImage = backgroundImage;



    // Check if images are placeholders or invalid URLs
    const isHeroImagePlaceholder = !heroImage || 
      heroImage === null || 
      heroImage === undefined ||
      heroImage.includes('/api/placeholder/') || 
      heroImage.trim() === '' ||
      heroImage === 'null' ||
      heroImage === 'undefined' ||
      // Check if it looks like a raw media ID (contains underscores, no http/https, no slashes)
      (heroImage.includes('_') && !heroImage.includes('http') && !heroImage.includes('/'));

    const isBackgroundImagePlaceholder = !heroBackgroundImage || 
      heroBackgroundImage === null || 
      heroBackgroundImage === undefined ||
      heroBackgroundImage.includes('/api/placeholder/') || 
      heroBackgroundImage.trim() === '' ||
      heroBackgroundImage === 'null' ||
      heroBackgroundImage === 'undefined' ||
      heroBackgroundImage === 'course_banner_media_id' ||
      heroBackgroundImage === 'course_preview_image_media_id' ||
      heroBackgroundImage === 'thumbnail_file_id' ||
      // Check if it looks like a raw media ID (contains underscores, no http/https, no slashes)
      (heroBackgroundImage.includes('_') && !heroBackgroundImage.includes('http') && !heroBackgroundImage.includes('/'));



    // If hero image is a placeholder, render directly without any state management
    // (We don't need to check background image since we're not using it for now)
    if (isHeroImagePlaceholder) {
      return <HeroSectionPlaceholder 
        layout={layout}
        left={left}
        right={right}
        styles={styles}
        courseData={courseData}
        heroTitle={heroTitle}
        heroDescription={heroDescription}
        heroImageAlt={heroImageAlt}
        domainRouting={domainRouting}
        primaryColor={primaryColor}
        padding={padding}
        roundedEdges={roundedEdges}
        textAlign={textAlign}
      />;
    }

    // For valid images, use the full component with state management
    return <HeroSectionWithState 
      layout={layout}
      backgroundImage={backgroundImage}
      backgroundColor={jsonBackgroundColor}
      left={left}
      right={right}
      styles={styles}
      courseData={courseData}
      heroImage={heroImage}
      heroImageAlt={heroImageAlt}
      heroBackgroundImage={heroBackgroundImage}
      isHeroImagePlaceholder={isHeroImagePlaceholder}
      isBackgroundImagePlaceholder={isBackgroundImagePlaceholder}
      domainRouting={domainRouting}
      primaryColor={primaryColor}
      padding={padding}
      roundedEdges={roundedEdges}
      textAlign={textAlign}
    />;
  }, [
    layout,
    backgroundImage,
    jsonBackgroundColor,
    left,
    right,
    styles,
    courseData,
    domainRouting,
    primaryColor,
    padding,
    roundedEdges,
    textAlign
  ]);
};

// Placeholder component - no state management, direct rendering
const HeroSectionPlaceholder: React.FC<any> = ({
  layout,
  left,
  right,
  courseData,
  heroTitle,
  heroDescription,
  heroImageAlt,
  domainRouting,
  primaryColor,
  padding,
  roundedEdges,
  textAlign,
}) => {
  const navigate = useNavigate();
  
  // Force theme color - ignore JSON backgroundColor completely
  const finalBackgroundColor = primaryColor !== "neutral" ? `hsl(var(--primary) / 0.2)` : "rgb(191 219 254)";

  const handleButtonClick = (button: { text: string; action: string; target: string }) => {
    switch (button.action) {
      case "navigate":
        if (button.target) {
          navigate({ to: button.target });
        }
        break;
      case "openLeadCollection":
        // Dispatch custom event to open lead collection
        const event = new CustomEvent('openLeadCollection', {
          detail: { source: 'heroSection' }
        });
        window.dispatchEvent(event);
        break;
      default:
        break;
    }
  };

  return (
    <section
      className={`w-full min-h-[400px] ${roundedEdges ? "rounded-lg" : ""} overflow-hidden flex items-center justify-center`}
      style={{
        padding,
        backgroundColor: finalBackgroundColor,
        textAlign,
      }}
    >
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        {layout === "split" ? (
          /* Split Layout */
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12 items-center">
            {/* Left Content */}
            {(left || courseData) && (
              <div className="space-y-6">
                {heroTitle && (
                  <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-gray-900 leading-tight">
                    {heroTitle}
                  </h1>
                )}
                {heroDescription && (
                  <p className="text-lg sm:text-xl text-gray-600 leading-relaxed">
                    {heroDescription}
                  </p>
                )}
                {isHeroButtonEnabled(left?.button) && (
                  <button
                    onClick={() => handleButtonClick(left!.button!)}
                    className="text-white px-6 py-3 rounded-lg font-semibold transition-colors"
                    style={{
                      backgroundColor: left.button.backgroundColor || (domainRouting.instituteThemeCode ? `hsl(var(--primary))` : "#2563eb"),
                    }}
                    onMouseEnter={(e) => {
                      if (left.button?.backgroundColor) {
                        e.currentTarget.style.opacity = "0.9";
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (left.button?.backgroundColor) {
                        e.currentTarget.style.opacity = "1";
                      }
                    }}
                  >
                    {left.button.text}
                  </button>
                )}
              </div>
            )}

            {/* Right Content - Don't render image if no valid image */}
            {/* Note: This section is intentionally left empty to avoid showing placeholder images */}
          </div>
        ) : (
          /* Centered Layout */
          <div className="text-center space-y-6">
            {(left || courseData) && (
              <>
                <h1 className="text-4xl lg:text-5xl font-bold text-gray-900">
                  {heroTitle}
                </h1>
                {heroDescription && (
                  <p className="text-xl text-gray-600 max-w-3xl mx-auto">
                    {heroDescription}
                  </p>
                )}
                {isHeroButtonEnabled(left?.button) && (
                  <button
                    onClick={() => handleButtonClick(left!.button!)}
                    className="text-white px-8 py-4 rounded-lg font-semibold text-lg transition-colors"
                    style={{
                      backgroundColor: left.button.backgroundColor || (domainRouting.instituteThemeCode ? `hsl(var(--primary))` : "#2563eb"),
                    }}
                    onMouseEnter={(e) => {
                      if (left.button?.backgroundColor) {
                        e.currentTarget.style.opacity = "0.9";
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (left.button?.backgroundColor) {
                        e.currentTarget.style.opacity = "1";
                      }
                    }}
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

// State management component - only for valid images
const HeroSectionWithState: React.FC<any> = ({
  layout,
  left,
  right,
  courseData,
  heroImage,
  heroImageAlt,
  heroBackgroundImage,
  isHeroImagePlaceholder,
  isBackgroundImagePlaceholder,
  domainRouting,
  primaryColor,
  padding,
  roundedEdges,
  textAlign,
}) => {
  const navigate = useNavigate();
 
  // State for resolved URLs - only needed for valid images
  const [resolvedImageUrl, setResolvedImageUrl] = useState<string>("/api/placeholder/400/300");

  // Use course data if available, otherwise fall back to props
  const heroTitle = courseData?.title || left?.title || "";
  const heroDescription = (courseData?.description && courseData.description.trim() !== "") ? courseData.description : "";

  // Force theme color - ignore JSON backgroundColor completely
  const finalBackgroundColor = primaryColor !== "neutral" ? `hsl(var(--primary) / 0.2)` : "rgb(191 219 254)";

  // Resolve image URLs - only for valid images
  useEffect(() => {
    // If both images are placeholders, don't run the effect
    if (isHeroImagePlaceholder && isBackgroundImagePlaceholder) {
      return;
    }

    let isMounted = true;
    
    const resolveImageUrl = async (imageUrl: string) => {
      if (!imageUrl || imageUrl.includes('/api/placeholder/') || imageUrl.includes('http')) {
        return imageUrl;
      }
      
      try {
        const resolvedUrl = await getPublicUrlWithoutLogin(imageUrl);
        return resolvedUrl || imageUrl;
      } catch (error) {
        console.error("Error resolving image URL:", error);
        return imageUrl;
      }
    };

    const loadImages = async () => {
      // Handle hero image - only if it's not a placeholder
      if (!isHeroImagePlaceholder) {
        const resolvedUrl = await resolveImageUrl(heroImage);
        if (isMounted) {
          setResolvedImageUrl(resolvedUrl);
        }
      }

      // Handle background image - only if it's not a placeholder
      if (!isBackgroundImagePlaceholder) {
        await resolveImageUrl(heroBackgroundImage);
      }
    };

    loadImages();
    return () => { isMounted = false; };
  }, [heroImage, heroBackgroundImage, isHeroImagePlaceholder, isBackgroundImagePlaceholder]);

  const handleButtonClick = (button: { text: string; action: string; target: string }) => {
    switch (button.action) {
      case "navigate":
        if (button.target) {
        navigate({ to: button.target });
        }
        break;
      case "openLeadCollection":
        // Dispatch custom event to open lead collection
        const event = new CustomEvent('openLeadCollection', {
          detail: { source: 'heroSection' }
        });
        window.dispatchEvent(event);
        break;
      default:
        break;
    }
  };

  return (
    <section
      className={`w-full min-h-[calc(100vh-5rem)] ${roundedEdges ? "rounded-lg" : ""} overflow-hidden flex items-center justify-center md:min-h-screen`}
      style={{
        padding,
        backgroundColor: finalBackgroundColor,
        textAlign,
      }}
    >
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        {layout === "split" ? (
          /* Split Layout */
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12 items-center">
            {/* Left Content */}
            {(left || courseData) && (
              <div className="space-y-6">
                {heroTitle && (
                  <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-gray-900 leading-tight">
                  {heroTitle}
                </h1>
                )}
                {heroDescription && (
                  <p className="text-lg sm:text-xl text-gray-600 leading-relaxed">
                  {heroDescription}
                </p>
                )}
                {isHeroButtonEnabled(left?.button) && (
                  <button
                    onClick={() => handleButtonClick(left!.button!)}
                    className="text-white px-6 py-3 rounded-lg font-semibold transition-colors"
                    style={{
                      backgroundColor: left.button.backgroundColor || (domainRouting.instituteThemeCode ? `hsl(var(--primary))` : "#2563eb"),
                    }}
                    onMouseEnter={(e) => {
                      if (left.button?.backgroundColor) {
                        e.currentTarget.style.opacity = "0.9";
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (left.button?.backgroundColor) {
                        e.currentTarget.style.opacity = "1";
                      }
                    }}
                  >
                    {left.button.text}
                  </button>
                )}
              </div>
            )}

            {/* Right Content - Only render if we have a valid image */}
            {(right || courseData) && heroImage && !isHeroImagePlaceholder && (
              <div className="flex justify-center">
                  <img
                  src={resolvedImageUrl || heroImage}
                    alt={heroImageAlt}
                    className="max-w-full h-auto rounded-lg shadow-lg"
                    onError={() => {
                      // Don't show placeholder on error, just hide the image
                    }}
                  />
              </div>
            )}
          </div>
        ) : (
          /* Centered Layout */
          <div className="text-center space-y-6">
            {(left || courseData) && (
              <>
                <h1 className="text-4xl lg:text-5xl font-bold text-gray-900">
                  {heroTitle}
                </h1>
                {heroDescription && (
                  <p className="text-xl text-gray-600 max-w-3xl mx-auto">
                  {heroDescription}
                </p>
                )}
                {isHeroButtonEnabled(left?.button) && (
                  <button
                    onClick={() => handleButtonClick(left!.button!)}
                    className="text-white px-8 py-4 rounded-lg font-semibold text-lg transition-colors"
                    style={{
                      backgroundColor: left.button.backgroundColor || (domainRouting.instituteThemeCode ? `hsl(var(--primary))` : "#2563eb"),
                    }}
                    onMouseEnter={(e) => {
                      if (left.button?.backgroundColor) {
                        e.currentTarget.style.opacity = "0.9";
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (left.button?.backgroundColor) {
                        e.currentTarget.style.opacity = "1";
                      }
                    }}
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
