import React, { useState, useEffect, useMemo } from 'react';
import Step1StudentDetails from './steps/Step1StudentDetails';
import Step2PreviousSchool from './steps/Step2PreviousSchool';
import Step3ParentDetails from './steps/Step3ParentDetails';
import Step4AddressDetails from './steps/Step4AddressDetails';
import Step5AFeeAssignment from './steps/Step5AFeeAssignment';
import Step6Finish from './steps/Step6Finish';
import AdmissionEntryScreen, { StudentSearchResult } from './AdmissionEntryScreen';
import { useInstituteDetailsStore } from '@/stores/students/students-list/useInstituteDetailsStore';
import authenticatedAxiosInstance from '@/lib/auth/axiosInstance';
import { BASE_URL } from '@/constants/urls';
import { toast } from 'sonner';

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
    const [wizardStarted, setWizardStarted] = useState(false);
    const [currentStep, setCurrentStep] = useState(1);
    const [admissionId, setAdmissionId] = useState('');
    const { instituteDetails } = useInstituteDetailsStore();
    const instituteId = instituteDetails?.id || '';
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [selectedSessionId, setSelectedSessionId] = useState('');
    const packageSessionOptions = useMemo(() => {
        if (!instituteDetails?.batches_for_sessions) return [];
        return instituteDetails.batches_for_sessions
            .filter((batch) => !selectedSessionId || batch.session.id === selectedSessionId)
            .map((batch) => ({
                id: batch.id,
                label: `${batch.package_dto.package_name} - ${batch.level.level_name}`,
                sessionId: batch.session.id,
            }));
    }, [instituteDetails, selectedSessionId]);

    const [formData, setFormData] = useState<AdmissionFormData>({
        sessionId: '', destinationPackageSessionId: '', source: '', sourceId: '', enquiryId: null, applicationId: null,

        studentFirstName: '', studentMiddleName: '', studentLastName: '',
        gender: '', applicationNumber: '', studentClass: '', section: '',
        classGroup: '', dateOfAdmission: '', dateOfBirth: '',
        residentialPhone: '', studentType: '', admissionType: '',
        transport: 'No', aadhaarType: '', aadhaarNumber: '',

        schoolName: '', previousClass: '', board: '', yearOfPassing: '',
        percentage: '', percentageScience: '', percentageMaths: '', previousAdmissionNo: '',
        religion: '', caste: '', motherTongue: '', bloodGroup: '', nationality: '', howDidYouKnow: '',

        fatherName: '', fatherMobile: '', fatherEmail: '', fatherAadhaar: '', fatherQualification: '', fatherOccupation: '',
        motherName: '', motherMobile: '', motherEmail: '', motherAadhaar: '', motherQualification: '', motherOccupation: '',
        guardianName: '', guardianMobile: '',

        currentAddress: '', currentLocality: '', currentPinCode: '', sameAsPermanent: false, permanentAddress: '', permanentLocality: '',
        documentsUploaded: false, sendSms: true, sendEmail: true
    });

    useEffect(() => {
        const newId = `VAC-ADM-2026-${Math.floor(10000 + Math.random() * 90000)}`;
        setAdmissionId(newId);
    }, []);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        const { name, value, type } = e.target;
        if (type === 'checkbox') {
            const checked = (e.target as HTMLInputElement).checked;
            setFormData(prev => ({ ...prev, [name]: checked }));
            if (name === 'sameAsPermanent') {
                if (checked) {
                    setFormData(prev => ({
                        ...prev,
                        permanentAddress: prev.currentAddress,
                        permanentLocality: prev.currentLocality
                    }));
                }
            }
        } else {
            setFormData(prev => ({ ...prev, [name]: value }));
        }
    };

    const handleFormDataUpdate = (updates: Partial<AdmissionFormData>) => {
        setFormData(prev => ({ ...prev, ...updates }));
    };

    const nextStep = () => setCurrentStep(prev => Math.min(prev + 1, STEPS.length));
    const prevStep = () => setCurrentStep(prev => Math.max(prev - 1, 1));
    const goToStep = (stepId: number) => setCurrentStep(stepId);

    const handleStartAdmission = (data: Partial<StudentSearchResult> | null, sessionId?: string) => {
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

            setFormData(prev => ({
                ...prev,
                studentFirstName: firstName,
                studentLastName: lastName,
                gender: data.gender || '',
                studentClass: data.classVal || '',
                dateOfBirth: data.dob || '',
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
        } else if (sessionId) {
            setFormData(prev => ({ ...prev, sessionId }));
        }
        setWizardStarted(true);
    };

    const handleSubmitAdmission = async () => {
        if (!instituteId) {
            toast.error('Institute details not available. Please try again.');
            return;
        }

        setIsSubmitting(true);
        try {
            const instituteId = instituteDetails?.id || '';

            // Resolve session_id from the selected package session if not already set
            let sessionId = formData.sessionId;
            if (!sessionId && formData.destinationPackageSessionId) {
                const match = instituteDetails?.batches_for_sessions?.find(
                    b => b.id === formData.destinationPackageSessionId
                );
                if (match) sessionId = match.session.id;
            }

            const payload: Record<string, any> = {
                institute_id: instituteId,
                source: formData.source || 'INSTITUTE',
                source_id: formData.sourceId || instituteId,
                session_id: sessionId || '',
                destination_package_session_id: formData.destinationPackageSessionId || '',
                enquiry_id: formData.enquiryId || null,
                application_id: formData.applicationId || null,
                first_name: formData.studentFirstName || '',
                last_name: formData.studentLastName || '',
                gender: formData.gender ? formData.gender.toUpperCase() : '',
                class_applying_for: formData.destinationPackageSessionId || formData.studentClass || '',
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
                toast.success(`Admission submitted successfully! ID: ${admissionId}`);
                setWizardStarted(false);
                setCurrentStep(1);
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

    if (!wizardStarted) {
        return <AdmissionEntryScreen onStartAdmission={handleStartAdmission} />;
    }

    return (
        <div className="flex h-full flex-col bg-gray-50/50 p-6 rounded-lg font-sans">
            <div className="mb-6 flex flex-col gap-2">
                <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-3">
                    <button onClick={() => setWizardStarted(false)} className="p-1 rounded-md hover:bg-gray-200 transition-colors" title="Back to Search">
                        <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"></path>
                        </svg>
                    </button>
                    Admission Form
                </h1>
            </div>

            {/* Stepper Tabs */}
            <div className="mb-8 w-full overflow-x-auto border-b border-gray-200 hide-scrollbar rounded-t-lg bg-white shadow-sm">
                <div className="flex w-max min-w-full">
                    {STEPS.map((step) => {
                        const isActive = currentStep === step.id;
                        const isCompleted = currentStep > step.id;
                        return (
                            <button
                                key={step.id}
                                onClick={() => goToStep(step.id)}
                                className={`flex-1 border-b-2 px-6 py-4 text-center text-sm font-medium whitespace-nowrap transition-colors
                                ${isActive ? 'border-primary text-primary bg-primary/5'
                                : isCompleted ? 'border-primary/50 text-gray-700 hover:bg-gray-50'
                                : 'border-transparent text-gray-400 hover:text-gray-600 hover:bg-gray-50'}`}
                            >
                                <span className={`mr-2 inline-flex h-6 w-6 items-center justify-center rounded-full text-xs
                                    ${isActive ? 'bg-primary text-white'
                                    : isCompleted ? 'bg-primary/20 text-primary'
                                    : 'bg-gray-100 text-gray-500'}`}
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
            <div className="flex-1 overflow-y-auto rounded-lg bg-white p-6 shadow-sm border border-gray-100">
                {currentStep === 1 && (
                    <Step1StudentDetails
                        formData={formData}
                        handleChange={handleChange}
                        packageSessionOptions={packageSessionOptions}
                        onFormDataUpdate={handleFormDataUpdate}
                    />
                )}
                {currentStep === 2 && <Step2PreviousSchool formData={formData} handleChange={handleChange} />}
                {currentStep === 3 && <Step3ParentDetails formData={formData} handleChange={handleChange} />}
                {currentStep === 4 && <Step4AddressDetails formData={formData} handleChange={handleChange} />}
                {currentStep === 5 && <Step6Finish formData={formData} handleChange={handleChange} admissionId={admissionId} />}
                {currentStep === 6 && <Step5AFeeAssignment formData={formData} handleChange={handleChange} />}
            </div>

            {/* Footer Navigation */}
            <div className="mt-6 flex justify-between rounded-lg bg-white p-4 shadow-sm border border-gray-100">
                <button
                    onClick={prevStep}
                    disabled={currentStep === 1}
                    className="px-6 py-2.5 rounded-lg border border-gray-300 text-sm font-medium text-gray-700 disabled:opacity-50 hover:bg-gray-50 transition-colors"
                >
                    Previous
                </button>

                {currentStep === 5 ? (
                    <button
                        onClick={handleSubmitAdmission}
                        disabled={isSubmitting}
                        className={`px-6 py-2.5 rounded-lg text-white text-sm font-medium shadow-sm transition-colors ${
                            isSubmitting ? 'bg-green-400 cursor-not-allowed' : 'bg-green-600 hover:bg-green-700'
                        }`}
                    >
                        {isSubmitting ? 'Submitting...' : 'Submit Admission'}
                    </button>
                ) : (
                    <button
                        onClick={nextStep}
                        className="px-6 py-2.5 rounded-lg bg-primary text-white text-sm font-medium hover:bg-primary/90 transition-colors shadow-sm"
                    >
                        Save & Next
                    </button>
                )}
            </div>
        </div>
    );
}
