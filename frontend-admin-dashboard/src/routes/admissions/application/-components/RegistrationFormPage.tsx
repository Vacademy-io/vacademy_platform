import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavHeadingStore } from '@/stores/layout-container/useNavHeadingStore';
import { useNavigate } from '@tanstack/react-router';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import {
    User,
    GraduationCap,
    Users,
    MapPin,
    Check,
    CaretLeft,
    CaretRight,
    Warning,
    CaretDown,
    CreditCardIcon as CreditCard,
} from '@phosphor-icons/react';
import { MyButton } from '@/components/design-system/button';
import { cn } from '@/lib/utils';
import ApplicationFormPrintTemplate from './ApplicationFormPrintTemplate';
import useInstituteLogoStore from '@/components/common/layout-container/sidebar/institutelogo-global-zustand';
import { StudentDetailsSection } from './sections/StudentDetailsSection';
import { AcademicInfoSection } from './sections/AcademicInfoSection';
import { ParentGuardianSection } from './sections/ParentGuardianSection';
import { AddressSection } from './sections/AddressSection';
import { PaymentSection } from './sections/PaymentSection';
import type { Registration } from '../../-types/registration-types';
import { useInstituteDetailsStore } from '@/stores/students/students-list/useInstituteDetailsStore';
import {
    applyForAdmission,
    type ApplyPayload,
    fetchApplicationStages,
    generatePaymentLink,
    fetchPaymentOptionById,
    type PaymentOptionDetails,
} from '../../-services/applicant-services';
import { getCustomFieldSettings } from '@/services/custom-field-settings';
import { toast } from 'sonner';

interface FormSection {
    id: string;
    label: string;
    shortLabel: string;
    icon: React.ReactNode;
    isComplete: boolean;
    hasErrors: boolean;
}

// Generate new registration ID
const generateRegistrationId = () => {
    const year = new Date().getFullYear();
    const num = Math.floor(Math.random() * 9000) + 1000;
    return `REG-${year}-${String(num).padStart(4, '0')}`;
};

// Initial empty form data
// Initial empty form data
const getInitialFormData = (): Partial<Registration> => ({
    id: generateRegistrationId(),
    status: 'DRAFT',

    // Student
    studentName: '',
    dateOfBirth: '',
    gender: undefined,
    nationality: 'Indian',
    religion: '',
    category: '',
    bloodGroup: '',
    motherTongue: '',
    languagesKnown: [''],

    // Academic
    applyingForClass: '',
    preferredBoard: '',
    academicYear: '2025-2026',
    mediumOfInstruction: '',
    previousSchoolName: '',
    previousSchoolBoard: '',
    lastClassAttended: '',
    previousSchoolAddress: '',

    // Parents
    fatherInfo: {
        name: '',
        mobile: '',
        email: '',
        occupation: '',
        annualIncome: '',
    },
    motherInfo: {
        name: '',
        mobile: '',
        email: '',
        occupation: '',
        annualIncome: '',
    },
    guardianInfo: undefined,

    // Emergency Contact
    emergencyContact: {
        name: '',
        relationship: '',
        mobile: '',
    },

    // Address
    // Address
    currentAddress: {
        houseNo: '',
        street: '',
        area: '',
        landmark: '',
        city: '',
        state: '',
        pincode: '',
        pinCode: '',
        country: 'India',
        addressLine1: '', // fallback or remove if not needed
        addressLine2: '',
    },
    permanentAddress: {
        houseNo: '',
        street: '',
        area: '',
        landmark: '',
        city: '',
        state: '',
        pincode: '',
        pinCode: '',
        country: 'India',
        addressLine1: '',
        addressLine2: '',
    },

    siblings: [],
    hasSiblingsInSchool: false,
    documents: [],
});

export function RegistrationFormPage() {
    const { setNavHeading } = useNavHeadingStore();
    const navigate = useNavigate();

    // Get sessionId from URL search params
    const [sessionId, setSessionId] = useState('');
    const [enquiryId, setEnquiryId] = useState<string | null>(null);
    const [enquiryTrackingId, setEnquiryTrackingId] = useState<string | null>(null);
    const [applicationTrackingId, setApplicationTrackingId] = useState<string | null>(null);
    const [showParentGenderModal, setShowParentGenderModal] = useState(false);
    const [pendingEnquiryData, setPendingEnquiryData] = useState<any>(null);

    const [activeSection, setActiveSection] = useState(0);
    const [formData, setFormData] = useState<Partial<Registration>>(getInitialFormData());
    const [isSaving, setIsSaving] = useState(false);
    const [showMobileNav, setShowMobileNav] = useState(false);
    const [paymentLink, setPaymentLink] = useState<string>('');
    const [applicantId, setApplicantId] = useState<string>('');
    const [showPaymentSection, setShowPaymentSection] = useState(false);
    const [paymentOptionId, setPaymentOptionId] = useState<string>('');
    const [paymentOptionDetails, setPaymentOptionDetails] = useState<PaymentOptionDetails | null>(
        null
    );

    // Get institute details
    const { instituteDetails } = useInstituteDetailsStore();
    const instituteId = instituteDetails?.id || '';
    const instituteName = instituteDetails?.institute_name || '';
    const { instituteLogo } = useInstituteLogoStore();
    const [logoBase64, setLogoBase64] = useState('');

    useEffect(() => {
        if (!instituteLogo) return;
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = img.naturalWidth;
            canvas.height = img.naturalHeight;
            const ctx = canvas.getContext('2d');
            if (ctx) {
                ctx.drawImage(img, 0, 0);
                setLogoBase64(canvas.toDataURL('image/png'));
            }
        };
        img.onerror = () => setLogoBase64('');
        img.src = instituteLogo;
    }, [instituteLogo]);

    const pdfTargetRef = useRef<HTMLDivElement>(null);
    const printTemplateRef = useRef<HTMLDivElement>(null);
    const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);

    const getPdfFilename = useCallback(() => {
        const parts = ['Application', formData.studentName, applicationTrackingId || enquiryTrackingId].filter(Boolean);
        return parts.join('_').replace(/\s+/g, '-') + '.pdf';
    }, [formData.studentName, applicationTrackingId, enquiryTrackingId]);

    const handleDownloadPdf = useCallback(async () => {
        if (!pdfTargetRef.current) {
            toast.error('PDF template not ready. Please try again.');
            return;
        }
        setIsGeneratingPdf(true);
        toast.info('Generating PDF...');
        try {
            const canvas = await html2canvas(pdfTargetRef.current, {
                scale: 2,
                useCORS: true,
                allowTaint: true,
                logging: false,
            });
            const imgData = canvas.toDataURL('image/png');
            const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
            const pdfWidth = pdf.internal.pageSize.getWidth();
            const pdfHeight = pdf.internal.pageSize.getHeight();
            const ratio = Math.min(pdfWidth / canvas.width, pdfHeight / canvas.height);
            const width = canvas.width * ratio;
            const height = canvas.height * ratio;
            pdf.addImage(imgData, 'PNG', 0, 0, width, height);
            if (height > pdfHeight) {
                let remainingHeight = canvas.height;
                let position = 0;
                pdf.deletePage(1);
                while (remainingHeight > 0) {
                    pdf.addPage();
                    pdf.addImage(imgData, 'PNG', 0, position, width, height);
                    remainingHeight -= canvas.height * (pdfHeight / height);
                    position -= pdfHeight;
                }
            }
            pdf.save(getPdfFilename());
            toast.success('PDF downloaded!');
        } catch (error) {
            console.error('PDF generation failed:', error);
            toast.error('Failed to generate PDF. Please try again.');
        } finally {
            setIsGeneratingPdf(false);
        }
    }, [getPdfFilename]);

    const handlePrint = useCallback(() => {
        if (!printTemplateRef.current) return;
        const printWindow = window.open('', '_blank');
        if (!printWindow) {
            toast.error('Pop-up blocked. Please allow pop-ups to print.');
            return;
        }
        printWindow.document.write(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>Application Form - ${formData.studentName || ''}</title>
                <style>
                    @media print { body { margin: 0; } }
                    body { margin: 0; padding: 0; }
                </style>
            </head>
            <body>${printTemplateRef.current.innerHTML}</body>
            </html>
        `);
        printWindow.document.close();
        printWindow.onload = () => {
            printWindow.print();
            printWindow.close();
        };
    }, [formData.studentName]);

    // Extract sessionId and enquiry data from URL on mount
    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const sid = params.get('sessionId');
        if (sid) setSessionId(sid);

        // Parse enquiry data if present
        const enquiryDataParam = params.get('enquiryData');
        if (enquiryDataParam) {
            try {
                const enquiryData = JSON.parse(decodeURIComponent(enquiryDataParam));
                console.log('Parsed enquiry data:', enquiryData);
                setEnquiryId(enquiryData.enquiry_id);
                setEnquiryTrackingId(enquiryData.tracking_id || null);
                prefillFormFromEnquiry(enquiryData);
            } catch (error) {
                console.error('Failed to parse enquiry data:', error);
            }
        }
    }, []);

    // Load custom fields on mount
    useEffect(() => {
        const loadCustomFields = async () => {
            try {
                await getCustomFieldSettings();
                // Custom fields validated
            } catch (error) {
                console.error('Failed to load custom fields:', error);
            }
        };
        loadCustomFields();
    }, []);

    // Fetch application stages and payment option details on page load
    useEffect(() => {
        if (!instituteId) return;
        const loadPaymentInfo = async () => {
            try {
                const stages = await fetchApplicationStages(instituteId, 'INSTITUTE', instituteId);
                const paymentStage = stages.find((stage) => stage.type === 'PAYMENT');
                if (paymentStage) {
                    const paymentConfig = JSON.parse(paymentStage.config_json) as {
                        payment_option_id: string;
                        payment_qr_code_file_id?: string | null;
                        upi_details?: {
                            upi_vpa?: string | null;
                            upi_payee_name?: string | null;
                        } | null;
                    };
                    const optionId = paymentConfig.payment_option_id;
                    const qrCodeFileId = paymentConfig.payment_qr_code_file_id ?? null;
                    const upiVpa = paymentConfig.upi_details?.upi_vpa ?? null;
                    const upiPayeeName = paymentConfig.upi_details?.upi_payee_name ?? null;
                    setPaymentOptionId(optionId);
                    const optionDetails = await fetchPaymentOptionById(instituteId, optionId);
                    if (optionDetails) {
                        setPaymentOptionDetails({
                            ...optionDetails,
                            qrCodeFileId,
                            upiVpa,
                            upiPayeeName,
                        });
                    } else {
                        // Still surface the QR code even if the payment option lookup failed
                        setPaymentOptionDetails({
                            id: optionId,
                            name: 'Application / Registration Fee',
                            amount: 0,
                            currency: 'INR',
                            qrCodeFileId,
                            upiVpa,
                            upiPayeeName,
                            plans: [],
                        });
                    }
                }
            } catch (error) {
                console.error('Error loading payment information:', error);
            }
        };
        loadPaymentInfo();
    }, [instituteId]);

    // Function to prefill form from enquiry data
    const prefillFormFromEnquiry = (enquiryData: any) => {
        const updates: Partial<Registration> = {};

        // Prefill child details
        if (enquiryData.child) {
            updates.studentName = enquiryData.child.name || '';
            updates.selectedPackageSessionId = enquiryData.child.destination_package_session_id || '';
            updates.applyingForClass = enquiryData.child.destination_package_session_id || '';
            if (enquiryData.child.dob) {
                // Convert ISO date to YYYY-MM-DD format
                const date = new Date(enquiryData.child.dob);
                updates.dateOfBirth = date.toISOString().split('T')[0];
            }
            updates.gender = enquiryData.child.gender || undefined;
        }

        // Apply child updates first
        setFormData((prev) => ({ ...prev, ...updates }));

        // Prefill parent details - need to determine if father or mother
        if (enquiryData.parent) {
            const parentData = enquiryData.parent;

            // Check if parent has gender field
            if (parentData.gender && parentData.gender === 'MALE') {
                // It's father
                const parentUpdates: Partial<Registration> = {
                    fatherInfo: {
                        name: parentData.name || '',
                        mobile: parentData.phone || '',
                        email: parentData.email || '',
                        occupation: '',
                        annualIncome: '',
                    },
                };

                // Prefill address if available
                if (parentData.address_line || parentData.city || parentData.pin_code) {
                    parentUpdates.currentAddress = {
                        houseNo: '',
                        street: '',
                        area: '',
                        state: '',
                        country: '',
                        ...formData.currentAddress,
                        addressLine1: parentData.address_line || '',
                        city: parentData.city || '',
                        pinCode: parentData.pin_code || '',
                        pincode: parentData.pin_code || '',
                    };
                }
                setFormData((prev) => ({ ...prev, ...parentUpdates }));
            } else if (parentData.gender && parentData.gender === 'FEMALE') {
                // It's mother
                const parentUpdates: Partial<Registration> = {
                    motherInfo: {
                        name: parentData.name || '',
                        mobile: parentData.phone || '',
                        email: parentData.email || '',
                        occupation: '',
                        annualIncome: '',
                    },
                };

                // Prefill address if available
                if (parentData.address_line || parentData.city || parentData.pin_code) {
                    parentUpdates.currentAddress = {
                        houseNo: '',
                        street: '',
                        area: '',
                        state: '',
                        country: '',
                        ...formData.currentAddress,
                        addressLine1: parentData.address_line || '',
                        city: parentData.city || '',
                        pinCode: parentData.pin_code || '',
                        pincode: parentData.pin_code || '',
                    };
                }
                setFormData((prev) => ({ ...prev, ...parentUpdates }));
            } else {
                // Gender is OTHER, not provided, or we need to ask user
                setPendingEnquiryData({ parent: parentData });
                setShowParentGenderModal(true);
            }
        }
    };

    const handleParentTypeSelection = (type: 'father' | 'mother') => {
        if (!pendingEnquiryData?.parent) return;

        const parentData = pendingEnquiryData.parent;
        const updates: Partial<Registration> = {};

        if (type === 'father') {
            updates.fatherInfo = {
                name: parentData.name || '',
                mobile: parentData.phone || '',
                email: parentData.email || '',
                occupation: '',
                annualIncome: '',
            };
        } else {
            updates.motherInfo = {
                name: parentData.name || '',
                mobile: parentData.phone || '',
                email: parentData.email || '',
                occupation: '',
                annualIncome: '',
            };
        }

        // Prefill address if available
        if (parentData.address_line || parentData.city || parentData.pin_code) {
            updates.currentAddress = {
                houseNo: '',
                street: '',
                area: '',
                state: '',
                country: '',
                ...formData.currentAddress,
                addressLine1: parentData.address_line || '',
                city: parentData.city || '',
                pinCode: parentData.pin_code || '',
                pincode: parentData.pin_code || '',
            };
        }

        setFormData((prev) => ({ ...prev, ...updates }));
        setShowParentGenderModal(false);
        setPendingEnquiryData(null);
    };

    const handleSaveDraft = useCallback(
        async (isAutoSave = false) => {
            setIsSaving(true);
            try {
                // Simulate API call
                await new Promise((resolve) => setTimeout(resolve, 500));
                if (!isAutoSave) {
                    console.log('Draft saved:', formData);
                }
            } catch (error) {
                console.error('Failed to save draft:', error);
            } finally {
                setIsSaving(false);
            }
        },
        [formData]
    );

    const sections: FormSection[] = [
        {
            id: 'student',
            label: 'Student Details',
            shortLabel: 'Student',
            icon: <User size={20} />,
            isComplete: Boolean(
                formData.studentName &&
                formData.dateOfBirth &&
                formData.gender &&
                formData.nationality &&
                formData.category
            ),
            hasErrors: false,
        },
        {
            id: 'academic',
            label: 'Academic Info',
            shortLabel: 'Academic',
            icon: <GraduationCap size={20} />,
            isComplete: Boolean(
                formData.applyingForClass &&
                formData.preferredBoard &&
                formData.previousSchoolName &&
                formData.previousSchoolBoard &&
                formData.lastClassAttended
            ),
            hasErrors: false,
        },
        {
            id: 'parent',
            label: 'Parent & Guardian',
            shortLabel: 'Parent',
            icon: <Users size={20} />,
            isComplete: Boolean(
                (formData.fatherInfo?.name && formData.fatherInfo?.mobile) ||
                (formData.motherInfo?.name && formData.motherInfo?.mobile)
            ),
            hasErrors: false,
        },
        {
            id: 'address',
            label: 'Address',
            shortLabel: 'Address',
            icon: <MapPin size={20} />,
            isComplete: Boolean(
                formData.currentAddress?.houseNo &&
                formData.currentAddress?.street &&
                formData.currentAddress?.area &&
                formData.currentAddress?.city &&
                formData.currentAddress?.state &&
                (formData.currentAddress?.pincode || formData.currentAddress?.pinCode)
            ),
            hasErrors: false,
        },
        {
            id: 'payment',
            label: 'Payment',
            shortLabel: 'Payment',
            icon: <CreditCard size={20} />,
            isComplete: false,
            hasErrors: false,
        },
    ];

    const completedSections = sections.filter((s) => s.isComplete).length;
    const progress = Math.round((completedSections / sections.length) * 100);

    useEffect(() => {
        setNavHeading(
            <div className="flex items-center gap-2">
                <span className="text-lg font-semibold">New Application</span>
            </div>
        );
    }, [setNavHeading]);

    // Auto-save every 30 seconds
    useEffect(() => {
        const autoSaveInterval = setInterval(() => {
            handleSaveDraft(true);
        }, 30000);

        return () => clearInterval(autoSaveInterval);
    }, [formData, handleSaveDraft]);

    const handleNext = () => {
        if (activeSection < sections.length - 1) {
            setActiveSection(activeSection + 1);
        }
    };

    const handlePrevious = () => {
        if (activeSection > 0) {
            setActiveSection(activeSection - 1);
        }
    };

    const handleSubmit = async () => {
        setIsSaving(true);
        try {
            if (!formData.applyingForClass) {
                toast.warning('Please select a class/grade from the Academic Info section');
                setIsSaving(false);
                return;
            }

            if (!sessionId) {
                toast.warning(
                    'Session ID is missing. Please select a session from the registration list'
                );
                setIsSaving(false);
                return;
            }

            // Confirmation dialog before submission
            const confirmed = window.confirm(
                'Are you sure you want to submit this application? Please review all details before proceeding.'
            );
            if (!confirmed) {
                setIsSaving(false);
                return;
            }

            // Prepare custom field values
            const custom_field_values: Record<string, string> = {};

            // Combine address fields into a single address_line
            const addressParts = [
                formData.currentAddress?.houseNo,
                formData.currentAddress?.street,
                formData.currentAddress?.area,
                formData.currentAddress?.landmark,
            ].filter(Boolean);
            const address_line = addressParts.join(', ');

            // Build API payload
            const payload: ApplyPayload = {
                enquiry_id: enquiryId || null,
                institute_id: instituteId,
                session_id: sessionId,
                destination_package_session_id: formData?.selectedPackageSessionId || '',
                source: 'INSTITUTE',
                source_id: instituteId,
                form_data: {
                    parent_name: formData.fatherInfo?.name || formData.motherInfo?.name || '',
                    parent_phone: formData.fatherInfo?.mobile || formData.motherInfo?.mobile || '',
                    parent_email: formData.fatherInfo?.email || formData.motherInfo?.email,
                    child_name: formData.studentName || '',
                    child_dob: formData.dateOfBirth || '',
                    child_gender: formData.gender || 'OTHER',
                    address_line: address_line,
                    city: formData.currentAddress?.city,
                    pin_code: formData.currentAddress?.pinCode,
                    father_name: formData.fatherInfo?.name,
                    mother_name: formData.motherInfo?.name,
                    id_number: formData.idNumber,
                    id_type: formData.idType,
                    previous_school_name: formData.previousSchoolName,
                    previous_school_board: formData.previousSchoolBoard,
                    last_class_attended: formData.lastClassAttended,
                    last_exam_result: formData.lastExamResult,
                    subjects_studied: formData.subjectsStudied,
                    applying_for_class: formData.applyingForClass,
                    academic_year: formData.academicYear,
                    board_preference: formData.preferredBoard,
                    tc_number: formData.tcNumber,
                    tc_issue_date: formData.tcIssueDate,
                    tc_pending: formData.tcPending,
                    has_special_education_needs: formData.hasSpecialNeeds,
                    is_physically_challenged: formData.isPhysicallyChallenged,
                    medical_conditions: formData.medicalConditions,
                    dietary_restrictions: formData.dietaryRestrictions,
                    blood_group: formData.bloodGroup,
                    mother_tongue: formData.motherTongue,
                    languages_known: formData.languagesKnown?.join(', '),
                    category: formData.category,
                    nationality: formData.nationality,
                },
                custom_field_values,
            };

            const response = await applyForAdmission(payload);
            console.log('Registration submitted successfully:', response);
            setApplicantId(response?.applicant_id);
            setApplicationTrackingId(response?.tracking_id || null);

            // Generate payment link using the paymentOptionId fetched at page load
            if (paymentOptionId) {
                const link = generatePaymentLink(
                    instituteId,
                    response?.applicant_id,
                    paymentOptionId
                );
                setPaymentLink(link);
                setShowPaymentSection(true);
            }

            setActiveSection(4);
        } catch (error) {
            console.error('Failed to submit registration:', error);
            toast.error('Failed to submit application. Please try again.');
        } finally {
            setIsSaving(false);
        }
    };

    const updateFormData = useCallback((updates: Partial<Registration>) => {
        setFormData((prev) => ({ ...prev, ...updates }));
    }, []);

    const renderSectionContent = () => {
        switch (activeSection) {
            case 0:
                return (
                    <StudentDetailsSection formData={formData} updateFormData={updateFormData} />
                );
            case 1:
                return <AcademicInfoSection formData={formData} updateFormData={updateFormData} />;
            case 2:
                return (
                    <ParentGuardianSection formData={formData} updateFormData={updateFormData} />
                );
            case 3:
                return <AddressSection formData={formData} updateFormData={updateFormData} />;
            case 4:
                return (
                    <PaymentSection
                        formData={formData}
                        updateFormData={updateFormData}
                        paymentLink={paymentLink}
                        applicantId={applicantId}
                        paymentOptionDetails={paymentOptionDetails}
                    />
                );
            default:
                return null;
        }
    };

    return (
        <>
            <div className="flex h-full flex-col">
                {/* Header */}
                <div className="mb-6 flex flex-col gap-4 rounded-lg border border-neutral-200 bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <h1 className="text-xl font-bold text-neutral-900">New Application</h1>
                    </div>
                    <div className="flex items-center gap-3">
                        <MyButton
                            onClick={handleDownloadPdf}
                            buttonType="secondary"
                            scale="medium"
                            disable={isGeneratingPdf}
                            className="flex items-center gap-1.5"
                        >
                            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                            {isGeneratingPdf ? 'Generating...' : 'Download PDF'}
                        </MyButton>
                        <MyButton
                            onClick={handlePrint}
                            buttonType="secondary"
                            scale="medium"
                            className="flex items-center gap-1.5"
                        >
                            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                            </svg>
                            Print
                        </MyButton>
                        {/* Progress */}
                        <div className="flex items-center gap-2">
                            <div className="h-2 w-24 overflow-hidden rounded-full bg-neutral-200">
                                <div
                                    className="h-full bg-primary-500 transition-all duration-300"
                                    style={{ width: `${progress}%` }}
                                />
                            </div>
                            <span className="text-sm font-medium text-neutral-600">
                                {progress}%
                            </span>
                        </div>
                    </div>
                </div>

                {/* Main Content */}
                <div className="flex min-h-0 flex-1 gap-6">
                    {/* Mobile Navigation Dropdown */}
                    <div className="mb-4 lg:hidden">
                        <button
                            onClick={() => setShowMobileNav(!showMobileNav)}
                            className="flex w-full items-center justify-between rounded-lg border border-neutral-200 bg-white px-4 py-3"
                        >
                            <div className="flex items-center gap-2">
                                {sections[activeSection]?.icon}
                                <span className="font-medium">
                                    {sections[activeSection]?.label}
                                </span>
                            </div>
                            <CaretDown
                                size={18}
                                className={cn(
                                    'transition-transform',
                                    showMobileNav && 'rotate-180'
                                )}
                            />
                        </button>
                        {showMobileNav && (
                            <div className="absolute inset-x-4 z-10 mt-1 rounded-lg border border-neutral-200 bg-white shadow-lg">
                                {sections.map((section, index) => (
                                    <button
                                        key={section.id}
                                        onClick={() => {
                                            setActiveSection(index);
                                            setShowMobileNav(false);
                                        }}
                                        className={cn(
                                            'flex w-full items-center gap-3 px-4 py-3 text-left transition-colors',
                                            index === activeSection
                                                ? 'bg-primary-50 text-primary-700'
                                                : 'hover:bg-neutral-50'
                                        )}
                                    >
                                        <span
                                            className={cn(
                                                'flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium',
                                                section.isComplete
                                                    ? 'bg-green-100 text-green-700'
                                                    : index === activeSection
                                                        ? 'bg-primary-100 text-primary-700'
                                                        : 'bg-neutral-100 text-neutral-500'
                                            )}
                                        >
                                            {section.isComplete ? (
                                                <Check size={14} weight="bold" />
                                            ) : (
                                                index + 1
                                            )}
                                        </span>
                                        <span className="font-medium">{section.label}</span>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Desktop Sidebar Navigation */}
                    <div className="sticky top-0 hidden h-fit w-64 shrink-0 rounded-lg border border-neutral-200 bg-white lg:block">
                        <div className="p-2">
                            {sections.map((section, index) => (
                                <button
                                    key={section.id}
                                    onClick={() => setActiveSection(index)}
                                    className={cn(
                                        'flex w-full items-center gap-3 rounded-lg px-4 py-3 text-left transition-all',
                                        index === activeSection
                                            ? 'bg-primary-50 text-primary-700'
                                            : 'text-neutral-600 hover:bg-neutral-50'
                                    )}
                                >
                                    <span
                                        className={cn(
                                            'flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium transition-colors',
                                            section.isComplete
                                                ? 'bg-green-100 text-green-700'
                                                : index === activeSection
                                                    ? 'bg-primary-500 text-white'
                                                    : 'bg-neutral-100 text-neutral-500'
                                        )}
                                    >
                                        {section.isComplete ? (
                                            <Check size={16} weight="bold" />
                                        ) : (
                                            section.icon
                                        )}
                                    </span>
                                    <div className="flex flex-col">
                                        <span
                                            className={cn(
                                                'text-sm font-medium',
                                                index === activeSection
                                                    ? 'text-primary-700'
                                                    : 'text-neutral-700'
                                            )}
                                        >
                                            {section.label}
                                        </span>
                                        {section.hasErrors && (
                                            <span className="flex items-center gap-1 text-xs text-red-600">
                                                <Warning size={12} />
                                                Has errors
                                            </span>
                                        )}
                                    </div>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Form Content */}
                    <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-neutral-200 bg-white">
                        {/* Section Header */}
                        <div className="border-b border-neutral-100 bg-neutral-50 px-6 py-4">
                            <h2 className="flex items-center gap-2 text-lg font-semibold text-neutral-900">
                                {sections[activeSection]?.icon}
                                {sections[activeSection]?.label}
                            </h2>
                            <p className="mt-1 text-sm text-neutral-500">
                                Step {activeSection + 1} of {sections.length}
                            </p>
                        </div>

                        {/* Section Content */}
                        <div className="flex-1 overflow-y-auto p-6">{renderSectionContent()}</div>

                        {/* Footer Navigation */}
                        <div className="flex items-center justify-between border-t border-neutral-100 bg-neutral-50 px-6 py-4">
                            <MyButton
                                buttonType="secondary"
                                onClick={handlePrevious}
                                disabled={activeSection === 0}
                                className="h-10"
                            >
                                <CaretLeft size={18} className="mr-1" />
                                Previous
                            </MyButton>

                            <div className="flex items-center gap-3">
                                {activeSection === 3 ? (
                                    <MyButton
                                        buttonType="primary"
                                        onClick={handleSubmit}
                                        disabled={isSaving}
                                        className="h-10 "
                                    >
                                        Submit Application
                                    </MyButton>
                                ) : activeSection === 4 ? (
                                    <MyButton
                                        buttonType="secondary"
                                        onClick={() => navigate({ to: '/admissions/application' })}
                                        className="h-10"
                                    >
                                        Back to List
                                    </MyButton>
                                ) : (
                                    <MyButton
                                        buttonType="primary"
                                        onClick={handleNext}
                                        className="h-10"
                                    >
                                        Next
                                        <CaretRight size={18} className="ml-1" />
                                    </MyButton>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Parent Type Selection Modal */}
            {showParentGenderModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
                    <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
                        <div className="mb-4">
                            <h2 className="text-lg font-semibold text-neutral-900">
                                Select Parent Type
                            </h2>
                            <p className="mt-2 text-sm text-neutral-600">
                                Please specify if the contact details belong to the father or mother
                            </p>
                        </div>

                        <div className="space-y-3">
                            <button
                                onClick={() => handleParentTypeSelection('father')}
                                className="flex w-full items-center gap-4 rounded-lg border border-neutral-200 p-4 text-left transition-all hover:border-primary-500 hover:bg-primary-50"
                            >
                                <div className="flex size-12 items-center justify-center rounded-full bg-blue-100">
                                    <User size={24} className="text-blue-600" />
                                </div>
                                <div>
                                    <h3 className="font-medium text-neutral-900">Father</h3>
                                    <p className="text-sm text-neutral-600">
                                        Use these details for father's information
                                    </p>
                                </div>
                            </button>

                            <button
                                onClick={() => handleParentTypeSelection('mother')}
                                className="flex w-full items-center gap-4 rounded-lg border border-neutral-200 p-4 text-left transition-all hover:border-primary-500 hover:bg-primary-50"
                            >
                                <div className="flex size-12 items-center justify-center rounded-full bg-pink-100">
                                    <User size={24} className="text-pink-600" />
                                </div>
                                <div>
                                    <h3 className="font-medium text-neutral-900">Mother</h3>
                                    <p className="text-sm text-neutral-600">
                                        Use these details for mother's information
                                    </p>
                                </div>
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Hidden print/PDF template rendered off-screen */}
            <div style={{ position: 'absolute', left: '-9999px', top: 0 }}>
                <div ref={printTemplateRef}>
                    <ApplicationFormPrintTemplate
                        ref={pdfTargetRef}
                        formData={formData}
                        instituteName={instituteName}
                        instituteLogo={logoBase64}
                        trackingLabel={applicationTrackingId ? 'Application Tracking ID' : enquiryTrackingId ? 'Enquiry Tracking ID' : ''}
                        trackingId={applicationTrackingId || enquiryTrackingId || ''}
                    />
                </div>
            </div>
        </>
    );
}

/*

{"order_id": null, "display_text": "Please pay the application fee to proceed.", "gateway_rules": {"fallback": "RAZORPAY", "preferred": "RAZORPAY"}, "payment_status": null, "payment_option_id": "e3458a23-2b76-47e2-bc73-b11eb093a3e1"}
 */
