import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { getPublicUrl } from "@/components/common/study-library/level-material/subject-material/module-material/chapter-material/slide-material/excalidrawUtils";
import { getCachedInstituteBranding } from "@/services/domain-routing";

export interface InstituteBranding {
  instituteId: string | null;
  instituteName: string | null;
  instituteLogoFileId: string | null;
  instituteThemeCode: string | null;
  homeIconClickRoute?: string | null;
  // White-label display overrides. When unset, defaults apply.
  hideInstituteName?: boolean | null;
  logoWidthPx?: number | null;
  logoHeightPx?: number | null;
}

interface InstituteBrandingProps {
  branding: InstituteBranding;
  size?: "small" | "medium" | "large";
  showName?: boolean;
  className?: string;
}

export const InstituteBrandingComponent: React.FC<InstituteBrandingProps> = ({
  branding,
  size = "medium",
  showName = true,
  className = "",
}) => {
  // These three overrides live on institute_domain_routing, NOT on the
  // institute record — so a caller that builds `branding` from an institute
  // lookup has no way to know them, and most callers simply forgot to thread
  // them. Fall back to the resolved domain's cached values so the overrides
  // apply everywhere instead of only where someone remembered.
  //
  // Guarded on instituteId: a screen rendering institute A's mark while the
  // browser sits on institute B's domain must NOT inherit B's logo box or name
  // suppression. Only an id match (or a caller that named no institute at all)
  // opts in. An explicit value on `branding` always wins.
  const domainBranding = getCachedInstituteBranding();
  const domainOverridesApply =
    !!domainBranding?.instituteId &&
    (!branding.instituteId ||
      domainBranding.instituteId === branding.instituteId);
  const resolveOverride = <T,>(
    own: T | null | undefined,
    fromDomain: T | null | undefined
  ): T | null => own ?? (domainOverridesApply ? (fromDomain ?? null) : null);

  const effectiveHideInstituteName = resolveOverride(
    branding.hideInstituteName,
    domainBranding?.hideInstituteName
  );
  const effectiveLogoWidthPx = resolveOverride(
    branding.logoWidthPx,
    domainBranding?.logoWidthPx
  );
  const effectiveLogoHeightPx = resolveOverride(
    branding.logoHeightPx,
    domainBranding?.logoHeightPx
  );

  // Explicit hideInstituteName on the branding record overrides the showName
  // prop (which is set by parents based on context). This lets white-label
  // settings take effect without every caller threading the flag manually.
  const effectiveShowName =
    effectiveHideInstituteName === true ? false : showName;
  const hasCustomLogoDims =
    typeof effectiveLogoWidthPx === "number" ||
    typeof effectiveLogoHeightPx === "number";
  const customLogoStyle: React.CSSProperties | undefined = hasCustomLogoDims
    ? {
        width:
          typeof effectiveLogoWidthPx === "number"
            ? effectiveLogoWidthPx
            : undefined,
        height:
          typeof effectiveLogoHeightPx === "number"
            ? effectiveLogoHeightPx
            : undefined,
      }
    : undefined;
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const isClickable = Boolean(branding.homeIconClickRoute);

  const handleLogoClick = () => {
    if (!branding.homeIconClickRoute) return;
    window.location.href = branding.homeIconClickRoute;
  };

  useEffect(() => {
    const loadLogo = async () => {
      setIsLoading(true);
      try {
        if (branding.instituteLogoFileId) {
          const url = await getPublicUrl(branding.instituteLogoFileId);
          setLogoUrl(url);
        } else {
          setLogoUrl(null);
        }
      } catch (error) {
        console.error("Error loading institute logo:", error);
        setLogoUrl(null);
      } finally {
        setIsLoading(false);
      }
    };

    loadLogo();
  }, [branding.instituteLogoFileId]);

  const sizeClasses = {
    small: "w-10 h-10 sm:w-12 sm:h-12",
    medium: "w-12 h-12 sm:w-14 sm:h-14",
    large: "w-12 h-12 sm:w-14 sm:h-14 md:w-16 md:h-16",
  };

  const textSizes = {
    small: "text-sm",
    medium: "text-base",
    large: "text-lg font-semibold",
  };

  const getInstituteDisplayName = (instituteName: string | null): string => {
    return instituteName || "";
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className={`flex flex-col items-center gap-3 ${className}`}
    >
      {/* Logo */}
      <motion.div
        initial={{ scale: 0.8 }}
        animate={{ scale: 1 }}
        transition={{ duration: 0.3, delay: 0.1 }}
        className={`relative ${hasCustomLogoDims ? "" : sizeClasses[size]} flex-shrink-0 my-2${isClickable ? " cursor-pointer" : ""}`}
        style={customLogoStyle}
        onClick={isClickable ? handleLogoClick : undefined}
      >
        {isLoading ? (
          <div
            className={`${hasCustomLogoDims ? "" : sizeClasses[size]} bg-gray-200 rounded-lg animate-pulse`}
            style={customLogoStyle}
          />
        ) : logoUrl ? (
          <img
            src={logoUrl}
            className={`${hasCustomLogoDims ? "" : sizeClasses[size]} object-contain rounded-lg`}
            style={customLogoStyle}
            onError={() => setLogoUrl(null)}
          />
        ) : (
          <div
            className={`${hasCustomLogoDims ? "" : sizeClasses[size]} bg-gray-100 rounded-lg flex items-center justify-center`}
            style={customLogoStyle}
          >
            <div className="w-1/2 h-1/2 bg-gray-200 rounded animate-pulse" />
          </div>
        )}
      </motion.div>

      {/* Institute Name */}
      {effectiveShowName && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.2 }}
          className="flex flex-col items-center text-center"
        >
          <h2 className={`font-semibold text-gray-900 ${textSizes[size]} leading-tight`}>
            {getInstituteDisplayName(branding.instituteName)}
          </h2>
          
        </motion.div>
      )}
    </motion.div>
  );
};

// Specialized component for auth pages
export const AuthPageBranding: React.FC<{ branding: InstituteBranding }> = ({ branding }) => {

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="text-center mb-8"
    >
      <InstituteBrandingComponent
        branding={branding}
        size="large"
        showName={true}
        className="justify-center mb-4"
      />
      
    </motion.div>
  );
};

export default InstituteBrandingComponent;
