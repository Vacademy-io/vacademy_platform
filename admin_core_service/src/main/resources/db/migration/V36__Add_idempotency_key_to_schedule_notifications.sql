ALTER TABLE schedule_notifications
    ADD COLUMN idempotency_key VARCHAR(255);

ALTER TABLE schedule_notifications
    ADD CONSTRAINT uk_schedule_notifications_idempotency_key
        UNIQUE (idempotency_key);

