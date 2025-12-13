import React from "react";
import { useNavigate, useLocation } from "@tanstack/react-router";
import { HeaderProps } from "../../-types/course-catalogue-types";
import { useDomainRouting } from "@/hooks/use-domain-routing";
import { getPublicUrlWithoutLogin } from "@/services/upload_file";
import { RouteMatcher } from "../../-services/route-matcher";
import { CourseCatalogueData } from "../../-types/course-catalogue-types";
import { useState, useEffect } from "react";
import { Search, ShoppingCart, X } from "lucide-react";
import { useCartStore } from "@/stores/cart-store";
import { useIsMobile } from "@/hooks/use-mobile";

export const HeaderComponent: React.FC<HeaderProps & {
  navigation?: Array<{ label: string; route: string; openInSameTab?: boolean }>;
  authLinks?: Array<{ label: string; route: string }>;
  catalogueData?: CourseCatalogueData;
  tagName?: string;
}> = ({
  logoUrl,
  menus,
  actionButton,
  navigation = [],
  authLinks = [],
  catalogueData,
  tagName = "home",
}) => {
  const [togle, settogle] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const domainRouting = useDomainRouting();
  const { getItemCountByMode, items, syncCart } = useCartStore();
  const [cartItemCount, setCartItemCount] = useState(0);
  const [currentMode, setCurrentMode] = useState<'buy' | 'rent'>(() => {
    const levelFilter = sessionStorage.getItem('levelFilter') || '';
    return levelFilter.includes('Rent') ? 'rent' : 'buy';
  });
  const isMobile = useIsMobile();
  const [instituteLogoUrl, setInstituteLogoUrl] = useState<string | null>(null);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [mobileMenuRef, setMobileMenuRef] = useState<HTMLDivElement | null>(null);
  const [hamburgerButtonRef, setHamburgerButtonRef] = useState<HTMLButtonElement | null>(null);
  const [isGenreDropdownOpen, setIsGenreDropdownOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [searchInputRef, setSearchInputRef] = useState<HTMLInputElement | null>(null);
  const [searchBarRef, setSearchBarRef] = useState<HTMLDivElement | null>(null);
  
  // Calculate cart item count based on current mode (Buy or Rent)
  useEffect(() => {
    const updateCartCount = async () => {
      const levelFilter = sessionStorage.getItem('levelFilter') || '';
      const isRentMode = levelFilter.includes('Rent');
      const mode = isRentMode ? 'rent' : 'buy';
      
      // Update current mode if changed
      if (mode !== currentMode) {
        setCurrentMode(mode);
        // Sync cart when mode changes
        await syncCart();
      }
      
      // Get count for the current mode from storage (most accurate)
      const count = await getItemCountByMode(mode);
      setCartItemCount(count);
    };
    
    updateCartCount();
    
    // Listen for cart changes and levelFilter changes
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'levelFilter' || e.key?.startsWith('cart_items_')) {
        updateCartCount();
      }
    };
    
    // Listen for custom events
    const handleCartUpdate = () => {
      updateCartCount();
    };
    
    const handleCartUpdated = () => {
      updateCartCount();
    };
    
    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('levelFilterChanged', handleCartUpdate);
    window.addEventListener('cartUpdated', handleCartUpdated);
    window.addEventListener('cartSynced', handleCartUpdated);
    
    // Also check periodically for same-tab changes
    const interval = setInterval(updateCartCount, 500);
    
    return () => {
      clearInterval(interval);
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('levelFilterChanged', handleCartUpdate);
      window.removeEventListener('cartUpdated', handleCartUpdated);
      window.removeEventListener('cartSynced', handleCartUpdated);
    };
  }, [getItemCountByMode, syncCart, currentMode]);
  
  // Also update count when items change (reactive to store updates)
  useEffect(() => {
    const updateCountFromStore = async () => {
      const levelFilter = sessionStorage.getItem('levelFilter') || '';
      const isRentMode = levelFilter.includes('Rent');
      const mode = isRentMode ? 'rent' : 'buy';
      const count = await getItemCountByMode(mode);
      setCartItemCount(count);
    };
    updateCountFromStore();
  }, [items, getItemCountByMode]);
  
  // Check if header styles.enabled is true
  const isHeaderStylesEnabled = !!(catalogueData?.globalSettings?.layout?.header?.styles?.enabled);
  const handleInstituteLogoClick = () => {
    if (domainRouting.homeIconClickRoute) {
      window.location.href = domainRouting.homeIconClickRoute;
    }
  };
  
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

  // Handle outside click to close search bar
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (isSearchOpen && searchBarRef && !searchBarRef.contains(event.target as Node)) {
        // Don't close if clicking on the search button
        const target = event.target as HTMLElement;
        if (target.closest('button[aria-label="Search"]')) {
          return;
        }
        setIsSearchOpen(false);
        setSearchTerm("");
      }
    };

    if (isSearchOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isSearchOpen, searchBarRef]);

  // Handle Escape key to close search
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && isSearchOpen) {
        setIsSearchOpen(false);
        setSearchTerm("");
      }
    };

    if (isSearchOpen) {
      document.addEventListener('keydown', handleEscape);
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isSearchOpen]);

  // Focus search input when search bar opens
  useEffect(() => {
    if (isSearchOpen && searchInputRef) {
      searchInputRef.focus();
    }
  }, [isSearchOpen, searchInputRef]);

  // Handle search submission
  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchTerm.trim()) {
      // Navigate to homepage with search term
      const currentPath = location.pathname;
      const pathSegments = currentPath.split('/').filter(Boolean);
      const currentTagName = pathSegments[0] || tagName;
      
      // Store search term in sessionStorage for filtering
      sessionStorage.setItem('searchTerm', searchTerm.trim());
      
      // Navigate to homepage
      navigate({ to: `/${currentTagName}` });
      
      // Close search bar
      setIsSearchOpen(false);
      setSearchTerm("");
    }
  };

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
  const handleNavigation = (route: string, label: string, openInSameTab?: boolean | string) => {
    // Normalize openInSameTab value (handle string "true"/"false", boolean, or undefined)
    const shouldOpenInSameTab = openInSameTab === true || openInSameTab === "true";
    
    // Check if route is external
    if (RouteMatcher.isExternalLink(route)) {
      console.log(`[HeaderComponent] Opening external link: ${route}, openInSameTab: ${openInSameTab}, shouldOpenInSameTab: ${shouldOpenInSameTab}`);
      if (shouldOpenInSameTab) {
        // Open in same tab
        window.location.href = route;
      } else {
        // Open in new tab (default behavior when openInSameTab is false or undefined)
        window.open(route, '_blank', 'noopener,noreferrer');
      }
      return;
    }
    
    // If catalogueData is available, try to match the route with pages
    if (catalogueData && catalogueData.pages) {
      const matchedPage = RouteMatcher.findMatchingPage(route, catalogueData.pages);
      
      if (matchedPage) {
        // Get the proper navigation route for this page
        const navigationRoute = RouteMatcher.getPageNavigationRoute(matchedPage, tagName);
        navigate({ to: navigationRoute });
        return;
      }
    }
    
    // Handle special routes (homepage, courses, etc.)
    const normalizedRoute = RouteMatcher.normalizeRoute(route);
    
    if (normalizedRoute === 'home' || normalizedRoute === '' || route === '/') {
      const currentPath = location.pathname;
      const pathSegments = currentPath.split('/').filter(Boolean);
      const currentTagName = pathSegments[0] || tagName;

      navigate({ to: `/${currentTagName}` });
      return;
    }
    
    if (normalizedRoute === 'courses') {
      const currentPath = location.pathname;
      const pathSegments = currentPath.split('/').filter(Boolean);
      const currentTagName = pathSegments[0] || tagName;

      navigate({ to: `/${currentTagName}` });
      return;
    }
    
    // For other routes, check if we're already on the target route
    if (isActiveRoute(route, label)) {
      return;
    }
    
    // Navigate to the route as-is (for custom internal routes)
    navigate({ to: route });
  };


  // Check if courseCatalogeType.enabled is true
  const isCourseCatalogeTypeEnabled = !!(catalogueData?.globalSettings?.courseCatalogeType?.enabled);
  
  // Check if logo from JSON should be used (when courseCatalogeType.enabled is true and layout.header.props.logo exists)
  const jsonLogoUrl = isCourseCatalogeTypeEnabled && catalogueData?.globalSettings?.layout?.header?.props?.logo
    ? catalogueData.globalSettings.layout.header.props.logo
    : null;

  // Check if we should hide search and cart icons
  const shouldHideSearchAndCart = () => {
    const currentPath = location.pathname.toLowerCase();
    
    // Hide on cart page
    if (currentPath.includes('/cart')) {
      return true;
    }
    
    // Hide on book/course details page (pattern: /$tagName/$courseId)
    // Check if path has format: /tagName/courseId where courseId looks like an ID (numeric or UUID)
    const pathSegments = location.pathname.split('/').filter(Boolean);
    if (pathSegments.length >= 2) {
      const potentialCourseId = pathSegments[1];
      // Check if it looks like a course ID (numeric or UUID)
      const isNumeric = /^\d+$/.test(potentialCourseId);
      const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(potentialCourseId);
      if (isNumeric || isUUID) {
        // This is likely a course/book details page
        return true;
      }
    }
    
    // Check if current page has buyRentSection component
    if (catalogueData?.pages) {
      const currentPathSegments = location.pathname.split('/').filter(Boolean);
      const pageRoute = currentPathSegments.slice(1).join('/') || '';
      
      // Check all pages to see if any have buyRentSection
      for (const page of catalogueData.pages) {
        const pageRouteLower = (page.route || '').toLowerCase();
        const pageIdLower = (page.id || '').toLowerCase();
        
        // Match by route or id
        const isCurrentPage = pageRouteLower === pageRoute.toLowerCase() || 
                             pageIdLower === pageRoute.toLowerCase() ||
                             (pageRoute === '' && pageRouteLower === '');
        
        if (isCurrentPage && page.components) {
          const hasBuyRentSection = page.components.some(
            (component: any) => component.type === 'buyRentSection' && (component.enabled === true || component.enabled === "true")
          );
          if (hasBuyRentSection) {
            return true;
          }
        }
      }
    }
    
    return false;
  };

  const hideSearchAndCart = shouldHideSearchAndCart();

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-white shadow-sm border-b w-full">
      <div className={`w-full ${isHeaderStylesEnabled && !isMobile ? 'px-20' : 'px-4 sm:px-6 lg:px-8'}`}>
        <div className={`flex items-center pt-2 pb-2 h-19 ${isCourseCatalogeTypeEnabled ? 'md:justify-between' : 'justify-between'}`}>
          {/* Mobile menu button - Left side when courseCatalogeType.enabled is true */}
          {isCourseCatalogeTypeEnabled && (
            <button
              ref={setHamburgerButtonRef}
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="md:hidden p-1.5 rounded-lg text-gray-600 hover:text-gray-900 hover:bg-gray-100 flex-shrink-0 transition-all duration-300 ease-in-out"
              aria-label="Toggle menu"
            >
              <div className="relative w-5 h-5 flex flex-col justify-center items-center">
                <span
                  className={`absolute block h-0.5 w-5 bg-current transform transition-all duration-300 ease-in-out ${
                    isMobileMenuOpen ? 'rotate-45 translate-y-0' : '-translate-y-1.5'
                  }`}
                />
                <span
                  className={`absolute block h-0.5 w-5 bg-current transform transition-all duration-300 ease-in-out ${
                    isMobileMenuOpen ? 'opacity-0' : 'opacity-100'
                  }`}
                />
                <span
                  className={`absolute block h-0.5 w-5 bg-current transform transition-all duration-300 ease-in-out ${
                    isMobileMenuOpen ? '-rotate-45 translate-y-0' : 'translate-y-1.5'
                  }`}
                />
              </div>
            </button>
          )}

          {/* Institute Logo and Name */}
          <div className={`flex items-center space-x-3 sm:space-x-4 ${isCourseCatalogeTypeEnabled ? 'flex-1 md:flex-none justify-center md:justify-start' : ''}`}>
            {/* Show JSON logo in rectangular format if courseCatalogeType.enabled is true and logo exists */}
            {jsonLogoUrl ? (
              <img
                src={jsonLogoUrl}
                alt="Logo"
                onClick={domainRouting.homeIconClickRoute ? handleInstituteLogoClick : undefined}
                className={`h-10 sm:h-20 w-auto object-contain rounded-lg shadow-sm transition-all duration-300 hover:scale-105${domainRouting.homeIconClickRoute ? " cursor-pointer" : ""}`}

                onError={(e) => {
                  e.currentTarget.style.display = "none";
                }}
              />
            ) : (
              <>
                {instituteLogoUrl && (
                  <img
                    src={instituteLogoUrl}
                    alt="Institute Logo"
                    onClick={domainRouting.homeIconClickRoute ? handleInstituteLogoClick : undefined}
                    className={`h-12 w-12 sm:h-14 sm:w-14 rounded-full object-cover${domainRouting.homeIconClickRoute ? " cursor-pointer" : ""}`}
                    onError={(e) => {
                      e.currentTarget.style.display = "none";
                    }}
                  />
                )}
                <div className="text-base sm:text-xl font-semibold text-gray-900 truncate">
                  {domainRouting.instituteName || "Learning Platform"}
                </div>
              </>
            )}
          </div>

          {/* Navigation Menu */}
          {navigation.length > 0 && (
            <nav className="hidden md:flex items-center space-x-6">
              {navigation.map((item, index) => {
                const isActive = isActiveRoute(item.route, item.label);
                // Explicitly handle openInSameTab - convert to boolean if needed
                const openInSameTab = item.openInSameTab === true || String(item.openInSameTab) === "true";
                return (
                  <button
                    key={index}
                    onClick={() => handleNavigation(item.route, item.label, openInSameTab)}
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
          <div className={`flex items-center space-x-2 sm:space-x-4 ${isCourseCatalogeTypeEnabled ? 'flex-shrink-0' : ''}`}>
            {/* Mobile menu button - Right side when courseCatalogeType.enabled is false */}
            {!isCourseCatalogeTypeEnabled && navigation.length > 0 && (
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

            {/* Search and Cart Icons - Only for hero section header */}
            {isCourseCatalogeTypeEnabled && !hideSearchAndCart && (
              <div className="flex items-center space-x-3 sm:space-x-4">
                {/* Search Icon */}
                <button
                  onClick={() => {
                    const newToggleState = !togle;
                    settogle(newToggleState);
                    // Dispatch custom event to open search bar in BookCatalogueComponent
                    window.dispatchEvent(new CustomEvent('toggleSearchBar', { 
                      detail: { isOpen: newToggleState } 
                    }));
                    // Also store in sessionStorage for persistence
                    sessionStorage.setItem('searchBarOpen', String(newToggleState));
                  }}
                  className="p-2 rounded-lg text-gray-600 hover:text-gray-900 hover:bg-gray-100 transition-all duration-200 ease-in-out"
                  aria-label="Search"
                >
                  <Search className="w-5 h-5 sm:w-6 sm:h-6" />
                </button>

                {/* Cart Icon */}
                <button
                  onClick={() => {
                    const currentPath = location.pathname;
                    const pathSegments = currentPath.split('/').filter(Boolean);
                    const currentTagName = pathSegments[0] || tagName;
                    navigate({ to: `/${currentTagName}/cart` });
                  }}
                  className="relative p-2 rounded-lg text-gray-600 hover:text-gray-900 hover:bg-gray-100 transition-all duration-200 ease-in-out"
                  aria-label="Shopping Cart"
                >
                  <ShoppingCart className="w-5 h-5 sm:w-6 sm:h-6" />
                  {cartItemCount > 0 && (
                    <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center text-[10px] min-w-[20px]">
                      {cartItemCount > 99 ? '99+' : cartItemCount}
                    </span>
                  )}
                </button>
              </div>
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
        {isCourseCatalogeTypeEnabled ? (
          // Enhanced menu for courseCatalogeType.enabled = true
          <div 
            ref={setMobileMenuRef}
            className={`md:hidden fixed top-[60px] left-0 right-0 z-[60] bg-white shadow-lg transition-all duration-500 ease-in-out ${
              isMobileMenuOpen 
                ? 'max-h-[500px] opacity-100 border-t border-gray-200' 
                : 'max-h-0 opacity-0 border-t-0 pointer-events-none'
            }`}
          >
            <div className={`transform transition-transform duration-500 ease-in-out ${
              isMobileMenuOpen ? 'translate-y-0' : '-translate-y-full'
            }`}>
              <div className="px-4 pt-2 pb-6 space-y-0">
                {/* Login */}
                <button
                  onClick={() => {
                    setIsMobileMenuOpen(false);
                    navigate({ to: '/login' });
                  }}
                  className="group relative w-full text-left px-5 py-3.5 rounded-xl text-base font-semibold text-white overflow-hidden transition-all duration-300 ease-in-out transform hover:scale-[1.02] hover:shadow-lg active:scale-[0.98]"
                  style={{
                    backgroundColor: domainRouting.instituteThemeCode ? `hsl(var(--primary))` : '#2563eb'
                  }}
                >
                  <span className="relative z-10 flex items-center justify-between">
                    <span>Login</span>
                    <svg className="w-5 h-5 transform group-hover:translate-x-1 transition-transform duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                    </svg>
                  </span>
                  <div className="absolute inset-0 bg-white opacity-0 group-hover:opacity-10 transition-opacity duration-300" />
                </button>

                {/* Customer Services */}
                <button
                  onClick={() => {
                    setIsMobileMenuOpen(false);
                    // Navigate to customer services or open support link
                    const customerServiceLink = authLinks.find(link => 
                      link.label.toLowerCase().includes('support') || 
                      link.label.toLowerCase().includes('customer') ||
                      link.route.includes('support') ||
                      link.route.includes('customer')
                    );
                    if (customerServiceLink) {
                      if (RouteMatcher.isExternalLink(customerServiceLink.route)) {
                        window.open(customerServiceLink.route, '_blank', 'noopener,noreferrer');
                      } else {
                        navigate({ to: customerServiceLink.route });
                      }
                    } else {
                      // Default customer service action - you can customize this
                      window.open('https://chat.whatsapp.com/Kvh1fsDcL1GFCBrIveQ8q8', '_blank', 'noopener,noreferrer');
                    }
                  }}
                  className="group w-full text-left px-5 py-3.5 rounded-xl text-base font-medium text-gray-700 bg-gray-50 hover:bg-gray-100 border border-gray-200 hover:border-gray-300 transition-all duration-300 ease-in-out transform hover:scale-[1.01] active:scale-[0.99]"
                >
                  <span className="flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 5.636l-3.536 3.536m0 5.656l3.536 3.536M9.172 9.172L5.636 5.636m3.536 9.192l-3.536 3.536M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-5 0a4 4 0 11-8 0 4 4 0 018 0z" />
                      </svg>
                      Customer Services
                    </span>
                    <svg className="w-5 h-5 transform group-hover:translate-x-1 transition-transform duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </span>
                </button>

                {/* Genre Dropdown */}
                {/* <div className="relative">
                  <button
                    onClick={() => setIsGenreDropdownOpen(!isGenreDropdownOpen)}
                    className="group w-full flex items-center justify-between px-5 py-3.5 rounded-xl text-base font-medium text-gray-700 bg-gray-50 hover:bg-gray-100 border border-gray-200 hover:border-gray-300 transition-all duration-300 ease-in-out transform hover:scale-[1.01] active:scale-[0.99]"
                  >
                    <span className="flex items-center gap-2">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                      </svg>
                      Genre
                    </span>
                    <svg 
                      className={`w-5 h-5 transform transition-all duration-300 ease-in-out ${
                        isGenreDropdownOpen ? 'rotate-180' : ''
                      }`}
                      fill="none" 
                      stroke="currentColor" 
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                  
                  <div 
                    className={`overflow-hidden transition-all duration-500 ease-in-out ${
                      isGenreDropdownOpen ? 'max-h-96 opacity-100 mt-2' : 'max-h-0 opacity-0 mt-0'
                    }`}
                  >
                    <div className="bg-gradient-to-br from-gray-50 to-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                      {['Poetry', 'Drama', 'Fiction', 'Non-Fiction'].map((genre, index) => (
                        <button
                          key={index}
                          onClick={() => {
                            setIsMobileMenuOpen(false);
                            setIsGenreDropdownOpen(false);
                            // Set genre filter in sessionStorage
                            sessionStorage.setItem('genreFilter', genre.toLowerCase());
                            // Navigate to homepage with genre filter
                            const currentPath = location.pathname;
                            const pathSegments = currentPath.split('/').filter(Boolean);
                            const currentTagName = pathSegments[0] || tagName;
                            navigate({ to: `/${currentTagName}` });
                          }}
                          className="group w-full text-left px-6 py-3 text-sm font-medium text-gray-700 hover:text-gray-900 hover:bg-white border-b border-gray-100 last:border-b-0 transition-all duration-200 ease-in-out transform hover:translate-x-1"
                        >
                          <span className="flex items-center gap-2">
                            <span className="w-1.5 h-1.5 rounded-full bg-gray-400 group-hover:bg-blue-500 transition-colors duration-200" />
                            {genre}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                </div> */}
              </div>
            </div>
          </div>
        ) : (
          // Original menu for courseCatalogeType.enabled = false
          isMobileMenuOpen && (navigation.length > 0 || authLinks.length > 0) && (
            <div 
              ref={setMobileMenuRef}
              className="md:hidden fixed top-[76px] left-0 right-0 z-[60] border-t border-gray-200 bg-white shadow-lg"
          >
            <div className="px-2 pt-1 pb-3 space-y-1">
              {/* Navigation Links */}
              {navigation.map((item, index) => {
                const isActive = isActiveRoute(item.route, item.label);
                // Explicitly handle openInSameTab - convert to boolean if needed
                const openInSameTab = item.openInSameTab === true || String(item.openInSameTab) === "true";
                return (
                  <button
                    key={index}
                    onClick={() => {
                      setIsMobileMenuOpen(false);
                      handleNavigation(item.route, item.label, openInSameTab);
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
          )
        )}
      </div>

      {/* Search Bar - Only for hero section header */}
    </header>
  );
};
