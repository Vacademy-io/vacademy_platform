import React from "react";
import { BannerProps } from "../../-types/course-catalogue-types";
import { useDomainRouting } from "@/hooks/use-domain-routing";

export const BannerComponent: React.FC<BannerProps> = ({
  title,
  media,
  alignment,
}) => {
  const domainRouting = useDomainRouting();

  const getAlignmentClass = () => {
    switch (alignment) {
      case "left":
        return "text-left";
      case "right":
        return "text-right";
      case "center":
      default:
        return "text-center";
    }
  };

  return (
    <div className="relative h-[300px] sm:h-[400px] lg:h-[500px] overflow-hidden">
      {/* Background Media */}
      {media.type === "image" && (
        <div className="absolute inset-0">
          <img
            src={media.url}
            alt="Banner"
            className="w-full h-full object-cover"
            onError={(e) => {
              e.currentTarget.style.display = "none";
            }}
          />
          <div 
            className="absolute inset-0 bg-opacity-40" 
            style={{
              backgroundColor: domainRouting.instituteThemeCode ? 
                `hsl(var(--primary))` : 
                'rgba(0, 0, 0, 0.4)'
            }}
          />
        </div>
      )}

      {media.type === "video" && (
        <div className="absolute inset-0">
          <video
            className="w-full h-full object-cover"
            autoPlay
            muted
            loop
            playsInline
          >
            <source src={media.url} type="video/mp4" />
          </video>
          <div 
            className="absolute inset-0 bg-opacity-40" 
            style={{
              backgroundColor: domainRouting.instituteThemeCode ? 
                `hsl(var(--primary))` : 
                'rgba(0, 0, 0, 0.4)'
            }}
          />
        </div>
      )}

      {/* Content */}
      <div className="relative z-10 h-full flex items-center justify-center">
        <div className={`w-full px-4 sm:px-6 lg:px-8 ${getAlignmentClass()}`}>
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white mb-4">
            {title}
          </h1>
        </div>
      </div>
    </div>
  );
};
