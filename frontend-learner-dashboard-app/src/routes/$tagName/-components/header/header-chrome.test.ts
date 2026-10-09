import { describe, expect, it } from "vitest";
import {
  EDITORIAL_AUTH_CLASSES,
  editorialNavItemClasses,
  hasHeaderChrome,
  headerOffsetClass,
  languageSwitcherClasses,
  resolveHeaderChrome,
} from "./header-chrome";

describe("resolveHeaderChrome", () => {
  it("turns nothing on for a header without the opt-in props", () => {
    for (const props of [undefined, null, {}, { activeStyle: "underline" }]) {
      const c = resolveHeaderChrome(props as never);
      expect(hasHeaderChrome(c)).toBe(false);
    }
  });

  it("reads each prop only at its exact opt-in value", () => {
    const c = resolveHeaderChrome({
      barSize: "compact",
      contentWidth: "contained",
      navStyle: "editorial",
      logoOnly: true,
      languageSwitcherStyle: "segmented",
      cartDisplay: "whenNotEmpty",
      megaMenuStyle: "editorial",
    });
    expect(Object.values(c).every(Boolean)).toBe(true);
    const off = resolveHeaderChrome({
      barSize: "default",
      contentWidth: "full",
      navStyle: "default",
      logoOnly: "yes" as never,
      languageSwitcherStyle: "pill",
      cartDisplay: "always",
      megaMenuStyle: "default",
    });
    expect(hasHeaderChrome(off)).toBe(false);
  });
});

describe("headerOffsetClass", () => {
  it("keeps the original offsets unless the bar is compact", () => {
    expect(headerOffsetClass(undefined)).toBe("pt-16 md:pt-20");
    expect(headerOffsetClass({ barSize: "default" })).toBe("pt-16 md:pt-20");
    expect(headerOffsetClass({}, "pt-20")).toBe("pt-20");
    expect(headerOffsetClass({ barSize: "compact" })).toBe("pt-16");
    expect(headerOffsetClass({ barSize: "compact" }, "pt-20")).toBe("pt-16");
  });
});

describe("editorial classes (Figma header 1:37 / 73:325)", () => {
  it("nav: 13px, the current page bold in the palette gold, others in the palette text colour", () => {
    expect(editorialNavItemClasses(true)).toContain("text-[13px]"); // design-lint-ignore: asserts the exact Figma class
    expect(editorialNavItemClasses(true)).toContain("font-bold text-palette-gold");
    expect(editorialNavItemClasses(false)).toContain("font-normal text-palette-text");
    expect(editorialNavItemClasses(false)).not.toContain("underline");
  });

  it("auth links: text link without padding, 8px-radius primary button", () => {
    expect(EDITORIAL_AUTH_CLASSES.text).not.toMatch(/(^|\s)px-/);
    expect(EDITORIAL_AUTH_CLASSES.primary).toContain("rounded-[8px]"); // design-lint-ignore: asserts the exact Figma class
    expect(EDITORIAL_AUTH_CLASSES.primary).toContain("bg-palette-primary");
  });

  it("segmented switch fills the active half; the footer one has no fill", () => {
    const seg = languageSwitcherClasses("segmented");
    expect(seg.group).toContain("border-palette-border");
    expect(seg.button(true)).toContain("bg-palette-sand text-palette-primary");
    expect(seg.button(false)).toContain("text-palette-muted");
    const foot = languageSwitcherClasses("footer");
    expect(foot.button(true)).not.toContain("bg-");
    expect(foot.button(true)).toContain("text-palette-body");
  });
});
