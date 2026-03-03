export type RegistrationStatus =
    | 'DRAFT'
    | 'SUBMITTED'
    | 'APPROVED'
    | 'REJECTED'
    | 'DOCUMENT_VERIFICATION'
    | 'FEE_PAYMENT'
    | 'COMPLETED';

export interface AddressInfo {
    houseNo: string;
    street: string;
    area: string;
    landmark?: string;
    city: string;
    state: string;
    pincode: string;
    pinCode?: string;
    country: string;
    // Keeping old fields for backward compatibility if needed, but intended to be replaced
    addressLine1?: string;
    addressLine2?: string;
}

export interface ParentInfo {
    name: string;
    relation: string;
    occupation: string;
    organization?: string;
    designation?: string;
    annualIncome: string;
    mobile: string;
    alternateMobile?: string;
    email: string;
    alternateEmail?: string;
    qualification?: string;
    aadharNumber?: string;
    panNumber?: string;
    officeAddress?: string;
}

export interface SiblingInfo {
    name: string;
    age: string;
    school: string;
    class: string;
    isAlumni: boolean;
}

export interface RegistrationDocument {
    id: string;
    name: string;
    type: string;
    isRequired: boolean;
    status: 'PENDING' | 'UPLOADED' | 'VERIFIED' | 'REJECTED';
    url?: string;
    remarks?: string;
}

export interface RegistrationFee {
    id: string;
    name: string;
    amount: number;
    description: string;
    dueDate?: string;
    status: 'PENDING' | 'PAID' | 'PARTIAL' | 'OVERDUE';
}

export interface Registration {
    id?: string;
    inquiryId?: string;
    registrationNo?: string;
    status: RegistrationStatus;

    // Transport & Hostel
    transportRequired?: boolean;
    hostelRequired?: boolean;

    // Student Details
    studentName: string;
    dateOfBirth: string;
    gender: 'MALE' | 'FEMALE' | 'OTHER';
    nationality: string;
    religion: string;
    category: string;
    bloodGroup: string;
    motherTongue: string;
    languagesKnown?: string;
    aadhaarNumber?: string;
    birthCertificateNumber?: string;
    hasSpecialNeeds?: boolean;
    specialNeedsDetails?: string;
    isPhysicallyChallenged?: boolean;
    medicalConditions?: string;
    dietaryRestrictions?: string;

    // Academic Info
    previousSchoolName?: string;
    previousSchoolBoard?: string;
    lastClassAttended?: string;
    previousSchoolAddress?: string;
    mediumOfInstruction?: string;
    academicYear?: string;
    lastExamResult?: string;
    subjectsStudied?: string;
    tcNumber?: string;
    tcIssueDate?: string;
    tcSubmittedLater?: boolean;
    tcPending?: boolean;
    applyingForClass: string;
    preferredBoard: string;

    // Level & Package Selection
    selectedLevelId?: string;
    packageSessionId?: string;
    idType?: 'AADHAR_CARD' | 'BIRTH_CERTIFICATE' | 'PASSPORT' | 'OTHER';
    idNumber?: string;

    // Address
    currentAddress: AddressInfo;
    permanentAddress: AddressInfo;

    // Parents
    fatherInfo: ParentInfo;
    motherInfo: ParentInfo;
    guardianInfo?: ParentInfo;

    // Siblings
    hasSiblingsInSchool?: boolean;
    siblings: SiblingInfo[];

    // Emergency Contact
    emergencyContact?: EmergencyContact;

    // Documents & Fees
    documents: RegistrationDocument[];
    fees?: RegistrationFee[];
    paymentMode?: string;
    transactionId?: string;
    paymentDate?: string;
    payerName?: string;
    feeStatus?: 'PAID' | 'PENDING';
}

export interface EmergencyContact {
    name: string;
    relationship: string;
    mobile: string;
    alternateMobile?: string;
}
