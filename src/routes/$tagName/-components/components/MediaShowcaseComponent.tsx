import React, { useState, useEffect ,useMemo} from "react";
import { useNavigate } from "@tanstack/react-router";
import { getPublicUrlWithoutLogin } from "@/services/upload_file";
import { useDomainRouting } from "@/hooks/use-domain-routing";
import { Play } from "lucide-react";

interface MediaItem {
  type: "image" | "video";
  url: string;
  caption: string;
}

interface Slide {
  backgroundImage: string;
  heading: string;
  description: string;
  button?: {
    enabled: boolean;
    text: string;
    action: "navigate" | "enroll" | "openLeadCollection";
    target: string;
    backgroundColor?: string;
  };
}

interface MediaItemComponentProps {
  item: MediaItem;
  roundedEdges: boolean;
}

// Utility function to check if URL is a YouTube URL
const isYouTubeUrl = (url: string): boolean => {
  if (!url) return false;
  return /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\/.+/.test(url);
};

// Utility function to extract YouTube video ID
const extractYouTubeVideoId = (url: string): string | null => {
  if (!url) return null;
  const regExp =
    /(?:youtu\.be\/|youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|v\/|live\/))([a-zA-Z0-9_-]{11})/;
  const match = url.match(regExp);
  return match ? match[1] : null;
};

// Utility function to convert YouTube URL to embed URL
const convertToYouTubeEmbedUrl = (url: string): string => {
  const videoId = extractYouTubeVideoId(url);
  if (!videoId) return url;

  // YouTube embed parameters
  const params = new URLSearchParams({
    modestbranding: '1',
    rel: '0',
    fs: '1',
    playsinline: '1',
  });

  return `https://www.youtube-nocookie.com/embed/${videoId}?${params.toString()}`;
};

// Check if URL is a valid video URL (not a placeholder)
const isValidVideoUrl = (url: string): boolean => {
  if (!url) return false;
  if (url.includes('/api/placeholder/')) return false;
  if (url.trim() === '') return false;
  if (url === 'null' || url === 'undefined') return false;
  return true;
};

const MediaItemComponent: React.FC<MediaItemComponentProps> = ({ item, roundedEdges }) => {
  const [resolvedUrl, setResolvedUrl] = useState<string>("");
  const [hasTriedLoading, setHasTriedLoading] = useState(false);
  const [videoLoadError, setVideoLoadError] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    if (hasTriedLoading) return;

    const loadUrl = async () => {
      // Check if it's a YouTube URL first - use it directly
      if (item.url && isYouTubeUrl(item.url)) {
        if (isMounted) {
          setResolvedUrl(item.url);
          setHasTriedLoading(true);
          setIsLoading(false);
        }
        return;
      }

      // Check if URL is invalid
      if (!item.url ||
        item.url === null ||
        item.url === undefined ||
        item.url.includes('/api/placeholder/') ||
        item.url.trim() === '' ||
        item.url === 'null' ||
        item.url === 'undefined') {
        if (isMounted) {
          setResolvedUrl("");
          setHasTriedLoading(true);
          setIsLoading(false);
          setVideoLoadError(true);
        }
        return;
      }

      // Check if it's already a full URL
      if (item.url.startsWith('http://') || item.url.startsWith('https://')) {
        if (isMounted) {
          setResolvedUrl(item.url);
          setHasTriedLoading(true);
          setIsLoading(false);
        }
        return;
      }

      // Resolve file ID to URL
      try {
        const url = await getPublicUrlWithoutLogin(item.url);
        if (isMounted) {
          if (url && isValidVideoUrl(url)) {
            setResolvedUrl(url);
          } else {
            setVideoLoadError(true);
          }
          setHasTriedLoading(true);
          setIsLoading(false);
        }
      } catch (error) {
        console.error("Error loading media URL:", error);
        if (isMounted) {
          setResolvedUrl("");
          setHasTriedLoading(true);
          setIsLoading(false);
          setVideoLoadError(true);
        }
      }
    };

    loadUrl();
    return () => { isMounted = false; };
  }, [item.url, hasTriedLoading]);

  // Render YouTube video player
  const renderYouTubePlayer = () => {
    const embedUrl = convertToYouTubeEmbedUrl(resolvedUrl);
    return (
      <div className={`relative w-full h-64 bg-black overflow-hidden ${roundedEdges ? 'rounded-lg' : 'rounded-none'}`}>
        <iframe
          src={embedUrl}
          title={item.caption || "Video"}
          frameBorder="0"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share; fullscreen"
          allowFullScreen
          className="absolute inset-0 w-full h-full"
          loading="lazy"
        />
      </div>
    );
  };

  // Render native video player for uploaded videos
  const renderNativeVideoPlayer = () => {
    return (
      <div className={`relative w-full h-64 bg-black overflow-hidden ${roundedEdges ? 'rounded-lg' : 'rounded-none'}`}>
        <video
          src={resolvedUrl}
          controls
          controlsList="nodownload noremoteplayback"
          disablePictureInPicture
          className="w-full h-full object-contain"
          onError={() => {
            console.warn("Native video failed to load:", resolvedUrl);
            setVideoLoadError(true);
          }}
          onLoadedData={() => {
            setVideoLoadError(false);
          }}
        >
          Your browser does not support the video tag.
        </video>
      </div>
    );
  };

  // Render video fallback (placeholder with play icon)
  const renderVideoFallback = () => {
    return (
      <div className={`relative w-full h-64 bg-gradient-to-br from-gray-700 to-gray-900 flex items-center justify-center ${roundedEdges ? 'rounded-lg' : 'rounded-none'}`}>
        <div className="flex flex-col items-center justify-center text-white/70">
          <Play className="w-16 h-16 mb-2 opacity-50" />
          <p className="text-sm">Video unavailable</p>
        </div>
      </div>
    );
  };

  // Render image
  const renderImage = () => {
    const imageSrc = resolvedUrl || "/api/placeholder/400/300";
    return (
      <img
        src={imageSrc}
        alt={item.caption}
        className={`w-full h-64 object-cover shadow-lg ${roundedEdges ? 'rounded-lg' : 'rounded-none'}`}
        onError={(e) => {
          if (!hasTriedLoading) {
            e.currentTarget.src = "/api/placeholder/400/300";
          }
        }}
        onLoad={() => {
          setHasTriedLoading(true);
        }}
      />
    );
  };

  // Loading state
  if (isLoading) {
    return (
      <div className={`relative w-full h-64 bg-gray-200 animate-pulse flex items-center justify-center ${roundedEdges ? 'rounded-lg' : 'rounded-none'}`}>
        <div className="text-gray-400 text-sm">Loading...</div>
      </div>
    );
  }

  return (
    <div className="relative group">
      {item.type === "video" ? (
        <>
          {/* Check if it's a YouTube URL */}
          {resolvedUrl && isYouTubeUrl(resolvedUrl) ? (
            renderYouTubePlayer()
          ) : resolvedUrl && !videoLoadError ? (
            renderNativeVideoPlayer()
          ) : (
            renderVideoFallback()
          )}
        </>
      ) : (
        renderImage()
      )}
      <div className={`absolute bottom-0 left-0 right-0 bg-black bg-opacity-50 text-white p-4 ${roundedEdges ? 'rounded-b-lg' : 'rounded-b-none'
        }`}>
        <p className="text-sm font-medium">{item.caption}</p>
      </div>
    </div>
  );
};

interface MediaShowcaseProps {
  // Legacy props for backward compatibility
  headerText?: string;
  description?: string;
  media?: MediaItem[];
  layout?: "carousel" | "grid" | "slider";
  styles?: {
    backgroundColor?: string;
    roundedEdges?: boolean;
  };
  // New slider props
  slides?: Slide[];
  autoplay?: boolean;
  autoplayInterval?: number;
}

export const MediaShowcaseComponent: React.FC<MediaShowcaseProps> = ({
  headerText,
  description,
  media,
  layout = "carousel",
  styles = {},
  slides,
  autoplay = false,
  autoplayInterval = 3000,
}) => {
  const navigate = useNavigate();
  const domainRouting = useDomainRouting();
  const {
    backgroundColor = "#f0f9ff",
    roundedEdges = true,
  } = styles;

  // Determine which format to use
  const isSliderFormat = layout === "slider" && slides && slides.length > 0;
  const mediaToUse = !isSliderFormat && media ? media : [];

  // Debug logging
  useEffect(() => {
    console.log("[MediaShowcaseComponent] Component mounted/updated:", {
      layout,
      slidesLength: slides?.length,
      isSliderFormat,
      autoplay,
      autoplayInterval,
      hasSlides: !!slides,
      slidesArray: slides
    });
  }, [layout, slides, isSliderFormat, autoplay, autoplayInterval]);

  const [currentIndex, setCurrentIndex] = useState(0);
  const [resolvedSlideImages, setResolvedSlideImages] = useState<{ [key: number]: string }>({});

  // Reset currentIndex when slides change
  useEffect(() => {
    if (isSliderFormat && slides && slides.length > 0) {
      setCurrentIndex(0);
    }
  }, [isSliderFormat, slides?.length]);

  // Resolve slide background images in parallel for better performance
  useEffect(() => {
    if (!isSliderFormat || !slides || slides.length === 0) return;

    const resolveImages = async () => {
      const resolved: { [key: number]: string } = {};
      
      // Load all images in parallel instead of sequentially
      const imagePromises = slides.map(async (slide, i) => {
        if (!slide.backgroundImage) return { index: i, url: null };

        // Check if it's already a URL
        if (slide.backgroundImage.startsWith('http://') || slide.backgroundImage.startsWith('https://')) {
          return { index: i, url: slide.backgroundImage };
        }

        // Resolve file ID to URL
        try {
          const url = await getPublicUrlWithoutLogin(slide.backgroundImage);
          return { index: i, url };
        } catch (error) {
          console.error(`Error loading slide ${i} image:`, error);
          return { index: i, url: slide.backgroundImage }; // Fallback to original
        }
      });

      // Wait for all images to resolve in parallel
      const results = await Promise.all(imagePromises);
      results.forEach(({ index, url }) => {
        if (url) {
          resolved[index] = url;
        }
      });
      
      setResolvedSlideImages(resolved);

      // Preload images into browser cache for smoother transitions
      results.forEach(({ url }) => {
        if (url && (url.startsWith('http://') || url.startsWith('https://'))) {
          const img = new Image();
          img.src = url;
        }
      });
    };

    resolveImages();
  }, [isSliderFormat, slides]);

  // Preload adjacent slide images for smoother transitions
  useEffect(() => {
    if (!isSliderFormat || !slides || slides.length === 0 || Object.keys(resolvedSlideImages).length === 0) return;

    // Preload next and previous slide images
    const preloadImage = (url: string) => {
      if (!url || url.includes('/api/placeholder/')) return;
      const img = new Image();
      img.src = url;
    };

    const nextIndex = (currentIndex + 1) % slides.length;
    const prevIndex = (currentIndex - 1 + slides.length) % slides.length;

    // Preload next slide
    if (resolvedSlideImages[nextIndex]) {
      preloadImage(resolvedSlideImages[nextIndex]);
    }

    // Preload previous slide
    if (resolvedSlideImages[prevIndex]) {
      preloadImage(resolvedSlideImages[prevIndex]);
    }
  }, [currentIndex, resolvedSlideImages, isSliderFormat, slides?.length]);

  // Autoplay functionality
  useEffect(() => {
    if (!isSliderFormat || !autoplay || !slides || slides.length <= 1) {
      return;
    }

    console.log("[MediaShowcaseComponent] Starting autoplay:", {
      autoplay,
      autoplayInterval,
      slidesLength: slides.length,
      resolvedImagesCount: Object.keys(resolvedSlideImages).length
    });

    const interval = setInterval(() => {
      setCurrentIndex((prev) => {
        const next = (prev + 1) % slides.length;
        console.log("[MediaShowcaseComponent] Autoplay advancing:", { prev, next });
        return next;
      });
    }, autoplayInterval);

    return () => {
      console.log("[MediaShowcaseComponent] Clearing autoplay interval");
      clearInterval(interval);
    };
  }, [isSliderFormat, autoplay, autoplayInterval, slides?.length]);

  const nextSlide = () => {
    if (isSliderFormat && slides) {
      setCurrentIndex((prev) => (prev + 1) % slides.length);
    } else {
      setCurrentIndex((prev) => (prev + 1) % mediaToUse.length);
    }
  };

  const prevSlide = () => {
    if (isSliderFormat && slides) {
      setCurrentIndex((prev) => (prev - 1 + slides.length) % slides.length);
    } else {
      setCurrentIndex((prev) => (prev - 1 + mediaToUse.length) % mediaToUse.length);
    }
  };

  const handleButtonClick = (button: Slide['button']) => {
    if (!button || !button.enabled) return;

    switch (button.action) {
      case "navigate":
        if (button.target) {
          navigate({ to: button.target });
        }
        break;
      case "openLeadCollection":
        window.dispatchEvent(new CustomEvent('openLeadCollection'));
        break;
      case "enroll":
        // Handle enroll action if needed
        console.log("Enroll action triggered");
        break;
      default:
        break;
    }
  };

  const renderMediaItem = (item: MediaItem, index: number) => {
    return (
      <MediaItemComponent 
        key={index} 
        item={item} 
        roundedEdges={roundedEdges} 
      />
    );
  };

  // Render slider format
  if (isSliderFormat && slides && slides.length > 0) {
    // Calculate transform: each slide takes 100/slides.length % of the container
    // So to move to slide N, we move by N * (100/slides.length)%
    const slideWidthPercent = 100 / slides.length;
    const transformPercent = currentIndex * slideWidthPercent;
    
    console.log("[MediaShowcaseComponent] ✅ Rendering SLIDER format:", {
      currentIndex,
      slidesLength: slides.length,
      resolvedImagesCount: Object.keys(resolvedSlideImages).length,
      slideWidthPercent: slideWidthPercent.toFixed(2),
      transformPercent: transformPercent.toFixed(2),
      transform: `translateX(-${transformPercent.toFixed(2)}%)`,
      containerWidth: `${slides.length * 100}%`,
      slideWidth: `${slideWidthPercent.toFixed(2)}%`,
      slides: slides.map((s, i) => ({
        index: i,
        heading: s.heading,
        hasBackground: !!s.backgroundImage,
        resolvedUrl: resolvedSlideImages[i] || s.backgroundImage
      }))
    });
    
    const sliderStyle = useMemo((): React.CSSProperties => ({
      transform: `translateX(-${transformPercent}%)`,
      width: `${slides.length * 100}%`,
      display: 'flex',
      transition: 'transform 500ms cubic-bezier(0.4, 0, 0.2, 1)', // Smoother easing
      willChange: 'transform',
      backfaceVisibility: 'hidden', // Prevent flickering
      WebkitBackfaceVisibility: 'hidden', // Safari support
      perspective: '1000px' // Enable 3D transforms for better performance
    }), [currentIndex, slides.length, transformPercent]);
    
    
    return (
      <section className="w-full relative" style={{ width: '100%', overflow: 'hidden' }}>
        <div 
          className="relative overflow-hidden" 
          style={{ 
            height: "500px", 
            width: "100%",
            position: 'relative',
            willChange: 'contents', // Optimize for animations
            transform: 'translateZ(0)' // Force GPU acceleration
          }}
        >
         <div className="flex h-full" style={sliderStyle}>

            {slides.map((slide, index) => {
              const backgroundUrl = resolvedSlideImages[index] || slide.backgroundImage || "/api/placeholder/1920/500";
              
              return (
                <div
                  key={index}
                  className="flex-shrink-0 h-full relative overflow-hidden"
                  style={{
                    width: `calc(100% / ${slides.length})`,
                    minWidth: `calc(100% / ${slides.length})`,
                    maxWidth: `calc(100% / ${slides.length})`,
                    flexBasis: `calc(100% / ${slides.length})`,
                    backgroundColor: '#1f2937',
                    position: 'relative'
                  }}
                >
                  {/* Use actual img tag for better performance and preloading */}
                  <img
                    src={backgroundUrl}
                    alt={slide.heading || `Slide ${index + 1}`}
                    className="absolute inset-0 w-full h-full object-cover"
                    style={{
                      objectFit: 'cover',
                      objectPosition: 'center',
                      willChange: 'transform',
                      backfaceVisibility: 'hidden',
                      transform: 'translateZ(0)' // Force GPU acceleration
                    }}
                    loading={index === 0 ? "eager" : "lazy"} // Eager load first slide, lazy load others
                    onError={(e) => {
                      e.currentTarget.src = "/api/placeholder/1920/500";
                    }}
                  />
                  {/* Overlay for better text readability */}
                  <div 
                    className="absolute inset-0" 
                    style={{ 
                      backgroundColor: 'rgba(0, 0, 0, 0.4)',
                      zIndex: 1,
                      pointerEvents: 'none'
                    }}
                  ></div>
                  
                  {/* Content */}
                  <div 
                    className="absolute inset-0 h-full w-full flex flex-col items-center justify-center text-center px-4 sm:px-6 lg:px-8"
                    style={{ 
                      zIndex: 10,
                      pointerEvents: 'auto'
                    }}
                  >
                    {slide.heading && (
                      <h2 
                        className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white mb-4 max-w-4xl" 
                        style={{ 
                          textShadow: '2px 2px 8px rgba(0,0,0,0.9), 0 0 20px rgba(0,0,0,0.5)',
                          lineHeight: '1.2'
                        }}
                      >
                        {slide.heading}
                      </h2>
                    )}
                    {slide.description && (
                      <p 
                        className="text-lg sm:text-xl text-white mb-6 max-w-2xl" 
                        style={{ 
                          textShadow: '1px 1px 6px rgba(0,0,0,0.9), 0 0 15px rgba(0,0,0,0.5)',
                          lineHeight: '1.6'
                        }}
                      >
                        {slide.description}
                      </p>
                    )}
                    {slide.button && slide.button.enabled && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleButtonClick(slide.button);
                        }}
                        className="px-6 py-3 sm:px-8 sm:py-4 text-base sm:text-lg font-semibold text-white rounded-md hover:opacity-90 transition-opacity shadow-lg cursor-pointer"
                        style={{
                          backgroundColor: slide.button.backgroundColor || (domainRouting.instituteThemeCode ? `hsl(var(--primary))` : "#2563eb"),
                          zIndex: 20,
                          position: 'relative'
                        }}
                      >
                        {slide.button.text}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Navigation Buttons */}
          {slides.length > 1 && (
            <>
              <button
                onClick={prevSlide}
                className="absolute left-4 top-1/2 transform -translate-y-1/2 bg-white bg-opacity-80 hover:bg-opacity-100 text-gray-800 p-2 sm:p-3 rounded-full shadow-lg transition-all z-20"
                aria-label="Previous slide"
              >
                <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <button
                onClick={nextSlide}
                className="absolute right-4 top-1/2 transform -translate-y-1/2 bg-white bg-opacity-80 hover:bg-opacity-100 text-gray-800 p-2 sm:p-3 rounded-full shadow-lg transition-all z-20"
                aria-label="Next slide"
              >
                <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </>
          )}

          {/* Dots Indicator */}
          {slides.length > 1 && (
            <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 flex space-x-2 z-20">
              {slides.map((_, index) => (
                <button
                  key={index}
                  onClick={() => setCurrentIndex(index)}
                  className={`w-2 h-2 sm:w-3 sm:h-3 rounded-full transition-all ${
                    index === currentIndex
                      ? "bg-white"
                      : "bg-white bg-opacity-50 hover:bg-opacity-75"
                  }`}
                  aria-label={`Go to slide ${index + 1}`}
                />
              ))}
            </div>
          )}
        </div>
      </section>
    );
  }

  // Render legacy format (carousel/grid)
  console.log("[MediaShowcaseComponent] ⚠️ Rendering LEGACY format (not slider):", {
    layout,
    isSliderFormat,
    hasSlides: !!slides,
    slidesLength: slides?.length,
    hasMedia: !!media,
    mediaLength: media?.length
  });
  
  return (
    <section
      className={`w-full py-12 ${roundedEdges ? "rounded-lg" : ""}`}
      style={{ backgroundColor }}
    >
      <div className="container mx-auto px-4">
        {/* Header */}
        {headerText && (
          <div className="text-center mb-8">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">
              {headerText}
            </h2>
            {description && (
              <p className="text-lg text-gray-600 max-w-2xl mx-auto">
                {description}
              </p>
            )}
          </div>
        )}

        {/* Media Content */}
        {layout === "carousel" ? (
          <div className="relative">
            <div className="overflow-hidden">
              <div
                className="flex transition-transform duration-300 ease-in-out"
                style={{ transform: `translateX(-${currentIndex * 100}%)` }}
              >
                {mediaToUse.map((item, index) => (
                  <div key={index} className="w-full flex-shrink-0 px-2">
                    {renderMediaItem(item, index)}
                  </div>
                ))}
              </div>
            </div>

            {/* Navigation Buttons */}
            {mediaToUse.length > 1 && (
              <>
                <button
                  onClick={prevSlide}
                  className="absolute left-4 top-1/2 transform -translate-y-1/2 bg-white bg-opacity-80 hover:bg-opacity-100 text-gray-800 p-2 rounded-full shadow-lg transition-all"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
                <button
                  onClick={nextSlide}
                  className="absolute right-4 top-1/2 transform -translate-y-1/2 bg-white bg-opacity-80 hover:bg-opacity-100 text-gray-800 p-2 rounded-full shadow-lg transition-all"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </>
            )}

            {/* Dots Indicator */}
            {mediaToUse.length > 1 && (
              <div className="flex justify-center mt-4 space-x-2">
                {mediaToUse.map((_, index) => (
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
        ) : (
          /* Grid Layout */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {mediaToUse.map((item, index) => renderMediaItem(item, index))}
          </div>
        )}
      </div>
    </section>
  );
};
