import { useState } from 'react';
import { StudentFeePaymentRowDTO, StudentFeeDueDTO } from '@/types/manage-finances';
import { AllocatePaymentResponse } from '@/services/manage-finances';
import { StudentSearchStep } from './StudentSearchStep';
import { InstallmentSelectionStep } from './InstallmentSelectionStep';
import { PaymentDetailsStep } from './PaymentDetailsStep';
import { PaymentSuccessStep } from './PaymentSuccessStep';

type WizardStep = 'search' | 'select' | 'payment' | 'success';

const STEPS: { key: WizardStep; label: string }[] = [
    { key: 'search', label: 'Search Student' },
    { key: 'select', label: 'Select Installments' },
    { key: 'payment', label: 'Payment Details' },
    { key: 'success', label: 'Done' },
];

export function PayInstallmentsMain() {
    const [step, setStep] = useState<WizardStep>('search');
    const [selectedStudent, setSelectedStudent] = useState<StudentFeePaymentRowDTO | null>(null);
    const [selectedDues, setSelectedDues] = useState<StudentFeeDueDTO[]>([]);
    const [paidAmount, setPaidAmount] = useState<number>(0);
    const [receipt, setReceipt] = useState<AllocatePaymentResponse | undefined>();

    const handleSelectStudent = (student: StudentFeePaymentRowDTO) => {
        setSelectedStudent(student);
        setStep('select');
    };

    const handleProceedToPayment = (dues: StudentFeeDueDTO[]) => {
        setSelectedDues(dues);
        setStep('payment');
    };

    const handlePaymentSuccess = (amount: number, receiptData?: AllocatePaymentResponse) => {
        setPaidAmount(amount);
        setReceipt(receiptData);
        setStep('success');
    };

    const handleBackToSelect = () => {
        setStep('select');
    };

    const handleReset = () => {
        setSelectedStudent(null);
        setSelectedDues([]);
        setPaidAmount(0);
        setReceipt(undefined);
        setStep('search');
    };

    const stepIndex = STEPS.findIndex((s) => s.key === step);

    return (
        <div className="flex flex-col gap-6 flex-1 min-h-0">
            {/* Step Indicator */}
            <div className="flex items-center gap-3 text-sm font-medium">
                {STEPS.map((s, idx) => (
                    <div key={s.key} className="flex items-center gap-3">
                        {idx > 0 && <span className="h-px w-8 bg-gray-200" />}
                        <span
                            className={`flex items-center gap-1.5 ${
                                idx === stepIndex
                                    ? 'text-blue-600'
                                    : idx < stepIndex
                                      ? 'text-gray-400'
                                      : 'text-gray-300'
                            }`}
                        >
                            <span
                                className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${
                                    idx === stepIndex
                                        ? 'bg-blue-600 text-white'
                                        : idx < stepIndex
                                          ? 'bg-emerald-500 text-white'
                                          : 'bg-gray-200 text-gray-400'
                                }`}
                            >
                                {idx < stepIndex ? '\u2713' : idx + 1}
                            </span>
                            {s.label}
                        </span>
                    </div>
                ))}
            </div>

            {/* Step Content */}
            {step === 'search' && <StudentSearchStep onSelectStudent={handleSelectStudent} />}
            {step === 'select' && selectedStudent && (
                <InstallmentSelectionStep
                    student={selectedStudent}
                    onBack={handleReset}
                    onProceedToPayment={handleProceedToPayment}
                />
            )}
            {step === 'payment' && selectedStudent && selectedDues.length > 0 && (
                <PaymentDetailsStep
                    student={selectedStudent}
                    selectedDues={selectedDues}
                    onBack={handleBackToSelect}
                    onSuccess={handlePaymentSuccess}
                />
            )}
            {step === 'success' && selectedStudent && (
                <PaymentSuccessStep
                    studentName={selectedStudent.student_name}
                    receipt={receipt}
                    onPayAnother={handleReset}
                />
            )}
        </div>
    );
}
