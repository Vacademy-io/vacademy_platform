import React from "react";
import { useNavigate, useLocation } from "@tanstack/react-router";
import { HeaderProps } from "../../-types/course-catalogue-types";
import { useDomainRouting } from "@/hooks/use-domain-routing";
import { getPublicUrlWithoutLogin } from "@/services/upload_file";
import { useState, useEffect } from "react";
import { navigateByHomeIcon } from "@/utils/home-icon-click";

export const HeaderComponent: React.FC<HeaderProps & { 
  navigation?: Array<{ label: string; route: string }>;
  authLinks?: Array<{ label: string; route: string }>;
}> = ({ navigation = [], authLinks = [] }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const domainRouting = useDomainRouting();
  const [instituteLogoUrl, setInstituteLogoUrl] = useState<string | null>(null);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [mobileMenuRef, setMobileMenuRef] = useState<HTMLDivElement | null>(null);
  const [hamburgerButtonRef, setHamburgerButtonRef] = useState<HTMLButtonElement | null>(null);

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

  // Handle outside click to close mobile menu
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (isMobileMenuOpen && mobileMenuRef && !mobileMenuRef.contains(event.target as Node)) {
        // Don't close if clicking on the hamburger button
        if (hamburgerButtonRef && hamburgerButtonRef.contains(event.target as Node)) {
          return;
        }
        setIsMobileMenuOpen(false);
      }
    };

    if (isMobileMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isMobileMenuOpen, mobileMenuRef, hamburgerButtonRef]);

  // Helper function to check if a navigation item is active
  const isActiveRoute = (route: string, label: string) => {
    const currentPath = location.pathname;
    const pathSegments = currentPath.split('/').filter(Boolean);
    const isOnTagNamePage = pathSegments.length === 1; // We're on /$tagName page
    
    // If we're on the tagName page, check which navigation item should be active
    if (isOnTagNamePage) {
      // If this is a "Courses" item, make it active when on the main page
      if (label.toLowerCase() === 'courses') {
        return true;
      }
      // If this is a "Home" item, don't make it active if "Courses" exists
      if (label.toLowerCase() === 'home') {
        // Check if there's a "Courses" item in the navigation
        const hasCoursesItem = navigation.some(item => item.label.toLowerCase() === 'courses');
        // Only highlight "Home" if there's no "Courses" item
        return !hasCoursesItem;
      }
    }
    
    // Handle specific routes
    if (route === 'homepage' || route === '/') {
      if (label.toLowerCase() === 'home' && isOnTagNamePage) {
        return true;
      }
      return false;
    }
    
    if (route === 'courses' || route === '/courses') {
      if (label.toLowerCase() === 'courses' && isOnTagNamePage) {
        return true;
      }
      return false;
    }
    
    // For other routes, check if current path matches
    return currentPath === route || currentPath.startsWith(route);
  };

  // Helper function to handle navigation
  const handleNavigation = (route: string, label: string) => {
    // Handle external links
    if (route.startsWith('http://') || route.startsWith('https://')) {
      window.open(route, '_blank');
      return;
    }
    
    // Handle homepage route - always navigate to current tagName page
    if (route === 'homepage' || route === '/') {
      const currentPath = location.pathname;
      const pathSegments = currentPath.split('/').filter(Boolean);
      const tagName = pathSegments[0] || 'home'; // fallback to 'home' if no tagName
      
      // Always navigate to the tagName page, even if already there
      // This allows switching between Home and Courses
      console.log(`[HeaderComponent] Navigating to tagName page: /${tagName}`);
      navigate({ to: `/${tagName}` });
      return;
    }
    
    // Handle courses route - navigate to current tagName page
    if (route === 'courses' || route === '/courses') {
      const currentPath = location.pathname;
      const pathSegments = currentPath.split('/').filter(Boolean);
      const tagName = pathSegments[0] || 'home'; // fallback to 'home' if no tagName
      
      // Always navigate to the tagName page, even if already there
      console.log(`[HeaderComponent] Navigating to courses page: /${tagName}`);
      navigate({ to: `/${tagName}` });
      return;
    }
    
    // For other routes, check if we're already on the target route
    if (isActiveRoute(route, label)) {
      console.log(`[HeaderComponent] Already on route ${route}, not navigating`);
      return;
    }
    
    // Navigate to the route
    navigate({ to: route });
  };


  return (
    <header className="bg-white shadow-sm border-b w-full fixed top-0 left-0 right-0 z-50 md:relative">
      <div className="w-full px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-20">
          {/* Institute Logo and Name */}
          <div
            className="flex items-center space-x-3 sm:space-x-4 cursor-pointer"
            onClick={() => navigateByHomeIcon(domainRouting.homeIconClickRoute, navigate)}
            role="button"
            aria-label="Go to home"
            title="Home"
          >
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
              {navigation.map((item, index) => {
                const isActive = isActiveRoute(item.route, item.label);
                return (
                  <button
                    key={index}
                    onClick={() => handleNavigation(item.route, item.label)}
                    className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                      isActive 
                        ? 'text-primary-600 border-b-2 border-primary-200' 
                        : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                    }`}
                  >
                    {item.label}
                  </button>
                );
              })}
            </nav>
          )}

          {/* Right side buttons */}
          <div className="flex items-center space-x-2 sm:space-x-4">
            {/* Mobile menu button */}
            {navigation.length > 0 && (
              <button
                ref={setHamburgerButtonRef}
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                className="md:hidden p-2 rounded-md text-gray-600 hover:text-gray-900 hover:bg-gray-100"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>
            )}

            {/* Auth Links - Hidden on mobile */}
            <div className="hidden md:flex items-center space-x-2">
              {authLinks.map((link, index) => {
                
                return (
                  <button
                    key={index}
                    onClick={() => {
                      // Use absolute paths for login/signup
                      if (link.route === 'login' || link.route === 'signup') {
                        window.location.href = `/${link.route}`;
                      } else if (link.route === '' || link.route === 'get-started') {
                        // Empty route or get-started should open lead collection
                        console.log("[HeaderComponent] Get Started button clicked, opening lead collection");
                        window.dispatchEvent(new CustomEvent('openLeadCollection'));
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
        </div>

        {/* Mobile Navigation Menu */}
        {isMobileMenuOpen && (navigation.length > 0 || authLinks.length > 0) && (
          <div 
            ref={setMobileMenuRef}
            className="md:hidden border-t border-gray-200 bg-white"
          >
            <div className="px-2 pt-2 pb-3 space-y-1">
              {/* Navigation Links */}
              {navigation.map((item, index) => {
                const isActive = isActiveRoute(item.route, item.label);
                return (
                  <button
                    key={index}
                    onClick={() => {
                      setIsMobileMenuOpen(false);
                      handleNavigation(item.route, item.label);
                    }}
                    className={`block w-full text-left px-3 py-2 rounded-md text-base font-medium transition-colors ${
                      isActive 
                        ? 'text-primary-600 border-b-2 border-primary-200' 
                        : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                    }`}
                  >
                    {item.label}
                  </button>
                );
              })}
              
              {/* Auth Links */}
              {authLinks.length > 0 && (
                <div className="border-t border-gray-200 pt-2 mt-2">
                  {authLinks.map((link, index) => (
                    <button
                      key={`auth-${index}`}
                      onClick={() => {
                        // Handle different types of routes
                        if (link.route === 'login' || link.route === 'signup') {
                          navigate({ to: `/${link.route}` });
                        } else if (link.route === 'getStarted' || link.label.toLowerCase().includes('get started')) {
                          // Dispatch custom event to open lead collection
                          const event = new CustomEvent('openLeadCollection', {
                            detail: { source: 'mobileMenu' }
                          });
                          window.dispatchEvent(event);
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
