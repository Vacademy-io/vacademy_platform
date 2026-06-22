-- Capture how a payment was collected (CASH/UPI/CARD/NET_BANKING/CHEQUE/BANK_TRANSFER/WALLET/OTHER).
-- Nullable: existing rows and code paths that don't supply a mode stay NULL.
ALTER TABLE payment_log ADD COLUMN IF NOT EXISTS payment_mode VARCHAR(50);
