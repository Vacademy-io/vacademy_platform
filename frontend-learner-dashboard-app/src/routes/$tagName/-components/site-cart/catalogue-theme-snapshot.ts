/**
 * The catalogue's palette for content portalled out of the page.
 *
 * A site's colours live on its theme wrapper — the [data-catalogue-theme]
 * preset plus inline --primary-* variables (and `dark`) — not on :root. The
 * learner Sheet portals to document.body, outside that wrapper, so a drawer
 * would paint in the app chrome's colours. Copying the wrapper's theme
 * attributes and inline custom properties onto the portalled panel makes it
 * wear the institute's theme like the rest of the page.
 */

export interface CatalogueThemeSnapshot {
  /** data-catalogue-* attributes to set on the panel. */
  attrs: Record<string, string>;
  /** Inline custom properties (--primary-500 …) of the wrapper. */
  vars: Record<string, string>;
  dark: boolean;
}

const THEME_ATTRIBUTES = ["data-catalogue-theme", "data-catalogue-radius", "data-heading-scale"];

interface StyleLike {
  length: number;
  item(index: number): string;
  getPropertyValue(name: string): string;
}

interface ThemeHostLike {
  getAttribute(name: string): string | null;
  classList: { contains(token: string): boolean };
  style: StyleLike;
}

interface ElementLike {
  closest(selector: string): unknown;
}

export const readCatalogueTheme = (el: ElementLike | null | undefined): CatalogueThemeSnapshot | null => {
  const host = (el?.closest?.("[data-catalogue-theme]") ?? null) as ThemeHostLike | null;
  if (!host) return null;
  const attrs: Record<string, string> = {};
  for (const name of THEME_ATTRIBUTES) {
    const value = host.getAttribute(name);
    if (value) attrs[name] = value;
  }
  const vars: Record<string, string> = {};
  for (let i = 0; i < host.style.length; i++) {
    const prop = host.style.item(i);
    if (prop.startsWith("--")) {
      const value = host.style.getPropertyValue(prop).trim();
      if (value) vars[prop] = value;
    }
  }
  return { attrs, vars, dark: host.classList.contains("dark") };
};
