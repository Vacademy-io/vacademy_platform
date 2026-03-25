import { CourseCatalogueData, Page } from "../-types/course-catalogue-types";

/**
 * Route matcher utility for handling dynamic page routing
 * Checks if a route is external, matches it with pages object, and returns normalized route path
 */
export class RouteMatcher {
  /**
   * Check if a route is an external link (http:// or https://)
   */
  static isExternalLink(route: string): boolean {
    return route.startsWith("http://") || route.startsWith("https://");
  }

  /**
   * Normalize a route string for comparison
   * e.g., "homepage" -> "home", "/courses" -> "courses", etc.
   */
  static normalizeRoute(route: string): string {
    return route
      .toLowerCase()
      .replace(/^\//, "") // Remove leading slash
      .replace(/\/$/, "") // Remove trailing slash
      .replace(/^homepage$/, "home") // Map homepage to home
      .trim();
  }

  /**
   * Find a matching page in the catalogue pages array
   * Matches by route, id, or normalized names
   */
  static findMatchingPage(
    route: string,
    pages: Page[]
  ): Page | undefined {
    if (!pages || pages.length === 0) {
      return undefined;
    }

    const normalizedRoute = this.normalizeRoute(route);

    // Exact route match
    let matchedPage = pages.find(
      (page) => this.normalizeRoute(page.route) === normalizedRoute
    );

    if (matchedPage) {
      return matchedPage;
    }

    // Exact id match
    matchedPage = pages.find(
      (page) => this.normalizeRoute(page.id) === normalizedRoute
    );

    if (matchedPage) {
      return matchedPage;
    }

    // Partial match (useful for pages like "course-list" matching "courses")
    matchedPage = pages.find(
      (page) =>
        this.normalizeRoute(page.route).includes(normalizedRoute) ||
        normalizedRoute.includes(this.normalizeRoute(page.route)) ||
        this.normalizeRoute(page.id).includes(normalizedRoute) ||
        normalizedRoute.includes(this.normalizeRoute(page.id))
    );

    if (matchedPage) {
      return matchedPage;
    }
    return undefined;
  }

  /**
   * Get the navigation route for a given page
   * Returns either the page id or route, depending on what's defined
   */
  static getPageNavigationRoute(page: Page, tagName: string): string {
    // Use the page route/id that is defined
    const routeId = page.route || page.id;
    
    // If it's already a full path, return as-is
    if (routeId.startsWith("/")) {
      return routeId;
    }

    // Build the route with tagName prefix
    const normalizedId = this.normalizeRoute(routeId);
    
    // Special case for home/homepage - just return /$tagName
    if (normalizedId === "home") {
      return `/${tagName}`;
    }

    // For other pages, return /$tagName/$routeId
    return `/${tagName}/${normalizedId}`;
  }

  /**
   * Process navigation routes from catalogue data
   * Checks each route and returns valid navigation items with matched pages
   */
  static processNavigationRoutes(
    navigationItems: Array<{ label: string; route: string }>,
    catalogueData: CourseCatalogueData,
    tagName: string
  ): Array<{
    label: string;
    route: string;
    isExternal: boolean;
    matchedPage?: Page;
  }> {
    return navigationItems.map((item) => {
      const isExternal = this.isExternalLink(item.route);
      
      if (isExternal) {
        return {
          label: item.label,
          route: item.route,
          isExternal: true,
        };
      }

      // Try to find a matching page
      const matchedPage = this.findMatchingPage(item.route, catalogueData.pages);

      if (matchedPage) {
        // Route should be /$tagName or /$tagName/routeId
        const normalizedRoute = this.normalizeRoute(item.route);
        const finalRoute =
          normalizedRoute === "home" || normalizedRoute === ""
            ? `/${tagName}`
            : `/${tagName}/${normalizedRoute}`;

        return {
          label: item.label,
          route: finalRoute,
          isExternal: false,
          matchedPage,
        };
      }

      // If no matching page, but route looks like an internal route, keep it
      // This allows for routes to pages not yet loaded
      return {
        label: item.label,
        route: item.route,
        isExternal: false,
      };
    });
  }

  /**
   * Process footer links with route matching
   */
  static processFooterLinks(
    links: Array<{ label: string; route: string }>,
    catalogueData: CourseCatalogueData,
    tagName: string
  ): Array<{
    label: string;
    route: string;
    isExternal: boolean;
    matchedPage?: Page;
  }> {
    return this.processNavigationRoutes(links, catalogueData, tagName);
  }

  /**
   * Validate if a current pathname matches a page route
   * Useful for highlighting active navigation items
   */
  static isRouteActive(
    currentPath: string,
    navRoute: string,
    tagName: string
  ): boolean {
    const normalizedCurrent = this.normalizeRoute(currentPath);
    const normalizedNav = this.normalizeRoute(navRoute);

    // Remove tagName from current path for comparison
    const pathWithoutTag = normalizedCurrent
      .replace(new RegExp(`^${this.normalizeRoute(tagName)}`), "")
      .replace(/^\//, "");

    // Check various matches
    return (
      normalizedCurrent === normalizedNav ||
      normalizedNav === normalizedCurrent ||
      pathWithoutTag === normalizedNav ||
      `${this.normalizeRoute(tagName)}/${pathWithoutTag}` === normalizedNav
    );
  }

  /**
   * Extract route information from a pathname
   */
  static extractRouteInfo(
    pathname: string,
    tagName: string
  ): {
    tagName: string;
    pageRoute: string | null;
    isHomePage: boolean;
  } {
    const segments = pathname.split("/").filter(Boolean);

    // If only one segment, it's the tagName
    if (segments.length === 1) {
      return {
        tagName: segments[0],
        pageRoute: null,
        isHomePage: true,
      };
    }

    // If two segments, first is tagName, second is page route
    if (segments.length >= 2) {
      return {
        tagName: segments[0],
        pageRoute: segments.slice(1).join("/"),
        isHomePage: false,
      };
    }

    return {
      tagName,
      pageRoute: null,
      isHomePage: true,
    };
  }
}

