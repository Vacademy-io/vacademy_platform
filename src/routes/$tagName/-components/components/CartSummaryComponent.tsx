import React from "react";
import { useCartStore } from "@/stores/cart-store";
import { CartSummaryProps } from "../../-types/course-catalogue-types";
import { Button } from "@/components/ui/button";
import { useNavigate } from "@tanstack/react-router";

export const CartSummaryComponent: React.FC<CartSummaryProps> = ({
  showSubtotal = true,
  showTaxes = false,
  showTotal = true,
  checkoutButtonEnabled = true,
  checkoutButtonLabel = "Proceed to Checkout",
  styles = {},
}) => {
  const { items, getTotal } = useCartStore();
  const navigate = useNavigate();
  const subtotal = getTotal();
  const taxRate = 0.18; // 18% GST (adjust as needed)
  const taxes = (showTaxes === true) ? subtotal * taxRate : 0;
  const total = subtotal + taxes;

  const padding = styles.padding || "20px";
  const roundedEdges = styles.roundedEdges ? "rounded-lg" : "";
  const backgroundColor = styles.backgroundColor || "#f9fafb";

  const handleCheckout = () => {
    // Navigate to checkout or payment page
    // You can customize this based on your routing structure
    console.log("[CartSummary] Proceeding to checkout with items:", items);
    // Example: navigate({ to: "/checkout" });
    // For now, just log - you can implement checkout flow later
  };

  if (items.length === 0) {
    return null;
  }

  return (
    <div
      className={`w-full max-w-[950px] mx-auto ${roundedEdges} border border-gray-200`}
      style={{ backgroundColor, padding }}
    >
      <div className="space-y-4">
        {showSubtotal && (
          <div className="flex justify-between items-center">
            <span className="text-gray-600">Subtotal</span>
            <span className="text-gray-900 font-medium">₹{subtotal.toFixed(2)}</span>
          </div>
        )}

        {showTaxes===true && (
          <div className="flex justify-between items-center">
            <span className="text-gray-600">Taxes (GST)</span>
            <span className="text-gray-900 font-medium">₹{taxes.toFixed(2)}</span>
          </div>
        )}

        {showTotal && (
          <div className="flex justify-between items-center pt-4 border-t border-gray-200">
            <span className="text-lg font-semibold text-gray-900">Total</span>
            <span className="text-xl font-bold text-gray-900">₹{total.toFixed(2)}</span>
          </div>
        )}

        {checkoutButtonEnabled && (
          <Button
            onClick={handleCheckout}
            className="w-full mt-6 bg-primary-600 hover:bg-primary-700 text-white"
            size="lg"
          >
            {checkoutButtonLabel}
          </Button>
        )}
      </div>
    </div>
  );
};




