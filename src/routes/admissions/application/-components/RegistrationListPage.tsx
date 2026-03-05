import { useState, useEffect } from 'react';
import { useNavHeadingStore } from '@/stores/layout-container/useNavHeadingStore';
import { Helmet } from 'react-helmet';
import { MyButton } from '@/components/design-system/button';
import {
    MagnifyingGlass,
    Plus,
    CaretRight,
    X,
    FileText,
    UserPlus,
    CreditCard,
} from '@phosphor-icons/react';
import { useInstituteDetailsStore } from '@/stores/students/students-list/useInstituteDetailsStore';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { ScheduleTestFilters } from '@/routes/evaluation/evaluations/-components/ScheduleTestFilters';
import { MyFilterOption } from '@/types/assessments/my-filter';
import {
    fetchApplicantList,
    fetchEnquiryDetails,
    fetchApplicationStages,
    generatePaymentLink,
    type Applicant,
} from '../../-services/applicant-services';
import { useQuery } from '@tanstack/react-query';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { CopySimple } from 'phosphor-react';

export function RegistrationListPage() {
    const { setNavHeading } = useNavHeadingStore();
    const [searchQuery, setSearchQuery] = useState('');
    const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');
    const { getAllSessions, instituteDetails } = useInstituteDetailsStore();
    const sessions = getAllSessions();
    const [selectedSessionId, setSelectedSessionId] = useState<string>(sessions[0]?.id ?? '');
    const instituteId = instituteDetails?.id || '';

    const [selectedPackageSessions, setSelectedPackageSessions] = useState<MyFilterOption[]>([]);
    const [selectedStatuses, setSelectedStatuses] = useState<MyFilterOption[]>([]);
    const [pageNo, setPageNo] = useState(0);
    const pageSize = 10;

    // Modal states
    const [showRegistrationTypeModal, setShowRegistrationTypeModal] = useState(false);
    const [showEnquiryModal, setShowEnquiryModal] = useState(false);
    const [enquiryTrackingId, setEnquiryTrackingId] = useState('');
    const [enquiryPhone, setEnquiryPhone] = useState('');
    const [isLoadingEnquiry, setIsLoadingEnquiry] = useState(false);

    // Detail sheet states
    const [showDetailSheet, setShowDetailSheet] = useState(false);
    const [selectedApplicant, setSelectedApplicant] = useState<Applicant | null>(null);
    const [paymentLink, setPaymentLink] = useState<string>('');
    const [isLoadingPayment, setIsLoadingPayment] = useState(false);

    // Debounce search query
    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedSearchQuery(searchQuery);
        }, 500);

        return () => clearTimeout(timer);
    }, [searchQuery]);

    // Prepare package session options for filter
    const packageSessionOptions: MyFilterOption[] =
        instituteDetails?.batches_for_sessions?.map((batch) => ({
            id: batch.id,
            name: `${batch.package_dto.package_name} - ${batch.level.level_name}`,
        })) || [];

    // Status options for filter
    const statusOptions: MyFilterOption[] = [
        { id: 'PENDING', name: 'Pending' },
        { id: 'COMPLETED', name: 'Completed' },
        { id: 'REJECTED', name: 'Rejected' },
        { id: 'ADMITTED', name: 'Admitted' },
    ];

    // Fetch applicants with filters
    const { data: applicantsData, isLoading } = useQuery({
        queryKey: [
            'applicants',
            instituteId,
            selectedPackageSessions.map((s) => s.id),
            selectedStatuses.map((s) => s.id),
            selectedStatuses.length,
            selectedPackageSessions.length,
            debouncedSearchQuery,
            pageNo,
            pageSize,
        ],
        queryFn: () =>
            fetchApplicantList(
                {
                    institute_id: instituteId,
                    package_session_ids:
                        selectedPackageSessions.length > 0
                            ? selectedPackageSessions.map((s) => s.id)
                            : undefined,
                    overall_statuses:
                        selectedStatuses.length > 0 ? selectedStatuses.map((s) => s.id) : undefined,
                    search: debouncedSearchQuery || '',
                },
                pageNo,
                pageSize
            ),
        enabled: !!instituteId,
    });

    const applicants = applicantsData?.content || [];
    const totalElements = applicantsData?.totalElements || 0;
    const totalPages = applicantsData?.totalPages || 0;

    useEffect(() => {
        setNavHeading(
            <div className="flex items-center gap-2">
                <span className="text-lg font-semibold">Application Management</span>
                <span className="rounded-full bg-neutral-200 px-2 py-0.5 text-xs font-medium text-neutral-600">
                    {totalElements}
                </span>
            </div>
        );
    }, [setNavHeading, totalElements]);

    const handleNewRegistration = () => {
        setShowRegistrationTypeModal(true);
    };

    const handleNewApplication = () => {
        setShowRegistrationTypeModal(false);
        if (selectedSessionId) {
            window.location.href = `/admissions/application/new?sessionId=${selectedSessionId}`;
        } else {
            window.location.href = '/admissions/application/new';
        }
    };

    const handleFromEnquiry = () => {
        setShowRegistrationTypeModal(false);
        setShowEnquiryModal(true);
    };

    const handleFetchEnquiry = async () => {
        if (!enquiryTrackingId.trim() && !enquiryPhone.trim()) {
            alert('Please enter either enquiry tracking ID or phone number');
            return;
        }

        setIsLoadingEnquiry(true);
        try {
            const searchParam = enquiryTrackingId.trim() || enquiryPhone.trim();
            const enquiryData = await fetchEnquiryDetails(searchParam);
            console.log('Enquiry data:', enquiryData);

            // Check if already applied
            if (enquiryData.already_applied) {
                alert('This enquiry has already been converted to an application.');
                setIsLoadingEnquiry(false);
                return;
            }

            // Navigate to registration form with enquiry data
            const encodedData = encodeURIComponent(JSON.stringify(enquiryData));
            if (selectedSessionId) {
                window.location.href = `/admissions/application/new?sessionId=${selectedSessionId}&enquiryData=${encodedData}`;
            } else {
                window.location.href = `/admissions/application/new?enquiryData=${encodedData}`;
            }
        } catch (error) {
            console.error('Error fetching enquiry:', error);
            alert('Failed to fetch enquiry details. Please check the tracking ID.');
            setIsLoadingEnquiry(false);
        }
    };

    const handleViewDetails = async (applicant: Applicant) => {
        setSelectedApplicant(applicant);
        setShowDetailSheet(true);
        setPaymentLink('');

        // Automatically generate payment link
        setIsLoadingPayment(true);
        try {
            const stages = await fetchApplicationStages(
                instituteId,
                'INSTITUTE',
                instituteId.toString()
            );

            const paymentStage = stages.find((stage) => stage.type === 'PAYMENT');
            if (paymentStage) {
                const paymentConfig = JSON.parse(paymentStage.config_json);
                const paymentOptionId = paymentConfig.payment_option_id;
                const link = generatePaymentLink(
                    instituteId,
                    applicant.applicant_id,
                    paymentOptionId
                );
                setPaymentLink(link);
            }
        } catch (error) {
            console.error('Error generating payment link:', error);
        } finally {
            setIsLoadingPayment(false);
        }
    };

    return (
        <div className="flex h-full flex-col">
            <Helmet>
                <title>Registrations - Admissions</title>
            </Helmet>

            <div className="mb-6 flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <div className="relative">
                        <MagnifyingGlass className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
                        <input
                            type="text"
                            placeholder="Search by tracking ID, name..."
                            className="h-8 w-64 rounded-md border border-neutral-300 pl-10 pr-4 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>

                    <ScheduleTestFilters
                        label="Class"
                        data={packageSessionOptions}
                        selectedItems={selectedPackageSessions}
                        onSelectionChange={setSelectedPackageSessions}
                    />

                    <ScheduleTestFilters
                        label="Status"
                        data={statusOptions}
                        selectedItems={selectedStatuses}
                        onSelectionChange={setSelectedStatuses}
                    />
                </div>

                <div className="flex items-center gap-3">
                    <Select
                        value={selectedSessionId}
                        onValueChange={setSelectedSessionId}
                        defaultValue={sessions[0]?.id}
                    >
                        <SelectTrigger className="h-10 w-[100px]">
                            <SelectValue placeholder="Select Session" />
                        </SelectTrigger>
                        <SelectContent>
                            {sessions.map((session) => (
                                <SelectItem key={session.id} value={session.id}>
                                    {session.session_name}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>

                    <MyButton
                        buttonType="primary"
                        onClick={handleNewRegistration}
                        disabled={!selectedSessionId}
                    >
                        <Plus className="mr-2 size-4" />
                        Add New
                    </MyButton>
                </div>
            </div>

            <div className="overflow-hidden rounded-lg border border-neutral-200 bg-white shadow-sm">
                {isLoading ? (
                    <div className="flex items-center justify-center p-12">
                        <div className="text-neutral-500">Loading applications...</div>
                    </div>
                ) : applicants.length === 0 ? (
                    <div className="flex items-center justify-center p-12">
                        <div className="text-center">
                            <p className="text-neutral-500">No applications found</p>
                            <p className="text-sm text-neutral-400">Try adjusting your filters</p>
                        </div>
                    </div>
                ) : (
                    <table className="w-full text-left text-sm text-neutral-600">
                        <thead className="bg-neutral-50 text-xs font-semibold uppercase text-neutral-500">
                            <tr>
                                <th className="px-6 py-3">Tracking ID</th>
                                <th className="px-6 py-3">Student Name</th>
                                <th className="px-6 py-3">Class</th>
                                <th className="px-6 py-3">Parent Name</th>
                                <th className="px-6 py-3">Mobile</th>
                                <th className="px-6 py-3">Date</th>
                                <th className="px-6 py-3">Status</th>
                                <th className="px-6 py-3 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-neutral-200">
                            {applicants.map((applicant) => (
                                <tr
                                    key={applicant.applicant_id}
                                    className="cursor-pointer hover:bg-neutral-50"
                                    onClick={() => handleViewDetails(applicant)}
                                >
                                    <td className="whitespace-nowrap px-6 py-4 font-medium text-primary-600">
                                        {applicant.tracking_id}
                                    </td>
                                    <td className="whitespace-nowrap px-6 py-4 text-neutral-900">
                                        {applicant.student_data?.full_name}
                                    </td>
                                    <td className="whitespace-nowrap px-6 py-4">
                                        {applicant.package_session?.level_name}
                                    </td>
                                    <td className="whitespace-nowrap px-6 py-4">
                                        {applicant.parent_data?.full_name}
                                    </td>
                                    <td className="whitespace-nowrap px-6 py-4">
                                        {applicant.parent_data?.mobile_number}
                                    </td>
                                    <td className="whitespace-nowrap px-6 py-4">
                                        {new Date(applicant.created_at).toLocaleDateString()}
                                    </td>
                                    <td className="whitespace-nowrap px-6 py-4">
                                        <span
                                            className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium
                                            ${
                                                applicant.overall_status === 'SUBMITTED'
                                                    ? 'bg-blue-100 text-blue-800'
                                                    : applicant.overall_status === 'ADMITTED' ||
                                                        applicant.overall_status === 'APPROVED'
                                                      ? 'bg-green-100 text-green-800'
                                                      : applicant.overall_status === 'PENDING'
                                                        ? 'bg-orange-100 text-orange-800'
                                                        : applicant.overall_status === 'REJECTED'
                                                          ? 'bg-red-100 text-red-800'
                                                          : 'bg-neutral-100 text-neutral-800'
                                            }`}
                                        >
                                            {applicant.overall_status}
                                        </span>
                                    </td>
                                    <td className="whitespace-nowrap px-6 py-4 text-right">
                                        <button className="text-neutral-400 hover:text-primary-600">
                                            <CaretRight className="size-5" />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>

            <div className="mt-4 flex items-center justify-between text-xs text-neutral-500">
                <span>
                    Showing {pageNo * pageSize + 1} to{' '}
                    {Math.min((pageNo + 1) * pageSize, totalElements)} of {totalElements} entries
                </span>
                <div className="flex gap-2">
                    <button
                        className="rounded border border-neutral-300 px-2 py-1 disabled:opacity-50"
                        disabled={pageNo === 0}
                        onClick={() => setPageNo((p) => Math.max(0, p - 1))}
                    >
                        Previous
                    </button>
                    <button
                        className="rounded border border-neutral-300 px-2 py-1 disabled:opacity-50"
                        disabled={pageNo >= totalPages - 1}
                        onClick={() => setPageNo((p) => Math.min(totalPages - 1, p + 1))}
                    >
                        Next
                    </button>
                </div>
            </div>

            {/* Registration Type Selection Modal */}
            {showRegistrationTypeModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
                    <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
                        <div className="mb-4 flex items-center justify-between">
                            <h2 className="text-lg font-semibold text-neutral-900">
                                Choose Application Type
                            </h2>
                            <button
                                onClick={() => setShowRegistrationTypeModal(false)}
                                className="text-neutral-400 hover:text-neutral-600"
                            >
                                <X className="size-5" />
                            </button>
                        </div>

                        <p className="mb-6 text-sm text-neutral-600">
                            Select how you would like to create a new application
                        </p>

                        <div className="space-y-3">
                            <button
                                onClick={handleNewApplication}
                                className="flex w-full items-center gap-4 rounded-lg border border-neutral-200 p-4 text-left transition-all hover:border-primary-500 hover:bg-primary-50"
                            >
                                <div className="flex size-12 items-center justify-center rounded-full bg-primary-100">
                                    <UserPlus className="size-6 text-primary-600" />
                                </div>
                                <div>
                                    <h3 className="font-medium text-neutral-900">
                                        New Application
                                    </h3>
                                    <p className="text-sm text-neutral-600">
                                        Start a fresh application form
                                    </p>
                                </div>
                            </button>

                            <button
                                onClick={handleFromEnquiry}
                                className="flex w-full items-center gap-4 rounded-lg border border-neutral-200 p-4 text-left transition-all hover:border-primary-500 hover:bg-primary-50"
                            >
                                <div className="flex size-12 items-center justify-center rounded-full bg-blue-100">
                                    <FileText className="size-6 text-blue-600" />
                                </div>
                                <div>
                                    <h3 className="font-medium text-neutral-900">From Enquiry</h3>
                                    <p className="text-sm text-neutral-600">
                                        Create application from existing enquiry
                                    </p>
                                </div>
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Enquiry Tracking ID Modal */}
            {showEnquiryModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
                    <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
                        <div className="mb-4 flex items-center justify-between">
                            <h2 className="text-lg font-semibold text-neutral-900">
                                Enter Enquiry Details
                            </h2>
                            <button
                                onClick={() => {
                                    setShowEnquiryModal(false);
                                    setEnquiryTrackingId('');
                                    setEnquiryPhone('');
                                }}
                                className="text-neutral-400 hover:text-neutral-600"
                            >
                                <X className="size-5" />
                            </button>
                        </div>

                        <div className="space-y-4">
                            <div>
                                <Label htmlFor="enquiryTrackingId">Enquiry Tracking ID</Label>
                                <Input
                                    id="enquiryTrackingId"
                                    type="text"
                                    placeholder="e.g., A9KQ2"
                                    value={enquiryTrackingId}
                                    onChange={(e) => setEnquiryTrackingId(e.target.value)}
                                    className="mt-1"
                                />
                            </div>

                            <div className="flex items-center gap-3">
                                <div className="h-px flex-1 bg-neutral-200"></div>
                                <span className="text-xs text-neutral-500">OR</span>
                                <div className="h-px flex-1 bg-neutral-200"></div>
                            </div>

                            <div>
                                <Label htmlFor="enquiryPhone">Phone Number</Label>
                                <Input
                                    id="enquiryPhone"
                                    type="tel"
                                    placeholder="e.g., 9876543210"
                                    value={enquiryPhone}
                                    onChange={(e) => setEnquiryPhone(e.target.value)}
                                    className="mt-1"
                                />
                            </div>

                            <p className="text-xs text-neutral-500">
                                Enter either the tracking ID or phone number of the enquiry you want
                                to convert to a registration
                            </p>

                            <div className="flex gap-3">
                                <MyButton
                                    buttonType="secondary"
                                    onClick={() => {
                                        setShowEnquiryModal(false);
                                        setEnquiryTrackingId('');
                                        setEnquiryPhone('');
                                    }}
                                    className="flex-1"
                                >
                                    Cancel
                                </MyButton>
                                <MyButton
                                    buttonType="primary"
                                    onClick={handleFetchEnquiry}
                                    disabled={
                                        isLoadingEnquiry ||
                                        (!enquiryTrackingId.trim() && !enquiryPhone.trim())
                                    }
                                    className="flex-1"
                                >
                                    {isLoadingEnquiry ? 'Loading...' : 'Continue'}
                                </MyButton>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Applicant Detail Sheet */}
            {showDetailSheet && selectedApplicant && (
                <div className="fixed inset-0 z-50 flex items-center justify-end bg-black/50">
                    <div className="size-full max-w-xl overflow-y-auto bg-white shadow-xl">
                        {/* Header */}
                        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-neutral-200 bg-white px-6 py-4">
                            <div>
                                <h2 className="text-lg font-semibold text-neutral-900">
                                    Application Details
                                </h2>
                                <p className="text-sm text-neutral-600">
                                    Tracking ID: {selectedApplicant.tracking_id}
                                </p>
                            </div>
                            <button
                                onClick={() => {
                                    setShowDetailSheet(false);
                                    setSelectedApplicant(null);
                                    setPaymentLink('');
                                }}
                                className="text-neutral-400 hover:text-neutral-600"
                            >
                                <X className="size-6" />
                            </button>
                        </div>

                        {/* Content */}
                        <div className="space-y-6 p-6">
                            {/* Status Badge */}
                            <div className="flex items-center gap-3">
                                Overall Status:
                                <span
                                    className={`inline-flex items-center rounded-full px-3 py-1 text-sm font-medium
                                    ${
                                        selectedApplicant.overall_status === 'SUBMITTED'
                                            ? 'bg-blue-100 text-blue-800'
                                            : selectedApplicant.overall_status === 'ADMITTED' ||
                                                selectedApplicant.overall_status === 'APPROVED'
                                              ? 'bg-green-100 text-green-800'
                                              : selectedApplicant.overall_status === 'PENDING'
                                                ? 'bg-orange-100 text-orange-800'
                                                : selectedApplicant.overall_status === 'REJECTED'
                                                  ? 'bg-red-100 text-red-800'
                                                  : 'bg-neutral-100 text-neutral-800'
                                    }`}
                                >
                                    {selectedApplicant.overall_status}
                                </span>
                            </div>

                            {/* Student Information */}
                            <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-4">
                                <h3 className="mb-3 font-semibold text-neutral-900">
                                    Student Information
                                </h3>
                                <div className="grid grid-cols-2 gap-4 text-sm">
                                    <div>
                                        <p className="text-neutral-500">Full Name</p>
                                        <p className="font-medium text-neutral-900">
                                            {selectedApplicant.student_data?.full_name || 'N/A'}
                                        </p>
                                    </div>
                                    <div>
                                        <p className="text-neutral-500">Date of Birth</p>
                                        <p className="font-medium text-neutral-900">
                                            {selectedApplicant.student_data?.date_of_birth
                                                ? new Date(
                                                      selectedApplicant.student_data.date_of_birth
                                                  ).toLocaleDateString()
                                                : 'N/A'}
                                        </p>
                                    </div>
                                    <div>
                                        <p className="text-neutral-500">Gender</p>
                                        <p className="font-medium text-neutral-900">
                                            {selectedApplicant.student_data?.gender || 'N/A'}
                                        </p>
                                    </div>
                                    <div>
                                        <p className="text-neutral-500">Class Applied For</p>
                                        <p className="font-medium text-neutral-900">
                                            {selectedApplicant.package_session?.level_name || 'N/A'}
                                        </p>
                                    </div>
                                </div>
                            </div>

                            {/* Parent Information */}
                            <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-4">
                                <h3 className="mb-3 font-semibold text-neutral-900">
                                    Parent Information
                                </h3>
                                <div className="grid grid-cols-2 gap-4 text-sm">
                                    <div>
                                        <p className="text-neutral-500">Full Name</p>
                                        <p className="font-medium text-neutral-900">
                                            {selectedApplicant.parent_data?.full_name || 'N/A'}
                                        </p>
                                    </div>
                                    <div>
                                        <p className="text-neutral-500">Mobile Number</p>
                                        <p className="font-medium text-neutral-900">
                                            {selectedApplicant.parent_data?.mobile_number || 'N/A'}
                                        </p>
                                    </div>
                                    <div>
                                        <p className="text-neutral-500">Email</p>
                                        <p className="font-medium text-neutral-900">
                                            {selectedApplicant.parent_data?.email || 'N/A'}
                                        </p>
                                    </div>
                                </div>
                            </div>

                            {/* Application Stage & Timeline */}
                            <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-4">
                                <h3 className="mb-3 font-semibold text-neutral-900">
                                    Application Stage & Timeline
                                </h3>
                                <div className="space-y-3 text-sm">
                                    <div className="flex justify-between">
                                        <span className="text-neutral-500">Current Stage</span>
                                        <span className="font-medium text-neutral-900">
                                            {selectedApplicant.application_stage?.stage_name ||
                                                'N/A'}
                                        </span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-neutral-500">Stage Status</span>
                                        <span
                                            className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium
                                            ${
                                                selectedApplicant.application_stage_status ===
                                                'COMPLETED'
                                                    ? 'bg-green-100 text-green-800'
                                                    : selectedApplicant.application_stage_status ===
                                                        'INITIATED'
                                                      ? 'bg-blue-100 text-blue-800'
                                                      : selectedApplicant.application_stage_status ===
                                                          'IN_PROGRESS'
                                                        ? 'bg-yellow-100 text-yellow-800'
                                                        : 'bg-neutral-100 text-neutral-800'
                                            }`}
                                        >
                                            {selectedApplicant.application_stage_status || 'N/A'}
                                        </span>
                                    </div>
                                    <div className="h-px bg-neutral-200"></div>
                                    <div className="flex justify-between">
                                        <span className="text-neutral-500">Created At</span>
                                        <span className="font-medium text-neutral-900">
                                            {new Date(
                                                selectedApplicant.created_at
                                            ).toLocaleString()}
                                        </span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-neutral-500">Last Updated</span>
                                        <span className="font-medium text-neutral-900">
                                            {new Date(
                                                selectedApplicant.updated_at
                                            ).toLocaleString()}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {/* Payment Section */}
                            <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-4">
                                <h3 className="mb-3 font-semibold text-neutral-900">
                                    Payment Information
                                </h3>

                                {isLoadingPayment ? (
                                    <div className="flex items-center gap-2 text-sm text-neutral-600">
                                        <div className="size-4 animate-spin rounded-full border-2 border-primary-600 border-t-transparent"></div>
                                        <span>Generating payment link...</span>
                                    </div>
                                ) : paymentLink ? (
                                    <div className="space-y-3">
                                        <div className="rounded-lg  p-3">
                                            <MyButton
                                                onClick={() => {
                                                    navigator.clipboard.writeText(paymentLink);
                                                }}
                                            >
                                                <CopySimple className="size-4" />
                                                Copy Link
                                            </MyButton>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-3">
                                        <p className="text-sm text-yellow-800">
                                            Payment configuration not available
                                        </p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
