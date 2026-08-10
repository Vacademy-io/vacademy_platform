-- Offline Content Download & Sync -- Part A3: device registry.
--
-- Encryption keys are device-local (never leave the device, generated in
-- hardware Keychain/Keystore) -- this table has no public-key column, no
-- master secret, no server key custody. It exists purely to (a) cap
-- concurrent offline devices per learner and (b) let admins/learners revoke
-- a device, which the check-in endpoint turns into a client-side purge.
--
-- Re-registering the same physical device (Capacitor Device.getId(), stable
-- per install) must reactivate its existing row instead of consuming a new
-- device slot -- that is what UNIQUE(user_id, client_device_id) enforces;
-- OfflineDeviceService.register() upserts against it.
CREATE TABLE IF NOT EXISTS offline_device (
    id                    VARCHAR(255) PRIMARY KEY,
    user_id               VARCHAR(255) NOT NULL,
    institute_id          VARCHAR(255) NOT NULL,
    device_name           VARCHAR(255),
    platform              VARCHAR(64),
    status                VARCHAR(16)  NOT NULL DEFAULT 'ACTIVE', -- ACTIVE | REVOKED
    client_device_id      VARCHAR(255) NOT NULL,
    lease_expires_at      TIMESTAMP,
    last_checkin_at       TIMESTAMP,
    registered_at         TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    revoked_at            TIMESTAMP,
    revoked_by_user_id    VARCHAR(255),
    revoke_reason         VARCHAR(64),
    created_at            TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at            TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Upsert key for re-registration (reactivate instead of consuming a new slot).
DO $$
BEGIN
    ALTER TABLE offline_device
        ADD CONSTRAINT uq_offline_device_user_client
        UNIQUE (user_id, client_device_id);
EXCEPTION
    WHEN duplicate_table THEN NULL;
    WHEN duplicate_object THEN NULL;
END $$;

-- "How many ACTIVE devices does this learner have" (cap enforcement, pessimistic
-- locked at the service layer) + the learner/admin device-list reads.
CREATE INDEX IF NOT EXISTS idx_offline_device_user_institute_status
    ON offline_device (user_id, institute_id, status);
