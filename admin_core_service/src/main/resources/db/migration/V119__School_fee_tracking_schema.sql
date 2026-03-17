-- =======================================================================================
-- V119: School Fee Payment Tracking System (2-Table Rollover Architecture)
-- =======================================================================================

-- ---------------------------------------------------------------------------------------
-- TABLE 1: STUDENT FEE PAYMENT (The Bill / Invoice)
-- Represents the actual installment the student owes, generated from the CPO template.
-- ---------------------------------------------------------------------------------------
CREATE TABLE student_fee_payment (
    id VARCHAR(255) PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Student & enrollment context 
    user_id VARCHAR(255) NOT NULL,
    user_plan_id VARCHAR(255) NOT NULL,       
    package_session_ids TEXT,                 

    -- Fee structure references (The Template)
    cpo_id VARCHAR(255) NOT NULL,       
    asv_id VARCHAR(255) NOT NULL,       
    i_id VARCHAR(255) NOT NULL,         

    -- Financial Tracking for this specific bill
    amount_expected DECIMAL(10,2) NOT NULL,   
    
    discount_amount DECIMAL(10,2) DEFAULT 0.00,  
    discount_reason TEXT,                     
    
    amount_paid DECIMAL(10,2) DEFAULT 0.00,   
    
    -- Formula for frontend: Total Due = amount_expected - discount_amount - amount_paid

    -- Timeline & Status
    due_date DATE,                      
    status VARCHAR(50) DEFAULT 'PENDING',     -- PENDING, PARTIAL_PAID, PAID, WAIVED, OVERDUE

    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),

    -- Foreign keys back to the fee template
    CONSTRAINT fk_sfp_cpo FOREIGN KEY (cpo_id) REFERENCES complex_payment_option(id),
    CONSTRAINT fk_sfp_asv FOREIGN KEY (asv_id) REFERENCES assigned_fee_value(id),
    CONSTRAINT fk_sfp_installment FOREIGN KEY (i_id) REFERENCES aft_installments(id)
);

CREATE INDEX idx_sfp_user_id ON student_fee_payment(user_id);
CREATE INDEX idx_sfp_user_plan_id ON student_fee_payment(user_plan_id);
CREATE INDEX idx_sfp_cpo_id ON student_fee_payment(cpo_id);
CREATE INDEX idx_sfp_status ON student_fee_payment(status);
CREATE INDEX idx_sfp_due_date ON student_fee_payment(due_date);


-- ---------------------------------------------------------------------------------------
-- TABLE 2: STUDENT FEE ALLOCATION LEDGER (The Receipt & Rollover Tracker)
-- Records exactly where every rupee from a transaction went.
-- Connects a PaymentLog (Razorpay/Cash) to a specific Bill. 
-- In case of overpayment, it splits the payment across multiple bills via multiple rows.
-- ---------------------------------------------------------------------------------------
CREATE TABLE student_fee_allocation_ledger (
    id VARCHAR(255) PRIMARY KEY DEFAULT gen_random_uuid(),
    
    user_id VARCHAR(255) NOT NULL,
    
    -- Source of funds
    payment_log_id VARCHAR(255) NOT NULL,              
    
    -- Destination of funds
    student_fee_payment_id VARCHAR(255) NOT NULL,       
    
    amount_allocated DECIMAL(10,2) NOT NULL,   
    
    -- transaction_type Enum: 
    -- 'INSTALLMENT_PAYMENT' (Standard payment vs a bill)
    -- 'ADVANCE_ROLLOVER'    (Extra money automatically poured into a future bill)
    -- 'REFUND'              (Refunded back to user)
    -- 'BOUNCE_REVERSAL'     (Cheque bounced)
    transaction_type VARCHAR(50) NOT NULL,     
    
    remarks TEXT,                              
    
    created_at TIMESTAMP DEFAULT NOW(),

    CONSTRAINT fk_ledger_installment FOREIGN KEY (student_fee_payment_id) REFERENCES student_fee_payment(id),
    CONSTRAINT fk_ledger_payment_log FOREIGN KEY (payment_log_id) REFERENCES payment_log(id)
);

CREATE INDEX idx_ledger_user_id ON student_fee_allocation_ledger(user_id);
CREATE INDEX idx_ledger_payment_log ON student_fee_allocation_ledger(payment_log_id);
CREATE INDEX idx_ledger_installment ON student_fee_allocation_ledger(student_fee_payment_id);
