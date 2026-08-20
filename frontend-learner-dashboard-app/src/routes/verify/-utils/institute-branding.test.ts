import { describe, expect, it } from "vitest";
import {
  displayHost,
  ensureHttp,
  normalizeThemeColor,
} from "./institute-branding";

/**
 * Branding on the public verification page.
 *
 * The page is opened by strangers judging whether a certificate is genuine, so
 * every one of these has the same failure mode: a page that looks broken reads
 * as "this certificate is suspect". None of them may throw, and none may emit
 * something a browser silently ignores.
 */

describe("theme colour", () => {
  // The hex literals below are the data under test, not UI colours.
  it("takes a hex the institute stored properly", () => {
    expect(normalizeThemeColor("#ED7424")).toBe("#ED7424"); // design-lint-ignore: test data
    expect(normalizeThemeColor("#fff")).toBe("#fff"); // design-lint-ignore: test data
  });

  /** Some institute rows hold the hex without its hash. */
  it("repairs a hex stored without its hash", () => {
    expect(normalizeThemeColor("ED7424")).toBe("#ED7424"); // design-lint-ignore: test data
    expect(normalizeThemeColor("  1e4fa1 ")).toBe("#1e4fa1"); // design-lint-ignore: test data
  });

  /**
   * Dropped, not passed through: an unparseable colour paints nothing, so the
   * page would render an invisible logo mark instead of a fallback.
   */
  it("drops anything that is not a usable colour", () => {
    expect(normalizeThemeColor("orange")).toBeNull();
    expect(normalizeThemeColor("#12345")).toBeNull();
    expect(normalizeThemeColor("")).toBeNull();
    expect(normalizeThemeColor(null)).toBeNull();
    expect(normalizeThemeColor(undefined)).toBeNull();
  });
});

describe("institute website", () => {
  it("makes a scheme-less address a working link", () => {
    expect(ensureHttp("edustream.ae")).toBe("https://edustream.ae");
  });

  it("leaves an address that already has a scheme alone", () => {
    expect(ensureHttp("http://edustream.ae")).toBe("http://edustream.ae");
    expect(ensureHttp("https://edustream.ae")).toBe("https://edustream.ae");
  });

  it("prints the host without scheme noise", () => {
    expect(displayHost("https://edustream.ae/")).toBe("edustream.ae");
    expect(displayHost("  http://edustream.ae  ")).toBe("edustream.ae");
    expect(displayHost("edustream.ae")).toBe("edustream.ae");
  });
});
