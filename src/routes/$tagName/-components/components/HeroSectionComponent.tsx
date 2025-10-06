import React, { useState, useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";
import { getPublicUrlWithoutLogin } from "@/services/upload_file";
import { useDomainRouting } from "@/hooks/use-domain-routing";

interface HeroSectionProps {
  layout: "split" | "centered";
  backgroundImage?: string;
  backgroundColor?: string;
  left?: {
    title: string;
    description: string;
    button?: {
      enabled?: boolean;
      text: string;
      action: string;
      target: string;
      backgroundColor?: string;
    };
  };
  right?: {
    image: string;
    alt: string;
  };
  styles?: {
    padding?: string;
    backgroundColor?: string;
    roundedEdges?: boolean;
    textAlign?: "left" | "center" | "right";
  };
  // Course data for dynamic population
  courseData?: {
    title?: string;
    description?: string;
    bannerImage?: string;
    previewImage?: string;
    price?: number;
    level?: string;
    duration?: string;
    instructor?: string;
  };
}

export const HeroSectionComponent: React.FC<HeroSectionProps> = ({
  layout,
  backgroundImage,
  backgroundColor,
  left,
  right,
  styles = {},
  courseData,
}) => {
  const navigate = useNavigate();
  const domainRouting = useDomainRouting();
  const {
    padding = "40px",
    backgroundColor: stylesBackgroundColor = "#f8fafc",
    roundedEdges = true,
    textAlign = "left",
  } = styles;

  // State for resolved URLs
  const [resolvedImageUrl, setResolvedImageUrl] = useState<string | null>(null);
  const [resolvedBackgroundUrl, setResolvedBackgroundUrl] = useState<string | null>(null);
  const [loadingImage, setLoadingImage] = useState(false);
  const [loadingBackground, setLoadingBackground] = useState(false);

  // Use course data if available, otherwise fall back to props
  const heroTitle = courseData?.title || left?.title || "";
  const heroDescription = courseData?.description || left?.description || "";
  const heroImage = courseData?.previewImage || courseData?.bannerImage || right?.image || "";
  const heroImageAlt = right?.alt || courseData?.title || "Course preview";
  const heroBackgroundImage = backgroundImage;

  // Resolve image URLs
  useEffect(() => {
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
      if (heroImage && !heroImage.includes('/api/placeholder/')) {
        setLoadingImage(true);
        const resolvedUrl = await resolveImageUrl(heroImage);
        if (isMounted) {
          setResolvedImageUrl(resolvedUrl);
          setLoadingImage(false);
        }
      } else {
        setResolvedImageUrl(heroImage);
      }

      if (heroBackgroundImage && !heroBackgroundImage.includes('/api/placeholder/')) {
        setLoadingBackground(true);
        const resolvedUrl = await resolveImageUrl(heroBackgroundImage);
        if (isMounted) {
          setResolvedBackgroundUrl(resolvedUrl);
          setLoadingBackground(false);
        }
      } else {
        setResolvedBackgroundUrl(heroBackgroundImage);
      }
    };

    loadImages();
    return () => { isMounted = false; };
  }, [heroImage, heroBackgroundImage]);

  const handleButtonClick = (button: { text: string; action: string; target: string }) => {
    
    switch (button.action) {
      case "navigate":
        // Navigate to the target route
        navigate({ to: button.target });
        break;
      case "enroll":
        // Handle enrollment action
        // This could trigger a modal or redirect to enrollment
        break;
      case "scroll":
        // Handle scroll action
        const element = document.querySelector(button.target);
        if (element) {
          element.scrollIntoView({ behavior: "smooth" });
        }
        break;
      default:
        break;
    }
  };

  return (
    <section
      className={`w-full min-h-screen ${roundedEdges ? "rounded-lg" : ""} overflow-hidden flex items-center`}
      style={{
        padding,
        backgroundColor: resolvedBackgroundUrl ? undefined : (backgroundColor || stylesBackgroundColor),
        backgroundImage: resolvedBackgroundUrl ? `url(${resolvedBackgroundUrl})` : undefined,
        backgroundSize: "cover",
        backgroundPosition: "center",
        textAlign,
      }}
    >
      <div className="container mx-auto px-4">
        {layout === "split" ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
            {/* Left Content */}
            {(left || courseData) && (
              <div className="space-y-6">
                <h1 className="text-4xl lg:text-5xl font-bold text-gray-900">
                  {heroTitle}
                </h1>
                <p className="text-lg text-gray-600">
                  {heroDescription}
                </p>
                {left?.button && left.button.enabled !== false && (
                  <button
                    onClick={() => handleButtonClick(left.button!)}
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

            {/* Right Content */}
            {(right || courseData) && heroImage && (
              <div className="flex justify-center">
                {loadingImage ? (
                  <div className="w-full h-64 bg-gray-200 flex items-center justify-center rounded-lg">
                    <div className="text-gray-400 text-sm">Loading image...</div>
                  </div>
                ) : (
                  <img
                    src={resolvedImageUrl || heroImage}
                    alt={heroImageAlt}
                    className="max-w-full h-auto rounded-lg shadow-lg"
                    onError={(e) => {
                      e.currentTarget.src = "/api/placeholder/400/300";
                    }}
                  />
                )}
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
                <p className="text-lg text-gray-600 max-w-2xl mx-auto">
                  {heroDescription}
                </p>
                {left?.button && left.button.enabled !== false && (
                  <button
                    onClick={() => handleButtonClick(left.button!)}
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
              </>
            )}
          </div>
        )}
      </div>
    </section>
  );
};
