-- Migration: Add tracking fields to payment_log table
-- Version: V97
-- Description: Add tracking_id, tracking_source, and order_status columns for order tracking
-- Author: System
-- Date: 2026-01-30

-- Add new columns to payment_log table
ALTER TABLE payment_log 
ADD COLUMN IF NOT EXISTS tracking_id VARCHAR(255) DEFAULT NULL,
ADD COLUMN IF NOT EXISTS tracking_source VARCHAR(255) DEFAULT NULL,
ADD COLUMN IF NOT EXISTS order_status VARCHAR(50) DEFAULT 'ORDERED';

-- Add comments for documentation
COMMENT ON COLUMN payment_log.tracking_id IS 'External tracking ID from shipping provider';
COMMENT ON COLUMN payment_log.tracking_source IS 'Source of tracking information (e.g., FedEx, UPS, DHL)';
COMMENT ON COLUMN payment_log.order_status IS 'Order fulfillment status (ORDERED, SHIPPED, DELIVERED, CANCELLED)';

-- Create index for tracking_id for faster lookups
CREATE INDEX IF NOT EXISTS idx_payment_log_tracking_id 
ON payment_log(tracking_id) 
WHERE tracking_id IS NOT NULL;

-- Create index for order_status for filtering
CREATE INDEX IF NOT EXISTS idx_payment_log_order_status 
ON payment_log(order_status) 
WHERE order_status IS NOT NULL;
