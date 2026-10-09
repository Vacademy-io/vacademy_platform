import { describe, expect, it, vi } from "vitest";

// folder-library-service reads the backend URL (window.location) at import time.
vi.mock("@/constants/urls", () => ({ BASE_URL: "" }));

import type { PublicFolderNode } from "../../../-services/folder-library-service";
import { findStream, folderTagSet, streamTabText, streamsFromFolderTree, streamsFromTagItems } from "./catalog-streams";

const folder = (id: string, extra: Partial<PublicFolderNode> = {}, children: PublicFolderNode[] = []): PublicFolderNode => ({
  id,
  node_type: "FOLDER",
  children,
  ...extra,
});

const page = (id: string): PublicFolderNode => ({ id, node_type: "PRODUCT_PAGE", product_page_code: id, children: [] });

const TREE: PublicFolderNode[] = [
  folder("s1", { title: "शिक्षा", subtitle: "EDUCATION", slug: "shiksha" }, [
    folder("c1", { title: "वैदिक गणित", subtitle: "Vedic Maths", course_tag: "Vedic-Maths" }, [
      folder("c1a", { title: "Deep", slug: "vedic-advanced" }),
      page("pp-1"),
    ]),
    folder("c2", { title: "संस्कृत", subtitle: "Sanskrit", coming_soon: true, audience_id: "aud-1" }),
    folder("c3", { title: "Dup", slug: "sanskrit" }),
    page("pp-2"),
  ]),
  folder("s2", { title: "Kala", coming_soon: true, audience_id: " aud-2 " }),
  page("top-level-page"),
  folder("s3", { title: "Again", slug: "shiksha" }),
];

describe("streamsFromFolderTree", () => {
  const streams = streamsFromFolderTree(TREE);

  it("makes top-level folders streams and keeps empty / coming-soon ones", () => {
    expect(streams.map((s) => s.slug)).toEqual(["shiksha", "kala"]);
    expect(streams[1]).toMatchObject({ title: "Kala", comingSoon: true, audienceId: "aud-2", categories: [] });
  });

  it("collects the stream's own tag plus every folder tag below it", () => {
    expect(streams[0].tag).toBe("shiksha");
    expect(streams[0].tags.sort()).toEqual(["sanskrit", "shiksha", "vedic-advanced", "vedic-maths"]);
  });

  it("makes direct sub-folders categories, de-duplicated by slug", () => {
    expect(streams[0].categories.map((c) => [c.slug, c.title, c.subtitle, c.comingSoon])).toEqual([
      ["vedic-maths", "वैदिक गणित", "Vedic Maths", false],
      ["sanskrit", "संस्कृत", "Sanskrit", true],
    ]);
    expect(streams[0].categories[0].tags.sort()).toEqual(["vedic-advanced", "vedic-maths"]);
    expect(streams[0].categories[1].audienceId).toBe("aud-1");
  });

  it("handles a missing tree", () => {
    expect(streamsFromFolderTree(undefined)).toEqual([]);
  });

  it("folderTagSet ignores product pages", () => {
    expect(folderTagSet(page("x"))).toEqual([]);
  });
});

describe("streamsFromTagItems", () => {
  it("maps validated items to tag streams", () => {
    expect(streamsFromTagItems([{ label: "Shiksha", slug: "shiksha", tag: "Shiksha" }])).toEqual([
      {
        id: "shiksha",
        slug: "shiksha",
        title: "Shiksha",
        subtitle: "",
        tag: "shiksha",
        tags: ["shiksha"],
        comingSoon: false,
        audienceId: null,
        categories: [],
      },
    ]);
  });
});

describe("streamTabText", () => {
  const s = { title: "शिक्षा", subtitle: "EDUCATION", slug: "shiksha" };
  it("follows the label mode", () => {
    expect(streamTabText(s, "title")).toEqual({ primary: "शिक्षा", secondary: "" });
    expect(streamTabText(s, "subtitle")).toEqual({ primary: "EDUCATION", secondary: "" });
    expect(streamTabText(s, "both")).toEqual({ primary: "शिक्षा", secondary: "EDUCATION" });
  });

  it("falls back when a text is missing", () => {
    expect(streamTabText({ title: "Kala", subtitle: "", slug: "kala" }, "subtitle")).toEqual({ primary: "Kala", secondary: "" });
    expect(streamTabText({ title: "", subtitle: "", slug: "kala" }, "both")).toEqual({ primary: "kala", secondary: "" });
  });

  it("finds a stream by slug", () => {
    const streams = streamsFromFolderTree(TREE);
    expect(findStream(streams, "kala")?.id).toBe("s2");
    expect(findStream(streams, null)).toBeNull();
    expect(findStream(streams, "nope")).toBeNull();
  });
});
