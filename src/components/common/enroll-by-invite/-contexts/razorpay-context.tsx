import { createContext, useContext, ReactNode } from "react";

interface RazorpayContextType {
  keyId: string | null;
}

const RazorpayContext = createContext<RazorpayContextType | undefined>(
  undefined
);

interface RazorpayProviderProps {
  keyId: string;
  children: ReactNode;
}

/**
 * Razorpay Provider Component
 *
 * Provides Razorpay configuration (keyId) to child components
 * This allows payment forms to access Razorpay credentials without prop drilling
 *
 * @param keyId - Razorpay key ID from backend
 * @param children - Child components that need Razorpay context
 */
export const RazorpayProvider = ({
  keyId,
  children,
}: RazorpayProviderProps) => {
  return (
    <RazorpayContext.Provider value={{ keyId }}>
      {children}
    </RazorpayContext.Provider>
  );
};

/**
 * Hook to access Razorpay context
 * Must be used within a RazorpayProvider
 *
 * @returns Razorpay context containing keyId
 * @throws Error if used outside RazorpayProvider
 */
export const useRazorpay = (): RazorpayContextType => {
  const context = useContext(RazorpayContext);

  if (context === undefined) {
    throw new Error("useRazorpay must be used within a RazorpayProvider");
  }

  return context;
};
