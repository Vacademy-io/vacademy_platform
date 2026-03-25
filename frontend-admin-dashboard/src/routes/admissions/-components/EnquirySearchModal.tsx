import React, { useState } from 'react';
import { X, MagnifyingGlass } from '@phosphor-icons/react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { MyButton } from '@/components/design-system/button';
import { searchEnquiriesByFilter } from '../-services/applicant-services';
import { toast } from 'sonner';
import { useInstituteDetailsStore } from '@/stores/students/students-list/useInstituteDetailsStore';

// overall_status values returned by the backend
type EnquiryStatus = 'ENQUIRY' | 'APPLICATION' | 'ADMISSION';

interface EnquirySearchModalProps {
    isOpen: boolean;
    onClose: () => void;
    // Pass only the callback(s) relevant to the context.
    // RegistrationListPage passes onSelectForApplication only.
    // AdmissionEntryScreen passes onSelectForAdmission only.
    // Passing both shows both action columns simultaneously.
    onSelectForApplication?: (enquiryIdOrTrackingId: string) => void;
    onSelectForAdmission?: (enquiryIdOrTrackingId: string) => void;
}

const STATUS_BADGE: Record<EnquiryStatus, { label: string; className: string }> = {
    ENQUIRY:     { label: 'Enquiry',     className: 'bg-orange-100 text-orange-800' },
    APPLICATION: { label: 'Applied',     className: 'bg-blue-100 text-blue-800' },
    ADMISSION:   { label: 'Admitted',    className: 'bg-green-100 text-green-800' },
};

export const EnquirySearchModal: React.FC<EnquirySearchModalProps> = ({
    isOpen,
    onClose,
    onSelectForApplication,
    onSelectForAdmission,
}) => {
    const [searchName, setSearchName] = useState('');
    const [searchPhone, setSearchPhone] = useState('');
    const [searchTrackingId, setSearchTrackingId] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [searchResults, setSearchResults] = useState<any[]>([]);
    const [hasSearched, setHasSearched] = useState(false);
    const { instituteDetails } = useInstituteDetailsStore();

    if (!isOpen) return null;

    const handleSearch = async () => {
        if (!searchName.trim() && !searchPhone.trim() && !searchTrackingId.trim()) {
            toast.warning('Please enter at least one search criteria');
            return;
        }

        setIsLoading(true);
        try {
            const results = await searchEnquiriesByFilter({
                instituteId: instituteDetails?.id || '',
                name: searchName.trim() || undefined,
                phone: searchPhone.trim() || undefined,
                enquiryTrackingId: searchTrackingId.trim() || undefined,
            });
            setSearchResults(results);
            setHasSearched(true);
        } catch (error) {
            console.error('Error searching enquiries:', error);
            toast.error('Failed to search enquiries. Please try again.');
        } finally {
            setIsLoading(false);
        }
    };

    const getIdToPass = (result: any) =>
        // Prefer tracking_id (short code); fall back to enquiry_id (UUID).
        // fetchEnquiryDetails auto-detects which param to use based on UUID regex.
        result.tracking_id || result.enquiry_id;

    const handleSelectForApplication = (result: any) => {
        onSelectForApplication?.(getIdToPass(result));
        onClose();
    };

    const handleSelectForAdmission = (result: any) => {
        onSelectForAdmission?.(getIdToPass(result));
        onClose();
    };

    const showApplicationCol = !!onSelectForApplication;
    const showAdmissionCol   = !!onSelectForAdmission;
    const colSpanEmpty = 4 + (showApplicationCol ? 1 : 0) + (showAdmissionCol ? 1 : 0);

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="w-full max-w-5xl rounded-lg bg-white p-6 shadow-xl flex flex-col max-h-[90vh]">
                <div className="mb-4 flex items-center justify-between">
                    <h2 className="text-xl font-semibold text-neutral-900">Search Enquiry</h2>
                    <button
                        onClick={onClose}
                        className="text-neutral-400 hover:text-neutral-600 transition-colors"
                    >
                        <X className="size-6" />
                    </button>
                </div>

                {/* Filters */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                    {/* filter by name */}
                    <div>
                        <Label htmlFor="searchName">Student / Parent Name</Label>
                        <Input
                            id="searchName"
                            type="text"
                            placeholder="e.g., John Doe"
                            value={searchName}
                            onChange={(e) => setSearchName(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                            className="mt-1"
                        />
                    </div>
                    {/* filter by phone number */}
                    <div>
                        <Label htmlFor="searchPhone">Phone Number</Label>
                        <Input
                            id="searchPhone"
                            type="tel"
                            placeholder="e.g., 9876543210"
                            value={searchPhone}
                            onChange={(e) => setSearchPhone(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                            className="mt-1"
                        />
                    </div>
                    {/* filter by Enquiry tracking id */}
                    <div>
                        <Label htmlFor="searchTrackingId">Tracking ID</Label>
                        <Input
                            id="searchTrackingId"
                            type="text"
                            placeholder="e.g., A9KQ2"
                            value={searchTrackingId}
                            onChange={(e) => setSearchTrackingId(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                            className="mt-1"
                        />
                    </div>
                </div>
                {/* search button */}
                <div className="flex justify-end mb-6">
                    <MyButton
                        buttonType="primary"
                        onClick={handleSearch}
                        disabled={isLoading}
                        className="w-full md:w-auto"
                    >
                        <MagnifyingGlass className="mr-2 size-4" />
                        {isLoading ? 'Searching...' : 'Search Enquiries'}
                    </MyButton>
                </div>

                {/* Table */}
                <div className="flex-1 overflow-auto border rounded-xl border-neutral-200">
                    <table className="w-full text-left text-sm text-neutral-600">
                        <thead className="bg-neutral-50 text-xs font-semibold uppercase text-neutral-500 sticky top-0 shadow-sm z-10">
                            <tr>
                                <th className="px-4 py-3 bg-neutral-50">Tracking ID</th>
                                <th className="px-4 py-3 bg-neutral-50">Student Name</th>
                                <th className="px-4 py-3 bg-neutral-50">Parent Name</th>
                                <th className="px-4 py-3 bg-neutral-50">Phone</th>
                                <th className="px-4 py-3 bg-neutral-50">Status</th>
                                {showApplicationCol && (
                                    <th className="px-4 py-3 bg-neutral-50 text-center">Application</th>
                                )}
                                {showAdmissionCol && (
                                    <th className="px-4 py-3 bg-neutral-50 text-center">Admission</th>
                                )}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-neutral-200">
                            {searchResults.map((result, idx) => {
                                const status: EnquiryStatus = result.overall_status || 'ENQUIRY';
                                const badge = STATUS_BADGE[status] ?? STATUS_BADGE.ENQUIRY;

                                // Application button: disable only if already applied or admitted
                                const appApplied = status === 'APPLICATION' || status === 'ADMISSION';
                                // Admission button: disable only if already admitted (direct admission is allowed)
                                const admAdmitted = status === 'ADMISSION';

                                return (
                                    <tr key={result.enquiry_id || idx} className="hover:bg-neutral-50 transition-colors">
                                        <td className="whitespace-nowrap px-4 py-3 font-medium text-primary-600">
                                            {result.tracking_id || '-'}
                                        </td>
                                        <td className="whitespace-nowrap px-4 py-3 text-neutral-900">
                                            {result.child?.name || '-'}
                                        </td>
                                        <td className="whitespace-nowrap px-4 py-3">
                                            {result.parent?.name || '-'}
                                        </td>
                                        <td className="whitespace-nowrap px-4 py-3">
                                            {result.parent?.phone || '-'}
                                        </td>
                                        <td className="whitespace-nowrap px-4 py-3">
                                            <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${badge.className}`}>
                                                {badge.label}
                                            </span>
                                        </td>

                                        {showApplicationCol && (
                                            <td className="whitespace-nowrap px-4 py-3 text-center">
                                                <MyButton
                                                    buttonType={appApplied ? 'secondary' : 'primary'}
                                                    scale="small"
                                                    onClick={() => handleSelectForApplication(result)}
                                                    disabled={appApplied}
                                                >
                                                    {appApplied ? 'Applied' : 'Apply'}
                                                </MyButton>
                                            </td>
                                        )}

                                        {showAdmissionCol && (
                                            <td className="whitespace-nowrap px-4 py-3 text-center">
                                                <MyButton
                                                    buttonType={admAdmitted ? 'secondary' : 'primary'}
                                                    scale="small"
                                                    onClick={() => handleSelectForAdmission(result)}
                                                    disabled={admAdmitted}
                                                >
                                                    {admAdmitted ? 'Admitted' : 'Admit'}
                                                </MyButton>
                                            </td>
                                        )}
                                    </tr>
                                );
                            })}
                            {searchResults.length === 0 && hasSearched && !isLoading && (
                                <tr>
                                    <td colSpan={colSpanEmpty} className="px-4 py-12 text-center text-neutral-500">
                                        No enquiries found matching your search.
                                    </td>
                                </tr>
                            )}
                            {searchResults.length === 0 && !hasSearched && !isLoading && (
                                <tr>
                                    <td colSpan={colSpanEmpty} className="px-4 py-12 text-center text-neutral-400">
                                        Enter search criteria and click Search to find enquiries.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};
