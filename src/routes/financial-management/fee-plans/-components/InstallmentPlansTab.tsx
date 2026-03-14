// @ts-nocheck
import React, { useState, useMemo } from 'react';
import { useInstituteDetailsStore } from '@/stores/students/students-list/useInstituteDetailsStore';
import { useCPOFullDetails, useCreateCPO, useInstituteCPOList } from '../-services/cpo-service';
import type { CPOPackage, CPOFeeType } from '../-types/cpo-types';
import CreateCPODialog from './CreateCPODialog';
import { buildCreateCPOPayload } from './CreateCPODialog';

// ─── Sub-components ─────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
    const isActive = status === 'ACTIVE';
    return (
        <span
            className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${
                isActive
                    ? 'border-green-200 bg-green-50 text-green-700'
                    : 'border-yellow-200 bg-yellow-50 text-yellow-700'
            }`}
        >
            <span
                className={`h-1.5 w-1.5 rounded-full ${isActive ? 'bg-green-500' : 'bg-yellow-500'}`}
            />
            {status}
        </span>
    );
}

function FeeTypeCard({
    feeType,
    isExpanded,
    onToggle,
    isLoadingInstallments = false,
}: {
    feeType: CPOFeeType;
    isExpanded: boolean;
    onToggle: () => void;
    isLoadingInstallments?: boolean;
}) {
    const assigned_fee_value = feeType.assigned_fee_value ?? {
        amount: 0,
        no_of_installments: 0,
        has_installment: false,
        is_refundable: false,
        has_penalty: false,
        penalty_percentage: null,
        installments: [],
        status: 'ACTIVE',
    };
    const installments = assigned_fee_value.installments ?? [];
    const hasInstallments = assigned_fee_value.has_installment && installments.length > 0;

    return (
        <div className="overflow-hidden rounded-lg border border-gray-200">
            {/* Fee Type Header */}
            <div
                onClick={onToggle}
                className="flex cursor-pointer items-center justify-between bg-gray-50 px-4 py-3 transition-colors hover:bg-gray-100"
            >
                <div className="flex items-center gap-3">
                    <div>
                        <div className="text-sm font-semibold text-gray-900">{feeType.name}</div>
                        <div className="mt-0.5 text-xs text-gray-500">
                            {feeType.code} · {feeType.description}
                        </div>
                    </div>
                </div>
                <div className="flex items-center gap-4">
                    <div className="text-right">
                        <div className="text-sm font-bold text-gray-800">
                            ₹{assigned_fee_value.amount.toLocaleString('en-IN')}
                        </div>
                        <div className="text-xs text-gray-500">
                            {assigned_fee_value.no_of_installments} installment
                            {assigned_fee_value.no_of_installments !== 1 ? 's' : ''}
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        {assigned_fee_value.is_refundable && (
                            <span className="rounded-md border border-blue-100 bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-600">
                                Refundable
                            </span>
                        )}
                        {assigned_fee_value.has_penalty && (
                            <span className="rounded-md border border-red-100 bg-red-50 px-2 py-0.5 text-xs font-medium text-red-600">
                                Penalty {assigned_fee_value.penalty_percentage}%
                            </span>
                        )}
                    </div>
                    <svg
                        className={`h-4 w-4 text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                    >
                        <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth="2"
                            d="M19 9l-7 7-7-7"
                        />
                    </svg>
                </div>
            </div>

            {/* Installment Details */}
            {isExpanded && isLoadingInstallments && (
                <div className="px-4 py-3 text-sm text-gray-500">Loading installments...</div>
            )}

            {isExpanded && !isLoadingInstallments && hasInstallments && (
                <div className="px-4 py-3">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b border-gray-100">
                                <th className="px-2 py-2 text-left text-xs font-semibold uppercase text-gray-500">
                                    #
                                </th>
                                <th className="px-2 py-2 text-left text-xs font-semibold uppercase text-gray-500">
                                    Amount
                                </th>
                                <th className="px-2 py-2 text-left text-xs font-semibold uppercase text-gray-500">
                                    Start Date
                                </th>
                                <th className="px-2 py-2 text-left text-xs font-semibold uppercase text-gray-500">
                                    End Date
                                </th>
                                <th className="px-2 py-2 text-left text-xs font-semibold uppercase text-gray-500">
                                    Due Date
                                </th>
                                <th className="px-2 py-2 text-left text-xs font-semibold uppercase text-gray-500">
                                    Status
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            {installments.map((inst) => (
                                <tr key={inst.id} className="border-b border-gray-50">
                                    <td className="px-2 py-2 font-medium text-gray-500">
                                        {inst.installment_number}
                                    </td>
                                    <td className="px-2 py-2 font-semibold text-gray-800">
                                        ₹{inst.amount.toLocaleString('en-IN')}
                                    </td>
                                    <td className="px-2 py-2 text-gray-600">
                                        {inst.start_date
                                            ? new Date(inst.start_date).toLocaleDateString(
                                                  'en-IN',
                                                  {
                                                      day: '2-digit',
                                                      month: 'short',
                                                      year: 'numeric',
                                                  }
                                              )
                                            : '-'}
                                    </td>
                                    <td className="px-2 py-2 text-gray-600">
                                        {inst.end_date
                                            ? new Date(inst.end_date).toLocaleDateString('en-IN', {
                                                  day: '2-digit',
                                                  month: 'short',
                                                  year: 'numeric',
                                              })
                                            : '-'}
                                    </td>
                                    <td className="px-2 py-2 text-gray-600">
                                        {new Date(inst.due_date).toLocaleDateString('en-IN', {
                                            day: '2-digit',
                                            month: 'short',
                                            year: 'numeric',
                                        })}
                                    </td>
                                    <td className="px-2 py-2">
                                        <span
                                            className={`rounded px-2 py-0.5 text-xs font-medium ${
                                                inst.status === 'PAID'
                                                    ? 'bg-green-50 text-green-700'
                                                    : inst.status === 'PENDING'
                                                      ? 'bg-amber-50 text-amber-700'
                                                      : 'bg-gray-50 text-gray-600'
                                            }`}
                                        >
                                            {inst.status}
                                        </span>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                        <tfoot>
                            <tr className="bg-gray-50">
                                <td className="px-2 py-2 font-bold text-gray-700">Total</td>
                                <td className="px-2 py-2 font-bold text-gray-800">
                                    ₹
                                    {installments
                                        .reduce((sum, i) => sum + i.amount, 0)
                                        .toLocaleString('en-IN')}
                                </td>
                                <td colSpan={4} />
                            </tr>
                        </tfoot>
                    </table>
                </div>
            )}

            {isExpanded && !isLoadingInstallments && !hasInstallments && (
                <div className="px-4 py-3 text-sm text-gray-500">
                    No installment schedule — one-time payment of ₹
                    {assigned_fee_value.amount.toLocaleString('en-IN')}
                </div>
            )}
        </div>
    );
}

function PackageCard({ pkg }: { pkg: CPOPackage }) {
    const [expandedFeeTypes, setExpandedFeeTypes] = useState<Set<string>>(new Set());
    const shouldFetchFullDetails = expandedFeeTypes.size > 0;

    const {
        data: fullCPO,
        isLoading: isLoadingFullCPO,
        isFetching: isFetchingFullCPO,
    } = useCPOFullDetails(pkg.id, shouldFetchFullDetails);

    const feeTypesForRender = fullCPO?.fee_types?.length ? fullCPO.fee_types : pkg.fee_types ?? [];

    const totalAmount = feeTypesForRender.reduce(
        (sum, ft) => sum + (ft.assigned_fee_value?.amount ?? 0),
        0
    );

    const toggleFeeType = (id: string) => {
        setExpandedFeeTypes((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    return (
        <div className="overflow-hidden rounded-xl border border-gray-200 shadow-sm transition-all hover:shadow-md">
            {/* Package Header */}
            <div className="flex items-center justify-between bg-white px-5 py-4">
                <div>
                    <div className="flex items-center gap-3">
                        <h3 className="text-base font-bold text-gray-900">{pkg.name}</h3>
                        <StatusBadge status={pkg.status} />
                    </div>
                    <div className="mt-1.5 flex items-center gap-4 text-sm text-gray-500">
                        <span>
                            <span className="font-semibold text-gray-700">
                                ₹{totalAmount.toLocaleString('en-IN')}
                            </span>{' '}
                            total
                        </span>
                        <span>·</span>
                        <span>
                            {feeTypesForRender.length} fee type
                            {feeTypesForRender.length !== 1 ? 's' : ''}
                        </span>
                    </div>
                </div>
            </div>

            {/* Fee Types List */}
            <div className="flex flex-col gap-2 px-5 pb-4">
                {feeTypesForRender.map((ft) => (
                    <FeeTypeCard
                        key={ft.id}
                        feeType={ft}
                        isExpanded={expandedFeeTypes.has(ft.id)}
                        onToggle={() => toggleFeeType(ft.id)}
                        isLoadingInstallments={
                            expandedFeeTypes.has(ft.id) && (isLoadingFullCPO || isFetchingFullCPO)
                        }
                    />
                ))}
            </div>
        </div>
    );
}

// ─── Main Component ─────────────────────────────────────────────────────────────

export default function InstallmentPlansTab() {
    const [selectedPackageSessionId, setSelectedPackageSessionId] = useState<string | null>(null);
    const [showCreateDialog, setShowCreateDialog] = useState(false);

    // Get batches (classes) from institute store
    const instituteDetails = useInstituteDetailsStore((s) => s.instituteDetails);
    const batches = useMemo(() => {
        return instituteDetails?.batches_for_sessions ?? [];
    }, [instituteDetails]);

    // Build dropdown options from batches
    const batchOptions = useMemo(() => {
        return batches.map((batch) => ({
            id: batch.id,
            label: `${batch.package_dto.package_name} – ${batch.level.level_name} (${batch.session.session_name})`,
        }));
    }, [batches]);

    // Fetch ALL CPOs for the institute (paginated)
    const { data: cpoListResponse, isLoading, isError, error } = useInstituteCPOList(0, 500);

    // Filter by selected session via package_session_links
    const cpoPackages: CPOPackage[] = useMemo(() => {
        const all = (cpoListResponse?.content ?? []).map((pkg) => ({
            ...pkg,
            fee_types: (pkg.fee_types ?? []).map((ft) => ({
                ...ft,
                assigned_fee_value: {
                    ...(ft.assigned_fee_value ?? {}),
                    installments: ft.assigned_fee_value?.installments ?? [],
                },
            })),
            package_session_links: pkg.package_session_links ?? [],
        }));
        if (!selectedPackageSessionId) return all;
        return all.filter((pkg) =>
            pkg.package_session_links?.some(
                (link) => link.package_session_id === selectedPackageSessionId
            )
        );
    }, [cpoListResponse, selectedPackageSessionId]);

    // Create CPO mutation
    const createCPOMutation = useCreateCPO();

    const handleCreateSave = (formData: Parameters<typeof buildCreateCPOPayload>[0]) => {
        const payload = buildCreateCPOPayload(formData);
        createCPOMutation.mutate(payload, {
            onSuccess: () => {
                setShowCreateDialog(false);
            },
        });
    };

    return (
        <div className="flex flex-col gap-5 duration-300 animate-in fade-in">
            {/* ─── Page Header with session filter ─────────────────────────────── */}
            <div className="flex flex-wrap items-center justify-between gap-4">
                {/* Title */}
                <div>
                    <h1 className="text-xl font-bold text-gray-900">Fee Plan</h1>
                    <p className="mt-1 text-sm text-gray-500">
                        Manage fee plans with fee types and installment schedules.
                    </p>
                </div>

                {/* Session filter + Create button */}
                <div className="flex items-center gap-3">
                    {/* Batch / Session selector */}
                    <div className="min-w-[260px]">
                        <select
                            value={selectedPackageSessionId ?? ''}
                            onChange={(e) => {
                                setSelectedPackageSessionId(e.target.value || null);
                            }}
                            className="w-full cursor-pointer rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-primary-500 focus:ring-1 focus:ring-primary-200"
                        >
                            <option value="">All Sessions</option>
                            {batchOptions.map((opt) => (
                                <option key={opt.id} value={opt.id}>
                                    {opt.label}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Create Package button */}
                    <button
                        onClick={() => setShowCreateDialog(true)}
                        className="flex cursor-pointer items-center gap-2 rounded-lg bg-gradient-to-r from-primary-400 to-primary-500 px-5 py-2 text-sm font-semibold text-white shadow-md transition hover:opacity-90"
                    >
                        <svg
                            className="h-4 w-4"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                        >
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth="2"
                                d="M12 4v16m8-8H4"
                            />
                        </svg>
                        Create Plan
                    </button>
                </div>
            </div>

            {/* ─── Loading ──────────────────────────────────────────────────────── */}
            {isLoading && (
                <div className="flex items-center justify-center py-16">
                    <div className="flex items-center gap-3 text-gray-500">
                        <svg
                            className="h-5 w-5 animate-spin text-primary-500"
                            fill="none"
                            viewBox="0 0 24 24"
                        >
                            <circle
                                className="opacity-25"
                                cx="12"
                                cy="12"
                                r="10"
                                stroke="currentColor"
                                strokeWidth="4"
                            />
                            <path
                                className="opacity-75"
                                fill="currentColor"
                                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                            />
                        </svg>
                        <span className="text-sm font-medium">Loading fee plans...</span>
                    </div>
                </div>
            )}

            {/* ─── Error ────────────────────────────────────────────────────────── */}
            {isError && (
                <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                    Failed to load fee plan.{' '}
                    {error instanceof Error ? error.message : 'Please try again.'}
                </div>
            )}

            {/* ─── Stats ────────────────────────────────────────────────────────── */}
            {!isLoading && cpoPackages.length > 0 && (
                <div className="grid grid-cols-3 gap-4">
                    <div className="rounded-xl border border-primary-100 bg-gradient-to-br from-primary-100 to-primary-200 p-4">
                        <div className="text-xs font-bold uppercase tracking-wide text-primary-500">
                            Total Packages
                        </div>
                        <div className="mt-1 text-2xl font-extrabold text-primary-500">
                            {cpoPackages.length}
                        </div>
                    </div>
                    <div className="rounded-xl border border-emerald-100 bg-gradient-to-br from-emerald-50 to-green-50 p-4">
                        <div className="text-xs font-bold uppercase tracking-wide text-emerald-500">
                            Total Fee Types
                        </div>
                        <div className="mt-1 text-2xl font-extrabold text-emerald-700">
                            {cpoPackages.reduce((sum, p) => sum + (p.fee_types?.length ?? 0), 0)}
                        </div>
                    </div>
                    <div className="rounded-xl border border-amber-100 bg-gradient-to-br from-amber-50 to-yellow-50 p-4">
                        <div className="text-xs font-bold uppercase tracking-wide text-amber-500">
                            Active Packages
                        </div>
                        <div className="mt-1 text-2xl font-extrabold text-amber-700">
                            {cpoPackages.filter((p) => p.status === 'ACTIVE').length}
                        </div>
                    </div>
                </div>
            )}

            {/* ─── Empty state ──────────────────────────────────────────────────── */}
            {!isLoading && !isError && cpoPackages.length === 0 && (
                <div className="py-16 text-center text-gray-400">
                    <svg
                        className="mx-auto mb-3 h-12 w-12 text-gray-300"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                    >
                        <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth="1.5"
                            d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
                        />
                    </svg>
                    <p className="font-medium text-gray-500">No fee plan found.</p>
                    <p className="mt-1 text-sm">
                        Click <strong>Create Plan</strong> to add the first one.
                    </p>
                </div>
            )}

            {/* ─── Package cards ─────────────────────────────────────────────────── */}
            {cpoPackages.length > 0 && (
                <div className="flex flex-col gap-4">
                    {cpoPackages.map((pkg) => (
                        <PackageCard key={pkg.id} pkg={pkg} />
                    ))}
                </div>
            )}

            {cpoPackages.length > 0 && (
                <div className="text-right text-xs text-gray-400">
                    Showing {cpoPackages.length} package{cpoPackages.length !== 1 ? 's' : ''}
                </div>
            )}

            {/* ─── Create CPO Dialog ─────────────────────────────────────────────── */}
            {showCreateDialog && (
                <CreateCPODialog
                    batchOptions={batchOptions}
                    defaultPackageSessionId={selectedPackageSessionId ?? undefined}
                    isSaving={createCPOMutation.isPending}
                    onSave={handleCreateSave}
                    onClose={() => setShowCreateDialog(false)}
                />
            )}
        </div>
    );
}
