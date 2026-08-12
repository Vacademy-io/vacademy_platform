import { beforeEach, describe, expect, it, vi } from "vitest";
import { createInMemoryConnection } from "../db/sqljs-connection";
import { runMigrations } from "../db/migrations";
import type { OfflineDbConnection } from "../db/connection";
import { nodesDao } from "../db/dao/nodes-dao";
import { assetsDao } from "../db/dao/assets-dao";
import { slidePayloadsDao } from "../db/dao/slide-payloads-dao";
import type { OfflineManifest } from "@/services/offline/manifest-service";
import {
  computeSlideStatus,
  ensureNodeTree,
  expandNode,
  rollupNodeStatus,
  subtreeHasOnlineOnly,
} from "./expander";

vi.mock("../crypto/keys", () => ({
  getOrCreateOfflineKey: vi.fn(async () => {
    const raw = crypto.getRandomValues(new Uint8Array(32));
    return crypto.subtle.importKey("raw", raw as BufferSource, { name: "AES-CTR" }, false, [
      "encrypt",
      "decrypt",
    ]);
  }),
}));

function manifestFixture(opts: { onlineOnlySlide?: boolean } = {}): OfflineManifest {
  return {
    package_session_id: "ps1",
    manifest_version: 1,
    settings: { revalidation_days: 7, max_devices: 2 },
    subjects: [
      {
        subject_id: "sub1",
        subject_name: "Math",
        subject_order: 1,
        modules: [
          {
            module_id: "mod1",
            module_name: "Algebra",
            module_order: 1,
            chapters: [
              {
                chapter_id: "chap1",
                chapter_name: "Ch1",
                chapter_order: 1,
                slides: [
                  {
                    slide_id: "slide1",
                    slide_type: "DOCUMENT",
                    title: "Notes",
                    slide_order: 1,
                    downloadable: true,
                    reason: "ALLOWED",
                    key_ref: null,
                    inline_payload: null,
                    assets: [
                      {
                        file_id: "file1",
                        role: "DOCUMENT",
                        size_bytes: 1000,
                        checksum: "etag-1",
                        checksum_type: "S3_ETAG",
                      },
                    ],
                  },
                  {
                    slide_id: "slide2",
                    slide_type: "QUIZ",
                    title: "Quiz",
                    slide_order: 2,
                    downloadable: true,
                    reason: "ALLOWED",
                    key_ref: null,
                    inline_payload: { questions: [{ id: "q1" }] },
                    assets: [],
                  },
                  ...(opts.onlineOnlySlide
                    ? [
                        {
                          slide_id: "slide3",
                          slide_type: "YOUTUBE",
                          title: "Video",
                          slide_order: 3,
                          downloadable: false,
                          reason: "ONLINE_ONLY" as const,
                          key_ref: null,
                          inline_payload: null,
                          assets: [],
                        },
                      ]
                    : []),
                ],
              },
            ],
          },
        ],
      },
    ],
  };
}

describe("rollupNodeStatus", () => {
  it("all children DOWNLOADED → DOWNLOADED", () => {
    // Online-only slides never get a node row, so "every child downloaded"
    // already means "everything savable here is saved" — there is nothing left
    // to fetch, and PARTIAL would render an actionable download control that
    // does nothing.
    expect(rollupNodeStatus(["DOWNLOADED", "DOWNLOADED"])).toBe("DOWNLOADED");
  });

  it("any child DOWNLOADING → parent DOWNLOADING", () => {
    expect(rollupNodeStatus(["DOWNLOADED", "DOWNLOADING"])).toBe("DOWNLOADING");
  });

  it("any child ERROR → parent ERROR", () => {
    expect(rollupNodeStatus(["DOWNLOADED", "ERROR"])).toBe("ERROR");
  });

  it("no children → NOT_DOWNLOADED", () => {
    expect(rollupNodeStatus([])).toBe("NOT_DOWNLOADED");
  });

  it("reports NOT_DOWNLOADED — not PARTIAL — when nothing is saved", () => {
    // PARTIAL must mean "some of this is on your device". Returning it for an
    // untouched node made never-downloaded chapters look partly saved and kept
    // subjects on the Downloads screen after Clear all downloads.
    expect(rollupNodeStatus([])).toBe("NOT_DOWNLOADED");
    expect(rollupNodeStatus(["NOT_DOWNLOADED", "NOT_DOWNLOADED"])).toBe("NOT_DOWNLOADED");
  });

  it("mixed downloaded/not-downloaded children → PARTIAL", () => {
    // The one case PARTIAL now covers: work genuinely remains, so the parent
    // keeps showing a download control until it is finished.
    expect(rollupNodeStatus(["DOWNLOADED", "NOT_DOWNLOADED"])).toBe("PARTIAL");
  });
});

describe("containers with nothing downloadable", () => {
  let db: OfflineDbConnection;

  beforeEach(async () => {
    db = await createInMemoryConnection();
    await runMigrations(db);
  });

  /**
   * A chapter whose slides are all restricted can never reach DOWNLOADED. If it
   * still gets a node row it sits in its module's rollup forever, so the module
   * (and subject, and course) report PARTIAL — or worse, QUEUED — with no way
   * for the learner to finish. It must not exist in the tree at all.
   */
  it("gives no node row to a fully-restricted chapter, so ancestors can complete", async () => {
    const manifest = manifestFixture();
    manifest.subjects[0]!.modules[0]!.chapters.push({
      chapter_id: "chapLocked",
      chapter_name: "Restricted",
      chapter_order: 2,
      slides: [
        {
          slide_id: "slideLocked",
          slide_type: "DOCUMENT",
          title: "Members only",
          slide_order: 1,
          downloadable: false,
          reason: "PERMISSION_DENIED",
          key_ref: null,
          inline_payload: null,
          assets: [],
        },
      ],
    });

    await ensureNodeTree(db, "user1", manifest);

    expect(await nodesDao.get(db, "user1", "chapLocked")).toBeNull();
    expect(await nodesDao.get(db, "user1", "chap1")).not.toBeNull();
    // The module's children are only the chapters that can finish.
    const children = await nodesDao.listChildren(db, "user1", "mod1");
    expect(children.map((c) => c.node_id)).toEqual(["chap1"]);
  });

  it("creates a COURSE root that parents the subjects", async () => {
    await ensureNodeTree(db, "user1", manifestFixture());

    const course = await nodesDao.get(db, "user1", "ps1");
    expect(course?.node_type).toBe("COURSE");
    const subjects = await nodesDao.listChildren(db, "user1", "ps1");
    expect(subjects.map((s) => s.node_id)).toEqual(["sub1"]);
  });
});

describe("computeSlideStatus", () => {
  it("all assets downloaded, no payload → DOWNLOADED", () => {
    expect(computeSlideStatus(["DOWNLOADED", "DOWNLOADED"], false, false)).toBe("DOWNLOADED");
  });

  it("all assets downloaded but payload not staged → not DOWNLOADED (all-or-nothing)", () => {
    expect(computeSlideStatus(["DOWNLOADED"], true, false)).not.toBe("DOWNLOADED");
  });

  it("all assets downloaded AND payload staged → DOWNLOADED", () => {
    expect(computeSlideStatus(["DOWNLOADED"], true, true)).toBe("DOWNLOADED");
  });

  it("any asset FAILED → ERROR", () => {
    expect(computeSlideStatus(["DOWNLOADED", "FAILED"], false, false)).toBe("ERROR");
  });

  it("all assets still PENDING → QUEUED", () => {
    expect(computeSlideStatus(["PENDING", "PENDING"], false, false)).toBe("QUEUED");
  });
});

describe("subtreeHasOnlineOnly", () => {
  it("false when every slide is downloadable", () => {
    const manifest = manifestFixture();
    expect(subtreeHasOnlineOnly(manifest, "chap1", "CHAPTER")).toBe(false);
  });

  it("true when the subtree contains an online-only slide", () => {
    const manifest = manifestFixture({ onlineOnlySlide: true });
    expect(subtreeHasOnlineOnly(manifest, "chap1", "CHAPTER")).toBe(true);
  });
});

describe("expandNode", () => {
  let db: OfflineDbConnection;
  const userId = "user1";

  beforeEach(async () => {
    db = await createInMemoryConnection();
    await runMigrations(db);
  });

  it("creates node rows for the whole tree and QUEUEs the target subtree", async () => {
    const manifest = manifestFixture();
    await expandNode(db, userId, manifest, "chap1", "CHAPTER");

    const chapterNode = await nodesDao.get(db, userId, "chap1");
    expect(chapterNode?.status).toBe("QUEUED");

    const moduleNode = await nodesDao.get(db, userId, "mod1");
    expect(moduleNode).not.toBeNull();
    const subjectNode = await nodesDao.get(db, userId, "sub1");
    expect(subjectNode).not.toBeNull();
  });

  it("does not downgrade UPDATE_AVAILABLE / PARTIAL nodes when re-walking the tree", async () => {
    // Regression: applyManifestUpdate calls expandNode -> ensureNodeTree over the
    // whole manifest. ensureNodeTree only preserved DOWNLOADED/DOWNLOADING, so
    // every node the check-in had badged UPDATE_AVAILABLE was reset to
    // NOT_DOWNLOADED — the learner tapped "Update" and their downloaded chapter
    // came back looking undownloaded, with the payloads still on disk.
    const manifest = manifestFixture();
    await ensureNodeTree(db, userId, manifest);

    await nodesDao.setStatus(db, userId, "chap1", "UPDATE_AVAILABLE");
    await nodesDao.setStatus(db, userId, "sub1", "PARTIAL");

    await ensureNodeTree(db, userId, manifest);

    expect((await nodesDao.get(db, userId, "chap1"))?.status).toBe("UPDATE_AVAILABLE");
    expect((await nodesDao.get(db, userId, "sub1"))?.status).toBe("PARTIAL");
  });

  it("creates PENDING asset rows for downloadable slides", async () => {
    const manifest = manifestFixture();
    const result = await expandNode(db, userId, manifest, "chap1", "CHAPTER");

    expect(result.slideIds).toEqual(["slide1", "slide2"]);
    const assets = await assetsDao.listBySlide(db, userId, "slide1");
    expect(assets).toHaveLength(1);
    expect(assets[0].status).toBe("PENDING");
  });

  it("skips non-downloadable (online-only) slides — no node, no asset rows", async () => {
    const manifest = manifestFixture({ onlineOnlySlide: true });
    const result = await expandNode(db, userId, manifest, "chap1", "CHAPTER");

    expect(result.skippedOnlineOnly).toBe(1);
    const onlineOnlyNode = await nodesDao.get(db, userId, "slide3");
    expect(onlineOnlyNode).toBeNull();
  });

  it("stages an encrypted slide_payloads row for slides with inline JSON", async () => {
    const manifest = manifestFixture();
    await expandNode(db, userId, manifest, "chap1", "CHAPTER");

    const payload = await slidePayloadsDao.get(db, userId, "slide2");
    expect(payload).not.toBeNull();
    expect(payload!.ciphertext).not.toBe(JSON.stringify(manifest.subjects[0].modules[0].chapters[0].slides[1].inline_payload));
  });

  it("a slide with no assets and no payload is marked DOWNLOADED immediately (nothing to fetch)", async () => {
    const manifest = manifestFixture();
    manifest.subjects[0].modules[0].chapters[0].slides.push({
      slide_id: "slide-empty",
      slide_type: "DOCUMENT",
      title: "Empty",
      slide_order: 4,
      downloadable: true,
      reason: "ALLOWED",
      key_ref: null,
      inline_payload: null,
      assets: [],
    });

    await expandNode(db, userId, manifest, "chap1", "CHAPTER");
    const node = await nodesDao.get(db, userId, "slide-empty");
    expect(node?.status).toBe("DOWNLOADED");
  });

  it("re-enqueuing does not reset an already-DOWNLOADED asset back to PENDING", async () => {
    const manifest = manifestFixture();
    await expandNode(db, userId, manifest, "chap1", "CHAPTER");

    await assetsDao.updateDownloadProgress(db, userId, "file1", "slide1", 1000, "DOWNLOADED");
    await assetsDao.upsert(db, {
      user_id: userId,
      file_id: "file1",
      slide_id: "slide1",
      package_session_id: "ps1",
      size: 1000,
      checksum: "etag-1",
      nonce: "bm9uY2U=",
      local_path: "offline/user1/assets/file1.enc",
      status: "DOWNLOADED",
      bytes_downloaded: 1000,
      attempt_count: 0,
    });

    await expandNode(db, userId, manifest, "chap1", "CHAPTER");
    const asset = await assetsDao.get(db, userId, "file1", "slide1");
    expect(asset?.status).toBe("DOWNLOADED");
  });

  it("ensureNodeTree does not downgrade a DOWNLOADED node", async () => {
    const manifest = manifestFixture();
    await ensureNodeTree(db, userId, manifest);
    await nodesDao.setStatus(db, userId, "slide1", "DOWNLOADED");

    await ensureNodeTree(db, userId, manifest);
    const node = await nodesDao.get(db, userId, "slide1");
    expect(node?.status).toBe("DOWNLOADED");
  });
});
