// @vitest-environment jsdom
//
// The suite-wide default is `node`; DOMPurify needs a real window to build
// its sanitizer, so this file opts into jsdom (installed, but not the default).
import { describe, expect, it } from "vitest";
import {
  applyPostSubmitTokens,
  DEFAULT_POST_SUBMIT_CONFIGURATION,
  isDefaultPostSubmitConfiguration,
  isExternalPostSubmitUrl,
  parsePostSubmitConfiguration,
  resolvePostSubmitButtons,
  resolvePostSubmitUrl,
  sanitizePostSubmitHtml,
} from "./post-submit-config";

const TOKENS = {
  name: "Asha R",
  email: "asha@example.com",
  campaignName: "Open Day",
};

describe("parsePostSubmitConfiguration", () => {
  it("falls back to the previous hardcoded copy when no blob exists", () => {
    // Campaigns created before the feature have no setting_json at all — the
    // public form must render exactly as it did before.
    expect(parsePostSubmitConfiguration(undefined)).toEqual(
      DEFAULT_POST_SUBMIT_CONFIGURATION
    );
    expect(parsePostSubmitConfiguration("{oops")).toEqual(
      DEFAULT_POST_SUBMIT_CONFIGURATION
    );
  });

  it("reads the admin-authored block and defaults the rest", () => {
    const parsed = parsePostSubmitConfiguration(
      JSON.stringify({
        postSubmitConfiguration: {
          enabled: true,
          successTitle: "See you there",
          // Keys this build no longer knows (artwork was removed) must be
          // ignored, not crash the public form.
          icon: "confetti",
          imageUrl: "https://cdn.example.com/banner.png",
        },
      })
    );
    expect(parsed.successTitle).toBe("See you there");
    expect(parsed.enabled).toBe(true);
    expect(parsed.successMessage).toBe(
      DEFAULT_POST_SUBMIT_CONFIGURATION.successMessage
    );
  });


  it("migrates the original single-button shape", () => {
    // The first cut of this feature wrote showCtaButton/ctaButtonText/
    // ctaButtonUrl; a campaign saved then must keep its button.
    const parsed = parsePostSubmitConfiguration(
      JSON.stringify({
        postSubmitConfiguration: {
          showCtaButton: true,
          ctaButtonText: "Join",
          ctaButtonUrl: "https://chat.example.com",
        },
      })
    );
    expect(parsed.buttons).toHaveLength(1);
    expect(parsed.buttons[0]?.text).toBe("Join");
    expect(parsed.buttons[0]?.url).toBe("https://chat.example.com");
    expect(parsed.buttons[0]?.variant).toBe("primary");
  });

  it("drops half-filled buttons and caps the list", () => {
    const parsed = parsePostSubmitConfiguration(
      JSON.stringify({
        postSubmitConfiguration: {
          buttons: [
            { id: "a", text: "Ok", url: "/x", variant: "primary" },
            { id: "b", text: "", url: "" },
            { id: "c", text: "No link", url: "  " },
          ],
        },
      })
    );
    expect(parsed.buttons).toHaveLength(1);
    expect(parsed.buttons[0]?.id).toBe("a");
  });

  it("ignores unrelated keys in the same blob", () => {
    const parsed = parsePostSubmitConfiguration(
      JSON.stringify({ workflow_setting: { offset_day: 2 } })
    );
    expect(parsed).toEqual(DEFAULT_POST_SUBMIT_CONFIGURATION);
  });
});

describe("applyPostSubmitTokens", () => {
  it("substitutes the submitted values", () => {
    expect(
      applyPostSubmitTokens("Thanks {{name}}, see you at {{campaignName}}", TOKENS)
    ).toBe("Thanks Asha R, see you at Open Day");
  });

  it("tolerates whitespace inside the braces", () => {
    expect(applyPostSubmitTokens("Hi {{ name }}", TOKENS)).toBe("Hi Asha R");
  });

  it("blanks a token the form never collected", () => {
    expect(applyPostSubmitTokens("Hi {{name}}", {})).toBe("Hi ");
  });

  it("url-encodes when asked, for query strings", () => {
    expect(
      applyPostSubmitTokens("/thanks?e={{email}}&n={{name}}", TOKENS, {
        encode: true,
      })
    ).toBe("/thanks?e=asha%40example.com&n=Asha%20R");
  });
});

describe("resolvePostSubmitUrl", () => {
  it("returns null when no destination is configured", () => {
    expect(resolvePostSubmitUrl("", TOKENS)).toBeNull();
    expect(resolvePostSubmitUrl("   ", TOKENS)).toBeNull();
  });

  it("passes through safe destinations with tokens applied", () => {
    expect(resolvePostSubmitUrl("/thanks?e={{email}}", TOKENS)).toBe(
      "/thanks?e=asha%40example.com"
    );
    expect(resolvePostSubmitUrl("https://example.com/x", TOKENS)).toBe(
      "https://example.com/x"
    );
  });

  it("refuses script and protocol-relative destinations", () => {
    // This string is handed to window.location on an anonymous public page.
    expect(resolvePostSubmitUrl("javascript:alert(1)", TOKENS)).toBeNull();
    expect(resolvePostSubmitUrl("//evil.example.com", TOKENS)).toBeNull();
    expect(resolvePostSubmitUrl("data:text/html,<b>x", TOKENS)).toBeNull();
  });
});

describe("isExternalPostSubmitUrl", () => {
  it("separates new-tab links from in-place navigation", () => {
    expect(isExternalPostSubmitUrl("https://example.com")).toBe(true);
    expect(isExternalPostSubmitUrl("/dashboard")).toBe(false);
  });
});

describe("sanitizePostSubmitHtml", () => {
  it("keeps formatting the admin actually wrote", () => {
    const clean = sanitizePostSubmitHtml(
      '<p>Welcome <strong>Asha</strong> — <a href="https://x.com">details</a></p>'
    );
    expect(clean).toContain("<strong>Asha</strong>");
    expect(clean).toContain('href="https://x.com"');
  });

  it("strips scripts and event handlers", () => {
    const clean = sanitizePostSubmitHtml(
      '<p onclick="steal()">hi</p><script>alert(1)</script><iframe src="x"></iframe>'
    );
    expect(clean).not.toContain("script");
    expect(clean).not.toContain("onclick");
    expect(clean).not.toContain("iframe");
    expect(clean).toContain("hi");
  });
});

describe("resolvePostSubmitButtons", () => {
  const withButtons = (buttons: unknown) =>
    parsePostSubmitConfiguration(
      JSON.stringify({ postSubmitConfiguration: { enabled: true, buttons } })
    );

  it("applies tokens to text and link", () => {
    const resolved = resolvePostSubmitButtons(
      withButtons([
        { id: "a", text: "Bye {{name}}", url: "/x?e={{email}}", variant: "primary" },
      ]),
      TOKENS
    );
    expect(resolved).toEqual([
      { id: "a", text: "Bye Asha R", href: "/x?e=asha%40example.com", variant: "primary" },
    ]);
  });

  it("drops a button whose link is unsafe rather than rendering it dead", () => {
    const resolved = resolvePostSubmitButtons(
      withButtons([
        { id: "a", text: "Safe", url: "https://ok.example.com", variant: "primary" },
        { id: "b", text: "Bad", url: "javascript:alert(1)", variant: "secondary" },
      ]),
      TOKENS
    );
    expect(resolved.map((b) => b.id)).toEqual(["a"]);
  });
});

describe("isDefaultPostSubmitConfiguration", () => {
  // The catalogue surface keeps its original thank-you block while this is
  // true, so live pages nobody edited don't silently change copy.
  it("is true for a campaign that never touched the card", () => {
    expect(
      isDefaultPostSubmitConfiguration(parsePostSubmitConfiguration(undefined))
    ).toBe(true);
    expect(
      isDefaultPostSubmitConfiguration(parsePostSubmitConfiguration("{}"))
    ).toBe(true);
    expect(
      isDefaultPostSubmitConfiguration(
        parsePostSubmitConfiguration(
          JSON.stringify({ workflow_setting: { offset_day: 1 } })
        )
      )
    ).toBe(true);
  });

  it("is true whenever the master switch is off, whatever else is set", () => {
    // Off is the default; nothing in the blob may leak onto a public page.
    expect(
      isDefaultPostSubmitConfiguration(
        parsePostSubmitConfiguration(
          JSON.stringify({
            postSubmitConfiguration: {
              enabled: false,
              successTitle: "Custom",
              redirectUrl: "https://example.com",
              buttons: [{ id: "a", text: "Go", url: "/x", variant: "primary" }],
            },
          })
        )
      )
    ).toBe(true);
  });

  it("is false as soon as anything is authored AND the switch is on", () => {
    const cases = [
      { successTitle: "Hi" },
      { successMessage: "Custom" },
      { content: "<p>x</p>" },
      { allowAnotherResponse: true },
      { anotherResponseText: "Again" },
      { redirectUrl: "/thanks" },
      { redirectDelaySeconds: 3 },
      { buttons: [{ id: "a", text: "Go", url: "/x", variant: "primary" }] },
    ];
    for (const partial of cases) {
      const postSubmitConfiguration = { enabled: true, ...partial };
      expect(
        isDefaultPostSubmitConfiguration(
          parsePostSubmitConfiguration(JSON.stringify({ postSubmitConfiguration }))
        )
      ).toBe(false);
    }
  });
});
