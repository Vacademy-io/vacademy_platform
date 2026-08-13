import type { OfflineDbConnection } from "../connection";
import type { DeviceStateRow } from "../types";

/** One lease/registration row per user on this device. */
export const deviceStateDao = {
    async get(db: OfflineDbConnection, userId: string): Promise<DeviceStateRow | null> {
        const rows = await db.query<DeviceStateRow>(
            "SELECT * FROM device_state WHERE user_id = ?",
            [userId]
        );
        return rows[0] ?? null;
    },

    async upsert(db: OfflineDbConnection, row: DeviceStateRow): Promise<void> {
        await db.run(
            `INSERT INTO device_state
                (user_id, device_id, device_registration_id, lease_expires_at,
                 last_checkin_at, last_checkin_monotonic, revoked)
             VALUES (?, ?, ?, ?, ?, ?, ?)
             ON CONFLICT (user_id) DO UPDATE SET
                device_id = excluded.device_id,
                device_registration_id = excluded.device_registration_id,
                lease_expires_at = excluded.lease_expires_at,
                last_checkin_at = excluded.last_checkin_at,
                last_checkin_monotonic = excluded.last_checkin_monotonic,
                revoked = excluded.revoked`,
            [
                row.user_id,
                row.device_id,
                row.device_registration_id,
                row.lease_expires_at,
                row.last_checkin_at,
                row.last_checkin_monotonic,
                row.revoked,
            ]
        );
    },

    async setRevoked(db: OfflineDbConnection, userId: string, revoked: boolean): Promise<void> {
        await db.run("UPDATE device_state SET revoked = ? WHERE user_id = ?", [
            revoked ? 1 : 0,
            userId,
        ]);
    },

    async delete(db: OfflineDbConnection, userId: string): Promise<void> {
        await db.run("DELETE FROM device_state WHERE user_id = ?", [userId]);
    },
};
