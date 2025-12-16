import React, { useState, useEffect, useRef } from "react";
import { useCartStore, CartItem } from "../../-stores/cart-store";
import { CartComponentProps } from "../../-types/course-catalogue-types";
import { getPublicUrlWithoutLogin } from "@/services/upload_file";
import { Trash2, Plus, Minus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getMembershipPlans, MembershipPlan } from "../../-services/membership-plan-service";
import { INSTITUTE_ID } from "@/constants/urls";
import { toast } from "sonner";

export const CartComponent: React.FC<CartComponentProps> = ({
  showItemImage = true,
  showItemTitle = true,
  showItemLevel = true,
  showQuantitySelector = true,
  quantityMin = 1,
  showRemoveButton = true,
  showPrice = true,
  showEmptyState = true,
  emptyStateMessage = "Your cart is empty. Add some books!",
  styles = {},
  instituteId, // Accept instituteId prop
}) => {

  const { items, removeItem, updateQuantity, membershipPlan, getItemCount, getTotal, syncCart } = useCartStore();
  const [imageUrls, setImageUrls] = useState<Record<string, string>>({});
  const [isRentMode, setIsRentMode] = useState(false);
  const [membershipPlans, setMembershipPlans] = useState<MembershipPlan[]>([]);
  const [isLoadingPlans, setIsLoadingPlans] = useState(false);

  useEffect(() => {
    // Check for Rent mode in session storage and sync cart
    const checkLevelFilter = () => {
      const levelFilter = sessionStorage.getItem("levelFilter");
      console.log("[CartComponent] Checking levelFilter:", levelFilter);
      const isRent = !!(levelFilter && levelFilter.includes("Rent"));
      setIsRentMode(isRent);
      // Sync cart when mode changes
      syncCart();
    };

    checkLevelFilter();

    // Listen for storage changes
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'levelFilter') {
        checkLevelFilter();
      }
    };
    window.addEventListener('storage', handleStorageChange);

    // Listen for custom events
    const handleLevelFilterChange = () => {
      checkLevelFilter();
    };
    window.addEventListener('levelFilterChanged', handleLevelFilterChange);

    // Also check periodically (for same-tab changes)
    const interval = setInterval(checkLevelFilter, 500);

    return () => {
      clearInterval(interval);
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('levelFilterChanged', handleLevelFilterChange);
    };
  }, [syncCart]);

  // Fetch membership plans when in Rent mode
  useEffect(() => {
    const fetchMembershipPlans = async () => {
      console.log("[CartComponent] fetchMembershipPlans triggered", { isRentMode, instituteId });

      if (!isRentMode) {
        console.log("[CartComponent] Skipping fetch - not in Rent mode");
        return;
      }

      // Use provided instituteId or fallback to INSTITUTE_ID constant
      const effectiveInstituteId = instituteId || INSTITUTE_ID;
      console.log("[CartComponent] Using instituteId:", effectiveInstituteId);

      setIsLoadingPlans(true);
      try {
        console.log("[CartComponent] Fetching membership plans...");
        const plans = await getMembershipPlans(effectiveInstituteId);
        console.log("[CartComponent] Fetched membership plans:", plans);
        console.log("[CartComponent] Number of plans:", plans.length);
        setMembershipPlans(plans);
      } catch (error) {
        console.error("[CartComponent] Error fetching membership plans:", error);
        setMembershipPlans([]);
      } finally {
        setIsLoadingPlans(false);
        console.log("[CartComponent] Finished fetching membership plans");
      }
    };

    fetchMembershipPlans();
  }, [isRentMode, instituteId]);

  // Cache for fetched images to prevent repeated API calls
  const fetchedImagesRef = useRef<Set<string>>(new Set());

  // Load images for all cart items
  useEffect(() => {
    const loadImages = async () => {
      // Create a list of promises to fetch images in parallel, but only for those not yet fetched
      const promises = items.map(async (item) => {
        const itemId = item.enrollInviteId || item.id;

        // Skip if invalid ID or already fetched
        if (!itemId || fetchedImagesRef.current.has(itemId)) return;

        // Mark as fetched immediately to prevent duplicate calls
        fetchedImagesRef.current.add(itemId);

        if (item.image && item.image !== "/api/placeholder/300/200") {
          try {
            const url = await getPublicUrlWithoutLogin(item.image);
            if (url && item.enrollInviteId) {
              setImageUrls(prev => ({ ...prev, [item.enrollInviteId!]: url }));
            }
          } catch (error) {
            console.error(`[CartComponent] Error loading image for item ${itemId}:`, error);
          }
        }
      });

      await Promise.all(promises);
    };

    if (items.length > 0) {
      loadImages();
    }
  }, [items]);

  const handleQuantityChange = async (enrollInviteId: string, newQuantity: number) => {
    await updateQuantity(enrollInviteId, newQuantity);
    window.dispatchEvent(new CustomEvent('cartUpdated'));
  };

  const handleRemove = async (enrollInviteId: string) => {
    await removeItem(enrollInviteId);
    window.dispatchEvent(new CustomEvent('cartUpdated'));
  };

  const padding = styles.padding || "10px";
  const roundedEdges = styles.roundedEdges ? "rounded-lg" : "";
  const backgroundColor = styles.backgroundColor || "#ffffff";

  if (items.length === 0 && showEmptyState) {
    return (
      <div
        className={`w-full ${roundedEdges} flex flex-col items-center justify-center py-12 px-4`}
        style={{ backgroundColor, padding }}
      >
        <div className="text-center">
          <div className="text-5xl mb-2">🛒</div>
          <p className="text-gray-600 text-sm sm:text-base">{emptyStateMessage}</p>
        </div>
      </div>
    );
  }

  // RENT MODE LAYOUT (Horizontal Scroll)
  if (isRentMode) {
    return (
      <div
        className={`w-full ${roundedEdges} relative space-y-6`}
        style={{ backgroundColor, padding }}
      >
        {/* Cart Items Section */}
        <div>
          <h2 className="text-base sm:text-lg font-semibold text-gray-800 mb-3">Your Books</h2>
          <div className="flex overflow-x-auto gap-3 pb-4 snap-x pr-4 scrollbar-hide">
            {items.map((item) => (
              <div
                key={item.enrollInviteId || item.id}
                className="flex-shrink-0 w-[130px] sm:w-[140px] snap-start flex flex-col bg-white rounded-lg border border-gray-200 overflow-hidden shadow-sm hover:shadow-md transition-all duration-200 relative group active:scale-[0.98]"
              >
                {/* Delete Button - Overlay Top Right */}
                {showRemoveButton && (
                  <button
                    className="absolute top-1.5 right-1.5 z-10 p-1.5 bg-white/95 rounded-full shadow-md text-red-500 hover:text-red-700 hover:bg-red-50 transition-all duration-200 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 active:scale-90"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (item.enrollInviteId) handleRemove(item.enrollInviteId);
                    }}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}

                {/* Image */}
                <div className="w-full h-[170px] sm:h-[180px] bg-gray-100 relative overflow-hidden">
                  <SimpleImage
                    src={item.enrollInviteId ? imageUrls[item.enrollInviteId] : undefined}
                    fallbackSrc={item.image}
                    alt={item.title}
                  />
                </div>

                {/* Minimal Details */}
                <div className="p-2.5 flex flex-col gap-1">
                  {showItemTitle && (
                    <h3 className="text-xs sm:text-sm font-semibold text-gray-900 line-clamp-2 leading-tight min-h-[2.5em]">
                      {item.title}
                    </h3>
                  )}
                  {/* No Quantity, No Price in Rent view as requested */}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Membership Plans Section */}
        <div className="mt-5">
          <h2 className="text-base sm:text-lg font-semibold text-gray-900 mb-3">Subscription Plans</h2>

          {isLoadingPlans ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {[1, 2].map((i) => (
                <div key={i} className="h-32 bg-gray-200 rounded-lg animate-pulse" />
              ))}
            </div>
          ) : membershipPlans.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {membershipPlans.map((plan) => (
                <MembershipPlanCard key={plan.id} plan={plan} />
              ))}
            </div>
          ) : (
            <div className="text-center py-6 text-gray-500">
              <p className="text-sm">No membership plans available at the moment.</p>
            </div>
          )}
        </div>

        {/* Subtotal, Total and Checkout Button Section */}
        {items.length > 0 && (
          <div className="mt-5 bg-gray-50 rounded-lg p-3 sm:p-4 border border-gray-200">

            {/* Total */}
            <div className="flex justify-between items-center pt-3 border-t border-gray-200 mb-3">
              <span className="text-base sm:text-lg font-semibold text-gray-900">Total</span>
              <span className="text-base sm:text-lg font-bold text-gray-900">₹{getTotal().toFixed(2)}</span>
            </div>

            {/* Checkout Button */}
            <Button
              onClick={() => {
                // Check if at least one membership plan is selected
                if (!membershipPlan) {
                  toast.error("Please select a membership plan before checkout", {
                    duration: 3000,
                  });
                  return;
                }

                // Get total number of books in cart
                const totalBooksInCart = getItemCount();
                // Fixed number of books allowed: 3
                const fixedBooksAllowed = 3;

                // Check if cart exceeds the fixed book limit
                if (totalBooksInCart > fixedBooksAllowed) {
                  toast.error(
                    "You had more then the desired number of books",
                    {
                      duration: 4000,
                    }
                  );
                  return;
                }

                // All validations passed - proceed to checkout
                console.log("[CartComponent] Proceeding to checkout with items:", items, "Plan:", membershipPlan);
                toast.success("Proceeding to checkout...", { duration: 2000 });
                // Implement your checkout flow here
              }}
              className="w-full bg-primary-100 hover:bg-primary-500 active:bg-primary-500 text-white font-semibold text-sm sm:text-base py-2.5 sm:py-3 rounded-lg shadow-md transition-all duration-200 active:scale-[0.98]"
              size="lg"
            >
              Checkout
            </Button>
          </div>
        )}
      </div>
    );
  }

  // STANDARD LAYOUT (Vertical List) - For Buy mode
  return (
    <div
      className={`w-full ${roundedEdges} space-y-4`}
      style={{ backgroundColor, padding }}
    >
      {items.map((item) => (
        <CartItemCard
          key={item.enrollInviteId || item.id}
          item={item}
          imageUrl={item.enrollInviteId ? imageUrls[item.enrollInviteId] : undefined}
          showItemImage={showItemImage}
          showItemTitle={showItemTitle}
          showItemLevel={showItemLevel}
          showQuantitySelector={showQuantitySelector}
          showRemoveButton={showRemoveButton}
          showPrice={showPrice}
          onQuantityChange={handleQuantityChange}
          onRemove={handleRemove}
          quantityMin={quantityMin}
        />
      ))}

      {/* Checkout Button for Buy mode */}
      {items.length > 0 && !isRentMode && (
        <div className="mt-5 bg-gray-50 rounded-lg p-3 sm:p-4 border border-gray-200">
          {/* Total */}
          <div className="flex justify-between items-center pt-3 border-t border-gray-200 mb-3">
            <span className="text-base sm:text-lg font-semibold text-gray-900">Total</span>
            <span className="text-base sm:text-lg font-bold text-gray-900">₹{getTotal().toFixed(2)}</span>
          </div>

          {/* Checkout Button */}
          <Button
            onClick={() => {
              // All validations passed - proceed to checkout
              console.log("[CartComponent] Proceeding to checkout with items:", items);
              toast.success("Proceeding to checkout...", { duration: 2000 });
              // Implement your checkout flow here
            }}
            className="w-full bg-primary-400 hover:bg-primary-500 active:bg-primary-500 text-white font-semibold text-sm sm:text-base py-2.5 sm:py-3 rounded-lg shadow-md transition-all duration-200 active:scale-[0.98]"
            size="lg"
          >
            Checkout
          </Button>
        </div>
      )}
    </div>
  );
};

// Helper for simple image loading in Rent loop
const SimpleImage = ({ src, fallbackSrc, alt }: { src?: string; fallbackSrc?: string; alt: string }) => {
  const [finalSrc, setFinalSrc] = useState<string | null>(src || null);

  useEffect(() => {
    if (src) {
      setFinalSrc(src);
    } else if (fallbackSrc && fallbackSrc !== "/api/placeholder/300/200") {
      getPublicUrlWithoutLogin(fallbackSrc).then(url => setFinalSrc(url)).catch(() => { });
    }
  }, [src, fallbackSrc]);

  if (!finalSrc) return <div className="w-full h-full bg-gray-200" />;
  return <img src={finalSrc} alt={alt} className="w-full h-full object-cover" />;
};

interface CartItemCardProps {
  item: CartItem;
  imageUrl?: string;
  showItemImage: boolean;
  showItemTitle: boolean;
  showItemLevel: boolean;
  showQuantitySelector: boolean;
  showRemoveButton: boolean;
  showPrice: boolean;
  onQuantityChange: (enrollInviteId: string, quantity: number) => void;
  onRemove: (enrollInviteId: string) => void;
  quantityMin: number;
}

const CartItemCard: React.FC<CartItemCardProps> = ({
  item,
  imageUrl,
  showItemImage,
  showItemTitle,
  showItemLevel,
  showQuantitySelector,
  showRemoveButton,
  showPrice,
  onQuantityChange,
  onRemove,
  quantityMin,
}) => {
  const [currentImageUrl, setCurrentImageUrl] = useState<string | null>(imageUrl || null);
  const [imageLoading, setImageLoading] = useState(true);

  useEffect(() => {
    if (imageUrl) {
      setCurrentImageUrl(imageUrl);
      setImageLoading(false);
    } else if (item.image && item.image !== "/api/placeholder/300/200") {
      setImageLoading(true);
      getPublicUrlWithoutLogin(item.image)
        .then((url) => {
          setCurrentImageUrl(url);
          setImageLoading(false);
        })
        .catch(() => {
          setImageLoading(false);
        });
    } else {
      setImageLoading(false);
    }
  }, [imageUrl, item.image]);

  return (
    <div className="w-full max-w-[950px] mx-auto flex flex-row gap-2.5 sm:gap-3 p-2.5 sm:p-3 border border-gray-200 rounded-lg bg-white hover:shadow-md hover:border-gray-300 transition-all duration-200 active:scale-[0.99]">
      {/* Item Image - Compact on mobile */}
      {showItemImage && (
        <div className="flex-shrink-0 w-[85px] h-[125px] sm:w-[110px] sm:h-[170px] bg-gray-100 rounded-lg overflow-hidden shadow-sm">
          {imageLoading ? (
            <div className="w-full h-full bg-gray-200 animate-pulse flex items-center justify-center">
              <div className="text-gray-400 text-xs">...</div>
            </div>
          ) : currentImageUrl ? (
            <img
              src={currentImageUrl}
              alt={item.title}
              className="w-full h-full object-cover"
              onError={() => setCurrentImageUrl(null)}
            />
          ) : (
            <div className="w-full h-full bg-gray-200 flex items-center justify-center">
              <div className="text-gray-400 text-xs">No Img</div>
            </div>
          )}
        </div>
      )}

      {/* Item Details - Flex Column for Mobile, organized */}
      <div className="flex-1 flex flex-col justify-between min-w-0">
        <div className="flex justify-between items-start gap-2">
          {/* Title and Level */}
          <div className="flex-1 min-w-0">
            {showItemTitle && (
              <h3 className="text-sm sm:text-base font-semibold text-gray-900 line-clamp-2 leading-tight">
                {item.title}
              </h3>
            )}
            {showItemLevel && item.level && (
              <p className="text-xs text-gray-500 mt-1 font-medium">
                {item.level}
              </p>
            )}
          </div>

          {/* Price - Always visible on top right */}
          {showPrice && (
            <div className="text-right flex-shrink-0">
              <p className="text-sm sm:text-base font-bold text-gray-900">
                ₹{item.price.toFixed(0)}
              </p>
            </div>
          )}
        </div>

        {/* Controls Row */}
        <div className="flex items-center justify-between mt-2 pt-2 border-t border-gray-100 sm:border-t-0 sm:pt-0">
          {showQuantitySelector ? (
            <div className="flex items-center gap-0.5 border border-gray-200 rounded-lg bg-gray-50 shadow-sm hover:bg-gray-100 transition-colors">
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 sm:h-8 sm:w-8 hover:bg-white active:bg-gray-200 rounded-l-lg transition-all duration-150"
                onClick={() => item.enrollInviteId && onQuantityChange(item.enrollInviteId, item.quantity - 1)}
                disabled={item.quantity <= quantityMin || !item.enrollInviteId}
              >
                <Minus className="h-3.5 w-3.5" />
              </Button>
              <span className="w-7 sm:w-8 text-center text-xs sm:text-sm font-semibold text-gray-700">{item.quantity}</span>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 sm:h-8 sm:w-8 hover:bg-white active:bg-gray-200 rounded-r-lg transition-all duration-150"
                onClick={() => item.enrollInviteId && onQuantityChange(item.enrollInviteId, item.quantity + 1)}
                disabled={!item.enrollInviteId}
              >
                <Plus className="h-3.5 w-3.5" />
              </Button>
            </div>
          ) : <div />}

          {showRemoveButton && (
            <button
              className="group flex items-center gap-1 text-red-500 hover:text-red-700 active:text-red-800 transition-all duration-200 px-2 py-1 rounded hover:bg-red-50 active:bg-red-100 active:scale-95"
              onClick={() => item.enrollInviteId && onRemove(item.enrollInviteId)}
              disabled={!item.enrollInviteId}
            >
              <Trash2 className="h-3.5 w-3.5 sm:h-4 sm:w-4 transition-transform group-hover:scale-110" />
              <span className="text-xs font-medium hidden sm:inline">Remove</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

// Membership Plan Card Component - Compact Mobile-First Design
interface MembershipPlanCardProps {
  plan: MembershipPlan;
}

const MembershipPlanCard: React.FC<MembershipPlanCardProps> = ({ plan }) => {
  const { setMembershipPlan, membershipPlan } = useCartStore();
  const isSelected = membershipPlan?.id === plan.id;

  const handleSelectPlan = (e: React.MouseEvent) => {
    e.stopPropagation();
    // Fixed number of books: 3
    const fixedNumberOfBooks = 3;
    setMembershipPlan({
      id: plan.id,
      title: plan.package_name,
      price: plan.min_plan_actual_price,
      numberOfBooks: fixedNumberOfBooks,
    });
  };

  // Extract fields - handle various possible field names
  const planName = plan.package_name || "Plan";
  // Fixed number of books: 3
  const numberOfBooks = 3;
  const description = plan.description || plan.package_description || "Premium subscription plan";
  const price = plan.min_plan_actual_price || 0;
  const currencySymbol = '₹';

  return (
    <div
      className={`
        rounded-lg p-2.5 sm:p-3 border-2 transition-all duration-200 cursor-pointer active:scale-[0.97] hover:scale-[1.01]
        ${isSelected
          ? 'bg-primary-50 border-primary-500 shadow-md'
          : 'bg-white border-gray-200 hover:border-primary-300 hover:shadow-sm'
        }
      `}
      onClick={handleSelectPlan}
    >
      {/* Compact Card - 2 rows layout */}
      <div className="space-y-2">
        {/* Row 1: Name and Price */}
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-sm sm:text-base font-semibold text-gray-900 line-clamp-1 flex-1 min-w-0">
            {planName}
          </h3>
          <div className="flex items-baseline gap-0.5 flex-shrink-0">
            <span className="text-sm sm:text-base font-bold text-gray-900">
              {currencySymbol}{price.toFixed(0)}
            </span>
          </div>
        </div>

        {/* Row 2: Description and Books Count */}
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs text-gray-600 line-clamp-1 flex-1 min-w-0">
            {description}
          </p>
          <div className="flex items-center gap-1 flex-shrink-0">
            <span className="text-xs text-gray-500">Books:</span>
            <span className="text-xs font-semibold text-gray-700">
              {numberOfBooks}
            </span>
          </div>
        </div>

        {/* Select Button */}
        <button
          className={`
            w-full mt-2 py-2 px-2 rounded-md text-xs sm:text-sm font-semibold transition-all duration-200 active:scale-95
            ${isSelected
              ? 'bg-primary-600 text-blue font-bold shadow-sm hover:bg-primary-700'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }
          `}
          onClick={handleSelectPlan}
        >
          {isSelected ? 'Selected' : 'Select'}
        </button>
      </div>
    </div>
  );
};

