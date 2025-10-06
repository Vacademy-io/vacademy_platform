import React, { useState, useEffect } from "react";
import { getPublicUrlWithoutLogin } from "@/services/upload_file";

interface MediaItem {
  type: "image" | "video";
  url: string;
  caption: string;
}

interface MediaItemComponentProps {
  item: MediaItem;
  roundedEdges: boolean;
}

const MediaItemComponent: React.FC<MediaItemComponentProps> = ({ item, roundedEdges }) => {
  const [resolvedUrl, setResolvedUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [hasTriedLoading, setHasTriedLoading] = useState(false);

  useEffect(() => {
    let isMounted = true;
    
    // If we've already tried loading this URL and it failed, don't try again
    if (hasTriedLoading) {
      return;
    }
    
    const loadUrl = async () => {
      if (!item.url || item.url.includes('/api/placeholder/')) {
        if (isMounted) {
          setLoading(false);
          setResolvedUrl("/api/placeholder/400/300");
          setHasTriedLoading(true);
        }
        return;
      }

      setLoading(true);
      try {
        const url = await getPublicUrlWithoutLogin(item.url);
        if (isMounted) {
          setResolvedUrl(url);
          setHasTriedLoading(true);
        }
      } catch (error) {
        console.error("Error loading media URL:", error);
        if (isMounted) {
          setResolvedUrl("/api/placeholder/400/300");
          setHasTriedLoading(true);
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    loadUrl();
    return () => { isMounted = false; };
  }, [item.url, hasTriedLoading]);

  if (loading) {
    return (
      <div className="w-full h-64 bg-gray-200 flex items-center justify-center">
        <div className="text-gray-400 text-sm">Loading...</div>
      </div>
    );
  }

  return (
    <div className="relative group">
      {item.type === "video" ? (
        <video
          src={resolvedUrl || "/api/placeholder/400/300"}
          controls
          className={`w-full h-64 object-cover shadow-lg ${
            roundedEdges ? 'rounded-lg' : 'rounded-none'
          }`}
          poster="/api/placeholder/400/300"
        >
          Your browser does not support the video tag.
        </video>
      ) : (
        <img
          src={resolvedUrl || "/api/placeholder/400/300"}
          alt={item.caption}
          className={`w-full h-64 object-cover shadow-lg ${
            roundedEdges ? 'rounded-lg' : 'rounded-none'
          }`}
          onError={(e) => {
            // Only set placeholder if we haven't already tried loading
            if (!hasTriedLoading) {
              e.currentTarget.src = "/api/placeholder/400/300";
            }
          }}
          onLoad={() => {
            // Mark as successfully loaded
            setHasTriedLoading(true);
          }}
        />
      )}
      <div className={`absolute bottom-0 left-0 right-0 bg-black bg-opacity-50 text-white p-4 ${
        roundedEdges ? 'rounded-b-lg' : 'rounded-b-none'
      }`}>
        <p className="text-sm font-medium">{item.caption}</p>
      </div>
    </div>
  );
};

interface MediaShowcaseProps {
  headerText: string;
  description: string;
  media: MediaItem[];
  layout: "carousel" | "grid";
  styles?: {
    backgroundColor?: string;
    roundedEdges?: boolean;
  };
}

export const MediaShowcaseComponent: React.FC<MediaShowcaseProps> = ({
  headerText,
  description,
  media,
  layout,
  styles = {},
}) => {
  const {
    backgroundColor = "#f0f9ff",
    roundedEdges = true,
  } = styles;

  const [currentIndex, setCurrentIndex] = useState(0);

  const nextSlide = () => {
    setCurrentIndex((prev) => (prev + 1) % media.length);
  };

  const prevSlide = () => {
    setCurrentIndex((prev) => (prev - 1 + media.length) % media.length);
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

  return (
    <section
      className={`w-full py-12 ${roundedEdges ? "rounded-lg" : ""}`}
      style={{ backgroundColor }}
    >
      <div className="container mx-auto px-4">
        {/* Header */}
        <div className="text-center mb-8">
          <h2 className="text-3xl font-bold text-gray-900 mb-4">
            {headerText}
          </h2>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            {description}
          </p>
        </div>

        {/* Media Content */}
        {layout === "carousel" ? (
          <div className="relative">
            <div className="overflow-hidden">
              <div
                className="flex transition-transform duration-300 ease-in-out"
                style={{ transform: `translateX(-${currentIndex * 100}%)` }}
              >
                {media.map((item, index) => (
                  <div key={index} className="w-full flex-shrink-0 px-2">
                    {renderMediaItem(item, index)}
                  </div>
                ))}
              </div>
            </div>

            {/* Navigation Buttons */}
            {media.length > 1 && (
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
            {media.length > 1 && (
              <div className="flex justify-center mt-4 space-x-2">
                {media.map((_, index) => (
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
            {media.map((item, index) => renderMediaItem(item, index))}
          </div>
        )}
      </div>
    </section>
  );
};
