// Registration Types for the Admissions Module

export type RegistrationStatus =
    | 'DRAFT'
    | 'PENDING_DOCUMENTS'
    | 'PENDING_FEE'
    | 'DOCUMENTS_VERIFIED'
    | 'FEE_PAID'
    | 'READY_FOR_ADMISSION'
    | 'ADMITTED'
    | 'CANCELLED';

export type FeeStatus = 'PENDING' | 'PARTIAL' | 'PAID' | 'WAIVED';

export type DocumentStatus = 'NOT_UPLOADED' | 'UPLOADED' | 'VERIFIED' | 'REJECTED';

export interface RegistrationDocument {
    id: string;
    type: string;
    name: string;
    url?: string;
    status: DocumentStatus;
    verifiedBy?: string;
    verifiedAt?: string;
    remarks?: string;
}

export interface RegistrationFee {
    id: string;
    type: string;
    description: string;
    amount: number;
    dueDate?: string;
    paidAmount: number;
    paidAt?: string;
    paymentMode?: string;
    receiptNumber?: string;
    concessionId?: string;
    concessionAmount?: number;
    concessionStatus?: 'PENDING' | 'APPROVED' | 'REJECTED';
    originalAmount?: number;
}

export interface ParentInfo {
    // Father's Details
    fatherName: string;
    fatherPhone?: string;
    fatherEmail?: string;
    fatherOccupation?: string;

    // Mother's Details
    motherName: string;
    motherPhone?: string;
    motherEmail?: string;
    motherOccupation?: string;

    // Guardian Details (if different from parents)
    guardianName?: string;
    guardianPhone?: string;
    guardianRelation?: string;
}

export interface AddressInfo {
    // Residential Address
    houseNo?: string;
    street?: string;
    area?: string;
    landmark?: string;
    city: string;
    state: string;
    pincode?: string; // wrapper for pinCode if needed by UI
    pinCode: string;
    country: string;
    // UI Helpers
    addressLine1?: string;
    addressLine2?: string;
}

export interface AcademicInfo {
    previousSchool?: string;
    previousClass?: string;
    previousBoard?: string;
    previousPercentage?: number;
    previousMedium?: string;
    previousAcademicYear?: string;
    subjectsStudied?: string;
    tcNumber?: string;
    tcIssueDate?: string;
    lastExamResult?: string;
    tcPending?: boolean;
}

export interface SiblingInfo {
    id: string;
    name: string;
    admissionNumber: string;
    classSection: string;
}

export interface Registration {
    id: string;
    inquiryId?: string;

    // Student Information
    studentName: string;
    dateOfBirth: string;
    gender: 'MALE' | 'FEMALE' | 'OTHER';
    bloodGroup?: string;
    nationality: string;
    religion?: string;
    category?: string;
    aadhaarNumber?: string;

    // ID Information (NEW)
    idType?: 'AADHAR_CARD' | 'BIRTH_CERTIFICATE' | 'PASSPORT' | 'OTHER';
    idNumber?: string;

    // Extended student fields
    birthCertificateNumber?: string;
    motherTongue?: string;
    languagesKnown?: string[];

    // Selected Package Session (NEW) - for API submission
    selectedPackageSessionId?: string;

    // Special Requirements
    hasSpecialNeeds?: boolean;
    specialNeedsDetails?: string;
    isPhysicallyChallenged?: boolean;
    disabilityType?: string;
    medicalConditions?: string;
    dietaryRestrictions?: string;

    // Class & Board
    applyingForClass: string;
    section?: string;
    preferredBoard: string;
    academicYear: string;

    // Higher Secondary (Class 11/12)
    stream?: string;
    selectedSubjects?: string[];

    // Sibling Information
    hasSibling?: boolean;
    siblings?: SiblingInfo[];

    // Parent Information
    parentInfo: ParentInfo;

    // Extended Parent fields (stored flexibly)
    fatherDob?: string;
    fatherAltPhone?: string;
    fatherAltEmail?: string;
    fatherQualification?: string;
    fatherOrganization?: string;
    fatherDesignation?: string;
    fatherOfficeAddress?: string;
    fatherIncome?: string;
    fatherAadhaar?: string;
    fatherPan?: string;

    motherDob?: string;
    motherAltPhone?: string;
    motherAltEmail?: string;
    motherQualification?: string;
    motherOrganization?: string;
    motherDesignation?: string;
    motherOfficeAddress?: string;
    motherIncome?: string;
    motherAadhaar?: string;
    motherPan?: string;

    // Guardian (conditional)
    livesWithGuardian?: boolean;
    guardianEmail?: string;
    guardianOccupation?: string;
    guardianAadhaar?: string;

    // Emergency Contact
    emergencyContactName?: string;
    emergencyContactRelation?: string;
    emergencyContactPhone?: string;
    emergencyAltPhone?: string;

    // Address
    addressInfo?: AddressInfo;
    currentAddress?: AddressInfo;
    permanentAddress?: AddressInfo;
    permanentSameAsResidential?: boolean;
    sameAsCurrentAddress?: boolean;

    // Permanent Address fields (when different)
    permanentHouseNo?: string;
    permanentStreet?: string;
    permanentArea?: string;
    permanentLandmark?: string;
    permanentCity?: string;
    permanentState?: string;
    permanentPinCode?: string;
    permanentCountry?: string;

    // Previous Academic
    academicInfo?: AcademicInfo;

    // TC Details
    tcSubmitLater?: boolean;

    // Preferences
    transportRequired?: boolean;
    pickupRoute?: string;
    transportDistance?: string;
    pickupTime?: string;

    hostelRequired?: boolean;
    roomPreference?: string;
    hostelRequirements?: string;

    // Documents
    documents: RegistrationDocument[];

    // Fee Waiver
    applyFeeWaiver?: boolean;
    waiverReason?: string;

    // Bank Transfer Details
    transactionId?: string;
    transferPaymentDate?: string;

    // Declarations
    declarationInfoTrue?: boolean;
    declarationFalseInfoWarning?: boolean;
    declarationTermsAccepted?: boolean;
    declarationPrivacyConsent?: boolean;
    declarationCommunicationConsent?: boolean;
    declarationSignatoryName?: string;
    declarationSignatoryRelation?: string;

    // Fees
    registrationFee?: RegistrationFee;
    totalFeesDue?: number;
    totalFeesPaid?: number;
    feeStatus?: FeeStatus;

    // Status & Tracking
    status: RegistrationStatus;
    assignedCounselor?: string;
    remarks?: string;

    // Metadata
    createdAt?: string;
    updatedAt?: string;
    createdBy?: string;
    instituteId?: string;

    // Backward compatibility / Form compatibility fields
    previousSchoolName?: string;
    previousSchoolBoard?: string;
    lastClassAttended?: string;
    previousSchoolAddress?: string;
    mediumOfInstruction?: string;
    lastExamResult?: string;
    subjectsStudied?: string;
    tcNumber?: string;
    tcIssueDate?: string;
    tcSubmittedLater?: boolean;
    tcPending?: boolean;
    hasSiblingsInSchool?: boolean;
    fatherInfo?: {
        name: string;
        mobile: string;
        alternateMobile?: string;
        email?: string;
        alternateEmail?: string;
        qualification?: string;
        occupation?: string;
        organization?: string;
        designation?: string;
        annualIncome?: string;
        officeAddress?: string;
        aadharNumber?: string;
        panNumber?: string;
    };
    motherInfo?: {
        name: string;
        mobile: string;
        alternateMobile?: string;
        email?: string;
        alternateEmail?: string;
        qualification?: string;
        occupation?: string;
        organization?: string;
        designation?: string;
        annualIncome?: string;
        officeAddress?: string;
        aadharNumber?: string;
        panNumber?: string;
    };
    guardianInfo?: {
        name: string;
        relation: string;
        mobile: string;
        email: string;
        occupation: string;
        annualIncome: string;
    };
    emergencyContact?: {
        name: string;
        relationship: string;
        mobile: string;
        alternateMobile?: string;
    };
    hasSiblings?: boolean;
    payerName?: string;
    paymentMode?: string;
    paymentDate?: string;
}

export interface RegistrationFilters {
    status?: RegistrationStatus[];
    applyingForClass?: string[];
    feeStatus?: FeeStatus[];
    dateFrom?: string;
    dateTo?: string;
    searchQuery?: string;
}

export interface RegistrationListResponse {
    registrations: Registration[];
    total: number;
    page: number;
    pageSize: number;
}

// Status configurations for UI
export const REGISTRATION_STATUS_CONFIG: Record<
    RegistrationStatus,
    { label: string; color: string; bgColor: string }
> = {
    DRAFT: { label: 'Draft', color: 'text-gray-700', bgColor: 'bg-gray-100' },
    PENDING_DOCUMENTS: {
        label: 'Pending Documents',
        color: 'text-amber-700',
        bgColor: 'bg-amber-100',
    },
    PENDING_FEE: { label: 'Pending Fee', color: 'text-orange-700', bgColor: 'bg-orange-100' },
    DOCUMENTS_VERIFIED: {
        label: 'Documents Verified',
        color: 'text-blue-700',
        bgColor: 'bg-blue-100',
    },
    FEE_PAID: { label: 'Fee Paid', color: 'text-green-700', bgColor: 'bg-green-100' },
    READY_FOR_ADMISSION: {
        label: 'Ready for Admission',
        color: 'text-emerald-700',
        bgColor: 'bg-emerald-100',
    },
    ADMITTED: { label: 'Admitted', color: 'text-purple-700', bgColor: 'bg-purple-100' },
    CANCELLED: { label: 'Cancelled', color: 'text-red-700', bgColor: 'bg-red-100' },
};

export const FEE_STATUS_CONFIG: Record<FeeStatus, { label: string; icon: string; color: string }> =
    {
        PENDING: { label: 'Pending', icon: '⏳', color: 'text-amber-600' },
        PARTIAL: { label: 'Partial', icon: '◐', color: 'text-orange-600' },
        PAID: { label: 'Paid', icon: '✓', color: 'text-green-600' },
        WAIVED: { label: 'Waived', icon: '✗', color: 'text-gray-600' },
    };

export const REQUIRED_DOCUMENTS = [
    { type: 'STUDENT_PHOTO', name: "Student's Recent Passport Photo", required: true },
    { type: 'BIRTH_CERTIFICATE', name: 'Birth Certificate', required: true },
    { type: 'STUDENT_AADHAAR', name: "Student's Aadhaar Card", required: true },
    { type: 'MARKSHEET', name: 'Previous Year Marksheet', required: true },
    { type: 'TRANSFER_CERTIFICATE', name: 'Transfer Certificate', required: true },
    { type: 'FATHER_AADHAAR', name: "Father's Aadhaar Card", required: true },
    { type: 'MOTHER_AADHAAR', name: "Mother's Aadhaar Card", required: true },
    { type: 'ADDRESS_PROOF', name: 'Address Proof', required: true },
    { type: 'CASTE_CERTIFICATE', name: 'Caste Certificate', required: false },
    { type: 'INCOME_CERTIFICATE', name: 'Income Certificate', required: false },
    { type: 'DISABILITY_CERTIFICATE', name: 'Disability Certificate', required: false },
    { type: 'MEDICAL_RECORDS', name: 'Medical Reports', required: false },
    { type: 'ACHIEVEMENTS', name: 'Achievement Certificates', required: false },
];
