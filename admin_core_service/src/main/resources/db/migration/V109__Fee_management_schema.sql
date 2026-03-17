-- V109: Fee Management Schema
-- Creates complex_payment_option, fee_type, assigned_fee_value, aft_installments tables

-- 1. Complex Payment Option (must be created first since fee_type references it)
CREATE TABLE complex_payment_option (
    id VARCHAR(255) PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    institute_id VARCHAR(255) NOT NULL,
    default_payment_option_id VARCHAR(255),
    status VARCHAR(50) DEFAULT 'ACTIVE',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- 2. Fee Type (Class-Specific Fee Components)
CREATE TABLE fee_type (
    id VARCHAR(255) PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    code VARCHAR(100) NOT NULL,
    description TEXT,
    cpo_id VARCHAR(255) NOT NULL,
    status VARCHAR(50) DEFAULT 'ACTIVE',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    CONSTRAINT fk_fee_type_cpo FOREIGN KEY (cpo_id) REFERENCES complex_payment_option(id)
);

-- 3. Assigned Fee Value (The Financial Contract)
CREATE TABLE assigned_fee_value (
    id VARCHAR(255) PRIMARY KEY DEFAULT gen_random_uuid(),
    fee_type_id VARCHAR(255) NOT NULL,
    amount DECIMAL(10,2) NOT NULL,
    no_of_installments INT DEFAULT 1,
    has_installment BOOLEAN DEFAULT false,
    is_refundable BOOLEAN DEFAULT false,
    has_penalty BOOLEAN DEFAULT false,
    penalty_percentage DECIMAL(5,2),
    status VARCHAR(50) DEFAULT 'ACTIVE',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    CONSTRAINT fk_afv_fee_type FOREIGN KEY (fee_type_id) REFERENCES fee_type(id)
);

-- 4. AFT Installments (The Scheduled Payments Template)
CREATE TABLE aft_installments (
    id VARCHAR(255) PRIMARY KEY DEFAULT gen_random_uuid(),
    assigned_fee_value_id VARCHAR(255) NOT NULL,
    installment_number INT NOT NULL,
    amount DECIMAL(10,2) NOT NULL,
    due_date DATE NOT NULL,
    status VARCHAR(50) DEFAULT 'PENDING',
    created_at TIMESTAMP DEFAULT NOW(),
    CONSTRAINT fk_aft_inst_afv FOREIGN KEY (assigned_fee_value_id) REFERENCES assigned_fee_value(id)
);
