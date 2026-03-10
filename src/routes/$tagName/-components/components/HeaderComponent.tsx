import React from "react";
import { useNavigate, useLocation } from "@tanstack/react-router";
import { HeaderProps } from "../../-types/course-catalogue-types";
import { useDomainRouting } from "@/hooks/use-domain-routing";
import { getPublicUrlWithoutLogin } from "@/services/upload_file";
import { RouteMatcher } from "../../-services/route-matcher";
import { CourseCatalogueData, Component as PageComponent } from "../../-types/course-catalogue-types";
import { useState, useEffect } from "react";
import { Search, ShoppingCart } from "lucide-react";
import { useCartStore } from "../../-stores/cart-store";
import { isIOSPlatform } from "@/hooks/useIsIOS";
import { getAccessToken, isTokenExpired } from "@/lib/auth/sessionUtility";
import { SystemAlertsBar } from "@/components/announcements";
import { LogoutSidebar } from "@/components/common/layout-container/sidebar/logoutSidebar";
import useStore from "@/components/common/layout-container/sidebar/useSidebar";
import { List } from "@phosphor-icons/react";

export const HeaderComponent: React.FC<HeaderProps & {
  navigation?: Array<{ label: string; route: string; openInSameTab?: boolean }>;
  authLinks?: Array<{ label: string; route: string }>;
  catalogueData?: CourseCatalogueData;
  tagName?: string;
}> = ({
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
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const { setSidebarOpen } = useStore();
    const [currentMode, setCurrentMode] = useState<'buy' | 'rent'>(() => {
      const levelFilter = sessionStorage.getItem('levelFilter') || '';
      return levelFilter.toLowerCase().includes('rent') ? 'rent' : 'buy';
    });
    const [instituteLogoUrl, setInstituteLogoUrl] = useState<string | null>(null);
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const [mobileMenuRef, setMobileMenuRef] = useState<HTMLDivElement | null>(null);
    const [hamburgerButtonRef, setHamburgerButtonRef] = useState<HTMLButtonElement | null>(null);
    const isIOS = isIOSPlatform();

    // Calculate cart item count based on current mode (Buy or Rent)
    useEffect(() => {
      const checkAuth = async () => {
        try {
          const token = await getAccessToken();
          setIsAuthenticated(!!token && !isTokenExpired(token));
        } catch (error) {
          setIsAuthenticated(false);
        }
      };
      checkAuth();

      const updateCartCount = async () => {
        const levelFilter = sessionStorage.getItem('levelFilter') || '';
        const isRentMode = levelFilter.toLowerCase().includes('rent');
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
        const isRentMode = levelFilter.toLowerCase().includes('rent');
        const mode = isRentMode ? 'rent' : 'buy';
        const count = await getItemCountByMode(mode);
        setCartItemCount(count);
      };
      updateCountFromStore();
    }, [items, getItemCountByMode]);

    // Check if courseCatalogeType.enabled is true
    const isCourseCatalogeTypeEnabled = !!(catalogueData?.globalSettings?.courseCatalogeType?.enabled);
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
              (component: PageComponent) => component.type === 'buyRentSection' && (component.enabled === true || String(component.enabled) === "true")
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

    // Consistent header height using design tokens
    const headerHeight = 'h-16 md:h-20';
    const headerTopOffset = isIOS ? 'pt-8' : '';

    return (
      <header
        className={`fixed top-0 left-0 right-0 z-[var(--catalogue-z-fixed)] bg-white border-b border-[hsl(var(--catalogue-border-subtle))] w-full ${headerTopOffset}`}
        style={{
          '--header-height': 'var(--catalogue-header-height)',
          '--header-height-mobile': 'var(--catalogue-header-height-mobile)'
        } as React.CSSProperties}
      >
        {/* Container with consistent responsive padding */}
        <LogoutSidebar />
        <div className="w-full px-4 sm:px-6 lg:px-8 xl:px-12">
          <div className={`flex items-center justify-between ${headerHeight}`}>
            {/* Mobile menu button - Left side when courseCatalogeType.enabled is true */}
            {/* Mobile menu button - Left side when courseCatalogeType.enabled is true */}
            {isCourseCatalogeTypeEnabled && (
              <button
                ref={setHamburgerButtonRef}
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                className="md:hidden p-2 rounded-md text-[hsl(var(--catalogue-text-secondary))] hover:text-[hsl(var(--catalogue-text-primary))] hover:bg-[hsl(var(--catalogue-interactive-hover))] flex-shrink-0 transition-colors duration-200"
                aria-label="Toggle menu"
              >
                <div className="relative w-5 h-5 flex flex-col justify-center items-center">
                  <span
                    className={`absolute block h-0.5 w-5 bg-current transform transition-transform duration-200 ${isMobileMenuOpen ? 'rotate-45 translate-y-0' : '-translate-y-1.5'
                      }`}
                  />
                  <span
                    className={`absolute block h-0.5 w-5 bg-current transition-opacity duration-200 ${isMobileMenuOpen ? 'opacity-0' : 'opacity-100'
                      }`}
                  />
                  <span
                    className={`absolute block h-0.5 w-5 bg-current transform transition-transform duration-200 ${isMobileMenuOpen ? '-rotate-45 translate-y-0' : 'translate-y-1.5'
                      }`}
                  />
                </div>
              </button>
            )}

            {/* Logo and Brand */}
            <div className={`flex items-center gap-3 ${isCourseCatalogeTypeEnabled ? 'flex-1 md:flex-none justify-center md:justify-start' : ''}`}>
              {/* JSON logo (rectangular) when courseCatalogeType is enabled */}
              {jsonLogoUrl ? (
                <img
                  src={jsonLogoUrl}
                  alt="Logo"
                  onClick={domainRouting.homeIconClickRoute ? handleInstituteLogoClick : undefined}
                  className={`max-h-12 md:max-h-16 w-auto object-contain rounded-md transition-opacity duration-200 hover:opacity-90 ${domainRouting.homeIconClickRoute ? 'cursor-pointer' : ''
                    }`}
                  onError={(e) => {
                    e.currentTarget.style.display = "none";
                  }}
                />
              ) : (
                <>
                  {/* Institute circular logo */}
                  {instituteLogoUrl && (
                    <img
                      src={instituteLogoUrl}
                      alt="Institute Logo"
                      onClick={domainRouting.homeIconClickRoute ? handleInstituteLogoClick : undefined}
                      className={`h-10 w-10 md:h-11 md:w-11 rounded-full object-cover border border-[hsl(var(--catalogue-border))] ${domainRouting.homeIconClickRoute ? 'cursor-pointer' : ''
                        }`}
                      onError={(e) => {
                        e.currentTarget.style.display = "none";
                      }}
                    />
                  )}
                  {/* Institute name */}
                  <span className="text-base md:text-lg font-semibold text-[hsl(var(--catalogue-text-primary))] truncate max-w-[200px] md:max-w-none">
                    {domainRouting.instituteName || "Learning Platform"}
                  </span>
                </>
              )}
            </div>

            {/* Desktop Navigation */}
            {navigation.length > 0 && (
              <nav className="hidden md:flex items-center gap-1">
                {navigation.map((item, index) => {
                  const isActive = isActiveRoute(item.route, item.label);
                  const openInSameTab = item.openInSameTab === true || String(item.openInSameTab) === "true";
                  return (
                    <button
                      key={index}
                      onClick={() => handleNavigation(item.route, item.label, openInSameTab)}
                      className={`px-4 py-2 rounded-md text-sm font-medium transition-colors duration-200 ${isActive
                        ? 'text-primary-500 bg-primary-50'
                        : 'text-[hsl(var(--catalogue-text-secondary))] hover:text-[hsl(var(--catalogue-text-primary))] hover:bg-[hsl(var(--catalogue-interactive-hover))]'
                        }`}
                    >
                      {item.label}
                    </button>
                  );
                })}
              </nav>
            )}

            {/* Right side actions */}
            <div className="flex items-center gap-2 md:gap-3 flex-shrink-0">
              {/* Mobile menu button - Right side when courseCatalogeType is disabled */}
              {!isCourseCatalogeTypeEnabled && navigation.length > 0 && (
                <button
                  ref={setHamburgerButtonRef}
                  onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                  className="md:hidden p-2 rounded-md text-[hsl(var(--catalogue-text-secondary))] hover:text-[hsl(var(--catalogue-text-primary))] hover:bg-[hsl(var(--catalogue-interactive-hover))] transition-colors duration-200"
                  aria-label="Toggle menu"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                  </svg>
                </button>
              )}

              {/* Search and Cart Icons */}
              {isCourseCatalogeTypeEnabled && !hideSearchAndCart && (
                <div className="flex items-center gap-1">
                  {/* Search Icon */}
                  <button
                    onClick={() => {
                      const newToggleState = !togle;
                      settogle(newToggleState);
                      window.dispatchEvent(new CustomEvent('toggleSearchBar', {
                        detail: { isOpen: newToggleState }
                      }));
                      sessionStorage.setItem('searchBarOpen', String(newToggleState));
                    }}
                    className="p-2 rounded-md text-[hsl(var(--catalogue-text-secondary))] hover:text-[hsl(var(--catalogue-text-primary))] hover:bg-[hsl(var(--catalogue-interactive-hover))] transition-colors duration-200"
                    aria-label="Search"
                  >
                    <Search className="w-5 h-5" />
                  </button>

                  {/* Cart Icon */}
                  <button
                    onClick={() => {
                      const currentPath = location.pathname;
                      const pathSegments = currentPath.split('/').filter(Boolean);
                      const currentTagName = pathSegments[0] || tagName;
                      navigate({ to: `/${currentTagName}/cart` });
                    }}
                    className="relative p-2 rounded-md text-[hsl(var(--catalogue-text-secondary))] hover:text-[hsl(var(--catalogue-text-primary))] hover:bg-[hsl(var(--catalogue-interactive-hover))] transition-colors duration-200"
                    aria-label="Shopping Cart"
                  >
                    <ShoppingCart className="w-5 h-5" />
                    {cartItemCount > 0 && (
                      <span className="absolute -top-0.5 -right-0.5 bg-primary-500 text-white text-[10px] font-semibold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">
                        {cartItemCount > 99 ? '99+' : cartItemCount}
                      </span>
                    )}
                  </button>
                </div>
              )}

              {/* Auth Links - Desktop only */}
              <div className="hidden md:flex items-center gap-2">
                {isAuthenticated ? (
                  <div className="flex items-center gap-3 shrink-0">
                    <SystemAlertsBar />
                    <div className="w-px h-6 bg-primary-200/60 dark:bg-neutral-700"></div>
                    <button
                      className="group relative flex items-center justify-center w-8 h-8 md:w-9 md:h-9 rounded-md border border-primary-200/50 dark:border-neutral-700 bg-white dark:bg-neutral-800 hover:bg-primary-100 dark:hover:bg-neutral-700 hover:border-primary-400 dark:hover:border-neutral-600 transition-all duration-200"
                      onClick={() => {
                        setSidebarOpen();
                      }}
                    >
                      <List className="w-4 h-4 text-primary-600 dark:text-neutral-300 group-hover:text-primary-700 dark:group-hover:text-neutral-200 transition-colors duration-200" />
                    </button>
                  </div>
                ) : (
                  authLinks.map((link, index) => (
                    <button
                      key={index}
                      onClick={() => {
                        if (link.route === 'login' || link.route === 'signup') {
                          window.location.href = `/${link.route}`;
                        } else if (link.route === '' || link.route === 'get-started') {
                          window.dispatchEvent(new CustomEvent('openLeadCollection'));
                        } else {
                          navigate({ to: link.route });
                        }
                      }}
                      className={`px-4 py-2 rounded-md text-sm font-medium transition-colors duration-200 ${index === 0
                        ? 'text-white bg-primary-500 hover:bg-primary-400'
                        : 'text-primary-500 border border-primary-500 hover:bg-primary-50'
                        }`}
                    >
                      {link.label}
                    </button>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Mobile Navigation Menu */}
          {isCourseCatalogeTypeEnabled ? (
            <div
              ref={setMobileMenuRef}
              className={`md:hidden fixed left-0 right-0 z-[var(--catalogue-z-dropdown)] bg-white border-b border-[hsl(var(--catalogue-border))] transition-all duration-300 ease-out ${isMobileMenuOpen
                ? 'opacity-100 visible'
                : 'opacity-0 invisible pointer-events-none'
                }`}
              style={{ top: isIOS ? 'calc(56px + 32px)' : '56px' }}
            >
              <div className={`transform transition-transform duration-300 ease-out ${isMobileMenuOpen ? 'translate-y-0' : '-translate-y-4'
                }`}>
                <div className="px-4 py-4 space-y-3">
                  {/* Login Button */}
                  <button
                    onClick={() => {
                      setIsMobileMenuOpen(false);
                      navigate({ to: '/login' });
                    }}
                    className="w-full flex items-center justify-between px-4 py-3 rounded-lg text-base font-medium text-white bg-primary-500 hover:bg-primary-400 transition-colors duration-200"
                  >
                    <span>Login</span>
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                    </svg>
                  </button>

                  {/* Customer Services Button */}
                  <button
                    onClick={() => {
                      setIsMobileMenuOpen(false);
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
                        window.open('https://chat.whatsapp.com/Kvh1fsDcL1GFCBrIveQ8q8', '_blank', 'noopener,noreferrer');
                      }
                    }}
                    className="w-full flex items-center justify-between px-4 py-3 rounded-lg text-base font-medium text-[hsl(var(--catalogue-text-secondary))] bg-[hsl(var(--catalogue-bg-subtle))] hover:bg-[hsl(var(--catalogue-interactive-hover))] border border-[hsl(var(--catalogue-border))] transition-colors duration-200"
                  >
                    <span className="flex items-center gap-3">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 5.636l-3.536 3.536m0 5.656l3.536 3.536M9.172 9.172L5.636 5.636m3.536 9.192l-3.536 3.536M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-5 0a4 4 0 11-8 0 4 4 0 018 0z" />
                      </svg>
                      Customer Services
                    </span>
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
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
            // Standard mobile menu
            isMobileMenuOpen && (navigation.length > 0 || authLinks.length > 0) && (
              <div
                ref={setMobileMenuRef}
                className="md:hidden fixed left-0 right-0 z-[var(--catalogue-z-dropdown)] border-t border-[hsl(var(--catalogue-border-subtle))] bg-white"
                style={{ top: isIOS ? 'calc(56px + 32px)' : '56px' }}
              >
                <div className="px-4 py-3 space-y-1">
                  {/* Navigation Links */}
                  {navigation.map((item, index) => {
                    const isActive = isActiveRoute(item.route, item.label);
                    const openInSameTab = item.openInSameTab === true || String(item.openInSameTab) === "true";
                    return (
                      <button
                        key={index}
                        onClick={() => {
                          setIsMobileMenuOpen(false);
                          handleNavigation(item.route, item.label, openInSameTab);
                        }}
                        className={`block w-full text-left px-4 py-2.5 rounded-md text-base font-medium transition-colors duration-200 ${isActive
                          ? 'text-primary-500 bg-primary-50'
                          : 'text-[hsl(var(--catalogue-text-secondary))] hover:text-[hsl(var(--catalogue-text-primary))] hover:bg-[hsl(var(--catalogue-interactive-hover))]'
                          }`}
                      >
                        {item.label}
                      </button>
                    );
                  })}

                  {/* Auth Links */}
                  {(authLinks.length > 0 || isAuthenticated) && (
                    <div className="border-t border-[hsl(var(--catalogue-border-subtle))] pt-3 mt-3 space-y-2">
                      {isAuthenticated ? (
                        <>
                          <button
                            onClick={() => {
                              setIsMobileMenuOpen(false);
                              navigate({ to: '/dashboard' });
                            }}
                            className={`block w-full text-left px-4 py-2.5 rounded-md text-base font-medium transition-colors duration-200 text-white bg-primary-500 hover:bg-primary-400`}
                          >
                            Dashboard
                          </button>
                          <div className="px-4 py-1">
                            {/* In mobile maybe don't need notification bell alone, they can see from dashboard */}
                            {/* Just have dashboard link */}
                          </div>
                        </>
                      ) : (
                        authLinks.map((link, index) => (
                          <button
                            key={`auth-${index}`}
                            onClick={() => {
                              if (link.route === 'login' || link.route === 'signup') {
                                navigate({ to: `/${link.route}` });
                              } else if (link.route === 'getStarted' || link.label.toLowerCase().includes('get started')) {
                                const event = new CustomEvent('openLeadCollection', {
                                  detail: { source: 'mobileMenu' }
                                });
                                window.dispatchEvent(event);
                              } else {
                                navigate({ to: link.route });
                              }
                              setIsMobileMenuOpen(false);
                            }}
                            className={`block w-full text-left px-4 py-2.5 rounded-md text-base font-medium transition-colors duration-200 ${index === 0
                              ? 'text-white bg-primary-500 hover:bg-primary-400'
                              : 'text-primary-500 hover:bg-primary-50'
                              }`}
                          >
                            {link.label}
                          </button>
                        ))
                      )}
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
