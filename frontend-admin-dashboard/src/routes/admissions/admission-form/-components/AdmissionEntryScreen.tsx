import React, { useState, useMemo, useEffect } from 'react';
import { useInstituteDetailsStore } from '@/stores/students/students-list/useInstituteDetailsStore';
import authenticatedAxiosInstance from '@/lib/auth/axiosInstance';
import { BASE_URL } from '@/constants/urls';
import { FilterChips } from '@/components/design-system/chips';
import { MyButton } from '@/components/design-system/button';
import { X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { fetchEnquiryDetails } from '../../-services/applicant-services';

export interface StudentSearchResult {
    id: string;
    studentName: string;
    parentName?: string;
    mobile: string;
    classVal: string;
    source?: string;
    status?: string;
    dob: string;
    address: string;
    gender: string;
    email?: string;
    sourceType?: string;
    sourceId?: string;
    destinationPackageSessionId?: string;
    parentGender?: 'father' | 'mother';
    enquiryId?: string | null;
    applicationId?: string | null;
}

interface Props {
    onStartAdmission: (data: Partial<StudentSearchResult> | null, sessionId?: string) => void;
}

const DATE_RANGES = [
    { id: 'today', label: 'Today' },
    { id: 'last_7_days', label: 'Last 7 Days' },
    { id: 'last_30_days', label: 'Last 30 Days' },
    { id: 'last_3_months', label: 'Last 3 Months' },
    { id: 'last_6_months', label: 'Last 6 Months' },
    { id: 'last_year', label: 'Last Year' },
];

const OVERALL_STATUSES = [
    { id: 'ENQUIRY', label: 'Enquiry' },
    { id: 'APPLICATION', label: 'Application' },
    { id: 'ADMISSION', label: 'Admission' },
];

const SOURCE_TYPES = [
    { id: 'WEBSITE', label: 'Website' },
    { id: 'GOOGLE_ADS', label: 'Google Ads' },
    { id: 'FACEBOOK', label: 'Facebook' },
    { id: 'GOOGLE', label: 'Google' },
    { id: 'FRIENDS', label: 'Friends' },
    { id: 'ZOHO_FORMS', label: 'Zoho Forms' },
    { id: 'AUDIENCE_CAMPAIGN', label: 'Audience Campaign' },
    { id: 'DIRECT_APPLICATION', label: 'Direct Application' },
    { id: 'MANUAL_ADMISSION', label: 'Manual Admission' },
    { id: 'OTHER', label: 'Other' },
];

const SEARCH_BY_MAP: Record<string, string> = {
    'Student Name': 'STUDENT_NAME',
    'Parent Mobile': 'PARENT_MOBILE',
    'Enquiry No': 'ENQUIRY_NO',
    'Application No': 'APPLICATION_NO',
};

const getDateRange = (rangeValue: string) => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    switch (rangeValue) {
        case 'today':
            return { from: today.toISOString(), to: new Date(today.getTime() + 24 * 60 * 60 * 1000 - 1).toISOString() };
        case 'last_7_days':
            return { from: new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString(), to: now.toISOString() };
        case 'last_30_days':
            return { from: new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString(), to: now.toISOString() };
        case 'last_3_months':
            return { from: new Date(today.getTime() - 90 * 24 * 60 * 60 * 1000).toISOString(), to: now.toISOString() };
        case 'last_6_months':
            return { from: new Date(today.getTime() - 180 * 24 * 60 * 60 * 1000).toISOString(), to: now.toISOString() };
        case 'last_year':
            return { from: new Date(today.getTime() - 365 * 24 * 60 * 60 * 1000).toISOString(), to: now.toISOString() };
        default:
            return undefined;
    }
};

const formatDate = (dateStr: string | null | undefined): string => {
    if (!dateStr) return '-';
    try {
        const d = new Date(dateStr);
        if (isNaN(d.getTime())) return '-';
        const day = String(d.getDate()).padStart(2, '0');
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const year = d.getFullYear();
        return `${day}/${month}/${year}`;
    } catch {
        return '-';
    }
};

export default function AdmissionEntryScreen({ onStartAdmission }: Props) {
    const { instituteDetails, getDetailsFromPackageSessionId } = useInstituteDetailsStore();

    const sessions = useMemo(() => instituteDetails?.sessions ?? [], [instituteDetails]);
    const [selectedSessionId, setSelectedSessionId] = useState('');

    const [initialLoadDone, setInitialLoadDone] = useState(false);

    useEffect(() => {
        if (sessions.length > 0 && !selectedSessionId) {
            setSelectedSessionId(sessions[0]?.id || '');
        }
    }, [sessions, selectedSessionId]);

    const packageSessionOptions = useMemo(() => {
        if (!instituteDetails?.batches_for_sessions) return [];
        return instituteDetails.batches_for_sessions
            .filter((batch) => !selectedSessionId || batch.session.id === selectedSessionId)
            .map((batch) => ({
                id: batch.id,
                label: `${batch.package_dto.package_name} - ${batch.level.level_name}`,
            }));
    }, [instituteDetails, selectedSessionId]);

    const [fromSource, setFromSource] = useState('From Enquiry');
    const [searchBy, setSearchBy] = useState('Student Name');
    const [searchValue, setSearchValue] = useState('');
    const [searchResults, setSearchResults] = useState<any[] | null>(null);
    const [isSearching, setIsSearching] = useState(false);
    const [totalResponses, setTotalResponses] = useState(0);

    const [statusFilters, setStatusFilters] = useState<{ id: string; label: string }[]>([]);
    const [sourceFilters, setSourceFilters] = useState<{ id: string; label: string }[]>([]);
    const [dateRangeFilters, setDateRangeFilters] = useState<{ id: string; label: string }[]>([]);
    const [packageSessionFilters, setPackageSessionFilters] = useState<{ id: string; label: string }[]>([]);

    const [showAdmissionTypeModal, setShowAdmissionTypeModal] = useState(false);
    const [showEnquiryModal, setShowEnquiryModal] = useState(false);
    const [showApplicationModal, setShowApplicationModal] = useState(false);
    const [showParentTypeModal, setShowParentTypeModal] = useState(false);
    const [pendingEnquiryMapped, setPendingEnquiryMapped] = useState<Partial<StudentSearchResult> | null>(null);
    const [enquiryTrackingId, setEnquiryTrackingId] = useState('');
    const [enquiryPhone, setEnquiryPhone] = useState('');
    const [applicationId, setApplicationId] = useState('');
    const [applicationPhone, setApplicationPhone] = useState('');
    const [isLoadingLookup, setIsLoadingLookup] = useState(false);

    const hasActiveFilters = statusFilters.length > 0 || sourceFilters.length > 0 || dateRangeFilters.length > 0 || packageSessionFilters.length > 0;

    const clearAllFilters = () => {
        setStatusFilters([]);
        setSourceFilters([]);
        setDateRangeFilters([]);
        setPackageSessionFilters([]);
    };

    const handleNewAdmission = () => {
        setShowAdmissionTypeModal(false);
        onStartAdmission({ id: '', studentName: '', mobile: '', classVal: '', dob: '', address: '', gender: '', enquiryId: null, applicationId: null }, selectedSessionId);
    };

    const handleFromEnquiryOption = () => {
        setShowAdmissionTypeModal(false);
        setEnquiryTrackingId('');
        setEnquiryPhone('');
        setShowEnquiryModal(true);
    };

    const handleFromApplicationOption = () => {
        setShowAdmissionTypeModal(false);
        setApplicationId('');
        setApplicationPhone('');
        setShowApplicationModal(true);
    };

    const handleFetchEnquiry = async () => {
        if (!enquiryTrackingId.trim() && !enquiryPhone.trim()) {
            alert('Please enter either enquiry tracking ID or phone number');
            return;
        }
        setIsLoadingLookup(true);
        try {
            const searchParam = enquiryTrackingId.trim() || enquiryPhone.trim();
            const enquiryData = await fetchEnquiryDetails(searchParam);

            const mapped: Partial<StudentSearchResult> = {
                id: enquiryData.enquiry_id || '',
                studentName: enquiryData.child?.name || '',
                gender: enquiryData.child?.gender || '',
                dob: enquiryData.child?.dob ? new Date(enquiryData.child.dob).toISOString().split('T')[0] : '',
                mobile: enquiryData.parent?.phone || '',
                email: enquiryData.parent?.email || '',
                address: enquiryData.parent?.address_line || '',
                parentName: enquiryData.parent?.name || '',
                classVal: '',
                sourceType: 'ENQUIRY',
                sourceId: enquiryData.enquiry_id || '',
                destinationPackageSessionId: '',
                enquiryId: enquiryData.enquiry_id || null,
                applicationId: null,
            };

            setShowEnquiryModal(false);

            const parentGender = enquiryData.parent?.gender;
            if (parentGender === 'MALE') {
                mapped.parentGender = 'father';
                onStartAdmission(mapped, selectedSessionId);
            } else if (parentGender === 'FEMALE') {
                mapped.parentGender = 'mother';
                onStartAdmission(mapped, selectedSessionId);
            } else {
                setPendingEnquiryMapped(mapped);
                setShowParentTypeModal(true);
            }
        } catch (error) {
            console.error('Error fetching enquiry:', error);
            alert('Failed to fetch enquiry details. Please check the tracking ID or phone number.');
        } finally {
            setIsLoadingLookup(false);
        }
    };

    const handleParentTypeSelection = (type: 'father' | 'mother') => {
        if (!pendingEnquiryMapped) return;
        const mapped = { ...pendingEnquiryMapped, parentGender: type };
        setShowParentTypeModal(false);
        setPendingEnquiryMapped(null);
        onStartAdmission(mapped, selectedSessionId);
    };

    const handleFetchApplication = async () => {
        if (!applicationId.trim() && !applicationPhone.trim()) {
            alert('Please enter either application ID or phone number');
            return;
        }
        setIsLoadingLookup(true);
        try {
            const body: Record<string, any> = {};
            if (selectedSessionId) body.session_id = selectedSessionId;
            body.from = 'APPLICATION';

            if (applicationId.trim()) {
                body.search_by = 'APPLICATION_NO';
                body.search_text = applicationId.trim();
            } else {
                body.search_by = 'PARENT_MOBILE';
                body.search_text = applicationPhone.trim();
            }

            const response = await authenticatedAxiosInstance.post(
                `${BASE_URL}/admin-core-service/v1/admission/responses/list?pageNo=0&pageSize=1`,
                body
            );

            const results = response.data?.content || [];
            if (results.length === 0) {
                alert('No application found with the given details.');
                setIsLoadingLookup(false);
                return;
            }

            const item = results[0];
            const mapped: Partial<StudentSearchResult> = {
                id: item.admission_id || item.application_id || '',
                studentName: item.student_name || '',
                gender: item.gender || '',
                dob: item.date_of_birth ? new Date(item.date_of_birth).toISOString().split('T')[0] : '',
                mobile: item.parent_mobile || '',
                email: item.parent_email || '',
                parentName: item.parent_name || '',
                address: '',
                classVal: getDisplayClass(item),
                sourceType: 'APPLICATION',
                sourceId: item.admission_id || item.application_id || '',
                destinationPackageSessionId: item.destination_package_session_id || '',
                enquiryId: null,
                applicationId: item.admission_id || item.application_id || null,
            };

            setShowApplicationModal(false);
            onStartAdmission(mapped, selectedSessionId);
        } catch (error) {
            console.error('Error fetching application:', error);
            alert('Failed to fetch application details. Please check the ID or phone number.');
        } finally {
            setIsLoadingLookup(false);
        }
    };

    const handleSearch = async () => {
        setIsSearching(true);
        try {
            const body: Record<string, any> = {};

            // session_id is mandatory
            if (selectedSessionId) body.session_id = selectedSessionId;

            // "from" field: ENQUIRY or APPLICATION (NOT "source")
            if (fromSource === 'From Enquiry') body.from = 'ENQUIRY';
            else if (fromSource === 'From Application') body.from = 'APPLICATION';

            // search_by + search_text (NOT "search")
            if (searchValue.trim()) {
                body.search_by = SEARCH_BY_MAP[searchBy] || 'STUDENT_NAME';
                body.search_text = searchValue.trim();
            }

            if (statusFilters.length > 0) body.statuses = statusFilters.map(f => f.id);
            if (sourceFilters.length > 0) body.sources = sourceFilters.map(f => f.id);
            if (packageSessionFilters.length > 0) body.destination_package_session_id = packageSessionFilters[0]?.id;

            const dateRange = dateRangeFilters.length > 0 ? getDateRange(dateRangeFilters[0]?.id || '') : undefined;
            if (dateRange) {
                body.created_from = dateRange.from;
                body.created_to = dateRange.to;
            }

            const response = await authenticatedAxiosInstance.post(
                `${BASE_URL}/admin-core-service/v1/admission/responses/list?pageNo=0&pageSize=20`,
                body
            );

            const data = response.data;
            const results = data?.content || [];
            setSearchResults(results);
            setTotalResponses(data?.totalElements || results.length);
        } catch (error) {
            console.error('Error searching admission responses:', error);
            setSearchResults([]);
            setTotalResponses(0);
        } finally {
            setIsSearching(false);
        }
    };

    useEffect(() => {
        if (selectedSessionId && !initialLoadDone) {
            setInitialLoadDone(true);
            handleSearch();
        }
    }, [selectedSessionId]);

    const getDisplayClass = (item: any) => {
        const psId = item.destination_package_session_id;
        if (!psId) return item.applying_for_class || '-';
        const details = getDetailsFromPackageSessionId({ packageSessionId: psId });
        if (details) return details.level.level_name;
        return item.applying_for_class || '-';
    };

    const handleSelectResult = (item: any) => {
        const sourceType = fromSource === 'From Enquiry' ? 'ENQUIRY' : 'APPLICATION';
        const sourceId = item.admission_id || item.enquiry_id || item.application_id || item.id || '';

        const isEnquiry = sourceType === 'ENQUIRY' || item.status === 'ENQUIRY';
        const isApplication = sourceType === 'APPLICATION' || item.status === 'APPLICATION';

        onStartAdmission({
            id: sourceId,
            studentName: item.student_name || '',
            parentName: item.parent_name || '',
            mobile: item.parent_mobile || '',
            classVal: getDisplayClass(item),
            source: item.source || sourceType,
            status: item.status || '',
            dob: item.date_of_birth || '',
            address: '',
            gender: item.gender || '',
            email: item.parent_email || '',
            sourceType,
            sourceId,
            destinationPackageSessionId: item.destination_package_session_id || '',
            enquiryId: isEnquiry ? (item.enquiry_id || item.admission_id || null) : null,
            applicationId: isApplication ? (item.application_id || item.admission_id || null) : null,
        }, selectedSessionId);
    };

    return (
        <div className="flex h-full flex-col p-6 animate-in fade-in duration-300">
            {/* Header with Academic Year + Admission Form button */}
            <div className="flex items-center justify-between mb-6 pb-4 border-b border-gray-200">
                <h1 className="text-2xl font-bold text-gray-800">Default Admission Form</h1>
                <div className="flex items-center gap-3">
                    {sessions.length > 0 && (
                        <select
                            value={selectedSessionId}
                            onChange={(e) => {
                                setSelectedSessionId(e.target.value);
                                setSearchResults(null);
                            }}
                            className="rounded-md border border-gray-300 px-3 py-2 text-sm font-medium focus:border-orange-500 focus:ring-1 focus:ring-orange-500 outline-none min-w-[180px]"
                        >
                            {sessions.map((s) => (
                                <option key={s.id} value={s.id}>{s.session_name}</option>
                            ))}
                        </select>
                    )}
                    <button
                        onClick={() => setShowAdmissionTypeModal(true)}
                        className="flex items-center gap-2 px-4 py-2 bg-orange-500 text-white text-sm font-medium rounded-md hover:bg-orange-600 transition-colors shadow-sm"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4"></path>
                        </svg>
                        Admission Form
                    </button>
                </div>
            </div>

            {/* Filter Chips */}
            <div className="flex flex-wrap items-center gap-2 mb-4">
                <FilterChips
                    label="Status"
                    filterList={OVERALL_STATUSES}
                    selectedFilters={statusFilters}
                    handleSelect={(option) => {
                        const exists = statusFilters.some((f) => f.id === option.id);
                        setStatusFilters(exists ? statusFilters.filter((f) => f.id !== option.id) : [...statusFilters, option]);
                    }}
                    handleClearFilters={() => setStatusFilters([])}
                    clearFilters={false}
                />
                <FilterChips
                    label="Source"
                    filterList={SOURCE_TYPES}
                    selectedFilters={sourceFilters}
                    handleSelect={(option) => {
                        const exists = sourceFilters.some((f) => f.id === option.id);
                        setSourceFilters(exists ? sourceFilters.filter((f) => f.id !== option.id) : [...sourceFilters, option]);
                    }}
                    handleClearFilters={() => setSourceFilters([])}
                    clearFilters={false}
                />
                <FilterChips
                    label="Date Range"
                    filterList={DATE_RANGES}
                    selectedFilters={dateRangeFilters}
                    handleSelect={(option) => {
                        const exists = dateRangeFilters.some((f) => f.id === option.id);
                        setDateRangeFilters(exists ? dateRangeFilters.filter((f) => f.id !== option.id) : [option]);
                    }}
                    handleClearFilters={() => setDateRangeFilters([])}
                    clearFilters={false}
                />
                {packageSessionOptions.length > 0 && (
                    <FilterChips
                        label="Package Session"
                        filterList={packageSessionOptions}
                        selectedFilters={packageSessionFilters}
                        handleSelect={(option) => {
                            const exists = packageSessionFilters.some((f) => f.id === option.id);
                            setPackageSessionFilters(exists ? packageSessionFilters.filter((f) => f.id !== option.id) : [option]);
                        }}
                        handleClearFilters={() => setPackageSessionFilters([])}
                        clearFilters={false}
                    />
                )}
                {hasActiveFilters && (
                    <>
                        <button
                            onClick={handleSearch}
                            disabled={isSearching}
                            className="h-8 px-3 text-xs font-medium text-white bg-gray-900 rounded-md hover:bg-black transition-colors disabled:opacity-60"
                        >
                            {isSearching ? 'Applying...' : 'Apply Filter'}
                        </button>
                        <MyButton buttonType="secondary" scale="small" onClick={clearAllFilters} className="h-8 px-2 text-xs">
                            <X className="mr-1 h-3 w-3" />
                            Clear All
                        </MyButton>
                    </>
                )}
            </div>

            {/* Search Panel */}
            <div className="bg-white p-5 rounded-lg border border-gray-200 shadow-sm mb-6">
                <div className="flex items-center gap-2 mb-4">
                    <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path>
                    </svg>
                    <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wider">Search Criteria</h2>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-end">
                    <div className="flex flex-col gap-1.5 flex-1">
                        <label className="text-xs font-medium text-gray-600">FROM <span className="text-red-500">*</span></label>
                        <select
                            value={fromSource}
                            onChange={(e) => {
                                setFromSource(e.target.value);
                                setSearchResults(null);
                                setSearchValue('');
                            }}
                            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-orange-500 focus:ring-1 focus:ring-orange-500 outline-none"
                        >
                            <option value="From Enquiry">From Enquiry</option>
                            <option value="From Application">From Application</option>
                        </select>
                    </div>

                    <div className="flex flex-col gap-1.5 flex-1">
                        <label className="text-xs font-medium text-gray-600">Search By</label>
                        <select
                            value={searchBy}
                            onChange={(e) => setSearchBy(e.target.value)}
                            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-orange-500 focus:ring-1 focus:ring-orange-500 outline-none"
                        >
                            <option value="Student Name">Student Name</option>
                            {fromSource === 'From Enquiry' ? (
                                <option value="Enquiry No">Enquiry No</option>
                            ) : (
                                <option value="Application No">Application No</option>
                            )}
                            <option value="Parent Mobile">Parent Mobile</option>
                        </select>
                    </div>

                    <div className="flex flex-col gap-1.5 flex-1">
                        <label className="text-xs font-medium text-gray-600">Enter Details</label>
                        <input
                            type="text"
                            value={searchValue}
                            onChange={(e) => setSearchValue(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                            placeholder={`Enter ${searchBy}`}
                            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-orange-500 focus:ring-1 focus:ring-orange-500 outline-none"
                        />
                    </div>

                    <div className="flex-1">
                        <button
                            onClick={handleSearch}
                            disabled={isSearching}
                            className="w-full px-4 py-2 bg-gray-800 text-white text-sm font-medium rounded-md hover:bg-gray-900 transition-colors disabled:opacity-60"
                        >
                            {isSearching ? 'Searching...' : 'Search'}
                        </button>
                    </div>
                </div>
            </div>

            {/* Results Section */}
            {searchResults !== null && (
                <div className="bg-white rounded-lg border border-orange-200 shadow-sm overflow-hidden flex-1 flex flex-col">
                    {searchResults.length > 0 && (
                        <div className="px-6 py-3 border-b border-orange-100 bg-orange-50/60">
                            <p className="text-sm text-gray-700">Total Responses: <span className="font-semibold text-orange-700">{totalResponses}</span></p>
                        </div>
                    )}
                    <div className="overflow-x-auto flex-1">
                        <table className="w-full text-left border-collapse min-w-[1200px]">
                            <thead>
                                <tr className="bg-orange-50 text-gray-700 text-xs uppercase tracking-wider border-b border-orange-200">
                                    <th className="px-4 py-3 font-semibold">S.No</th>
                                    <th className="px-4 py-3 font-semibold">Class</th>
                                    <th className="px-4 py-3 font-semibold">Student Name</th>
                                    <th className="px-4 py-3 font-semibold">Gender</th>
                                    <th className="px-4 py-3 font-semibold">Date of Birth</th>
                                    <th className="px-4 py-3 font-semibold">Parent Name</th>
                                    <th className="px-4 py-3 font-semibold">Parent Email</th>
                                    <th className="px-4 py-3 font-semibold">Parent Mobile</th>
                                    <th className="px-4 py-3 font-semibold">Tracking ID</th>
                                    <th className="px-4 py-3 font-semibold">Status</th>
                                    <th className="px-4 py-3 font-semibold">Source</th>
                                    <th className="px-4 py-3 font-semibold text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 text-sm">
                                {searchResults.length > 0 ? (
                                    searchResults.map((result, idx) => (
                                        <tr key={result.admission_id || idx}
                                            className={`transition-colors ${idx % 2 === 0 ? 'bg-white' : 'bg-orange-50/30'} hover:bg-orange-50/60`}>
                                            <td className="px-4 py-3.5 text-gray-600">{idx + 1}</td>
                                            <td className="px-4 py-3.5 font-medium text-orange-700">{getDisplayClass(result)}</td>
                                            <td className="px-4 py-3.5 font-medium text-gray-900">{result.student_name || '-'}</td>
                                            <td className="px-4 py-3.5 text-gray-700">{result.gender || '-'}</td>
                                            <td className="px-4 py-3.5 text-orange-600">{formatDate(result.date_of_birth)}</td>
                                            <td className="px-4 py-3.5 text-gray-700">{result.parent_name || '-'}</td>
                                            <td className="px-4 py-3.5 text-gray-600 max-w-[180px] truncate" title={result.parent_email || ''}>
                                                {result.parent_email || '-'}
                                            </td>
                                            <td className="px-4 py-3.5 text-gray-700">{result.parent_mobile || '-'}</td>
                                            <td className="px-4 py-3.5 text-gray-600 font-mono text-xs">{result.tracking_id || '-'}</td>
                                            <td className="px-4 py-3.5">
                                                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                                                    result.status === 'NEW' ? 'bg-green-100 text-green-800' :
                                                    result.status === 'CONTACTED' ? 'bg-blue-100 text-blue-800' :
                                                    result.status === 'FOLLOW_UP' ? 'bg-yellow-100 text-yellow-800' :
                                                    result.status === 'QUALIFIED' ? 'bg-purple-100 text-purple-800' :
                                                    result.status === 'NOT_ELIGIBLE' ? 'bg-red-100 text-red-800' :
                                                    result.status === 'ENQUIRY' ? 'bg-orange-100 text-orange-800' :
                                                    'bg-gray-100 text-gray-700'
                                                }`}>
                                                    {result.status || '-'}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3.5 text-gray-600">{result.source || '-'}</td>
                                            <td className="px-4 py-3.5 text-right">
                                                {result.status !== 'ADMISSION' ? (
                                                    <button
                                                        onClick={() => handleSelectResult(result)}
                                                        className="inline-flex items-center justify-center px-3 py-1.5 border border-orange-500 text-orange-600 hover:bg-orange-500 hover:text-white rounded text-xs font-medium transition-colors whitespace-nowrap"
                                                    >
                                                        Create Admission
                                                    </button>
                                                ) : (
                                                    <span className="text-xs text-gray-400">Already Admitted</span>
                                                )}
                                            </td>
                                        </tr>
                                    ))
                                ) : (
                                    <tr>
                                        <td colSpan={12} className="px-6 py-12 text-center text-gray-500">
                                            <div className="flex flex-col items-center justify-center gap-2">
                                                <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                                                </svg>
                                                <p>No records found matching your search criteria.</p>
                                            </div>
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Empty State */}
            {searchResults === null && (
                <div className="flex-1 flex flex-col items-center justify-center border-2 border-dashed border-orange-200 rounded-lg bg-orange-50/30 p-12 text-center">
                    <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center shadow-sm border border-orange-100 mb-4 text-orange-400">
                        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13"></path>
                        </svg>
                    </div>
                    <h3 className="text-lg font-medium text-gray-800 mb-1">Select a student to begin</h3>
                    <p className="text-sm text-gray-500 max-w-md">
                        Use the search panel above to find an existing Enquiry or Application. Alternatively, click 'Admission Form' to start a fresh form.
                    </p>
                </div>
            )}

            {/* Choose Admission Type Modal */}
            {showAdmissionTypeModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
                    <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
                        <div className="mb-4 flex items-center justify-between">
                            <h2 className="text-lg font-semibold text-neutral-900">Choose Admission Type</h2>
                            <button onClick={() => setShowAdmissionTypeModal(false)} className="text-neutral-400 hover:text-neutral-600">
                                <X className="size-5" />
                            </button>
                        </div>
                        <p className="mb-6 text-sm text-neutral-600">Select how you would like to create a new admission</p>
                        <div className="space-y-3">
                            <button
                                onClick={handleNewAdmission}
                                className="flex w-full items-center gap-4 rounded-lg border border-neutral-200 p-4 text-left transition-all hover:border-orange-400 hover:bg-orange-50"
                            >
                                <div className="flex size-12 shrink-0 items-center justify-center rounded-full bg-orange-100">
                                    <svg className="size-6 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                                    </svg>
                                </div>
                                <div>
                                    <h3 className="font-medium text-neutral-900">New Admission</h3>
                                    <p className="text-sm text-neutral-600">Start a fresh admission form</p>
                                </div>
                            </button>

                            <button
                                onClick={handleFromEnquiryOption}
                                className="flex w-full items-center gap-4 rounded-lg border border-neutral-200 p-4 text-left transition-all hover:border-orange-400 hover:bg-orange-50"
                            >
                                <div className="flex size-12 shrink-0 items-center justify-center rounded-full bg-blue-100">
                                    <svg className="size-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                    </svg>
                                </div>
                                <div>
                                    <h3 className="font-medium text-neutral-900">From Enquiry</h3>
                                    <p className="text-sm text-neutral-600">Create admission from existing enquiry</p>
                                </div>
                            </button>

                            <button
                                onClick={handleFromApplicationOption}
                                className="flex w-full items-center gap-4 rounded-lg border border-neutral-200 p-4 text-left transition-all hover:border-orange-400 hover:bg-orange-50"
                            >
                                <div className="flex size-12 shrink-0 items-center justify-center rounded-full bg-green-100">
                                    <svg className="size-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                                    </svg>
                                </div>
                                <div>
                                    <h3 className="font-medium text-neutral-900">From Application</h3>
                                    <p className="text-sm text-neutral-600">Create admission from existing application</p>
                                </div>
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Enter Enquiry Details Modal */}
            {showEnquiryModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
                    <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
                        <div className="mb-4 flex items-center justify-between">
                            <h2 className="text-lg font-semibold text-neutral-900">Enter Enquiry Details</h2>
                            <button
                                onClick={() => { setShowEnquiryModal(false); setEnquiryTrackingId(''); setEnquiryPhone(''); }}
                                className="text-neutral-400 hover:text-neutral-600"
                            >
                                <X className="size-5" />
                            </button>
                        </div>
                        <div className="space-y-4">
                            <div>
                                <Label htmlFor="admEnquiryTrackingId">Enquiry Tracking ID</Label>
                                <Input
                                    id="admEnquiryTrackingId"
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
                                <Label htmlFor="admEnquiryPhone">Phone Number</Label>
                                <Input
                                    id="admEnquiryPhone"
                                    type="tel"
                                    placeholder="e.g., 9876543210"
                                    value={enquiryPhone}
                                    onChange={(e) => setEnquiryPhone(e.target.value)}
                                    className="mt-1"
                                />
                            </div>
                            <p className="text-xs text-neutral-500">
                                Enter either the tracking ID or phone number of the enquiry you want to convert to an admission
                            </p>
                            <div className="flex gap-3">
                                <MyButton
                                    buttonType="secondary"
                                    onClick={() => { setShowEnquiryModal(false); setEnquiryTrackingId(''); setEnquiryPhone(''); }}
                                    className="flex-1"
                                >
                                    Cancel
                                </MyButton>
                                <MyButton
                                    buttonType="primary"
                                    onClick={handleFetchEnquiry}
                                    disabled={isLoadingLookup || (!enquiryTrackingId.trim() && !enquiryPhone.trim())}
                                    className="flex-1"
                                >
                                    {isLoadingLookup ? 'Loading...' : 'Continue'}
                                </MyButton>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Enter Application Details Modal */}
            {showApplicationModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
                    <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
                        <div className="mb-4 flex items-center justify-between">
                            <h2 className="text-lg font-semibold text-neutral-900">Enter Application Details</h2>
                            <button
                                onClick={() => { setShowApplicationModal(false); setApplicationId(''); setApplicationPhone(''); }}
                                className="text-neutral-400 hover:text-neutral-600"
                            >
                                <X className="size-5" />
                            </button>
                        </div>
                        <div className="space-y-4">
                            <div>
                                <Label htmlFor="admApplicationId">Application ID / Tracking ID</Label>
                                <Input
                                    id="admApplicationId"
                                    type="text"
                                    placeholder="e.g., APP-12345"
                                    value={applicationId}
                                    onChange={(e) => setApplicationId(e.target.value)}
                                    className="mt-1"
                                />
                            </div>
                            <div className="flex items-center gap-3">
                                <div className="h-px flex-1 bg-neutral-200"></div>
                                <span className="text-xs text-neutral-500">OR</span>
                                <div className="h-px flex-1 bg-neutral-200"></div>
                            </div>
                            <div>
                                <Label htmlFor="admApplicationPhone">Phone Number</Label>
                                <Input
                                    id="admApplicationPhone"
                                    type="tel"
                                    placeholder="e.g., 9876543210"
                                    value={applicationPhone}
                                    onChange={(e) => setApplicationPhone(e.target.value)}
                                    className="mt-1"
                                />
                            </div>
                            <p className="text-xs text-neutral-500">
                                Enter either the application ID or phone number of the application you want to convert to an admission
                            </p>
                            <div className="flex gap-3">
                                <MyButton
                                    buttonType="secondary"
                                    onClick={() => { setShowApplicationModal(false); setApplicationId(''); setApplicationPhone(''); }}
                                    className="flex-1"
                                >
                                    Cancel
                                </MyButton>
                                <MyButton
                                    buttonType="primary"
                                    onClick={handleFetchApplication}
                                    disabled={isLoadingLookup || (!applicationId.trim() && !applicationPhone.trim())}
                                    className="flex-1"
                                >
                                    {isLoadingLookup ? 'Loading...' : 'Continue'}
                                </MyButton>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Select Parent Type Modal */}
            {showParentTypeModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
                    <div className="w-full max-w-sm rounded-lg bg-white p-6 shadow-xl">
                        <div className="mb-2">
                            <h2 className="text-lg font-semibold text-neutral-900">Select Parent Type</h2>
                            <p className="mt-1 text-sm text-neutral-600">
                                Please specify if the contact details belong to the father or mother
                            </p>
                        </div>
                        <div className="mt-5 space-y-3">
                            <button
                                onClick={() => handleParentTypeSelection('father')}
                                className="flex w-full items-center gap-4 rounded-lg border border-neutral-200 p-4 text-left transition-all hover:border-blue-400 hover:bg-blue-50"
                            >
                                <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-blue-100">
                                    <svg className="size-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                    </svg>
                                </div>
                                <div>
                                    <h3 className="font-medium text-neutral-900">Father</h3>
                                    <p className="text-sm text-neutral-500">Use these details for father's information</p>
                                </div>
                            </button>

                            <button
                                onClick={() => handleParentTypeSelection('mother')}
                                className="flex w-full items-center gap-4 rounded-lg border border-neutral-200 p-4 text-left transition-all hover:border-pink-400 hover:bg-pink-50"
                            >
                                <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-pink-100">
                                    <svg className="size-5 text-pink-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                    </svg>
                                </div>
                                <div>
                                    <h3 className="font-medium text-neutral-900">Mother</h3>
                                    <p className="text-sm text-neutral-500">Use these details for mother's information</p>
                                </div>
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
