import { useContext } from "react";
import { EwayContext, EwayContextType } from "../-contexts/eway-context";

/**
 * Hook to use Eway Context
 * Must be used within an EwayProvider
 *
 * @returns EwayContextType with encryption key and public key
 * @throws Error if used outside EwayProvider
 */
export const useEway = (): EwayContextType => {
  const context = useContext(EwayContext);

  if (context === undefined) {
    throw new Error("useEway must be used within an EwayProvider");
  }

  return context;
};
