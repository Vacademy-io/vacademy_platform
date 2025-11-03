import { createContext, ReactNode } from "react";

/**
 * Eway Context Interface
 * Provides Eway payment gateway configuration to child components
 */
export interface EwayContextType {
  /** Eway encryption key for client-side card data encryption */
  encryptionKey: string;
  /** Eway public API key */
  publicKey: string;
  /** Helper function to check if Eway is properly configured */
  isConfigured: boolean;
}

/**
 * Eway Context
 * Used to share Eway payment gateway keys across components
 */
export const EwayContext = createContext<EwayContextType | undefined>(
  undefined
);

/**
 * Eway Provider Props
 */
interface EwayProviderProps {
  encryptionKey: string;
  publicKey: string;
  children: ReactNode;
}

/**
 * Eway Provider Component
 * Wraps components that need access to Eway payment gateway configuration
 *
 * @param encryptionKey - Eway encryption key for encrypting card data
 * @param publicKey - Eway public API key
 * @param children - Child components
 */
export const EwayProvider = ({
  encryptionKey,
  publicKey,
  children,
}: EwayProviderProps) => {
  const isConfigured = !!(encryptionKey && publicKey);

  const value: EwayContextType = {
    encryptionKey,
    publicKey,
    isConfigured,
  };

  return <EwayContext.Provider value={value}>{children}</EwayContext.Provider>;
};
