import React, { useState } from "react";
import { useNavigate, useLocation } from "@tanstack/react-router";
import { ShoppingBag, BookOpen, ArrowRight, X } from "lucide-react";

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
  buy,
  rent,
  tagName,
}) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [hoveredCard, setHoveredCard] = useState<"buy" | "rent" | null>(null);
  const [showRentConfirmation, setShowRentConfirmation] = useState(false);

  const currentTagName = tagName || location.pathname.split("/").filter(Boolean)[0] || "";

  const handleCardClick = (levelFilterValue: string) => {
    if (levelFilterValue) {
      sessionStorage.setItem("levelFilter", levelFilterValue);
      window.dispatchEvent(new CustomEvent('levelFilterChanged', { 
        detail: { levelFilter: levelFilterValue } 
      }));
    }
    navigate({ to: `/${currentTagName}` as any });
  };

  const handleRentClick = () => setShowRentConfirmation(true);
  const handleRentConfirm = () => {
    setShowRentConfirmation(false);
    handleCardClick(rent.levelFilterValue);
  };
  const handleRentCancel = () => setShowRentConfirmation(false);
  const handleBuyRedirect = () => {
    setShowRentConfirmation(false);
    handleCardClick(buy.levelFilterValue);
  };

  return (
    // NEUTRAL: Section background
    <div className="w-full py-6 px-4 sm:px-6 lg:px-8 bg-gray-50">
      <div className="max-w-4xl mx-auto">
        {/* Heading */}
        <div className="text-center mb-4">
          <p className="text-sm sm:text-base text-gray-600">
            Select the option that best fits your needs
          </p>
        </div>

        {/* Two Column Layout */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* RENT Card - NEUTRAL with PRIMARY accent on hover */}
          <div
            className={`relative overflow-hidden rounded-lg border transition-all duration-200 cursor-pointer ${
              hoveredCard === "rent" 
                ? "border-primary-400 bg-primary-50" 
                : "border-gray-200 bg-white hover:border-gray-300"
            }`}
            onMouseEnter={() => setHoveredCard("rent")}
            onMouseLeave={() => setHoveredCard(null)}
            onClick={handleRentClick}
          >
            <div className="p-4 sm:p-5 flex flex-col items-center text-center">
              {/* Icon - PRIMARY accent */}
              <div className={`w-12 h-12 rounded-lg mb-3 flex items-center justify-center transition-colors ${
                hoveredCard === "rent" ? "bg-primary-500" : "bg-primary-100"
              }`}>
                <BookOpen className={`h-6 w-6 ${hoveredCard === "rent" ? "text-white" : "text-primary-600"}`} />
              </div>

              {/* Title - dark neutral */}
              <h3 className="text-lg sm:text-xl font-bold text-gray-900 mb-1">
                Rent a book
              </h3>
              {/* Description - NEUTRAL */}
              <p className="text-xs sm:text-sm text-gray-600 mb-3">
                Access books at affordable rates
              </p>

              {/* Button - PRIMARY */}
              <button className="px-4 py-2 rounded-md text-sm font-medium text-white bg-primary-500 hover:bg-primary-600 transition-colors flex items-center gap-2">
                <span>{rent.buttonLabel}</span>
                <ArrowRight className={`h-4 w-4 transition-transform ${hoveredCard === "rent" ? "translate-x-1" : ""}`} />
              </button>
            </div>
          </div>

          {/* BUY Card - NEUTRAL with PRIMARY accent on hover */}
          <div
            className={`relative overflow-hidden rounded-lg border transition-all duration-200 cursor-pointer ${
              hoveredCard === "buy" 
                ? "border-primary-400 bg-primary-50" 
                : "border-gray-200 bg-white hover:border-gray-300"
            }`}
            onMouseEnter={() => setHoveredCard("buy")}
            onMouseLeave={() => setHoveredCard(null)}
            onClick={() => handleCardClick(buy.levelFilterValue)}
          >
            <div className="p-4 sm:p-5 flex flex-col items-center text-center">
              {/* Icon - PRIMARY accent */}
              <div className={`w-12 h-12 rounded-lg mb-3 flex items-center justify-center transition-colors ${
                hoveredCard === "buy" ? "bg-primary-500" : "bg-primary-100"
              }`}>
                <ShoppingBag className={`h-6 w-6 ${hoveredCard === "buy" ? "text-white" : "text-primary-600"}`} />
              </div>

              {/* Title - dark neutral */}
              <h3 className="text-lg sm:text-xl font-bold text-gray-900 mb-1">
                Buy a book
              </h3>
              {/* Description - NEUTRAL */}
              <p className="text-xs sm:text-sm text-gray-600 mb-3">
                Own books forever
              </p>

              {/* Button - PRIMARY */}
              <button className="px-4 py-2 rounded-md text-sm font-medium text-white bg-primary-500 hover:bg-primary-600 transition-colors flex items-center gap-2">
                <span>{buy.buttonLabel}</span>
                <ArrowRight className={`h-4 w-4 transition-transform ${hoveredCard === "buy" ? "translate-x-1" : ""}`} />
              </button>
            </div>
          </div>
        </div>

        {/* How it Works Section - NEUTRAL */}
        <div className="mt-6">
          <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-200">
              <h3 className="text-base font-semibold text-gray-900">How it Works</h3>
            </div>
            
            <div className="p-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                  { step: 1, title: "Browse & Select", desc: "Explore our collection and choose books." },
                  { step: 2, title: "Choose Option", desc: "Buy for ownership or Rent for access." },
                  { step: 3, title: "Complete Purchase", desc: "Add to cart and checkout securely." },
                  { step: 4, title: "Start Reading", desc: "Access your books instantly." },
                ].map(({ step, title, desc }) => (
                  <div key={step} className="flex gap-3">
                    {/* PRIMARY ACCENT: Step number */}
                    <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary-500 flex items-center justify-center text-white text-xs font-medium">
                      {step}
                    </div>
                    <div>
                      {/* Title - darker neutral */}
                      <h4 className="text-sm font-medium text-gray-800">{title}</h4>
                      {/* Description - NEUTRAL */}
                      <p className="text-xs text-gray-500">{desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Rent Confirmation Modal */}
      {showRentConfirmation && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          {/* NEUTRAL: Modal background */}
          <div className="bg-white rounded-lg max-w-sm w-full p-4 relative">
            <button
              onClick={handleRentCancel}
              className="absolute top-3 right-3 text-gray-400 hover:text-gray-600 transition-colors"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </button>

            <div className="mt-1">
              <h3 className="text-base font-semibold text-gray-900 mb-2">
                Location Restriction
              </h3>
              <p className="text-sm text-gray-600 mb-4">
                We only allow renting books in <b>Jabalpur</b>. Do you want to continue?
              </p>

              <div className="flex gap-2">
                {/* PRIMARY ACCENT: Buttons */}
                <button
                  onClick={handleBuyRedirect}
                  className="flex-1 px-3 py-2 text-sm font-medium text-primary-600 border border-primary-400 rounded-md hover:bg-primary-50 transition-colors"
                >
                  Buy Instead
                </button>
                <button
                  onClick={handleRentConfirm}
                  className="flex-1 px-3 py-2 text-sm font-medium text-white bg-primary-500 rounded-md hover:bg-primary-600 transition-colors"
                >
                  Continue
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
