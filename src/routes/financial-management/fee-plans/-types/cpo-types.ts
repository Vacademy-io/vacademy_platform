// CPO (Complex Payment Option) API types

export interface CPOInstallment {
    installmentNumber: number;
    amount: number;
    dueDate: string; // YYYY-MM-DD
    id?: string;
    status?: string;
}

export interface AssignedFeeValue {
    id?: string;
    amount: number;
    original_amount: number;
    discount_type: 'PERCENTAGE' | 'FLAT' | null;
    discount_value: number | null;
    noOfInstallments: number;
    hasInstallment: boolean;
    isRefundable: boolean;
    hasPenalty: boolean;
    status: string;
    installments: CPOInstallment[];
}

export interface CPOFeeType {
    id?: string;
    name: string;
    code: string;
    description?: string;
    status: string;
    assignedFeeValue: AssignedFeeValue;
}

export interface CreateCPORequest {
    name: string;
    instituteId: string;
    feeTypes: CPOFeeType[];
}

export interface CPOResponse {
    id: string;
    name: string;
    instituteId: string;
    status: 'ACTIVE' | 'PENDING_APPROVAL';
    createdBy: string;
    approvedBy: string | null;
    feeTypes: CPOFeeType[];
    packageSessionLinks: unknown[];
}
