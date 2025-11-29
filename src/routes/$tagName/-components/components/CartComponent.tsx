import React, { useState, useEffect } from "react";
import { useCartStore, CartItem } from "@/stores/cart-store";
import { CartComponentProps } from "../../-types/course-catalogue-types";
import { getPublicUrlWithoutLogin } from "@/services/upload_file";
import { Trash2, Plus, Minus } from "lucide-react";
import { Button } from "@/components/ui/button";

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
}) => {
  const { items, removeItem, updateQuantity } = useCartStore();
  const [imageUrls, setImageUrls] = useState<Record<string, string>>({});

  // Load images for all cart items
  useEffect(() => {
    const loadImages = async () => {
      const urlMap: Record<string, string> = {};
      
      for (const item of items) {
        if (item.image && item.image !== "/api/placeholder/300/200") {
          try {
            const url = await getPublicUrlWithoutLogin(item.image);
            if (url && item.enrollInviteId) {
              urlMap[item.enrollInviteId] = url;
            }
          } catch (error) {
            console.error(`[CartComponent] Error loading image for item ${item.enrollInviteId || item.id}:`, error);
          }
        }
      }
      
      setImageUrls(urlMap);
    };

    if (items.length > 0) {
      loadImages();
    }
  }, [items]);

  const handleQuantityChange = (enrollInviteId: string, newQuantity: number) => {
    updateQuantity(enrollInviteId, newQuantity);
  };

  const handleRemove = (enrollInviteId: string) => {
    removeItem(enrollInviteId);
  };

  const padding = styles.padding || "20px";
  const roundedEdges = styles.roundedEdges ? "rounded-lg" : "";
  const backgroundColor = styles.backgroundColor || "#ffffff";

  if (items.length === 0 && showEmptyState) {
    return (
      <div
        className={`w-full ${roundedEdges} flex flex-col items-center justify-center py-16 px-4`}
        style={{ backgroundColor, padding }}
      >
        <div className="text-center">
          <div className="text-6xl mb-4">🛒</div>
          <p className="text-gray-600 text-lg">{emptyStateMessage}</p>
        </div>
      </div>
    );
  }

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
    </div>
  );
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
    <div className="w-full max-w-[950px] mx-auto flex flex-col sm:flex-row gap-4 p-4 border border-gray-200 rounded-lg bg-white hover:shadow-md transition-shadow">
      {/* Item Image */}
      {showItemImage && (
        <div className="flex-shrink-0 w-full sm:w-32 h-32 bg-gray-100 rounded-lg overflow-hidden">
          {imageLoading ? (
            <div className="w-full h-full bg-gray-200 animate-pulse flex items-center justify-center">
              <div className="text-gray-400 text-sm">Loading...</div>
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
              <div className="text-gray-400 text-sm">No Image</div>
            </div>
          )}
        </div>
      )}

      {/* Item Details */}
      <div className="flex-1 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex-1">
          {showItemTitle && (
            <h3 className="text-lg font-semibold text-gray-900 mb-1">
              {item.title}
            </h3>
          )}
          {showItemLevel && item.level && (
            <p className="text-sm text-gray-600 mb-2">
              Level: {item.level}
            </p>
          )}
          {showPrice && (
            <p className="text-lg font-bold text-gray-900">
              ₹{item.price.toFixed(2)}
            </p>
          )}
        </div>

        {/* Quantity Selector and Remove Button */}
        <div className="flex items-center gap-4">
          {showQuantitySelector && (
            <div className="flex items-center gap-2 border border-gray-300 rounded-md">
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0"
                onClick={() => item.enrollInviteId && onQuantityChange(item.enrollInviteId, item.quantity - 1)}
                disabled={item.quantity <= quantityMin || !item.enrollInviteId}
              >
                <Minus className="h-4 w-4" />
              </Button>
              <span className="w-12 text-center font-medium">{item.quantity}</span>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0"
                onClick={() => item.enrollInviteId && onQuantityChange(item.enrollInviteId, item.quantity + 1)}
                disabled={!item.enrollInviteId}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          )}

          {showRemoveButton && (
            <Button
              variant="ghost"
              size="sm"
              className="text-red-600 hover:text-red-700 hover:bg-red-50"
              onClick={() => item.enrollInviteId && onRemove(item.enrollInviteId)}
              disabled={!item.enrollInviteId}
            >
              <Trash2 className="h-5 w-5" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};

