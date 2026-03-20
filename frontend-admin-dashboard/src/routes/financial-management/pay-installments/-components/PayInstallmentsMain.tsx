import { useState } from 'react';
import { StudentFeePaymentRowDTO } from '@/types/manage-finances';
import { StudentSearchStep } from './StudentSearchStep';
import { InstallmentSelectionStep } from './InstallmentSelectionStep';
import { PaymentSuccessStep } from './PaymentSuccessStep';

type WizardStep = 'search' | 'select' | 'success';

export function PayInstallmentsMain() {
    const [step, setStep] = useState<WizardStep>('search');
    const [selectedStudent, setSelectedStudent] = useState<StudentFeePaymentRowDTO | null>(null);
    const [paidAmount, setPaidAmount] = useState<number>(0);

    const handleSelectStudent = (student: StudentFeePaymentRowDTO) => {
        setSelectedStudent(student);
        setStep('select');
    };

    const handlePaymentSuccess = (amount: number) => {
        setPaidAmount(amount);
        setStep('success');
    };

    const handleReset = () => {
        setSelectedStudent(null);
        setPaidAmount(0);
        setStep('search');
    };

    return (
        <div className="space-y-6">
            {/* Step Indicator */}
            <div className="flex items-center gap-3 text-sm font-medium">
                <span
                    className={`flex items-center gap-1.5 ${step === 'search' ? 'text-blue-600' : 'text-gray-400'}`}
                >
                    <span
                        className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${
                            step === 'search'
                                ? 'bg-blue-600 text-white'
                                : 'bg-emerald-500 text-white'
                        }`}
                    >
                        {step === 'search' ? '1' : '\u2713'}
                    </span>
                    Search Student
                </span>
                <span className="h-px w-8 bg-gray-200" />
                <span
                    className={`flex items-center gap-1.5 ${
                        step === 'select'
                            ? 'text-blue-600'
                            : step === 'success'
                              ? 'text-gray-400'
                              : 'text-gray-300'
                    }`}
                >
                    <span
                        className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${
                            step === 'select'
                                ? 'bg-blue-600 text-white'
                                : step === 'success'
                                  ? 'bg-emerald-500 text-white'
                                  : 'bg-gray-200 text-gray-400'
                        }`}
                    >
                        {step === 'success' ? '\u2713' : '2'}
                    </span>
                    Select & Pay
                </span>
                <span className="h-px w-8 bg-gray-200" />
                <span
                    className={`flex items-center gap-1.5 ${step === 'success' ? 'text-blue-600' : 'text-gray-300'}`}
                >
                    <span
                        className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${
                            step === 'success'
                                ? 'bg-blue-600 text-white'
                                : 'bg-gray-200 text-gray-400'
                        }`}
                    >
                        3
                    </span>
                    Done
                </span>
            </div>

            {/* Step Content */}
            {step === 'search' && <StudentSearchStep onSelectStudent={handleSelectStudent} />}
            {step === 'select' && selectedStudent && (
                <InstallmentSelectionStep
                    student={selectedStudent}
                    onBack={handleReset}
                    onSuccess={handlePaymentSuccess}
                />
            )}
            {step === 'success' && selectedStudent && (
                <PaymentSuccessStep
                    studentName={selectedStudent.student_name}
                    amount={paidAmount}
                    onPayAnother={handleReset}
                />
            )}
        </div>
    );
}
