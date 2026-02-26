import React, { useState, useEffect } from 'react';
import Step1StudentDetails from './steps/Step1StudentDetails';
import Step2PreviousSchool from './steps/Step2PreviousSchool';
import Step3ParentDetails from './steps/Step3ParentDetails';
import Step4AddressDetails from './steps/Step4AddressDetails';
import Step5AFeeAssignment from './steps/Step5AFeeAssignment';
import Step6Finish from './steps/Step6Finish';
import AdmissionEntryScreen, { StudentSearchResult } from './AdmissionEntryScreen';
import { Button } from '@/components/ui/button'; // Assuming button exists, if not I will use simple html buttons or flowbite

export interface AdmissionFormData {
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
    sameAsPermanent: boolean;
    permanentAddress: string;
    permanentLocality: string;

    // Step 5 (Documents - just flag if toggled for now)
    documentsUploaded: boolean;

    // Step 6 (Finish options)
    sendSms: boolean;
    sendEmail: boolean;
}

const STEPS = [
    { id: 1, title: 'Student Details' },
    { id: 2, title: 'Previous School & Other Details' },
    { id: 3, title: 'Student Parent Details' },
    { id: 4, title: 'Address Details' },
    { id: 5, title: 'Fee Assignment' },
    { id: 6, title: 'Finish' },
];

export default function AdmissionFormWizard() {
    const [wizardStarted, setWizardStarted] = useState(false);
    const [currentStep, setCurrentStep] = useState(1);
    const [admissionId, setAdmissionId] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const [formData, setFormData] = useState<AdmissionFormData>({
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

        currentAddress: '', currentLocality: '', sameAsPermanent: false, permanentAddress: '', permanentLocality: '',
        documentsUploaded: false, sendSms: true, sendEmail: true
    });

    useEffect(() => {
        // Generate UNIQUE ADMISSION ID when form starts
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

    const nextStep = () => setCurrentStep(prev => Math.min(prev + 1, STEPS.length));
    const prevStep = () => setCurrentStep(prev => Math.max(prev - 1, 1));
    const goToStep = (stepId: number) => setCurrentStep(stepId);

    const handleStartAdmission = (data: Partial<StudentSearchResult> | null) => {
        if (data) {
            setFormData(prev => ({
                ...prev,
                studentFirstName: data.studentName || '',
                gender: data.gender || '',
                studentClass: data.classVal || '',
                dateOfBirth: data.dob || '',
                residentialPhone: data.mobile || '',
                fatherName: data.parentName || '', // assuming father for now
                fatherMobile: data.mobile || '',
                fatherEmail: data.email || '',
                currentAddress: data.address || ''
            }));
        }
        setWizardStarted(true);
    };

    const handleSubmitAdmission = async () => {
        setIsSubmitting(true);
        try {
            const payload = {
                institute_id: "4983ac8a-4527-496d-89f0-79c6bc25f753",
                source: "INSTITUTE",
                source_id: "4983ac8a-4527-496d-89f0-79c6bc25f753",
                first_name: formData.studentFirstName || "Default",
                last_name: formData.studentLastName || "",
                gender: formData.gender ? formData.gender.toUpperCase() : "MALE",
                date_of_birth: formData.dateOfBirth || "2000-01-01",
                class_applying_for: formData.studentClass || "Class 1",
                admission_type: formData.admissionType || "NEW",
                father_name: formData.fatherName || "",
                father_mobile: formData.fatherMobile || "",
                father_email: formData.fatherEmail || "",
                mother_name: formData.motherName || "",
                mother_mobile: formData.motherMobile || "",
                mother_email: formData.motherEmail || "",
                current_address: formData.currentAddress || "",
                current_locality: formData.currentLocality || "",
                current_pin_code: "110001",
                blood_group: formData.bloodGroup || "B+",
                nationality: formData.nationality || "Indian"
            };

            const response = await fetch('https://backend-stage.vacademy.io/admin-core-service/v1/admission/submit', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(payload)
            });

            if (response.ok) {
                alert(`Admission Form Submitted Successfully! Admission ID: ${admissionId}`);
                // Simple reset back to entry screen upon success
                setWizardStarted(false);
                setCurrentStep(1);
            } else {
                alert('Failed to submit admission form. Please try again.');
            }
        } catch (error) {
            console.error('Error submitting form:', error);
            alert('An error occurred. Please check your network and try again.');
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
                <p className="text-sm text-gray-500 pl-8">Admission ID: <span className="font-semibold text-primary">{admissionId}</span></p>
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
                {currentStep === 1 && <Step1StudentDetails formData={formData} handleChange={handleChange} />}
                {currentStep === 2 && <Step2PreviousSchool formData={formData} handleChange={handleChange} />}
                {currentStep === 3 && <Step3ParentDetails formData={formData} handleChange={handleChange} />}
                {currentStep === 4 && <Step4AddressDetails formData={formData} handleChange={handleChange} />}
                {currentStep === 5 && <Step5AFeeAssignment formData={formData} handleChange={handleChange} />}
                {currentStep === 6 && <Step6Finish formData={formData} handleChange={handleChange} admissionId={admissionId} />}
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

                {currentStep < STEPS.length ? (
                    <button
                        onClick={nextStep}
                        className="px-6 py-2.5 rounded-lg bg-primary text-white text-sm font-medium hover:bg-primary/90 transition-colors shadow-sm"
                    >
                        Save & Next
                    </button>
                ) : (
                    <button
                        onClick={handleSubmitAdmission}
                        disabled={isSubmitting}
                        className={`px-6 py-2.5 rounded-lg text-white text-sm font-medium shadow-sm transition-colors ${
                            isSubmitting ? 'bg-green-400 cursor-not-allowed' : 'bg-green-600 hover:bg-green-700'
                        }`}
                    >
                        {isSubmitting ? 'Submitting...' : 'Submit Admission'}
                    </button>
                )}
            </div>
        </div>
    );
}
