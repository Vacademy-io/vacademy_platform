export interface FinalCourseData {
    aboutCourse: string;
    course: string;
    courseBanner: string;
    courseMedia: string;
    courseMediaId: {
        type: string;
        id: string;
    };
    coursePreview: string;
    customHtml: string;
    description: string;
    includeInstituteLogo: boolean;
    instituteLogo: string;
    learningOutcome: string;
    restrictToSameBatch: boolean;
    showRelatedCourses: boolean;
    tags: string[];
    targetAudience: string;
}

export interface PaymentOption {
    id: string;
    name: string;
    amount: number;
    currency: string;
    description: string;
    duration: string;
    features: string[];
}

export interface PaymentInfo {
    cardholderName: string;
    cardNumber: string;
    expiryDate: string;
    cvv: string;
}

export interface EnrollmentData {
    registrationData: Record<
        string,
        {
            name: string;
            value: string;
            is_mandatory: boolean;
            type: string;
            comma_separated_options?: string[];
        }
    >;
    selectedPayment: PaymentOption | null;
    paymentInfo: PaymentInfo;
}
