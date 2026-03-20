import React, { useState, useEffect } from "react";
import { getPublicUrlWithoutLogin } from "@/services/upload_file";
import { ChevronLeft, ChevronRight } from "lucide-react";

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

const TestimonialCard: React.FC<{ testimonial: Testimonial }> = ({
  testimonial,
}) => {
  const [avatarUrl, setAvatarUrl] = useState<string>("");
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    let isMounted = true;
    
    const loadAvatar = async () => {
      if (!testimonial.avatar || 
          testimonial.avatar.includes('/api/placeholder/') || 
          testimonial.avatar.trim() === '' ||
          testimonial.avatar === 'null' ||
          testimonial.avatar === 'undefined') {
        return;
      }

      if (testimonial.avatar.startsWith('http://') || testimonial.avatar.startsWith('https://')) {
        if (isMounted) setAvatarUrl(testimonial.avatar);
        return;
      }

      try {
        const url = await getPublicUrlWithoutLogin(testimonial.avatar);
        if (isMounted && url) setAvatarUrl(url);
      } catch {
        // Silently fail - will show initials instead
      }
    };

    loadAvatar();
    return () => { isMounted = false; };
  }, [testimonial.avatar]);

  // Get initials for fallback
  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  return (
    // NEUTRAL: Card background with subtle border
    <div className="bg-white border border-gray-200 rounded-lg p-4 hover:border-gray-300 transition-colors">
      <div className="flex items-start gap-3">
        {/* Avatar - PRIMARY ACCENT for initials background */}
        <div className="flex-shrink-0">
          {avatarUrl && !hasError ? (
            <img
              src={avatarUrl}
              alt={testimonial.name}
              className="w-10 h-10 rounded-full object-cover"
              onError={() => setHasError(true)}
            />
          ) : (
            <div className="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center">
              <span className="text-sm font-medium text-primary-700">
                {getInitials(testimonial.name)}
              </span>
            </div>
          )}
        </div>
        
        {/* Content - NEUTRAL text */}
        <div className="flex-1 min-w-0">
          <blockquote className="text-sm text-gray-600 mb-2 line-clamp-3">
            "{testimonial.feedback}"
          </blockquote>
          <div>
            {/* Name - slightly darker for emphasis */}
            <div className="text-sm font-medium text-gray-800">
              {testimonial.name}
            </div>
            {/* Role - muted */}
            <div className="text-xs text-gray-500 line-clamp-1">
              {testimonial.role}
            </div>
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
}) => {
  const [currentIndex, setCurrentIndex] = useState(0);

  const nextTestimonial = () => {
    setCurrentIndex((prev) => (prev + 1) % testimonials.length);
  };

  const prevTestimonial = () => {
    setCurrentIndex((prev) => (prev - 1 + testimonials.length) % testimonials.length);
  };

  // Carousel Layout
  if (layout === "carousel") {
    return (
      // NEUTRAL: Section background
      <section className="w-full py-6 sm:py-8 bg-gray-50">
        <div className="w-full px-4 sm:px-6 lg:px-8">
          {/* Header */}
          <div className="text-center mb-6">
            {/* Heading - dark neutral for readability */}
            <h2 className="text-lg sm:text-xl md:text-2xl font-bold text-gray-900 mb-2">
              {headerText}
            </h2>
            {/* Description - NEUTRAL */}
            <p className="text-sm text-gray-600 max-w-2xl mx-auto">
              {description}
            </p>
          </div>

          {/* Carousel */}
          <div className="relative max-w-2xl mx-auto">
            <div className="overflow-hidden">
              <div
                className="flex transition-transform duration-300 ease-out"
                style={{ transform: `translateX(-${currentIndex * 100}%)` }}
              >
                {testimonials.map((testimonial, index) => (
                  <div key={index} className="w-full flex-shrink-0 px-2">
                    <TestimonialCard testimonial={testimonial} />
                  </div>
                ))}
              </div>
            </div>

            {/* Navigation - NEUTRAL with PRIMARY on hover */}
            {testimonials.length > 1 && (
              <>
                <button
                  onClick={prevTestimonial}
                  className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-4 bg-white border border-gray-200 text-gray-500 p-1.5 rounded-full hover:text-primary-600 hover:border-primary-300 transition-colors"
                  aria-label="Previous testimonial"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  onClick={nextTestimonial}
                  className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-4 bg-white border border-gray-200 text-gray-500 p-1.5 rounded-full hover:text-primary-600 hover:border-primary-300 transition-colors"
                  aria-label="Next testimonial"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </>
            )}

            {/* Dots - PRIMARY for active, NEUTRAL for inactive */}
            {testimonials.length > 1 && (
              <div className="flex justify-center mt-4 gap-1.5">
                {testimonials.map((_, index) => (
                  <button
                    key={index}
                    onClick={() => setCurrentIndex(index)}
                    className={`w-2 h-2 rounded-full transition-all ${
                      index === currentIndex
                        ? "bg-primary-500 w-4"
                        : "bg-gray-300"
                    }`}
                    aria-label={`Go to testimonial ${index + 1}`}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </section>
    );
  }

  // Grid or Grid-Scroll Layout
  return (
    <section className="w-full py-6 sm:py-8 bg-gray-50">
      <div className="w-full px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-6">
          <h2 className="text-lg sm:text-xl md:text-2xl font-bold text-gray-900 mb-2">
            {headerText}
          </h2>
          <p className="text-sm text-gray-600 max-w-2xl mx-auto">
            {description}
          </p>
        </div>

        {/* Grid */}
        <div className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 ${
          layout === "grid-scroll" ? "overflow-x-auto scrollbar-hide" : ""
        }`}>
          {testimonials.map((testimonial, index) => (
            <TestimonialCard key={index} testimonial={testimonial} />
          ))}
        </div>
      </div>
    </section>
  );
};
