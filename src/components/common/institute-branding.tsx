import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { getPublicUrl } from "@/components/common/study-library/level-material/subject-material/module-material/chapter-material/slide-material/excalidrawUtils";

export interface InstituteBranding {
  instituteId: string | null;
  instituteName: string | null;
  instituteLogoFileId: string | null;
  instituteThemeCode: string | null;
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
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

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
    small: "w-16 h-16",
    medium: "w-20 h-20",
    large: "w-24 h-24",
  };

  const textSizes = {
    small: "text-sm",
    medium: "text-base",
    large: "text-lg",
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
        className={`relative ${sizeClasses[size]} flex-shrink-0`}
      >
        {isLoading ? (
          <div className={`${sizeClasses[size]} bg-gray-200 rounded-lg animate-pulse`} />
        ) : logoUrl ? (
          <img
            src={logoUrl}
            alt={`${getInstituteDisplayName(branding.instituteName)} logo`}
            className={`${sizeClasses[size]} object-contain rounded-lg`}
            onError={() => setLogoUrl(null)}
          />
        ) : (
          <div className={`${sizeClasses[size]} bg-gray-100 rounded-lg flex items-center justify-center`}>
            <div className="w-1/2 h-1/2 bg-gray-200 rounded animate-pulse" />
          </div>
        )}
      </motion.div>

      {/* Institute Name */}
      {showName && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.2 }}
          className="flex flex-col items-center text-center"
        >
          <h2 className={`font-semibold text-gray-900 ${textSizes[size]} leading-tight`}>
            {getInstituteDisplayName(branding.instituteName)}
          </h2>
          {branding.instituteName}
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
