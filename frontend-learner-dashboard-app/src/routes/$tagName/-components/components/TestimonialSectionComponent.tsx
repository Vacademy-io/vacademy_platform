import React, { useState, useEffect } from "react";
import { getPublicUrlWithoutLogin } from "@/services/upload_file";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface Testimonial {
  name: string;
  role: string;
  feedback: string;
  text?: string;
  quote?: string;
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

const TestimonialCard: React.FC<{ testimonial: Testimonial; hoverEffect?: string }> = ({
  testimonial,
  hoverEffect = "none",
}) => {
  const [avatarUrl, setAvatarUrl] = useState<string>("");
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    let isMounted = true;

    const loadAvatar = async () => {
      if (!testimonial.avatar || testimonial.avatar.trim() === '' ||
          testimonial.avatar === 'null' || testimonial.avatar === 'undefined' ||
          testimonial.avatar.includes('/api/placeholder/')) {
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
        // Silently fail
      }
    };

    loadAvatar();
    return () => { isMounted = false; };
  }, [testimonial.avatar]);

  const getInitials = (name: string) =>
    name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);

  const feedbackText = testimonial.feedback || testimonial.text || testimonial.quote || "";

  const hoverClass =
    hoverEffect === "lift" ? "hover:-translate-y-1 hover:shadow-lg" :
    hoverEffect === "scale" ? "hover:scale-[1.02] hover:shadow-lg" :
    hoverEffect === "shadow" ? "hover:shadow-lg" : "";

  return (
    <div className={`bg-white border border-gray-100 rounded-xl p-6 sm:p-7 transition-all duration-200 ${hoverClass}`}>
      {/* Quote */}
      <blockquote className="text-sm sm:text-base text-gray-600 leading-relaxed mb-5">
        &ldquo;{feedbackText}&rdquo;
      </blockquote>

      {/* Author */}
      <div className="flex items-center gap-3">
        {avatarUrl && !hasError ? (
          <img
            src={avatarUrl}
            alt={testimonial.name}
            className="w-11 h-11 rounded-full object-cover"
            onError={() => setHasError(true)}
          />
        ) : (
          <div className="w-11 h-11 rounded-full bg-primary-100 flex items-center justify-center flex-shrink-0">
            <span className="text-sm font-semibold text-primary-700">
              {getInitials(testimonial.name)}
            </span>
          </div>
        )}
        <div className="min-w-0">
          <div className="text-sm font-semibold text-gray-900">{testimonial.name}</div>
          {testimonial.role && (
            <div className="text-xs text-gray-500 whitespace-pre-line">{testimonial.role}</div>
          )}
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
  const { backgroundColor, cardHoverEffect = "none" } = styles;
  const [currentIndex, setCurrentIndex] = useState(0);

  const nextTestimonial = () => setCurrentIndex((prev) => (prev + 1) % testimonials.length);
  const prevTestimonial = () => setCurrentIndex((prev) => (prev - 1 + testimonials.length) % testimonials.length);

  // Carousel Layout
  if (layout === "carousel") {
    return (
      <section className="w-full py-10 sm:py-14" style={{ backgroundColor: backgroundColor || '#f8fafc' }}>
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-8">
            <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">{headerText}</h2>
            {description && <p className="text-base sm:text-lg text-gray-500 max-w-2xl mx-auto">{description}</p>}
          </div>

          <div className="relative max-w-2xl mx-auto">
            <div className="overflow-hidden">
              <div
                className="flex transition-transform duration-300 ease-out"
                style={{ transform: `translateX(-${currentIndex * 100}%)` }}
              >
                {testimonials.map((testimonial, index) => (
                  <div key={index} className="w-full flex-shrink-0 px-2">
                    <TestimonialCard testimonial={testimonial} hoverEffect={cardHoverEffect} />
                  </div>
                ))}
              </div>
            </div>

            {testimonials.length > 1 && (
              <>
                <button
                  onClick={prevTestimonial}
                  className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-4 bg-white border border-gray-200 text-gray-500 p-2 rounded-full hover:text-gray-800 hover:shadow-md transition-all"
                  aria-label="Previous testimonial"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <button
                  onClick={nextTestimonial}
                  className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-4 bg-white border border-gray-200 text-gray-500 p-2 rounded-full hover:text-gray-800 hover:shadow-md transition-all"
                  aria-label="Next testimonial"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              </>
            )}

            {testimonials.length > 1 && (
              <div className="flex justify-center mt-6 gap-2">
                {testimonials.map((_, index) => (
                  <button
                    key={index}
                    onClick={() => setCurrentIndex(index)}
                    className={`h-2 rounded-full transition-all ${
                      index === currentIndex ? "bg-primary-500 w-6" : "bg-gray-300 w-2"
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

  // Grid / Grid-Scroll Layout
  return (
    <section className="w-full py-10 sm:py-14" style={{ backgroundColor: backgroundColor || '#f8fafc' }}>
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-8">
          <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">{headerText}</h2>
          {description && <p className="text-base sm:text-lg text-gray-500 max-w-2xl mx-auto">{description}</p>}
        </div>

        <div className={`grid gap-5 sm:gap-6 ${
          testimonials.length === 1 ? 'grid-cols-1 max-w-xl mx-auto' :
          testimonials.length === 2 ? 'grid-cols-1 sm:grid-cols-2 max-w-3xl mx-auto' :
          'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3'
        } ${layout === "grid-scroll" ? "overflow-x-auto scrollbar-hide" : ""}`}>
          {testimonials.map((testimonial, index) => (
            <TestimonialCard key={index} testimonial={testimonial} hoverEffect={cardHoverEffect} />
          ))}
        </div>
      </div>
    </section>
  );
};
