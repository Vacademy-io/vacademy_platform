import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { SignupSettings } from "@/config/signup/defaultSignupSettings";
import { mapSignupSettings } from "@/config/signup/mapSignupSettings";
import { useInstituteQuery, parseInstituteSettings } from "@/services/signup-api";

interface UseModularSignupFlowProps {
  instituteId: string;
}

export function useModularSignupFlow({ instituteId }: UseModularSignupFlowProps) {
  const [settings, setSettings] = useState<SignupSettings | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Only fetch institute details if we have a valid institute ID
  const { data: instituteDetails, isLoading: isLoadingInstitute, error: instituteError } = useQuery({
    ...useInstituteQuery({ instituteId }),
    enabled: !!instituteId && instituteId.trim() !== "",
  });

  useEffect(() => {
    // If no institute ID, use default settings
    if (!instituteId || instituteId.trim() === "") {
      setSettings(mapSignupSettings(null));
      setError(null);
      setIsLoading(false);
      return;
    }

    if (instituteDetails) {
      try {
        // Parse institute settings to extract signup configuration
        const instituteSettings = parseInstituteSettings(instituteDetails.setting);
        const signupSettings = instituteSettings.signup;
        
        const mappedSettings = mapSignupSettings(signupSettings);
        
        setSettings(mappedSettings);
        setError(null);
      } catch (err) {
        setError("Failed to load signup configuration");
        // Fallback to default settings
        setSettings(mapSignupSettings(null));
      } finally {
        setIsLoading(false);
      }
    } else if (instituteError) {
      setError("Failed to load institute details");
      // Fallback to default settings
      setSettings(mapSignupSettings(null));
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
