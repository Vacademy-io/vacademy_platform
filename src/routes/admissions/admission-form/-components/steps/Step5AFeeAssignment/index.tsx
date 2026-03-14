import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { useCPOOptions } from '@/routes/financial-management/fee-plans/-services/cpo-service';
import type {
    CPOInstallment,
    CPOPackage,
} from '@/routes/financial-management/fee-plans/-types/cpo-types';
import { toast } from 'sonner';
import {
    fetchDefaultPaymentOptionId,
    schoolEnroll,
    type SchoolEnrollPayload,
} from '@/routes/admissions/-services/enrollment-services';
import type { AdmissionFormData } from '../../AdmissionFormWizard';
import { MyButton } from '@/components/design-system/button';

interface AdmissionSubmitResult {
    child_user_id?: string;
    parent_user_id?: string;
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
}

interface Props {
    formData: AdmissionFormData;
    admissionResult: AdmissionSubmitResult | null;
    packageSessionId: string;
    instituteId: string;
}

const formatCurrency = (value: number | undefined) => {
    if (!value && value !== 0) return '-';
    return `₹ ${value.toLocaleString('en-IN')}`;
};

const getInstallmentLabel = (installments?: CPOInstallment[]) => {
    if (!installments || installments.length === 0) return 'One-time payment';
    const count = installments.length;
    const firstDue = installments[0]?.due_date;
    return `${count} installment${count > 1 ? 's' : ''}${firstDue ? ` • starts ${new Date(firstDue).toLocaleDateString('en-IN')}` : ''}`;
};

const formatDate = (value?: string | null) => {
    if (!value) return '-';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return '-';
    return d.toLocaleDateString('en-IN');
};

export default function Step5AFeeAssignment({
    formData,
    admissionResult,
    packageSessionId,
    instituteId,
}: Props) {
    const navigate = useNavigate();
    const {
        data: cpoOptions,
        isLoading,
        isError,
        refetch,
    } = useCPOOptions(packageSessionId || null);
    const [selectedCpoId, setSelectedCpoId] = useState<string | null>(null);
    const [isEnrolling, setIsEnrolling] = useState(false);
    const [defaultPaymentOptionId, setDefaultPaymentOptionId] = useState<string | null>(null);
    const [isDefaultLoading, setIsDefaultLoading] = useState(false);
    const [enrollSuccess, setEnrollSuccess] = useState<{
        cpoName: string;
        totalAmount: number;
        paymentOptionId: string;
        studentName?: string;
    } | null>(null);

    useEffect(() => {
        if (cpoOptions && cpoOptions.length > 0 && !selectedCpoId) {
            setSelectedCpoId(cpoOptions[0]?.id ?? null);
        }
    }, [cpoOptions, selectedCpoId]);

    useEffect(() => {
        const fetchDefaultPaymentOption = async () => {
            if (!instituteId) return;
            try {
                setIsDefaultLoading(true);
                const id = await fetchDefaultPaymentOptionId(instituteId);
                setDefaultPaymentOptionId(id);
            } catch (error) {
                console.error('Failed to fetch default payment option', error);
            } finally {
                setIsDefaultLoading(false);
            }
        };
        fetchDefaultPaymentOption();
    }, [instituteId]);

    const selectedCpo = useMemo(
        () => cpoOptions?.find((cpo) => cpo.id === selectedCpoId) || null,
        [cpoOptions, selectedCpoId]
    );

    const enrollInviteId = useMemo(() => {
        if (!selectedCpo) return null;
        const link = selectedCpo.package_session_links?.find(
            (l) => l.package_session_id === packageSessionId
        );
        return link?.enroll_invite_id || null;
    }, [selectedCpo, packageSessionId]);

    const totalAmount = useMemo(() => {
        if (!selectedCpo?.fee_types) return 0;
        return selectedCpo.fee_types.reduce(
            (sum, fee) => sum + (fee.assigned_fee_value?.amount ?? 0),
            0
        );
    }, [selectedCpo]);

    const handleEnroll = async () => {
        if (!packageSessionId) {
            toast.error('Package session is required to enroll.');
            return;
        }
        if (!selectedCpo) {
            toast.error('Select a fee plan to continue.');
            return;
        }
        const child = admissionResult?.child;
        const childUserId = child?.id || admissionResult?.child_user_id;
        if (!childUserId) {
            toast.error('Child user ID missing from admission response.');
            return;
        }

        const paymentOptionId = selectedCpo.default_payment_option_id ?? defaultPaymentOptionId;
        if (!paymentOptionId) {
            toast.error('Payment option is required. Set a default or update the CPO.');
            return;
        }

        const payload: SchoolEnrollPayload = {
            user: {
                id: childUserId,
                username: child?.email,
                email: child?.email,
                full_name: child?.full_name,
                mobile_number: child?.phone || formData.residentialPhone,
                date_of_birth: formData.dateOfBirth || undefined,
                gender: formData.gender || undefined,
            },
            institute_id: instituteId,
            package_session_id: packageSessionId,
            cpo_id: selectedCpo.id,
            payment_option_id: paymentOptionId,
            enroll_invite_id: enrollInviteId ?? null,
            school_payment: {
                payment_mode: 'OFFLINE',
                amount: 0,
                manual_payment: {
                    file_id: '',
                    transaction_id: '',
                },
            },
            start_date: formData.dateOfAdmission || new Date().toISOString(),
        };

        try {
            setIsEnrolling(true);
            await schoolEnroll(payload);
            toast.success('Student enrolled and fee plan assigned.');
            setEnrollSuccess({
                cpoName: selectedCpo.name,
                totalAmount,
                paymentOptionId,
                studentName: child?.full_name || child?.email,
            });
        } catch (error) {
            console.error('Enrollment failed', error);
            toast.error('Failed to enroll student. Please try again.');
        } finally {
            setIsEnrolling(false);
        }
    };

    if (!packageSessionId) {
        return (
            <div className="flex h-full flex-col items-center justify-center gap-2 text-center text-gray-600">
                <div className="flex size-10 items-center justify-center rounded-full bg-yellow-100 text-lg text-yellow-700">
                    !
                </div>
                <p className="text-sm font-medium">
                    Select a package session in Step 1 to view fee plans.
                </p>
            </div>
        );
    }

    if (enrollSuccess) {
        return (
            <div className="flex h-full flex-col items-center justify-center gap-4 rounded-lg border border-green-100 bg-green-50 p-8 text-center text-gray-800">
                <div className="flex size-12 items-center justify-center rounded-full bg-white text-xl font-semibold text-green-600">
                    ✓
                </div>
                <div>
                    <h3 className="text-lg font-semibold text-gray-900">Enrollment complete</h3>
                    <p className="mt-1 text-sm text-gray-600">
                        {enrollSuccess.studentName
                            ? `${enrollSuccess.studentName} has been enrolled with the selected fee plan.`
                            : 'Student has been enrolled with the selected fee plan.'}
                    </p>
                </div>
                <div className="flex flex-col gap-1 text-sm text-gray-700">
                    <span>Plan: {enrollSuccess.cpoName}</span>
                    <span>Total assigned: {formatCurrency(enrollSuccess.totalAmount)}</span>
                    <span>Payment mode: Offline</span>
                </div>
                <div className="flex gap-3">
                    <MyButton
                        onClick={() => navigate({ to: '/admissions/admission-form' })}
                        className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 shadow-sm transition hover:bg-gray-100"
                    >
                        Go to admission form
                    </MyButton>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6 duration-200 animate-in fade-in">
            <div className="flex items-start justify-between gap-4">
                <div>
                    <h2 className="text-lg font-semibold text-gray-900">Assign Fee Plan</h2>
                    <p className="text-sm text-gray-600">
                        Fetched from CPO linked to the selected package session.
                    </p>
                </div>
                <button
                    onClick={() => refetch()}
                    className="rounded border border-blue-200 px-3 py-1.5 text-sm font-medium text-blue-600 transition hover:border-blue-300 hover:text-blue-700"
                    disabled={isLoading}
                >
                    Refresh
                </button>
            </div>

            {(isLoading || isDefaultLoading) && (
                <div className="rounded-lg border border-gray-200 bg-white p-6 text-sm text-gray-600">
                    Loading fee plans...
                </div>
            )}

            {isError && (
                <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                    Failed to load CPO options. Please retry.
                </div>
            )}

            {!isLoading && !isError && cpoOptions && cpoOptions.length === 0 && (
                <div className="rounded-lg border border-gray-200 bg-white p-6 text-sm text-gray-600">
                    No fee plans found for this package session.
                </div>
            )}

            {!isLoading && !isError && cpoOptions && cpoOptions.length > 0 && (
                <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
                    <div className="space-y-3 lg:col-span-1">
                        {cpoOptions.map((cpo) => (
                            <button
                                key={cpo.id}
                                onClick={() => setSelectedCpoId(cpo.id)}
                                className={`w-full rounded-lg border bg-white p-4 text-left shadow-sm transition hover:border-blue-300 hover:shadow ${
                                    selectedCpoId === cpo.id
                                        ? 'border-blue-500 bg-blue-50 ring-1 ring-blue-200'
                                        : 'border-gray-200'
                                }`}
                            >
                                <div className="flex items-center justify-between">
                                    <div>
                                        <div className="text-sm font-semibold text-gray-900">
                                            {cpo.name}
                                        </div>
                                        <div className="mt-0.5 text-xs text-gray-500">
                                            Default payment option:{' '}
                                            {cpo.default_payment_option_id
                                                ? 'Available'
                                                : 'Not set'}
                                        </div>
                                    </div>
                                    <div className="text-sm font-semibold text-gray-800">
                                        {formatCurrency(
                                            cpo.fee_types?.reduce(
                                                (sum, fee) =>
                                                    sum + (fee.assigned_fee_value?.amount ?? 0),
                                                0
                                            )
                                        )}
                                    </div>
                                </div>
                            </button>
                        ))}
                    </div>

                    <div className="space-y-4 lg:col-span-2">
                        {selectedCpo ? (
                            <div className="overflow-hidden rounded-lg border bg-white shadow-sm">
                                <div className="flex items-center justify-between border-b px-5 py-4">
                                    <div>
                                        <div className="text-base font-semibold text-gray-900">
                                            {selectedCpo.name}
                                        </div>
                                        <div className="text-xs text-gray-500">
                                            {selectedCpo.package_session_links?.length
                                                ? 'Linked to current package session'
                                                : 'No session link found'}
                                        </div>
                                    </div>
                                    <div className="text-sm font-semibold text-blue-700">
                                        {formatCurrency(totalAmount)}
                                    </div>
                                </div>

                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm">
                                        <thead className="bg-gray-50 text-gray-600">
                                            <tr>
                                                <th className="px-4 py-3 text-left font-semibold">
                                                    Fee Type
                                                </th>
                                                <th className="px-4 py-3 text-left font-semibold">
                                                    Amount
                                                </th>
                                                <th className="px-4 py-3 text-left font-semibold">
                                                    Installments
                                                </th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-100">
                                            {selectedCpo.fee_types?.map((fee) => (
                                                <tr key={fee.id} className="hover:bg-gray-50">
                                                    <td className="px-4 py-3 font-medium text-gray-900">
                                                        {fee.name}
                                                    </td>
                                                    <td className="px-4 py-3 text-gray-800">
                                                        {formatCurrency(
                                                            fee.assigned_fee_value?.amount
                                                        )}
                                                    </td>
                                                    <td className="px-4 py-3 text-gray-600">
                                                        {getInstallmentLabel(
                                                            fee.assigned_fee_value?.installments
                                                        )}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>

                                <div className="space-y-3 border-t bg-gray-50 px-5 py-4">
                                    <div className="rounded-lg border border-gray-200 bg-white">
                                        <div className="border-b px-4 py-3 text-sm font-semibold text-gray-800">
                                            Installments
                                        </div>
                                        <div className="overflow-x-auto">
                                            <table className="w-full text-sm">
                                                <thead className="bg-gray-50 text-gray-600">
                                                    <tr>
                                                        <th className="px-4 py-2 text-left font-semibold">
                                                            Fee
                                                        </th>
                                                        <th className="px-4 py-2 text-left font-semibold">
                                                            #
                                                        </th>
                                                        <th className="px-4 py-2 text-left font-semibold">
                                                            Amount
                                                        </th>
                                                        <th className="px-4 py-2 text-left font-semibold">
                                                            Due
                                                        </th>
                                                        <th className="px-4 py-2 text-left font-semibold">
                                                            Start
                                                        </th>
                                                        <th className="px-4 py-2 text-left font-semibold">
                                                            End
                                                        </th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-gray-100">
                                                    {selectedCpo.fee_types?.flatMap((fee) =>
                                                        (
                                                            fee.assigned_fee_value?.installments ||
                                                            []
                                                        ).map((inst) => (
                                                            <tr
                                                                key={`${fee.id}-${inst.id || inst.installment_number}`}
                                                                className="hover:bg-gray-50"
                                                            >
                                                                <td className="px-4 py-2 font-medium text-gray-900">
                                                                    {fee.name}
                                                                </td>
                                                                <td className="px-4 py-2 text-gray-700">
                                                                    {inst.installment_number}
                                                                </td>
                                                                <td className="px-4 py-2 text-gray-800">
                                                                    {formatCurrency(inst.amount)}
                                                                </td>
                                                                <td className="px-4 py-2 text-gray-700">
                                                                    {formatDate(inst.due_date)}
                                                                </td>
                                                                <td className="px-4 py-2 text-gray-700">
                                                                    {formatDate(inst.start_date)}
                                                                </td>
                                                                <td className="px-4 py-2 text-gray-700">
                                                                    {formatDate(inst.end_date)}
                                                                </td>
                                                            </tr>
                                                        ))
                                                    )}
                                                    {selectedCpo.fee_types?.every(
                                                        (fee) =>
                                                            !fee.assigned_fee_value?.installments
                                                                ?.length
                                                    ) && (
                                                        <tr>
                                                            <td
                                                                colSpan={6}
                                                                className="px-4 py-3 text-center text-sm text-gray-600"
                                                            >
                                                                No installments configured.
                                                            </td>
                                                        </tr>
                                                    )}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>

                                    <div className="flex flex-wrap items-center justify-between gap-3">
                                        <div className="text-sm text-gray-700">
                                            Total: {formatCurrency(totalAmount)}
                                        </div>
                                        <MyButton
                                            onClick={handleEnroll}
                                            disabled={isEnrolling}
                                            className={`rounded-lg border px-4 py-2 text-sm font-semibold shadow-sm transition ${
                                                isEnrolling
                                                    ? 'cursor-not-allowed bg-blue-300/60 text-blue-100'
                                                    : 'border-blue-600 text-blue-600 hover:bg-blue-600 hover:text-white'
                                            }`}
                                        >
                                            {isEnrolling
                                                ? 'Enrolling...'
                                                : 'Enroll with this fee plan'}
                                        </MyButton>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="rounded-lg border border-dashed border-gray-300 bg-white p-6 text-sm text-gray-600">
                                Select a fee plan to view details.
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
