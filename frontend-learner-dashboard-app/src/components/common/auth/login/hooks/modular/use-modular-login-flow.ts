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
    console.group("[useModularLoginFlow] Effect run");
    console.log("instituteId:", instituteId);
    console.log("has instituteDetails:", Boolean(instituteDetails));
    console.log("instituteError:", instituteError ? String(instituteError) : null);

    // If no institute ID, use default settings
    if (!instituteId || instituteId.trim() === "") {
      const defaults = mapLoginSettings(null);
      console.info("[useModularLoginFlow] No instituteId, using default login settings:", defaults.providers);
      setSettings(defaults);
      setError(null);
      setIsLoading(false);
      console.groupEnd();
      return;
    }

    if (instituteDetails) {
      try {
        // Parse institute settings to extract signup configuration (use signup settings for login)
        const instituteSettings = parseInstituteSettings(instituteDetails.setting || "");
        console.info("[useModularLoginFlow] Parsed institute settings, signup present:", Boolean(instituteSettings.signup));
        const signupSettings = instituteSettings.signup; // Use signup settings for login
        
        // Map signup settings to login settings format
        const mappedSettings = mapLoginSettings(signupSettings);
        console.info("[useModularLoginFlow] Mapped login providers:", mappedSettings.providers);
        
        setSettings(mappedSettings);
        setError(null);
      } catch (err) {
        console.error("[useModularLoginFlow] Error mapping login settings:", err);
        setError("Failed to load login configuration");
        // Fallback to default settings
        const defaults = mapLoginSettings(null);
        console.info("[useModularLoginFlow] Fallback to default settings:", defaults.providers);
        setSettings(defaults);
      } finally {
        setIsLoading(false);
        console.groupEnd();
      }
    } else if (instituteError) {
      console.warn("[useModularLoginFlow] Institute error, using defaults");
      setError("Failed to load institute details");
      // Fallback to default settings
      const defaults = mapLoginSettings(null);
      console.info("[useModularLoginFlow] Defaults due to error:", defaults.providers);
      setSettings(defaults);
      setIsLoading(false);
      console.groupEnd();
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
