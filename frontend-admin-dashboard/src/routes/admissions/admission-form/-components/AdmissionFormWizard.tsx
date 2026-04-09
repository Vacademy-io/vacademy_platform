import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useNavigate, useRouterState } from '@tanstack/react-router';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import Step1StudentDetails from './steps/Step1StudentDetails';
import Step2PreviousSchool from './steps/Step2PreviousSchool';
import Step3ParentDetails from './steps/Step3ParentDetails';
import Step4AddressDetails from './steps/Step4AddressDetails';
import Step5AFeeAssignment from './steps/Step5AFeeAssignment';
import Step6Finish from './steps/Step6Finish';
import AdmissionFormPrintTemplate from './AdmissionFormPrintTemplate';
import type { StudentSearchResult } from './AdmissionEntryScreen';
import { useInstituteDetailsStore } from '@/stores/students/students-list/useInstituteDetailsStore';
import useInstituteLogoStore from '@/components/common/layout-container/sidebar/institutelogo-global-zustand';
import authenticatedAxiosInstance from '@/lib/auth/axiosInstance';
import { BASE_URL } from '@/constants/urls';
import { toast } from 'sonner';
import { MyButton } from '@/components/design-system/button';

interface AdmissionSubmitResult {
    applicant_id?: string;
    tracking_id?: string;
    parent_user_id?: string;
    child_user_id?: string;
    parent?: {
        id?: string;
        full_name?: string;
        email?: string;
        phone?: string;
    };
    child?: {
        id?: string;
        full_name?: string;
        email?: string;
        phone?: string;
    };
    workflow_type?: string;
    overall_status?: string;
    current_stage_id?: string;
    message?: string;
}

export interface AdmissionFormData {
    // Source / context
    sessionId: string;
    destinationPackageSessionId: string;
    source: string;
    sourceId: string;
    enquiryId: string | null;
    applicationId: string | null;

    // Step 1
    studentFirstName: string;
    studentMiddleName: string;
    studentLastName: string;
    gender: string;
    applicationNumber: string;
    studentClass: string;
    section: string;
    classGroup: string;
    dateOfAdmission: string;
    dateOfBirth: string;
    residentialPhone: string;
    studentType: string;
    admissionType: string;
    transport: string;
    aadhaarType: string;
    aadhaarNumber: string;

    // Step 2
    schoolName: string;
    previousClass: string;
    board: string;
    yearOfPassing: string;
    percentage: string;
    percentageScience: string;
    percentageMaths: string;
    previousAdmissionNo: string;
    religion: string;
    caste: string;
    motherTongue: string;
    bloodGroup: string;
    nationality: string;
    howDidYouKnow: string;

    // Step 3
    fatherName: string;
    fatherMobile: string;
    fatherEmail: string;
    fatherAadhaar: string;
    fatherQualification: string;
    fatherOccupation: string;
    motherName: string;
    motherMobile: string;
    motherEmail: string;
    motherAadhaar: string;
    motherQualification: string;
    motherOccupation: string;
    guardianName: string;
    guardianMobile: string;

    // Step 4
    currentAddress: string;
    currentLocality: string;
    currentPinCode: string;
    sameAsPermanent: boolean;
    permanentAddress: string;
    permanentLocality: string;

    // Documents
    documentsUploaded: boolean;

    // Finish options
    sendSms: boolean;
    sendEmail: boolean;
}

const STEPS = [
    { id: 1, title: 'Student Details' },
    { id: 2, title: 'Previous School & Personal Details' },
    { id: 3, title: 'Student Parent Details' },
    { id: 4, title: 'Address Details' },
    { id: 5, title: 'Finish' },
    { id: 6, title: 'Fee Assignment' },
];

export default function AdmissionFormWizard() {
    const navigate = useNavigate();
    const routerState = useRouterState();
    const locationState = routerState.location.state as any;
    const [currentStep, setCurrentStep] = useState(1);
    const [admissionId, setAdmissionId] = useState('');
    const [admissionSubmitResult, setAdmissionSubmitResult] =
        useState<AdmissionSubmitResult | null>(null);
    const [sourceTrackingId, setSourceTrackingId] = useState<string | null>(null);
    const [sourceTrackingLabel, setSourceTrackingLabel] = useState<string>('');
    const [admissionTrackingId, setAdmissionTrackingId] = useState<string | null>(null);
    const { instituteDetails } = useInstituteDetailsStore();
    const instituteId = instituteDetails?.id || '';
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [selectedSessionId, setSelectedSessionId] = useState(locationState?.sessionId || '');
    const allBatches = instituteDetails?.batches_for_sessions ?? [];
    const { instituteLogo } = useInstituteLogoStore();
    const instituteName = instituteDetails?.institute_name || '';
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

    const packageSessionOptions = useMemo(() => {
        if (!allBatches.length) return [];
        return allBatches
            .filter((batch) => batch.is_parent === true || !batch.parent_id)
            .filter((batch) => !selectedSessionId || batch.session.id === selectedSessionId)
            .map((batch) => ({
                id: batch.id,
                label: `${batch.package_dto.package_name} - ${batch.level.level_name}${batch.name ? ` - ${batch.name}` : ''}`,
                sessionId: batch.session.id,
            }));
    }, [allBatches, selectedSessionId]);

    const [formData, setFormData] = useState<AdmissionFormData>({
        sessionId: '',
        destinationPackageSessionId: '',
        source: '',
        sourceId: '',
        enquiryId: null,
        applicationId: null,

        studentFirstName: '',
        studentMiddleName: '',
        studentLastName: '',
        gender: '',
        applicationNumber: '',
        studentClass: '',
        section: '',
        classGroup: '',
        dateOfAdmission: '',
        dateOfBirth: '',
        residentialPhone: '',
        studentType: '',
        admissionType: '',
        transport: 'No',
        aadhaarType: '',
        aadhaarNumber: '',

        schoolName: '',
        previousClass: '',
        board: '',
        yearOfPassing: '',
        percentage: '',
        percentageScience: '',
        percentageMaths: '',
        previousAdmissionNo: '',
        religion: '',
        caste: '',
        motherTongue: '',
        bloodGroup: '',
        nationality: '',
        howDidYouKnow: '',

        fatherName: '',
        fatherMobile: '',
        fatherEmail: '',
        fatherAadhaar: '',
        fatherQualification: '',
        fatherOccupation: '',
        motherName: '',
        motherMobile: '',
        motherEmail: '',
        motherAadhaar: '',
        motherQualification: '',
        motherOccupation: '',
        guardianName: '',
        guardianMobile: '',

        currentAddress: '',
        currentLocality: '',
        currentPinCode: '',
        sameAsPermanent: false,
        permanentAddress: '',
        permanentLocality: '',
        documentsUploaded: false,
        sendSms: true,
        sendEmail: true,
    });

    useEffect(() => {
        const newId = `VAC-ADM-2026-${Math.floor(10000 + Math.random() * 90000)}`;
        setAdmissionId(newId);
    }, []);

    const getPdfFilename = useCallback(() => {
        const parts = [
            'Admission',
            formData.studentFirstName,
            formData.studentLastName,
            admissionTrackingId || sourceTrackingId,
        ].filter(Boolean);
        return parts.join('_').replace(/\s+/g, '-') + '.pdf';
    }, [formData.studentFirstName, formData.studentLastName, admissionTrackingId, sourceTrackingId]);

    const targetRef = useRef<HTMLDivElement>(null);
    const printTemplateRef = useRef<HTMLDivElement>(null);
    const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);

    const handleDownloadPdf = useCallback(async () => {
        if (!targetRef.current) {
            toast.error('PDF template not ready. Please try again.');
            return;
        }
        setIsGeneratingPdf(true);
        toast.info('Generating PDF...');
        try {
            const canvas = await html2canvas(targetRef.current, {
                scale: 2,
                useCORS: true,
                allowTaint: true,
                logging: false,
            });
            const imgData = canvas.toDataURL('image/png');
            const pdf = new jsPDF({
                orientation: 'portrait',
                unit: 'mm',
                format: 'a4',
            });
            const pdfWidth = pdf.internal.pageSize.getWidth();
            const pdfHeight = pdf.internal.pageSize.getHeight();
            const imgWidth = canvas.width;
            const imgHeight = canvas.height;
            const ratio = Math.min(pdfWidth / imgWidth, pdfHeight / imgHeight);
            const width = imgWidth * ratio;
            const height = imgHeight * ratio;
            pdf.addImage(imgData, 'PNG', 0, 0, width, height);

            // If content overflows one page, add more pages
            if (height > pdfHeight) {
                let remainingHeight = imgHeight;
                let position = 0;
                pdf.deletePage(1);
                while (remainingHeight > 0) {
                    pdf.addPage();
                    pdf.addImage(imgData, 'PNG', 0, position, width, height);
                    remainingHeight -= imgHeight * (pdfHeight / height);
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
                <title>Admission Form - ${formData.studentFirstName} ${formData.studentLastName}</title>
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
    }, [formData.studentFirstName, formData.studentLastName]);

    const handleChange = (
        e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
    ) => {
        const { name, value, type } = e.target;
        if (type === 'checkbox') {
            const checked = (e.target as HTMLInputElement).checked;
            setFormData((prev) => ({ ...prev, [name]: checked }));
            if (name === 'sameAsPermanent') {
                if (checked) {
                    setFormData((prev) => ({
                        ...prev,
                        permanentAddress: prev.currentAddress,
                        permanentLocality: prev.currentLocality,
                    }));
                }
            }
        } else {
            setFormData((prev) => ({ ...prev, [name]: value }));
        }
    };

    const handleFormDataUpdate = (updates: Partial<AdmissionFormData>) => {
        setFormData((prev) => ({ ...prev, ...updates }));
    };

    const nextStep = () => setCurrentStep((prev) => Math.min(prev + 1, STEPS.length));
    const prevStep = () => setCurrentStep((prev) => Math.max(prev - 1, 1));
    const goToStep = (stepId: number) => setCurrentStep(stepId);

    // Pre-populate form from route state (passed from admission-list)
    useEffect(() => {
        const data = locationState?.studentData as Partial<StudentSearchResult> | null | undefined;
        const sessionId = locationState?.sessionId as string | undefined;

        if (sessionId) {
            setSelectedSessionId(sessionId);
        }
        if (data) {
            const nameParts = (data.studentName || '').split(' ');
            const firstName = nameParts[0] || '';
            const lastName = nameParts.length > 1 ? nameParts.slice(1).join(' ') : '';

            const parentName = data.parentName || '';
            const parentMobile = data.mobile || '';
            const parentEmail = data.email || '';
            const isMother = data.parentGender === 'mother';

            // Normalize DOB from ISO to YYYY-MM-DD for date input
            const dob = data.dob ? data.dob.split('T')[0] || '' : '';

            setFormData((prev) => ({
                ...prev,
                studentFirstName: firstName,
                studentLastName: lastName,
                gender: data.gender || '',
                studentClass: data.classVal || '',
                dateOfBirth: dob,
                residentialPhone: parentMobile,
                fatherName: isMother ? '' : parentName,
                fatherMobile: isMother ? '' : parentMobile,
                fatherEmail: isMother ? '' : parentEmail,
                motherName: isMother ? parentName : '',
                motherMobile: isMother ? parentMobile : '',
                motherEmail: isMother ? parentEmail : '',
                currentAddress: data.address || '',
                source: data.sourceType || '',
                sourceId: data.sourceId || '',
                destinationPackageSessionId: data.destinationPackageSessionId || '',
                sessionId: sessionId || '',
                enquiryId: data.enquiryId ?? null,
                applicationId: data.applicationId ?? null,
            }));
            if (data.enquiryTrackingId) {
                setSourceTrackingId(data.enquiryTrackingId);
                setSourceTrackingLabel(
                    data.sourceType === 'APPLICATION' ? 'Application Tracking ID' : 'Enquiry Tracking ID'
                );
            }
        } else if (sessionId) {
            setFormData((prev) => ({ ...prev, sessionId }));
        }
    }, []); // Run once on mount

    const handleSubmitAdmission = async () => {
        if (!instituteId) {
            toast.error('Institute details not available. Please try again.');
            return;
        }

        if (!formData.destinationPackageSessionId) {
            toast.error('Please select a package session before submitting admission.');
            setCurrentStep(1);
            return;
        }

        setIsSubmitting(true);
        try {
            const instituteId = instituteDetails?.id || '';

            // Resolve session_id from the selected package session if not already set
            let sessionId = formData.sessionId;
            if (!sessionId && formData.destinationPackageSessionId) {
                const match = instituteDetails?.batches_for_sessions?.find(
                    (b) => b.id === formData.destinationPackageSessionId
                );
                if (match) sessionId = match.session.id;
            }

            const normalizedSource = (formData.source || '').toUpperCase();
            const resolvedSource = normalizedSource === 'LEVEL' ? 'LEVEL' : 'INSTITUTE';
            const resolvedSourceId =
                resolvedSource === 'LEVEL'
                    ? formData.sourceId ||
                      formData.studentClass ||
                      formData.destinationPackageSessionId ||
                      ''
                    : instituteId;

            const payload: Record<string, any> = {
                institute_id: instituteId,
                source: resolvedSource,
                source_id: resolvedSourceId,
                session_id: sessionId || '',
                destination_package_session_id: formData.destinationPackageSessionId || '',
                enquiry_id: formData.enquiryId || null,
                application_id: formData.applicationId || null,
                first_name: formData.studentFirstName || '',
                last_name: formData.studentLastName || '',
                gender: formData.gender || '',
                class_applying_for:
                    formData.destinationPackageSessionId || formData.studentClass || '',
                section: formData.section || '',
                admission_no: formData.applicationNumber || '',
                date_of_admission: formData.dateOfAdmission || '',
                has_transport: formData.transport === 'Yes',
                student_type: formData.studentType || '',
                class_group: formData.classGroup || '',
                date_of_birth: formData.dateOfBirth || '',
                mobile_number: formData.residentialPhone || '',
                admission_type: formData.admissionType || '',
                student_aadhaar: formData.aadhaarNumber || '',
                previous_school_name: formData.schoolName || '',
                previous_class: formData.previousClass || '',
                previous_board: formData.board || '',
                year_of_passing: formData.yearOfPassing || '',
                previous_percentage: formData.percentage || '',
                previous_admission_no: formData.previousAdmissionNo || '',
                religion: formData.religion || '',
                caste: formData.caste || '',
                mother_tongue: formData.motherTongue || '',
                blood_group: formData.bloodGroup || '',
                nationality: formData.nationality || '',
                how_did_you_know: formData.howDidYouKnow || '',
                father_name: formData.fatherName || '',
                father_mobile: formData.fatherMobile || '',
                father_email: formData.fatherEmail || '',
                father_aadhaar: formData.fatherAadhaar || '',
                father_qualification: formData.fatherQualification || '',
                father_occupation: formData.fatherOccupation || '',
                mother_name: formData.motherName || '',
                mother_mobile: formData.motherMobile || '',
                mother_email: formData.motherEmail || '',
                mother_aadhaar: formData.motherAadhaar || '',
                mother_qualification: formData.motherQualification || '',
                mother_occupation: formData.motherOccupation || '',
                guardian_name: formData.guardianName || '',
                guardian_mobile: formData.guardianMobile || '',
                current_address: formData.currentAddress || '',
                current_locality: formData.currentLocality || '',
                current_pin_code: formData.currentPinCode || '',
                permanent_address: formData.permanentAddress || '',
                permanent_locality: formData.permanentLocality || '',
                custom_field_values: {},
            };

            const response = await authenticatedAxiosInstance.post(
                `${BASE_URL}/admin-core-service/v1/admission/submit`,
                payload
            );

            if (response.status >= 200 && response.status < 300) {
                const data = response.data as AdmissionSubmitResult;
                setAdmissionSubmitResult(data);
                setAdmissionTrackingId(data.tracking_id || null);
                toast.success(`Admission submitted successfully! ID: ${admissionId}`);
                setCurrentStep(6);
            } else {
                toast.error('Failed to submit admission form. Please try again.');
                toast.error('Failed to submit admission form. Please try again.');
            }
        } catch (error) {
            console.error('Error submitting form:', error);
            toast.error('An error occurred. Please check your network and try again.');
            toast.error('An error occurred. Please check your network and try again.');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="flex h-full flex-col rounded-lg bg-gray-50/50 p-6 font-sans">
            <div className="mb-6 flex items-center justify-between">
                <h1 className="flex items-center gap-3 text-2xl font-bold text-gray-800">
                    <button
                        onClick={() => navigate({ to: '/admissions/admission-list' })}
                        className="rounded-md p-1 transition-colors hover:bg-gray-200"
                        title="Back to Admission List"
                    >
                        <svg
                            className="h-5 w-5 text-gray-600"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                        >
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth="2"
                                d="M10 19l-7-7m0 0l7-7m-7 7h18"
                            ></path>
                        </svg>
                    </button>
                    Admission Form
                </h1>
                <div className="flex items-center gap-2">
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
                </div>
            </div>

            {/* Stepper Tabs */}
            <div className="hide-scrollbar mb-8 w-full overflow-x-auto rounded-t-lg border-b border-gray-200 bg-white shadow-sm">
                <div className="flex w-max min-w-full">
                    {STEPS.map((step) => {
                        const isActive = currentStep === step.id;
                        const isCompleted = currentStep > step.id;
                        return (
                            <button
                                key={step.id}
                                onClick={() => goToStep(step.id)}
                                className={`flex-1 whitespace-nowrap border-b-2 px-6 py-4 text-center text-sm font-medium transition-colors
                                ${
                                    isActive
                                        ? 'border-primary text-primary bg-primary/5'
                                        : isCompleted
                                          ? 'border-primary/50 text-gray-700 hover:bg-gray-50'
                                          : 'border-transparent text-gray-400 hover:bg-gray-50 hover:text-gray-600'
                                }`}
                            >
                                <span
                                    className={`mr-2 inline-flex h-6 w-6 items-center justify-center rounded-full text-xs
                                    ${
                                        isActive
                                            ? 'bg-primary text-white'
                                            : isCompleted
                                              ? 'bg-primary/20 text-primary'
                                              : 'bg-gray-100 text-gray-500'
                                    }`}
                                >
                                    {isCompleted ? '✓' : step.id}
                                </span>
                                {step.title}
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Step Content */}
            <div className="flex-1 overflow-y-auto rounded-lg border border-gray-100 bg-white p-6 shadow-sm">
                {currentStep === 1 && (
                    <Step1StudentDetails
                        formData={formData}
                        handleChange={handleChange}
                        packageSessionOptions={packageSessionOptions}
                        allBatches={allBatches}
                        onFormDataUpdate={handleFormDataUpdate}
                    />
                )}
                {currentStep === 2 && (
                    <Step2PreviousSchool formData={formData} handleChange={handleChange} />
                )}
                {currentStep === 3 && (
                    <Step3ParentDetails formData={formData} handleChange={handleChange} />
                )}
                {currentStep === 4 && (
                    <Step4AddressDetails formData={formData} handleChange={handleChange} />
                )}
                {currentStep === 5 && (
                    <Step6Finish
                        formData={formData}
                        handleChange={handleChange}
                        admissionId={admissionId}
                    />
                )}
                {currentStep === 6 && (
                    <Step5AFeeAssignment
                        formData={formData}
                        admissionResult={admissionSubmitResult}
                        packageSessionId={formData.destinationPackageSessionId}
                        instituteId={instituteId}
                    />
                )}
            </div>

            {/* Footer Navigation - hidden on Fee Assignment step */}
            {currentStep !== 6 && (
                <div className="mt-6 flex justify-between rounded-lg border border-gray-100 bg-white p-4 shadow-sm">
                    <MyButton
                        onClick={prevStep}
                        disabled={currentStep === 1}
                        className="rounded-lg border border-gray-300 px-6 py-2.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-50"
                    >
                        Previous
                    </MyButton>

                    {currentStep === 5 ? (
                        <MyButton
                            onClick={handleSubmitAdmission}
                            disabled={isSubmitting}
                            className={`rounded-lg px-6 py-2.5 text-sm font-medium text-white shadow-sm transition-colors ${
                                isSubmitting
                                    ? 'cursor-not-allowed bg-green-400'
                                    : 'bg-green-600 hover:bg-green-700'
                            }`}
                        >
                            {isSubmitting ? 'Submitting...' : 'Submit Admission'}
                        </MyButton>
                    ) : (
                        <MyButton onClick={nextStep}>Save & Next</MyButton>
                    )}
                </div>
            )}

            {/* Hidden print/PDF template rendered off-screen */}
            <div style={{ position: 'absolute', left: '-9999px', top: 0 }}>
                <div ref={printTemplateRef}>
                    <AdmissionFormPrintTemplate
                        ref={targetRef}
                        formData={formData}
                        instituteName={instituteName}
                        instituteLogo={logoBase64}
                        trackingLabel={admissionTrackingId ? 'Admission Tracking ID' : sourceTrackingLabel}
                        trackingId={admissionTrackingId || sourceTrackingId || ''}
                    />
                </div>
            </div>
        </div>
    );
}
