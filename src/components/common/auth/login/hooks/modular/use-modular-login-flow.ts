import { useState, useEffect } from "react";
import { LoginSettings } from "@/config/login/defaultLoginSettings";
import { mapLoginSettings } from "@/config/login/mapLoginSettings";
import { parseInstituteSettings, useInstituteQuery } from "@/services/signup-api";

interface UseModularLoginFlowProps {
  instituteId: string;
}

export function useModularLoginFlow({ instituteId }: UseModularLoginFlowProps) {
  const [settings, setSettings] = useState<LoginSettings | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Use the same institute query as signup to ensure consistency
  const { data: instituteDetails, isLoading: isLoadingInstitute, error: instituteError } = useInstituteQuery({ instituteId });

  useEffect(() => {
    // If no institute ID, use default settings
    if (!instituteId || instituteId.trim() === "") {
      setSettings(mapLoginSettings(null));
      setError(null);
      setIsLoading(false);
      return;
    }

    if (instituteDetails) {
      try {
        // Parse institute settings to extract signup configuration (use signup settings for login)
        const instituteSettings = parseInstituteSettings(instituteDetails.setting || "");
        const signupSettings = instituteSettings.signup; // Use signup settings for login
        
        // Map signup settings to login settings format
        const mappedSettings = mapLoginSettings(signupSettings);
        
        setSettings(mappedSettings);
        setError(null);
      } catch (err) {
        console.error("Error mapping login settings:", err);
        setError("Failed to load login configuration");
        // Fallback to default settings
        setSettings(mapLoginSettings(null));
      } finally {
        setIsLoading(false);
      }
    } else if (instituteError) {
      setError("Failed to load institute details");
      // Fallback to default settings
      setSettings(mapLoginSettings(null));
      setIsLoading(false);
    }
  }, [instituteId, instituteDetails, instituteError]);

  const resetFlow = () => {
    setError(null);
    setIsLoading(true);
  };

  return {
    settings,
    isLoading: isLoading || isLoadingInstitute,
    error,
    resetFlow,
    instituteDetails,
  };
}
