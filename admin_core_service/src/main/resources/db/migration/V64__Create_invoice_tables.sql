-- Create invoice table
CREATE TABLE IF NOT EXISTS invoice (
    id VARCHAR(255) NOT NULL,
    invoice_number VARCHAR(100) NOT NULL UNIQUE,
    user_id VARCHAR(255) NOT NULL,
    institute_id VARCHAR(255) NOT NULL,
    invoice_date TIMESTAMP NOT NULL,
    due_date TIMESTAMP NOT NULL,
    subtotal DECIMAL(10, 2) NOT NULL,
    discount_amount DECIMAL(10, 2),
    tax_amount DECIMAL(10, 2),
    total_amount DECIMAL(10, 2) NOT NULL,
    currency VARCHAR(10) NOT NULL,
    status VARCHAR(50) NOT NULL,
    pdf_file_id VARCHAR(255),
    invoice_data_json TEXT,
    tax_included BOOLEAN,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT invoice_pkey PRIMARY KEY (id)
);

-- Create indexes for invoice table
CREATE INDEX IF NOT EXISTS idx_invoice_user_id ON invoice(user_id);
CREATE INDEX IF NOT EXISTS idx_invoice_institute_id ON invoice(institute_id);
CREATE INDEX IF NOT EXISTS idx_invoice_invoice_number ON invoice(invoice_number);
CREATE INDEX IF NOT EXISTS idx_invoice_invoice_date ON invoice(invoice_date);
CREATE INDEX IF NOT EXISTS idx_invoice_status ON invoice(status);

-- Create invoice_line_item table
CREATE TABLE IF NOT EXISTS invoice_line_item (
    id VARCHAR(255) NOT NULL,
    invoice_id VARCHAR(255) NOT NULL,
    item_type VARCHAR(50) NOT NULL,
    description TEXT,
    quantity INTEGER,
    unit_price DECIMAL(10, 2),
    amount DECIMAL(10, 2) NOT NULL,
    source_id VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT invoice_line_item_pkey PRIMARY KEY (id),
    CONSTRAINT invoice_line_item_invoice_id_fkey FOREIGN KEY (invoice_id) REFERENCES invoice(id) ON DELETE CASCADE
);

-- Create indexes for invoice_line_item table
CREATE INDEX IF NOT EXISTS idx_invoice_line_item_invoice_id ON invoice_line_item(invoice_id);
CREATE INDEX IF NOT EXISTS idx_invoice_line_item_item_type ON invoice_line_item(item_type);
CREATE INDEX IF NOT EXISTS idx_invoice_line_item_source_id ON invoice_line_item(source_id);

-- Create invoice_payment_log_mapping table
CREATE TABLE IF NOT EXISTS invoice_payment_log_mapping (
    id VARCHAR(255) NOT NULL,
    invoice_id VARCHAR(255) NOT NULL,
    payment_log_id VARCHAR(255) NOT NULL,
    CONSTRAINT invoice_payment_log_mapping_pkey PRIMARY KEY (id),
    CONSTRAINT invoice_payment_log_mapping_invoice_id_fkey FOREIGN KEY (invoice_id) REFERENCES invoice(id) ON DELETE CASCADE,
    CONSTRAINT invoice_payment_log_mapping_payment_log_id_fkey FOREIGN KEY (payment_log_id) REFERENCES payment_log(id) ON DELETE CASCADE,
    CONSTRAINT invoice_payment_log_mapping_unique UNIQUE (invoice_id, payment_log_id)
);

-- Create indexes for invoice_payment_log_mapping table
CREATE INDEX IF NOT EXISTS idx_invoice_payment_log_mapping_invoice_id ON invoice_payment_log_mapping(invoice_id);
CREATE INDEX IF NOT EXISTS idx_invoice_payment_log_mapping_payment_log_id ON invoice_payment_log_mapping(payment_log_id);

