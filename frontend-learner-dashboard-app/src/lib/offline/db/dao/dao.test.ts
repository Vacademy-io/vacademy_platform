import { beforeEach, describe, expect, it } from "vitest";
import { createInMemoryConnection } from "../sqljs-connection";
import { runMigrations } from "../migrations";
import type { OfflineDbConnection } from "../connection";
import { assetsDao } from "./assets-dao";
import { deviceStateDao } from "./device-state-dao";
import { eventQueueDao } from "./event-queue-dao";
import { manifestsDao } from "./manifests-dao";
import { nodesDao } from "./nodes-dao";
import { slidePayloadsDao } from "./slide-payloads-dao";
import type { AssetRow, EventQueueRow, NodeRow } from "../types";

let db: OfflineDbConnection;

beforeEach(async () => {
    db = await createInMemoryConnection();
    await runMigrations(db);
});

const nodeRow = (userId: string, nodeId: string): NodeRow => ({
    user_id: userId,
    node_id: nodeId,
    node_type: "CHAPTER",
    package_session_id: "ps1",
    parent_id: "m1",
    status: "QUEUED",
    bytes_total: 100,
    bytes_done: 0,
});

const assetRow = (userId: string, fileId: string, slideId: string): AssetRow => ({
    user_id: userId,
    file_id: fileId,
    slide_id: slideId,
    package_session_id: "ps1",
    size: 1000,
    checksum: "etag-1",
    nonce: "bm9uY2U=",
    local_path: null,
    status: "PENDING",
    bytes_downloaded: 0,
    attempt_count: 0,
});

const eventRow = (userId: string, id: string, seq: number): EventQueueRow => ({
    client_event_id: id,
    user_id: userId,
    seq,
    client_ts: 1700000000000 + seq,
    event_type: "VIDEO_ACTIVITY",
    context: JSON.stringify({ slideId: "s1", packageSessionId: "ps1" }),
    payload: JSON.stringify({ id: `activity-${seq}` }),
    sync_status: "PENDING",
    attempt_count: 0,
    last_error: null,
});

describe("dao round-trips", () => {
    it("device_state upsert + get + revoke", async () => {
        await deviceStateDao.upsert(db, {
            user_id: "u1",
            device_id: "dev-abc",
            device_registration_id: "reg-1",
            lease_expires_at: 123,
            last_checkin_at: 100,
            last_checkin_monotonic: 50,
            revoked: 0,
        });
        expect((await deviceStateDao.get(db, "u1"))?.device_id).toBe("dev-abc");

        await deviceStateDao.setRevoked(db, "u1", true);
        expect((await deviceStateDao.get(db, "u1"))?.revoked).toBe(1);
    });

    it("manifests upsert overwrites and flags updates", async () => {
        const base = {
            user_id: "u1",
            package_session_id: "ps1",
            institute_id: "inst1",
            version: 1,
            fetched_at: 111,
            tree_json: "{}",
            update_available: 0,
        };
        await manifestsDao.upsert(db, base);
        await manifestsDao.upsert(db, { ...base, version: 2 });
        expect((await manifestsDao.get(db, "u1", "ps1"))?.version).toBe(2);

        await manifestsDao.setUpdateAvailable(db, "u1", "ps1", true);
        expect((await manifestsDao.get(db, "u1", "ps1"))?.update_available).toBe(1);
    });

    it("nodes status + progress updates", async () => {
        await nodesDao.upsert(db, nodeRow("u1", "c1"));
        await nodesDao.setStatus(db, "u1", "c1", "DOWNLOADED");
        await nodesDao.updateProgress(db, "u1", "c1", 100);

        const row = await nodesDao.get(db, "u1", "c1");
        expect(row?.status).toBe("DOWNLOADED");
        expect(row?.bytes_done).toBe(100);
    });

    it("assets ref-counting and distinct-file storage total", async () => {
        // Same file shared by two slides: disk usage counted once.
        await assetsDao.upsert(db, { ...assetRow("u1", "f1", "s1"), status: "DOWNLOADED" });
        await assetsDao.upsert(db, { ...assetRow("u1", "f1", "s2"), status: "DOWNLOADED" });
        await assetsDao.upsert(db, { ...assetRow("u1", "f2", "s1"), status: "DOWNLOADED" });

        expect(await assetsDao.totalDownloadedBytes(db, "u1")).toBe(2000);
        expect(await assetsDao.countOtherReferences(db, "u1", "f1", "s1")).toBe(1);

        await assetsDao.deleteBySlide(db, "u1", "s2");
        expect(await assetsDao.countOtherReferences(db, "u1", "f1", "s1")).toBe(0);
    });

    it("slide_payloads round-trip", async () => {
        await slidePayloadsDao.upsert(db, {
            user_id: "u1",
            slide_id: "s1",
            manifest_version: 3,
            ciphertext: "Y2lwaGVy",
            nonce: "bm9uY2U=",
            key_ref: null,
        });
        expect((await slidePayloadsDao.get(db, "u1", "s1"))?.manifest_version).toBe(3);
    });

    it("event_queue seq assignment, flush lifecycle and boot recovery", async () => {
        expect(await eventQueueDao.nextSeq(db, "u1")).toBe(1);
        await eventQueueDao.insert(db, eventRow("u1", "e1", 1));
        await eventQueueDao.insert(db, eventRow("u1", "e2", 2));
        expect(await eventQueueDao.nextSeq(db, "u1")).toBe(3);

        const pending = await eventQueueDao.listPending(db, "u1", 50);
        expect(pending.map((e) => e.client_event_id)).toEqual(["e1", "e2"]);

        await eventQueueDao.setStatus(db, "u1", ["e1"], "SYNCED");
        await eventQueueDao.setStatus(db, "u1", ["e2"], "IN_FLIGHT");
        expect(await eventQueueDao.countByStatus(db, "u1", "PENDING")).toBe(0);

        await eventQueueDao.recoverInFlight(db, "u1");
        expect(await eventQueueDao.countByStatus(db, "u1", "PENDING")).toBe(1);

        await eventQueueDao.deleteSynced(db, "u1");
        expect((await eventQueueDao.listPending(db, "u1", 50))[0]?.client_event_id).toBe("e2");
    });
});

describe("per-user isolation (shared-device edge case)", () => {
    it("user A's rows are invisible to user B across every DAO", async () => {
        await nodesDao.upsert(db, nodeRow("userA", "c1"));
        await assetsDao.upsert(db, assetRow("userA", "f1", "s1"));
        await eventQueueDao.insert(db, eventRow("userA", "eA", 1));
        await manifestsDao.upsert(db, {
            user_id: "userA",
            package_session_id: "ps1",
            institute_id: null,
            version: 1,
            fetched_at: 1,
            tree_json: "{}",
            update_available: 0,
        });

        expect(await nodesDao.get(db, "userB", "c1")).toBeNull();
        expect(await nodesDao.listByPackageSession(db, "userB", "ps1")).toHaveLength(0);
        expect(await assetsDao.listBySlide(db, "userB", "s1")).toHaveLength(0);
        expect(await assetsDao.totalDownloadedBytes(db, "userB")).toBe(0);
        expect(await eventQueueDao.listPending(db, "userB", 50)).toHaveLength(0);
        expect(await eventQueueDao.nextSeq(db, "userB")).toBe(1);
        expect(await manifestsDao.get(db, "userB", "ps1")).toBeNull();
        expect(await manifestsDao.listForUser(db, "userB")).toHaveLength(0);

        // Same node id downloadable independently per user.
        await nodesDao.upsert(db, { ...nodeRow("userB", "c1"), status: "NOT_DOWNLOADED" });
        expect((await nodesDao.get(db, "userA", "c1"))?.status).toBe("QUEUED");
        expect((await nodesDao.get(db, "userB", "c1"))?.status).toBe("NOT_DOWNLOADED");
    });
});
