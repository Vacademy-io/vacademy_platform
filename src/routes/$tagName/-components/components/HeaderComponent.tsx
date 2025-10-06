import React from "react";
import { useNavigate } from "@tanstack/react-router";
import { HeaderProps } from "../../-types/course-catalogue-types";
import { useDomainRouting } from "@/hooks/use-domain-routing";
import { getPublicUrlWithoutLogin } from "@/services/upload_file";
import { useState, useEffect } from "react";

export const HeaderComponent: React.FC<HeaderProps & { 
  navigation?: Array<{ label: string; route: string }>;
  authLinks?: Array<{ label: string; route: string }>;
}> = ({
  logoUrl,
  menus,
  actionButton,
  navigation = [],
  authLinks = [],
}) => {
  const navigate = useNavigate();
  const domainRouting = useDomainRouting();
  const [instituteLogoUrl, setInstituteLogoUrl] = useState<string | null>(null);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Load institute logo
  useEffect(() => {
    const loadInstituteLogo = async () => {
      if (domainRouting.instituteLogoFileId) {
        try {
          const url = await getPublicUrlWithoutLogin(domainRouting.instituteLogoFileId);
          setInstituteLogoUrl(url);
        } catch (error) {
          console.error("Error loading institute logo:", error);
        }
      }
    };

    loadInstituteLogo();
  }, [domainRouting.instituteLogoFileId]);



  return (
    <header className="bg-white shadow-sm border-b w-full">
      <div className="w-full px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-20">
          {/* Institute Logo and Name */}
          <div className="flex items-center space-x-3 sm:space-x-4">
            {instituteLogoUrl && (
              <img
                className="h-12 w-12 sm:h-14 sm:w-14 rounded-full object-cover"
                src={instituteLogoUrl}
                alt="Institute Logo"
                onError={(e) => {
                  e.currentTarget.style.display = "none";
                }}
              />
            )}
            <div className="text-base sm:text-xl font-semibold text-gray-900 truncate">
              {domainRouting.instituteName || "Learning Platform"}
            </div>
          </div>

          {/* Navigation Menu */}
          {navigation.length > 0 && (
            <nav className="hidden md:flex items-center space-x-6">
              {navigation.map((item, index) => (
                <button
                  key={index}
                  onClick={() => {
                    // For now, just log the route since routing won't work
                  }}
                  className="text-gray-600 hover:text-gray-900 px-3 py-2 rounded-md text-sm font-medium transition-colors"
                >
                  {item.label}
                </button>
              ))}
            </nav>
          )}

          {/* Right side buttons */}
          <div className="flex items-center space-x-2 sm:space-x-4">
            {/* Mobile menu button */}
            {navigation.length > 0 && (
              <button
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                className="md:hidden p-2 rounded-md text-gray-600 hover:text-gray-900 hover:bg-gray-100"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>
            )}

            {/* Auth Links */}
            {authLinks.map((link, index) => {
              
              return (
                <button
                  key={index}
                  onClick={() => {
                    // Use absolute paths for login/signup
                    if (link.route === 'login' || link.route === 'signup') {
                      window.location.href = `/${link.route}`;
                    } else {
                      navigate({ to: link.route });
                    }
                  }}
                  className={`px-4 py-2 sm:px-6 sm:py-2.5 rounded-md text-sm sm:text-base font-semibold transition-colors min-w-[80px] ${
                    index === 0
                      ? "text-white shadow-sm"
                      : "border-2 hover:bg-opacity-10"
                  }`}
                  style={{
                    color: index === 0 ? 'white' : domainRouting.instituteThemeCode ? `hsl(var(--primary))` : '#2563eb',
                    backgroundColor: index === 0 ? (domainRouting.instituteThemeCode ? `hsl(var(--primary))` : '#2563eb') : 'transparent',
                    borderColor: index === 0 ? 'transparent' : (domainRouting.instituteThemeCode ? `hsl(var(--primary))` : '#2563eb')
                  }}
                >
                  {link.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Mobile Navigation Menu */}
        {isMobileMenuOpen && (navigation.length > 0 || authLinks.length > 0) && (
          <div className="md:hidden border-t border-gray-200 bg-white">
            <div className="px-2 pt-2 pb-3 space-y-1">
              {/* Navigation Links */}
              {navigation.map((item, index) => (
                <button
                  key={index}
                  onClick={() => {
                    setIsMobileMenuOpen(false);
                  }}
                  className="block w-full text-left px-3 py-2 rounded-md text-base font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-50"
                >
                  {item.label}
                </button>
              ))}
              
              {/* Auth Links */}
              {authLinks.length > 0 && (
                <div className="border-t border-gray-200 pt-2 mt-2">
                  {authLinks.map((link, index) => (
                    <button
                      key={`auth-${index}`}
                      onClick={() => {
                        // Use absolute paths for login/signup
                        if (link.route === 'login' || link.route === 'signup') {
                          window.location.href = `/${link.route}`;
                        } else {
                          navigate({ to: link.route });
                        }
                        setIsMobileMenuOpen(false);
                      }}
                      className={`block w-full text-left px-4 py-3 rounded-md text-base font-semibold transition-colors ${
                        index === 0
                          ? "text-white hover:opacity-90"
                          : "hover:bg-opacity-10"
                      }`}
                      style={{
                        color: index === 0 ? 'white' : domainRouting.instituteThemeCode ? `hsl(var(--primary))` : '#2563eb',
                        backgroundColor: index === 0 ? (domainRouting.instituteThemeCode ? `hsl(var(--primary))` : '#2563eb') : 'transparent'
                      }}
                    >
                      {link.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </header>
  );
};
