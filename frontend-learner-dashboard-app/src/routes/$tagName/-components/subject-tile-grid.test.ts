import { describe, it, expect, vi } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { SubjectTileGrid, type SubjectTile } from "./SubjectTileGrid";

/**
 * The tile grid is the whole visible difference of the "tiles" course-content
 * variant on the public course page, and nothing between the editor and
 * production renders it — this app's build never runs tsc. So render it for
 * real (SSR, the only option here: no @testing-library, environment "node")
 * and check the artwork, the fallback, and the open state actually come out.
 */

const SUBJECTS: SubjectTile[] = [
  { id: "s1", subject_name: "Level 2: English", description: "Reading & phonics" },
  { id: "s2", subject_name: "Level 2: Math Explorer" },
];

const html = (props: Partial<Parameters<typeof SubjectTileGrid>[0]> = {}) =>
  renderToStaticMarkup(
    React.createElement(SubjectTileGrid, {
      subjects: SUBJECTS,
      thumbs: {},
      openSubjectId: null,
      onToggle: vi.fn(),
      ...props,
    }),
  );

describe("SubjectTileGrid", () => {
  it("renders a card per subject", () => {
    const out = html();
    expect(out).toContain("Level 2: English");
    expect(out).toContain("Level 2: Math Explorer");
    expect((out.match(/<button/g) || []).length).toBe(2);
  });

  it("lays the cards out as a grid, not a list", () => {
    expect(html()).toContain("grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3");
  });

  it("shows the subject artwork when one resolved", () => {
    const out = html({ thumbs: { s1: "https://cdn.example/eng.png" } });
    expect(out).toContain('src="https://cdn.example/eng.png"');
    // Decorative: the subject name is right beside it, so an alt would be
    // read out twice.
    expect(out).toContain('alt=""');
  });

  it("falls back to a glyph rather than a broken image when artwork is missing", () => {
    const out = html({ thumbs: {} });
    expect(out).not.toContain("<img");
    expect(out).toContain("svg");
  });

  it("marks only the open card as expanded", () => {
    const out = html({ openSubjectId: "s2" });
    expect((out.match(/aria-expanded="true"/g) || []).length).toBe(1);
    expect((out.match(/aria-expanded="false"/g) || []).length).toBe(1);
  });

  it("omits the description line for a subject that has none", () => {
    const out = html();
    expect(out).toContain("Reading &amp; phonics");
    // Two cards, one description — the subject without one must not leave a
    // blank line where its text would go. Match the description div itself,
    // not the muted colour, which the artwork-fallback glyph also uses.
    const descriptions = out.match(/truncate text-sm text-catalogue-text-muted/g) || [];
    expect(descriptions.length).toBe(1);
  });

  it("renders nothing for an empty subject list", () => {
    expect(html({ subjects: [] })).not.toContain("<button");
  });
});
