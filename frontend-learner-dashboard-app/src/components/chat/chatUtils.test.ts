import { describe, expect, it } from "vitest";
import { formatClockTime, toUtcDate } from "./chatUtils";

/**
 * The regression this guards: a message sent at 2:17 PM IST is stored as the UTC wall clock
 * 08:47:03, and a service build that serialised it without a zone marker made every browser
 * read it as 8:47 AM local.
 */
const SENT_AT = Date.parse("2026-08-19T08:47:03.767Z");

describe("toUtcDate", () => {
  it("reads a zone-less server timestamp as UTC", () => {
    expect(toUtcDate("2026-08-19T08:47:03.767725")?.getTime()).toBe(SENT_AT);
  });

  it("leaves an explicit UTC timestamp alone", () => {
    expect(toUtcDate("2026-08-19T08:47:03.767725Z")?.getTime()).toBe(SENT_AT);
  });

  it("leaves an explicit offset alone rather than shifting it twice", () => {
    expect(toUtcDate("2026-08-19T14:17:03.767+05:30")?.getTime()).toBe(SENT_AT);
  });

  it("accepts the space-separated form", () => {
    expect(toUtcDate("2026-08-19 08:47:03.767725")?.getTime()).toBe(SENT_AT);
  });

  it("returns null for empty or unparseable input", () => {
    expect(toUtcDate(undefined)).toBeNull();
    expect(toUtcDate(null)).toBeNull();
    expect(toUtcDate("")).toBeNull();
    expect(toUtcDate("not a date")).toBeNull();
  });
});

/** Modern ICU separates the AM/PM marker with a narrow no-break space. */
const normalise = (s: string) => s.replace(/[\u202f\u00a0]/g, " ");

describe("formatClockTime", () => {
  // 2026-08-19T08:46Z is 2:16 PM in IST, the zone every institute runs in.
  const afternoon = new Date("2026-08-19T08:46:00Z");
  const morning = new Date("2026-08-19T03:16:00Z");

  it("renders a 12-hour clock even for a locale that defaults to 24-hour", () => {
    expect(normalise(formatClockTime(afternoon, "en-GB"))).toBe("2:16 PM");
  });

  it("uppercases the marker for locales that spell it lowercase", () => {
    expect(normalise(formatClockTime(afternoon, "en-IN"))).toBe("2:16 PM");
    expect(normalise(formatClockTime(afternoon, "en-US"))).toBe("2:16 PM");
  });

  it("marks morning times AM", () => {
    expect(normalise(formatClockTime(morning, "en-GB"))).toBe("8:46 AM");
  });
});
