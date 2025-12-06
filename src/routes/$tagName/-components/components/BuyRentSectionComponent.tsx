import React, { useState } from "react";
import { useNavigate, useLocation } from "@tanstack/react-router";
import { useDomainRouting } from "@/hooks/use-domain-routing";
import { ShoppingBag, BookOpen, ArrowRight, Sparkles, X } from "lucide-react";

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
  const domainRouting = useDomainRouting();
  const [hoveredCard, setHoveredCard] = useState<"buy" | "rent" | null>(null);
  const [showRentConfirmation, setShowRentConfirmation] = useState(false);

  // Extract tagName from current path if not provided
  const currentTagName = tagName || location.pathname.split("/").filter(Boolean)[0] || "";

  const themeColor = domainRouting.instituteThemeCode ? `hsl(var(--primary))` : "#3b82f6";

  const handleCardClick = (levelFilterValue: string) => {
    if (levelFilterValue) {
      sessionStorage.setItem("levelFilter", levelFilterValue);
    }
    navigate({
      to: `/${currentTagName}` as any,
    });
  };

  const handleRentClick = () => {
    setShowRentConfirmation(true);
  };

  const handleRentConfirm = () => {
    setShowRentConfirmation(false);
    handleCardClick(rent.levelFilterValue);
  };

  const handleRentCancel = () => {
    setShowRentConfirmation(false);
  };

  const handleBuyRedirect = () => {
    setShowRentConfirmation(false);
    handleCardClick(buy.levelFilterValue);
  };

  return (
    <div className="w-full py-5 px-4 sm:px-6 lg:px-8 bg-gradient-to-br from-gray-50 to-white">
      <div className="container mx-auto max-w-6xl">
        {/* Heading */}
        <div className="text-center mb-3">
          <div className="flex items-center justify-center gap-2 text-gray-600">
            <Sparkles className="h-5 w-5" />
            <p className="text-lg sm:text-xl">Select the option that best fits your needs</p>
          </div>
        </div>

        {/* Two Column Layout */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 lg:gap-12">


           {/* RENT Card */}
           <div
            className={`group relative overflow-hidden rounded-2xl bg-white shadow-lg transition-all duration-500 cursor-pointer ${
              hoveredCard === "rent" ? "scale-105 shadow-2xl" : "scale-100 hover:scale-[1.02] hover:shadow-xl"
            }`}
            onMouseEnter={() => setHoveredCard("rent")}
            onMouseLeave={() => setHoveredCard(null)}
            onClick={handleRentClick}
            style={{
              backgroundImage: "url(https://media.istockphoto.com/id/1328717786/vector/books-swap-exchange-or-crossing-vector-illustration-with-hand-gives-book-to-friend.jpg?s=612x612&w=0&k=20&c=5CQ5hVSDu6Kb9PkZBavYLao4e8u830Uq7RXNKfE4tk4=)",
              backgroundSize: "cover",
              backgroundPosition: "center",
              backgroundRepeat: "no-repeat",
              transform: hoveredCard === "rent" ? "scale(1.05)" : undefined,
            }}
          >
            {/* Background Overlay for text readability */}
            <div 
              className="absolute inset-0 transition-opacity duration-500" 
              style={{
                backgroundColor: hoveredCard === "rent" ? "rgba(0, 0, 0, 0.5)" : "rgba(0, 0, 0, 0.4)",
                zIndex: 1
              }}
            />
            
            {/* Gradient Overlay */}
            <div
              className="absolute inset-0 transition-opacity duration-500"
              style={{
                background: `linear-gradient(135deg, ${themeColor}15 0%, ${themeColor}05 100%)`,
                opacity: hoveredCard === "rent" ? 1 : 0,
                zIndex: 2
              }}
            />

            {/* Content - centered */}
            <div className="relative min-h-[220px] p-8 sm:p-10 lg:p-12 flex flex-col items-center justify-center text-center" style={{ zIndex: 10 }}>
              <div className="max-w-md w-full">
                {/* Icon */}
                <div
                  className="w-16 h-16 rounded-2xl mb-6 flex items-center justify-center transition-transform duration-300 mx-auto backdrop-blur-sm"
                  style={{ 
                    backgroundColor: `${themeColor}25`,
                    transform: hoveredCard === "rent" ? "scale(1.1)" : "scale(1)"
                  }}
                >
                  <BookOpen className="h-8 w-8" style={{ color: "white" }} />
                </div>

                {/* Title */}
                <h3 className="text-2xl sm:text-4xl font-bold text-white mb-4 drop-shadow-lg">
                  Rent a book
                </h3>

                {/* Optional description */}
                {/* <p className="text-gray-600 text-lg mb-6 leading-relaxed">
                  Flexible reading options — access books for a limited time at a fraction of the cost.
                </p> */}

                {/* Button (responsive width & centered) */}
                <button
                  className="max-w-[210px] sm:w-auto mx-auto py-2 px-3 rounded-xl font-semibold text-lg text-white transition-all duration-300 flex items-center justify-center gap-2 shadow-lg"
                  style={{
                    backgroundColor: themeColor,
                    transform: hoveredCard === "rent" ? "scale(1.05)" : "scale(1)",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.opacity = "0.9";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.opacity = "1";
                  }}
                >
                  <span>{rent.buttonLabel}</span>
                  <ArrowRight 
                    className="h-5 w-5 transition-transform duration-300" 
                    style={{
                      transform: hoveredCard === "rent" ? "translateX(4px)" : "translateX(0)"
                    }}
                  />
                </button>
              </div>
            </div>

            {/* Decorative Corner */}
            <div className="absolute top-0 right-0 w-32 h-32 rounded-bl-full opacity-10" style={{ backgroundColor: themeColor }} />
          </div>

          {/* BUY Card */}
          <div
            className={`group relative overflow-hidden rounded-2xl bg-white shadow-lg transition-all duration-500 cursor-pointer ${
              hoveredCard === "buy" ? "scale-105 shadow-2xl" : "scale-100 hover:scale-[1.02] hover:shadow-xl"
            }`}
            onMouseEnter={() => setHoveredCard("buy")}
            onMouseLeave={() => setHoveredCard(null)}
            onClick={() => handleCardClick(buy.levelFilterValue)}
            style={{
              backgroundImage: "url(https://media.istockphoto.com/id/1212483651/photo/stack-of-books-in-trolley-bookshop-concept.jpg?s=612x612&w=0&k=20&c=PiJ-o1La4fnPSOPn83FnSnkMvRwhyhDDeI-bIQdIPrM=)",
              backgroundSize: "cover",
              backgroundPosition: "center",
              backgroundRepeat: "no-repeat",
              transform: hoveredCard === "buy" ? "scale(1.05)" : undefined,
            }}
          >
            {/* Background Overlay for text readability */}
            <div 
              className="absolute inset-0 transition-opacity duration-500" 
              style={{
                backgroundColor: hoveredCard === "buy" ? "rgba(0, 0, 0, 0.5)" : "rgba(0, 0, 0, 0.4)",
                zIndex: 1
              }}
            />
            
            {/* Gradient Overlay */}
            <div
              className="absolute inset-0 transition-opacity duration-500"
              style={{
                background: `linear-gradient(135deg, ${themeColor}15 0%, ${themeColor}05 100%)`,
                opacity: hoveredCard === "buy" ? 1 : 0,
                zIndex: 2
              }}
            />

            {/* Content - centered vertically and horizontally */}
            <div className="relative min-h-[220px] p-8 sm:p-10 lg:p-12 flex flex-col items-center justify-center text-center" style={{ zIndex: 10 }}>
              {/* Limit inner content width so text is nicely centered */}
              <div className="max-w-md w-full">
                {/* Icon */}
                <div
                  className="w-16 h-16 rounded-2xl mb-6 flex items-center justify-center transition-transform duration-300 mx-auto backdrop-blur-sm"
                  style={{ 
                    backgroundColor: `${themeColor}25`,
                    transform: hoveredCard === "buy" ? "scale(1.1)" : "scale(1)"
                  }}
                >
                  <ShoppingBag className="h-8 w-8" style={{ color: "white" }} />
                </div>

                {/* Title */}
                <h3 className="text-2xl sm:text-4xl font-bold text-white mb-4 drop-shadow-lg">
                  Buy a book
                </h3>

                {/* Optional description (uncomment if needed) */}
                {/* <p className="text-gray-600 text-lg mb-6 leading-relaxed">
                  Lifetime ownership — keep books forever.
                </p> */}

                {/* Button (responsive width & centered) */}
                <button
                  className="max-w-[210px] sm:w-auto mx-auto py-2 px-3 rounded-xl font-semibold text-lg text-white transition-all duration-300 flex items-center justify-center gap-2 shadow-lg"
                  style={{
                    backgroundColor: themeColor,
                    transform: hoveredCard === "buy" ? "scale(1.05)" : "scale(1)",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.opacity = "0.9";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.opacity = "1";
                  }}
                >
                  <span>{buy.buttonLabel}</span>
                  <ArrowRight 
                    className="h-5 w-5 transition-transform duration-300" 
                    style={{
                      transform: hoveredCard === "buy" ? "translateX(4px)" : "translateX(0)"
                    }}
                  />
                </button>
              </div>
            </div>

            {/* Decorative Corner */}
            <div className="absolute top-0 right-0 w-32 h-32 rounded-bl-full opacity-10" style={{ backgroundColor: themeColor }} />
          </div>

         
        </div>

        {/* Bottom Decorative Element */}
        <div className="mt-4 text-center">
          <div className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-gray-100 text-gray-600">
            <Sparkles className="h-4 w-4" />
            <span className="text-sm font-medium">Both options available for all titles</span>
          </div>
        </div>

        {/* How it Works Section */}
        <div className="mt-12 max-w-4xl mx-auto">
          <div className="bg-white rounded-lg shadow-md border border-gray-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-xl font-semibold text-gray-900">How it Works</h3>
            </div>
            
            <div className="px-6 py-6">
              <div className="space-y-4">
                <div className="flex gap-4">
                  <div 
                    className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center font-semibold text-white"
                    style={{ backgroundColor: themeColor }}
                  >
                    1
                  </div>
                  <div>
                    <h4 className="font-semibold text-gray-900 mb-1">Browse & Select</h4>
                    <p className="text-gray-600 text-sm">Explore our collection and choose books that interest you.</p>
                  </div>
                </div>
                
                <div className="flex gap-4">
                  <div 
                    className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center font-semibold text-white"
                    style={{ backgroundColor: themeColor }}
                  >
                    2
                  </div>
                  <div>
                    <h4 className="font-semibold text-gray-900 mb-1">Choose Your Option</h4>
                    <p className="text-gray-600 text-sm">Select Buy for ownership or Rent for temporary access at affordable rates.</p>
                  </div>
                </div>
                
                <div className="flex gap-4">
                  <div 
                    className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center font-semibold text-white"
                    style={{ backgroundColor: themeColor }}
                  >
                    3
                  </div>
                  <div>
                    <h4 className="font-semibold text-gray-900 mb-1">Complete Purchase</h4>
                    <p className="text-gray-600 text-sm">Add to cart, proceed to checkout, and complete payment securely.</p>
                  </div>
                </div>
                
                <div className="flex gap-4">
                  <div 
                    className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center font-semibold text-white"
                    style={{ backgroundColor: themeColor }}
                  >
                    4
                  </div>
                  <div>
                    <h4 className="font-semibold text-gray-900 mb-1">Start Reading</h4>
                    <p className="text-gray-600 text-sm">Access your books instantly and begin your learning journey.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Rent Confirmation Modal */}
      {showRentConfirmation && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6 relative">
            {/* Close Button */}
            <button
              onClick={handleRentCancel}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors"
              aria-label="Close"
            >
              <X className="h-5 w-5" />
            </button>

            {/* Modal Content */}
            <div className="mt-2">
              <h3 className="text-xl font-semibold text-gray-900 mb-4">
                Location Restriction
              </h3>
              <p className="text-gray-600 mb-6">
                We only allow renting books in <b>Jabalpur</b>. Do you want to continue?
              </p>

              {/* Action Buttons */}
              <div className=" flex gap-3  justify-between">
                <button
                  onClick={handleBuyRedirect}
                  className=" max-w-[320px] px-4 py-2 text-white rounded-md font-medium transition-opacity hover:opacity-90"
                  style={{ backgroundColor: themeColor }}
                >
                  Buy
                </button>
                <button
                  onClick={handleRentConfirm}
                  className="px-4 py-2 text-white rounded-md font-medium transition-opacity hover:opacity-90"
                  style={{ backgroundColor: themeColor }}
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
