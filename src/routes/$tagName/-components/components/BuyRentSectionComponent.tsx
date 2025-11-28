import React, { useState } from "react";
import { useNavigate, useLocation } from "@tanstack/react-router";
import { useDomainRouting } from "@/hooks/use-domain-routing";
import { ShoppingBag, BookOpen, ArrowRight, Sparkles } from "lucide-react";

interface BuyRentSectionProps {
  heading?: string;
  buy: {
    buttonLabel: string;
    levelFilterValue: string;
    targetRoute: string;
  };
  rent: {
    buttonLabel: string;
    levelFilterValue: string;
    targetRoute: string;
  };
  tagName?: string;
}

export const BuyRentSectionComponent: React.FC<BuyRentSectionProps> = ({
  heading = "Choose Your Reading Path",
  buy,
  rent,
  tagName,
}) => {
  const navigate = useNavigate();
  const location = useLocation();
  const domainRouting = useDomainRouting();
  const [hoveredCard, setHoveredCard] = useState<"buy" | "rent" | null>(null);

  // Extract tagName from current path if not provided
  const currentTagName = tagName || location.pathname.split('/').filter(Boolean)[0] || '';

  const themeColor = domainRouting.instituteThemeCode 
    ? `hsl(var(--primary))` 
    : '#3b82f6';

  const handleCardClick = (levelFilterValue: string) => {
    // Store filter value in sessionStorage for the target page to use
    if (levelFilterValue) {
      sessionStorage.setItem('levelFilter', levelFilterValue);
    }

    // Navigate to homepage (which contains the course catalog)
    // The level filter will be automatically applied when CourseCatalogComponent loads
    navigate({ 
      to: `/${currentTagName}` as any
    });
  };

  return (
    <div className="w-full py-16 px-4 sm:px-6 lg:px-8 bg-gradient-to-br from-gray-50 to-white">
      <div className="container mx-auto max-w-6xl">
        {/* Heading */}
        <div className="text-center mb-12">
          <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-gray-900 mb-4">
            {heading}
          </h2>
          <div className="flex items-center justify-center gap-2 text-gray-600">
            <Sparkles className="h-5 w-5" />
            <p className="text-lg sm:text-xl">Select the option that best fits your needs</p>
          </div>
        </div>

        {/* Two Column Layout */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 lg:gap-12">
          {/* BUY Card */}
          <div
            className={`group relative overflow-hidden rounded-2xl bg-white shadow-lg transition-all duration-500 cursor-pointer transform ${
              hoveredCard === "buy" 
                ? "scale-105 shadow-2xl" 
                : "hover:scale-102 hover:shadow-xl"
            }`}
            onMouseEnter={() => setHoveredCard("buy")}
            onMouseLeave={() => setHoveredCard(null)}
            onClick={() => handleCardClick(buy.levelFilterValue)}
          >
            {/* Gradient Overlay */}
            <div 
              className="absolute inset-0 bg-gradient-to-br opacity-0 group-hover:opacity-100 transition-opacity duration-500"
              style={{
                background: `linear-gradient(135deg, ${themeColor}15 0%, ${themeColor}05 100%)`
              }}
            />
            
            {/* Content */}
            <div className="relative p-8 sm:p-10 lg:p-12">
              {/* Icon */}
              <div 
                className="w-16 h-16 rounded-2xl mb-6 flex items-center justify-center transition-transform duration-300 group-hover:scale-110 group-hover:rotate-3"
                style={{ backgroundColor: `${themeColor}15` }}
              >
                <ShoppingBag 
                  className="h-8 w-8"
                  style={{ color: themeColor }}
                />
              </div>

              {/* Title */}
              <h3 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
                Buy
              </h3>

              {/* Description */}
              {/* <p className="text-gray-600 text-lg mb-8 leading-relaxed">
                Own your books forever. Build your personal library with our curated collection of premium titles.
              </p> */}

              {/* Features List */}
              <ul className="space-y-3 mb-8">
                {[
                  "Lifetime ownership",
                  "No time restrictions",
                  "Build your collection",
                  "Keep forever"
                ].map((feature, index) => (
                  <li key={index} className="flex items-center gap-3 text-gray-700">
                    <div 
                      className="w-2 h-2 rounded-full"
                      style={{ backgroundColor: themeColor }}
                    />
                    <span className="text-base">{feature}</span>
                  </li>
                ))}
              </ul>

              {/* Button */}
              <button
                className={`w-full py-4 px-6 rounded-xl font-semibold text-lg text-white transition-all duration-300 transform group-hover:scale-105 flex items-center justify-center gap-2 shadow-lg`}
                style={{ 
                  backgroundColor: themeColor,
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.opacity = '0.9';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.opacity = '1';
                }}
              >
                <span>{buy.buttonLabel}</span>
                <ArrowRight className="h-5 w-5 transition-transform duration-300 group-hover:translate-x-1" />
              </button>
            </div>

            {/* Decorative Corner */}
            <div 
              className="absolute top-0 right-0 w-32 h-32 rounded-bl-full opacity-10"
              style={{ backgroundColor: themeColor }}
            />
          </div>

          {/* RENT Card */}
          <div
            className={`group relative overflow-hidden rounded-2xl bg-white shadow-lg transition-all duration-500 cursor-pointer transform ${
              hoveredCard === "rent" 
                ? "scale-105 shadow-2xl" 
                : "hover:scale-102 hover:shadow-xl"
            }`}
            onMouseEnter={() => setHoveredCard("rent")}
            onMouseLeave={() => setHoveredCard(null)}
            onClick={() => handleCardClick(rent.levelFilterValue)}
          >
            {/* Gradient Overlay */}
            <div 
              className="absolute inset-0 bg-gradient-to-br opacity-0 group-hover:opacity-100 transition-opacity duration-500"
              style={{
                background: `linear-gradient(135deg, ${themeColor}15 0%, ${themeColor}05 100%)`
              }}
            />
            
            {/* Content */}
            <div className="relative p-8 sm:p-10 lg:p-12">
              {/* Icon */}
              <div 
                className="w-16 h-16 rounded-2xl mb-6 flex items-center justify-center transition-transform duration-300 group-hover:scale-110 group-hover:rotate-3"
                style={{ backgroundColor: `${themeColor}15` }}
              >
                <BookOpen 
                  className="h-8 w-8"
                  style={{ color: themeColor }}
                />
              </div>

              {/* Title */}
              <h3 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
                Rent
              </h3>

              {/* Description */}
              {/* <p className="text-gray-600 text-lg mb-8 leading-relaxed">
                Flexible reading options. Access books for a limited time at a fraction of the cost.
              </p> */}

              {/* Features List */}
              <ul className="space-y-3 mb-8">
                {[
                  "Affordable pricing",
                  "Flexible duration",
                  "Try before you buy",
                  "Return anytime"
                ].map((feature, index) => (
                  <li key={index} className="flex items-center gap-3 text-gray-700">
                    <div 
                      className="w-2 h-2 rounded-full"
                      style={{ backgroundColor: themeColor }}
                    />
                    <span className="text-base">{feature}</span>
                  </li>
                ))}
              </ul>

              {/* Button */}
              <button
                className={`w-full py-4 px-6 rounded-xl font-semibold text-lg text-white transition-all duration-300 transform group-hover:scale-105 flex items-center justify-center gap-2 shadow-lg`}
                style={{ 
                  backgroundColor: themeColor,
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.opacity = '0.9';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.opacity = '1';
                }}
              >
                <span>{rent.buttonLabel}</span>
                <ArrowRight className="h-5 w-5 transition-transform duration-300 group-hover:translate-x-1" />
              </button>
            </div>

            {/* Decorative Corner */}
            <div 
              className="absolute top-0 right-0 w-32 h-32 rounded-bl-full opacity-10"
              style={{ backgroundColor: themeColor }}
            />
          </div>
        </div>

        {/* Bottom Decorative Element */}
        <div className="mt-16 text-center">
          <div className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-gray-100 text-gray-600">
            <Sparkles className="h-4 w-4" />
            <span className="text-sm font-medium">Both options available for all titles</span>
          </div>
        </div>
      </div>
    </div>
  );
};

