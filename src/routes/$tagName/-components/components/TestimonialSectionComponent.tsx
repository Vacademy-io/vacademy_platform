import React, { useState, useEffect } from "react";
import { getPublicUrlWithoutLogin } from "@/services/upload_file";

interface Testimonial {
  name: string;
  role: string;
  feedback: string;
  avatar: string;
}

interface TestimonialSectionProps {
  headerText: string;
  description: string;
  layout: "grid" | "grid-scroll" | "carousel";
  testimonials: Testimonial[];
  styles?: {
    backgroundColor?: string;
    roundedEdges?: boolean;
    cardHoverEffect?: "lift" | "scale" | "shadow" | "none";
    scrollEnabled?: boolean;
  };
}

const TestimonialCard: React.FC<{ testimonial: Testimonial; hoverEffect: string }> = ({
  testimonial,
  hoverEffect 
}) => {
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [loadingAvatar, setLoadingAvatar] = useState(false);
  const [hasTriedLoading, setHasTriedLoading] = useState(false);

  useEffect(() => {
    let isMounted = true;
    
    // If we've already tried loading this URL and it failed, don't try again
    if (hasTriedLoading) {
      return;
    }
    
    const loadAvatar = async () => {
      console.log("[TestimonialCard] Loading avatar with URL:", testimonial.avatar);
      
      if (!testimonial.avatar || testimonial.avatar.includes('/api/placeholder/')) {
        console.log("[TestimonialCard] Using placeholder - no valid avatar URL");
        if (isMounted) {
          setLoadingAvatar(false);
          setAvatarUrl("/api/placeholder/60/60");
          setHasTriedLoading(true);
        }
        return;
      }

      // Check if it's already a public URL
      if (testimonial.avatar.startsWith('http://') || testimonial.avatar.startsWith('https://')) {
        console.log("[TestimonialCard] Using public URL directly:", testimonial.avatar);
        if (isMounted) {
          setLoadingAvatar(false);
          setAvatarUrl(testimonial.avatar);
          setHasTriedLoading(true);
        }
        return;
      }

      setLoadingAvatar(true);
      try {
        console.log("[TestimonialCard] Calling getPublicUrlWithoutLogin with:", testimonial.avatar);
        const url = await getPublicUrlWithoutLogin(testimonial.avatar);
        console.log("[TestimonialCard] Got URL from API:", url);
        if (isMounted) {
          setAvatarUrl(url);
          setHasTriedLoading(true);
        }
      } catch (error) {
        console.error("[TestimonialCard] Error loading avatar:", error);
        if (isMounted) {
          setAvatarUrl("/api/placeholder/60/60");
          setHasTriedLoading(true);
        }
      } finally {
        if (isMounted) {
          setLoadingAvatar(false);
        }
      }
    };

    loadAvatar();
    return () => { isMounted = false; };
  }, [testimonial.avatar, hasTriedLoading]);

  const getHoverClass = () => {
    switch (hoverEffect) {
      case "lift":
        return "hover:-translate-y-2";
      case "scale":
        return "hover:scale-105";
      case "shadow":
        return "hover:shadow-lg";
      default:
        return "";
    }
  };

  return (
    <div className={`bg-white p-6 rounded-lg shadow-md transition-all duration-300 ${getHoverClass()}`}>
      <div className="flex items-start space-x-4">
        <div className="flex-shrink-0">
          {loadingAvatar ? (
            <div className="w-12 h-12 bg-gray-200 rounded-full flex items-center justify-center">
              <div className="w-6 h-6 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin"></div>
            </div>
          ) : (
            <img
              src={avatarUrl || "/api/placeholder/60/60"}
              alt={testimonial.name}
              className="w-12 h-12 rounded-full object-cover"
              onError={(e) => {
                // Only set placeholder if we haven't already tried loading
                if (!hasTriedLoading) {
                  e.currentTarget.src = "/api/placeholder/60/60";
                }
              }}
              onLoad={() => {
                // Mark as successfully loaded
                setHasTriedLoading(true);
              }}
            />
          )}
        </div>
        <div className="flex-1">
          <blockquote className="text-gray-700 mb-4 italic">
            "{testimonial.feedback}"
          </blockquote>
          <div>
            <div className="font-semibold text-gray-900">{testimonial.name}</div>
            <div className="text-sm text-gray-600">{testimonial.role}</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export const TestimonialSectionComponent: React.FC<TestimonialSectionProps> = ({
  headerText,
  description,
  layout,
  testimonials,
  styles = {},
}) => {
  const {
    backgroundColor = "#f9fafb",
    roundedEdges = true,
    cardHoverEffect = "lift",
    scrollEnabled = true,
  } = styles;

  const [currentIndex, setCurrentIndex] = useState(0);

  const nextTestimonial = () => {
    setCurrentIndex((prev) => (prev + 1) % testimonials.length);
  };

  const prevTestimonial = () => {
    setCurrentIndex((prev) => (prev - 1 + testimonials.length) % testimonials.length);
  };

  if (layout === "carousel") {
    return (
      <section
        className={`w-full py-12 ${roundedEdges ? "rounded-lg" : ""}`}
        style={{ backgroundColor }}
      >
        <div className="container mx-auto px-4">
          {/* Header */}
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">
              {headerText}
            </h2>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              {description}
            </p>
          </div>

          {/* Carousel */}
          <div className="relative">
            <div className="overflow-hidden">
              <div
                className="flex transition-transform duration-300 ease-in-out"
                style={{ transform: `translateX(-${currentIndex * 100}%)` }}
              >
                {testimonials.map((testimonial, index) => (
                  <div key={index} className="w-full flex-shrink-0 px-4">
                    <TestimonialCard 
                      testimonial={testimonial} 
                      hoverEffect={cardHoverEffect} 
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* Navigation Buttons */}
            {testimonials.length > 1 && (
              <>
                <button
                  onClick={prevTestimonial}
                  className="absolute left-4 top-1/2 transform -translate-y-1/2 bg-white bg-opacity-80 hover:bg-opacity-100 text-gray-800 p-2 rounded-full shadow-lg transition-all"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
                <button
                  onClick={nextTestimonial}
                  className="absolute right-4 top-1/2 transform -translate-y-1/2 bg-white bg-opacity-80 hover:bg-opacity-100 text-gray-800 p-2 rounded-full shadow-lg transition-all"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </>
            )}

            {/* Dots Indicator */}
            {testimonials.length > 1 && (
              <div className="flex justify-center mt-6 space-x-2">
                {testimonials.map((_, index) => (
                  <button
                    key={index}
                    onClick={() => setCurrentIndex(index)}
                    className={`w-3 h-3 rounded-full transition-all ${
                      index === currentIndex
                        ? "bg-primary-600"
                        : "bg-gray-300 hover:bg-gray-400"
                    }`}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </section>
    );
  }

  if (layout === "grid-scroll") {
    return (
      <section
        className={`w-full py-12 ${roundedEdges ? "rounded-lg" : ""}`}
        style={{ backgroundColor }}
      >
        <div className="container mx-auto px-4">
          {/* Header */}
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">
              {headerText}
            </h2>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              {description}
            </p>
          </div>

          {/* Scrollable Grid */}
          <div className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 ${
            scrollEnabled ? "overflow-x-auto scrollbar-hide" : ""
          }`}>
            {testimonials.map((testimonial, index) => (
              <TestimonialCard 
                key={index} 
                testimonial={testimonial} 
                hoverEffect={cardHoverEffect} 
              />
            ))}
          </div>
        </div>
      </section>
    );
  }

  // Default grid layout
  return (
    <section
      className={`w-full py-12 ${roundedEdges ? "rounded-lg" : ""}`}
      style={{ backgroundColor }}
    >
      <div className="container mx-auto px-4">
        {/* Header */}
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold text-gray-900 mb-4">
            {headerText}
          </h2>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            {description}
          </p>
        </div>

        {/* Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {testimonials.map((testimonial, index) => (
            <TestimonialCard 
              key={index} 
              testimonial={testimonial} 
              hoverEffect={cardHoverEffect} 
            />
          ))}
        </div>
      </div>
    </section>
  );
};
