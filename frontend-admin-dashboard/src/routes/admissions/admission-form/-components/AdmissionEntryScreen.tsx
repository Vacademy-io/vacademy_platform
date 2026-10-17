import React, { useState, useMemo, useEffect } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { useInstituteDetailsStore } from '@/stores/students/students-list/useInstituteDetailsStore';
import authenticatedAxiosInstance from '@/lib/auth/axiosInstance';
import { BASE_URL } from '@/constants/urls';
import { FilterChips } from '@/components/design-system/chips';
import { MyButton } from '@/components/design-system/button';
import { X } from '@phosphor-icons/react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { EnquirySearchModal } from '../../-components/EnquirySearchModal';
import { ParentTypeModal } from '../../-components/ParentTypeModal';
import type { EnquiryDetailsResponse } from '../../-services/applicant-services';
import { AdmissionBulkImportDialog } from './AdmissionBulkImportDialog';

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
    enquiryTrackingId?: string | null;
}

interface Props {
    onStartAdmission?: (data: Partial<StudentSearchResult> | null, sessionId?: string) => void;
}

const buildDateRanges = (t: TFunction) => [
    { id: 'today', label: t('dateRanges.today') },
    { id: 'last_7_days', label: t('dateRanges.last7Days') },
    { id: 'last_30_days', label: t('dateRanges.last30Days') },
    { id: 'last_3_months', label: t('dateRanges.last3Months') },
    { id: 'last_6_months', label: t('dateRanges.last6Months') },
    { id: 'last_year', label: t('dateRanges.lastYear') },
];

const buildOverallStatuses = (t: TFunction) => [
    { id: 'APPLICATION', label: t('overallStatuses.application') },
    { id: 'ADMISSION', label: t('overallStatuses.admission') },
];

const buildSourceTypes = (t: TFunction) => [
    { id: 'WEBSITE', label: t('sourceTypes.website') },
    { id: 'GOOGLE_ADS', label: t('sourceTypes.googleAds') },
    { id: 'FACEBOOK', label: t('sourceTypes.facebook') },
    { id: 'GOOGLE', label: t('sourceTypes.google') },
    { id: 'FRIENDS', label: t('sourceTypes.friends') },
    { id: 'ZOHO_FORMS', label: t('sourceTypes.zohoForms') },
    { id: 'AUDIENCE_CAMPAIGN', label: t('sourceTypes.audienceCampaign') },
    { id: 'DIRECT_APPLICATION', label: t('sourceTypes.directApplication') },
    { id: 'MANUAL_ADMISSION', label: t('sourceTypes.manualAdmission') },
    { id: 'OTHER', label: t('sourceTypes.other') },
];

// Internal logic keys — NOT translated. `searchBy` state holds one of these literal
// keys and is used only for SEARCH_BY_MAP lookup and backend `search_by` payload
// resolution; the strings shown to users are looked up separately via
// `getSearchByLabel()` below.
const SEARCH_BY_MAP: Record<string, string> = {
    'Student Name': 'STUDENT_NAME',
    'Parent Mobile': 'PARENT_MOBILE',
    'Enquiry No': 'ENQUIRY_NO',
    'Application No': 'APPLICATION_NO',
};

const getSearchByLabel = (t: TFunction, searchBy: string): string => {
    switch (searchBy) {
        case 'Student Name':
            return t('searchByOptions.studentName');
        case 'Application No':
            return t('searchByOptions.applicationNo');
        case 'Parent Mobile':
            return t('searchByOptions.parentMobile');
        default:
            return searchBy;
    }
};

// `status` values come straight from the backend (enquiry/application/admission
// pipeline). Translate the known set for display; fall back to the raw value for
// anything unrecognized so new backend statuses never render blank.
// `gender` values come from the backend as 'MALE' | 'FEMALE' | 'OTHER'. Translate
// the known set; fall back to the raw value for anything unrecognized.
const getGenderLabel = (t: TFunction, gender: string | undefined): string => {
    switch (gender) {
        case 'MALE':
            return t('genderLabels.male');
        case 'FEMALE':
            return t('genderLabels.female');
        case 'OTHER':
            return t('genderLabels.other');
        default:
            return gender || '-';
    }
};

const getStatusLabel = (t: TFunction, status: string | undefined): string => {
    switch (status) {
        case 'NEW':
            return t('statusLabels.new');
        case 'CONTACTED':
            return t('statusLabels.contacted');
        case 'FOLLOW_UP':
            return t('statusLabels.followUp');
        case 'QUALIFIED':
            return t('statusLabels.qualified');
        case 'NOT_ELIGIBLE':
            return t('statusLabels.notEligible');
        case 'ENQUIRY':
            return t('statusLabels.enquiry');
        case 'APPLICATION':
            return t('statusLabels.application');
        case 'ADMISSION':
            return t('statusLabels.admission');
        default:
            return status || '-';
    }
};

const getSourceLabel = (t: TFunction, source: string | undefined): string => {
    switch (source) {
        case 'WEBSITE':
            return t('sourceTypes.website');
        case 'GOOGLE_ADS':
            return t('sourceTypes.googleAds');
        case 'FACEBOOK':
            return t('sourceTypes.facebook');
        case 'GOOGLE':
            return t('sourceTypes.google');
        case 'FRIENDS':
            return t('sourceTypes.friends');
        case 'ZOHO_FORMS':
            return t('sourceTypes.zohoForms');
        case 'AUDIENCE_CAMPAIGN':
            return t('sourceTypes.audienceCampaign');
        case 'DIRECT_APPLICATION':
            return t('sourceTypes.directApplication');
        case 'MANUAL_ADMISSION':
            return t('sourceTypes.manualAdmission');
        case 'OTHER':
            return t('sourceTypes.other');
        default:
            return source || '-';
    }
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
    const { t } = useTranslation('admissionsAdmissionEntryScreen');
    const navigate = useNavigate();
    const { instituteDetails, getDetailsFromPackageSessionId } = useInstituteDetailsStore();

    const navigateToForm = (data: Partial<StudentSearchResult> | null, sessionId?: string) => {
        if (onStartAdmission) {
            navigateToForm(data, sessionId);
            return;
        }
        navigate({
            to: '/admissions/admission-form',
            state: { studentData: data, sessionId } as any,
        });
    };

    const sessions = useMemo(() => instituteDetails?.sessions ?? [], [instituteDetails]);
    const [selectedSessionId, setSelectedSessionId] = useState('');
    const [isBulkImportOpen, setIsBulkImportOpen] = useState(false);

    const [initialLoadDone, setInitialLoadDone] = useState(false);

    useEffect(() => {
        if (sessions.length > 0 && !selectedSessionId) {
            setSelectedSessionId(sessions[0]?.id || '');
        }
    }, [sessions, selectedSessionId]);

    const allBatches = instituteDetails?.batches_for_sessions ?? [];

    const packageSessionOptions = useMemo(() => {
        if (!allBatches.length) return [];
        return allBatches
            .filter((batch) => batch.is_parent === true || !batch.parent_id)
            .filter((batch) => !selectedSessionId || batch.session.id === selectedSessionId)
            .map((batch) => ({
                id: batch.id,
                label: `${batch.package_dto.package_name} - ${batch.level.level_name}${batch.name ? ` - ${batch.name}` : ''}`,
            }));
    }, [allBatches, selectedSessionId]);

    const dateRangeOptions = useMemo(() => buildDateRanges(t), [t]);
    const overallStatusOptions = useMemo(() => buildOverallStatuses(t), [t]);
    const sourceTypeOptions = useMemo(() => buildSourceTypes(t), [t]);

    const [searchBy, setSearchBy] = useState('Student Name');
    const [searchValue, setSearchValue] = useState('');
    const [searchResults, setSearchResults] = useState<any[] | null>(null);
    const [isSearching, setIsSearching] = useState(false);
    const [totalResponses, setTotalResponses] = useState(0);

    // Default to Admission on initial load.
    const [statusFilters, setStatusFilters] = useState<{ id: string; label: string }[]>([
        { id: 'ADMISSION', label: t('overallStatuses.admission') },
    ]);
    const [sourceFilters, setSourceFilters] = useState<{ id: string; label: string }[]>([]);
    const [dateRangeFilters, setDateRangeFilters] = useState<{ id: string; label: string }[]>([]);
    const [packageSessionFilters, setPackageSessionFilters] = useState<{ id: string; label: string }[]>([]);
    const [sectionFilters, setSectionFilters] = useState<{ id: string; label: string }[]>([]);

    const sectionFilterOptions = useMemo(() => {
        if (packageSessionFilters.length === 0) return [];
        const parentId = packageSessionFilters[0]?.id;
        if (!parentId) return [];
        return allBatches
            .filter((b) => b.parent_id === parentId)
            .map((b) => ({
                id: b.id,
                label: b.name || b.level.level_name,
            }));
    }, [allBatches, packageSessionFilters]);

    const [showAdmissionTypeModal, setShowAdmissionTypeModal] = useState(false);
    const [showEnquiryModal, setShowEnquiryModal] = useState(false);
    const [showApplicationModal, setShowApplicationModal] = useState(false);
    const [showParentTypeModal, setShowParentTypeModal] = useState(false);
    const [pendingEnquiryMapped, setPendingEnquiryMapped] = useState<Partial<StudentSearchResult> | null>(null);
    const [applicationId, setApplicationId] = useState('');
    const [applicationPhone, setApplicationPhone] = useState('');
    const [isLoadingLookup, setIsLoadingLookup] = useState(false);

    const hasActiveFilters = statusFilters.length > 0 || sourceFilters.length > 0 || dateRangeFilters.length > 0 || packageSessionFilters.length > 0 || sectionFilters.length > 0;

    const clearAllFilters = () => {
        setStatusFilters([]);
        setSourceFilters([]);
        setDateRangeFilters([]);
        setPackageSessionFilters([]);
        setSectionFilters([]);
    };

    const handleNewAdmission = () => {
        setShowAdmissionTypeModal(false);
        navigateToForm({ id: '', studentName: '', mobile: '', classVal: '', dob: '', address: '', gender: '', enquiryId: null, applicationId: null }, selectedSessionId);
    };

    const handleFromEnquiryOption = () => {
        setShowAdmissionTypeModal(false);
        setShowEnquiryModal(true);
    };

    const handleFromApplicationOption = () => {
        setShowAdmissionTypeModal(false);
        setApplicationId('');
        setApplicationPhone('');
        setShowApplicationModal(true);
    };

    const handleSelectEnquiry = (enquiryData: EnquiryDetailsResponse) => {
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
            enquiryTrackingId: enquiryData.tracking_id || null,
        };

        // Auto-fill parent relation from enquiry data; show popup only if unknown
        const rawRelation = enquiryData.parent_relation_with_child || '';
        const relation = String(rawRelation).toLowerCase().trim();

        if (relation === 'father') {
            mapped.parentGender = 'father';
            navigateToForm(mapped, selectedSessionId);
        } else if (relation === 'mother') {
            mapped.parentGender = 'mother';
            navigateToForm(mapped, selectedSessionId);
        } else {
            // Relation unknown — ask admin to choose
            setPendingEnquiryMapped(mapped);
            setShowParentTypeModal(true);
        }
    };

    const handleParentTypeSelection = (type: 'father' | 'mother') => {
        if (!pendingEnquiryMapped) return;
        const mapped = { ...pendingEnquiryMapped, parentGender: type };
        setShowParentTypeModal(false);
        setPendingEnquiryMapped(null);
        navigateToForm(mapped, selectedSessionId);
    };

    const handleFetchApplication = async () => {
        if (!applicationId.trim() && !applicationPhone.trim()) {
            alert(t('alerts.enterIdOrPhone'));
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
                alert(t('alerts.noApplicationFound'));
                setIsLoadingLookup(false);
                return;
            }

            const item = results[0];
            const resolvedApplicantId = item.applicant_id || item.application_id || null;
            const mapped: Partial<StudentSearchResult> = {
                id: resolvedApplicantId || item.admission_id || '',
                studentName: item.student_name || '',
                gender: item.gender || '',
                dob: item.date_of_birth ? new Date(item.date_of_birth).toISOString().split('T')[0] : '',
                mobile: item.parent_mobile || '',
                email: item.parent_email || '',
                parentName: item.parent_name || '',
                address: '',
                classVal: getDisplayClass(item),
                sourceType: 'APPLICATION',
                sourceId: resolvedApplicantId || item.admission_id || '',
                destinationPackageSessionId: item.destination_package_session_id || '',
                enquiryId: null,
                applicationId: resolvedApplicantId,
                enquiryTrackingId: item.tracking_id || null,
            };

            setShowApplicationModal(false);
            navigateToForm(mapped, selectedSessionId);
        } catch (error) {
            console.error('Error fetching application:', error);
            alert(t('alerts.fetchFailed'));
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

            // search_by + search_text (NOT "search")
            if (searchValue.trim()) {
                body.search_by = SEARCH_BY_MAP[searchBy] || 'STUDENT_NAME';
                body.search_text = searchValue.trim();
            }

            if (statusFilters.length > 0) body.statuses = statusFilters.map(f => f.id);
            if (sourceFilters.length > 0) body.sources = sourceFilters.map(f => f.id);
            if (sectionFilters.length > 0) {
                body.destination_package_session_id = sectionFilters[0]?.id;
            } else if (packageSessionFilters.length > 0) {
                body.destination_package_session_id = packageSessionFilters[0]?.id;
            }

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
        const sourceType = item.status === 'APPLICATION' ? 'APPLICATION' : 'ENQUIRY';
        const sourceId = sourceType === 'APPLICATION'
            ? item.applicant_id || item.application_id || item.admission_id || item.id || ''
            : item.enquiry_id || item.admission_id || item.id || '';

        const isEnquiry = sourceType === 'ENQUIRY';
        const isApplication = sourceType === 'APPLICATION';

        navigateToForm({
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
            applicationId: isApplication ? (item.applicant_id || item.application_id || null) : null,
        }, selectedSessionId);
    };

    return (
        <div className="flex h-full flex-col p-6 animate-in fade-in duration-300">
            {/* Header with Academic Year + Admission Form button */}
            <div className="flex items-center justify-between mb-6 pb-4 border-b border-gray-200">
                <h1 className="text-2xl font-bold text-gray-800">{t('header.title')}</h1>
                <div className="flex items-center gap-3">
                    {sessions.length > 0 && (
                        <select
                            value={selectedSessionId}
                            onChange={(e) => {
                                setSelectedSessionId(e.target.value);
                                setSearchResults(null);
                            }}
                            className="rounded-md border border-gray-300 px-3 py-2 text-sm font-medium focus:border-orange-500 focus:ring-1 focus:ring-orange-500 outline-none min-w-44"
                        >
                            {sessions.map((s) => (
                                <option key={s.id} value={s.id}>{s.session_name}</option>
                            ))}
                        </select>
                    )}
                    <button
                        onClick={() => setShowAdmissionTypeModal(true)}
                        className="flex items-center gap-2 px-4 py-2 bg-primary-500 text-white text-sm font-medium rounded-md hover:bg-primary-600 transition-colors shadow-sm"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4"></path>
                        </svg>
                        {t('header.admissionForm')}
                    </button>
                    <MyButton
                        buttonType="secondary"
                        disabled={!selectedSessionId}
                        onClick={() => setIsBulkImportOpen(true)}
                        className="px-4 py-2"
                    >
                        {t('header.bulkImport')}
                    </MyButton>
                </div>
            </div>

            {/* Filter Chips */}
            <div className="flex flex-wrap items-center gap-2 mb-4">
                <FilterChips
                    label={t('filters.status')}
                    filterList={overallStatusOptions}
                    selectedFilters={statusFilters}
                    handleSelect={(option) => {
                        const exists = statusFilters.some((f) => f.id === option.id);
                        setStatusFilters(exists ? statusFilters.filter((f) => f.id !== option.id) : [...statusFilters, option]);
                    }}
                    handleClearFilters={() => setStatusFilters([])}
                    clearFilters={false}
                />
                <FilterChips
                    label={t('filters.source')}
                    filterList={sourceTypeOptions}
                    selectedFilters={sourceFilters}
                    handleSelect={(option) => {
                        const exists = sourceFilters.some((f) => f.id === option.id);
                        setSourceFilters(exists ? sourceFilters.filter((f) => f.id !== option.id) : [...sourceFilters, option]);
                    }}
                    handleClearFilters={() => setSourceFilters([])}
                    clearFilters={false}
                />
                <FilterChips
                    label={t('filters.dateRange')}
                    filterList={dateRangeOptions}
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
                        label={t('filters.class')}
                        filterList={packageSessionOptions}
                        selectedFilters={packageSessionFilters}
                        handleSelect={(option) => {
                            const exists = packageSessionFilters.some((f) => f.id === option.id);
                            if (exists) {
                                setPackageSessionFilters([]);
                            } else {
                                setPackageSessionFilters([option]);
                            }
                            setSectionFilters([]);
                        }}
                        handleClearFilters={() => { setPackageSessionFilters([]); setSectionFilters([]); }}
                        clearFilters={false}
                    />
                )}
                {sectionFilterOptions.length > 0 && (
                    <FilterChips
                        label={t('filters.section')}
                        filterList={sectionFilterOptions}
                        selectedFilters={sectionFilters}
                        handleSelect={(option) => {
                            const exists = sectionFilters.some((f) => f.id === option.id);
                            setSectionFilters(exists ? [] : [option]);
                        }}
                        handleClearFilters={() => setSectionFilters([])}
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
                            {isSearching ? t('filters.applying') : t('filters.applyFilter')}
                        </button>
                        <MyButton buttonType="secondary" scale="small" onClick={clearAllFilters} className="h-8 px-2 text-xs">
                            <X className="mr-1 h-3 w-3" />
                            {t('filters.clearAll')}
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
                    <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wider">{t('search.criteriaHeading')}</h2>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 items-end">
                    <div className="flex flex-col gap-1.5 flex-1">
                        <label className="text-xs font-medium text-gray-600">{t('search.searchByLabel')}</label>
                        <select
                            value={searchBy}
                            onChange={(e) => setSearchBy(e.target.value)}
                            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-orange-500 focus:ring-1 focus:ring-orange-500 outline-none"
                        >
                            <option value="Student Name">{t('searchByOptions.studentName')}</option>
                            <option value="Application No">{t('searchByOptions.applicationNo')}</option>
                            <option value="Parent Mobile">{t('searchByOptions.parentMobile')}</option>
                        </select>
                    </div>

                    <div className="flex flex-col gap-1.5 flex-1">
                        <label className="text-xs font-medium text-gray-600">{t('search.enterDetailsLabel')}</label>
                        <input
                            type="text"
                            value={searchValue}
                            onChange={(e) => setSearchValue(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                            placeholder={t('search.enterDetailsPlaceholder', { field: getSearchByLabel(t, searchBy) })}
                            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-orange-500 focus:ring-1 focus:ring-orange-500 outline-none"
                        />
                    </div>

                    <div className="flex-1">
                        <button
                            onClick={handleSearch}
                            disabled={isSearching}
                            className="w-full px-4 py-2 bg-gray-800 text-white text-sm font-medium rounded-md hover:bg-gray-900 transition-colors disabled:opacity-60"
                        >
                            {isSearching ? t('search.searching') : t('search.searchButton')}
                        </button>
                    </div>
                </div>
            </div>

            {/* Results Section */}
            {searchResults !== null && (
                <div className="bg-white rounded-lg border border-orange-200 shadow-sm overflow-hidden flex-1 flex flex-col">
                    {searchResults.length > 0 && (
                        <div className="px-6 py-3 border-b border-orange-100 bg-orange-50/60">
                            <p className="text-sm text-gray-700">{t('results.totalResponses')} <span className="font-semibold text-orange-700">{totalResponses}</span></p>
                        </div>
                    )}
                    <div className="overflow-x-auto flex-1">
                        <table className="w-full text-start border-collapse min-w-[1200px]"> {/* design-lint-ignore: table min-width for horizontal-scroll layout, no scale token close enough */}
                            <thead>
                                <tr className="bg-orange-50 text-gray-700 text-xs uppercase tracking-wider border-b border-orange-200">
                                    <th className="px-4 py-3 font-semibold">{t('table.sNo')}</th>
                                    <th className="px-4 py-3 font-semibold">{t('table.class')}</th>
                                    <th className="px-4 py-3 font-semibold">{t('table.studentName')}</th>
                                    <th className="px-4 py-3 font-semibold">{t('table.gender')}</th>
                                    <th className="px-4 py-3 font-semibold">{t('table.dateOfBirth')}</th>
                                    <th className="px-4 py-3 font-semibold">{t('table.parentName')}</th>
                                    <th className="px-4 py-3 font-semibold">{t('table.parentEmail')}</th>
                                    <th className="px-4 py-3 font-semibold">{t('table.parentMobile')}</th>
                                    <th className="px-4 py-3 font-semibold">{t('table.trackingId')}</th>
                                    <th className="px-4 py-3 font-semibold">{t('table.status')}</th>
                                    <th className="px-4 py-3 font-semibold">{t('table.source')}</th>
                                    <th className="px-4 py-3 font-semibold text-end">{t('table.actions')}</th>
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
                                            <td className="px-4 py-3.5 text-gray-700">{getGenderLabel(t, result.gender)}</td>
                                            <td className="px-4 py-3.5 text-orange-600">{formatDate(result.date_of_birth)}</td>
                                            <td className="px-4 py-3.5 text-gray-700">{result.parent_name || '-'}</td>
                                            <td className="px-4 py-3.5 text-gray-600 max-w-44 truncate" title={result.parent_email || ''}>
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
                                                    {getStatusLabel(t, result.status)}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3.5 text-gray-600">{getSourceLabel(t, result.source)}</td>
                                            <td className="px-4 py-3.5 text-right">
                                                {result.status !== 'ADMISSION' ? (
                                                    <button
                                                        onClick={() => handleSelectResult(result)}
                                                        className="inline-flex items-center justify-center px-3 py-1.5 border border-orange-500 text-orange-600 hover:bg-orange-500 hover:text-white rounded text-xs font-medium transition-colors whitespace-nowrap"
                                                    >
                                                        {t('results.createAdmission')}
                                                    </button>
                                                ) : (
                                                    <span className="text-xs text-gray-400">{t('results.alreadyAdmitted')}</span>
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
                                                <p>{t('results.noRecordsFound')}</p>
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
                    <h3 className="text-lg font-medium text-gray-800 mb-1">{t('emptyState.title')}</h3>
                    <p className="text-sm text-gray-500 max-w-md">
                        {t('emptyState.description')}
                    </p>
                </div>
            )}

            {/* Choose Admission Type Modal */}
            {showAdmissionTypeModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
                    <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
                        <div className="mb-4 flex items-center justify-between">
                            <h2 className="text-lg font-semibold text-neutral-900">{t('admissionTypeModal.title')}</h2>
                            <button onClick={() => setShowAdmissionTypeModal(false)} className="text-neutral-400 hover:text-neutral-600">
                                <X className="size-5" />
                            </button>
                        </div>
                        <p className="mb-6 text-sm text-neutral-600">{t('admissionTypeModal.subtitle')}</p>
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
                                    <h3 className="font-medium text-neutral-900">{t('admissionTypeModal.newAdmissionTitle')}</h3>
                                    <p className="text-sm text-neutral-600">{t('admissionTypeModal.newAdmissionDesc')}</p>
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
                                    <h3 className="font-medium text-neutral-900">{t('admissionTypeModal.fromEnquiryTitle')}</h3>
                                    <p className="text-sm text-neutral-600">{t('admissionTypeModal.fromEnquiryDesc')}</p>
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
                                    <h3 className="font-medium text-neutral-900">{t('admissionTypeModal.fromApplicationTitle')}</h3>
                                    <p className="text-sm text-neutral-600">{t('admissionTypeModal.fromApplicationDesc')}</p>
                                </div>
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <EnquirySearchModal
                isOpen={showEnquiryModal}
                onClose={() => setShowEnquiryModal(false)}
                onSelectForAdmission={handleSelectEnquiry}
            />

            {/* Enter Application Details Modal */}
            {showApplicationModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
                    <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
                        <div className="mb-4 flex items-center justify-between">
                            <h2 className="text-lg font-semibold text-neutral-900">{t('applicationModal.title')}</h2>
                            <button
                                onClick={() => { setShowApplicationModal(false); setApplicationId(''); setApplicationPhone(''); }}
                                className="text-neutral-400 hover:text-neutral-600"
                            >
                                <X className="size-5" />
                            </button>
                        </div>
                        <div className="space-y-4">
                            <div>
                                <Label htmlFor="admApplicationId">{t('applicationModal.applicationIdLabel')}</Label>
                                <Input
                                    id="admApplicationId"
                                    type="text"
                                    placeholder={t('applicationModal.applicationIdPlaceholder')}
                                    value={applicationId}
                                    onChange={(e) => setApplicationId(e.target.value)}
                                    className="mt-1"
                                />
                            </div>
                            <div className="flex items-center gap-3">
                                <div className="h-px flex-1 bg-neutral-200"></div>
                                <span className="text-xs text-neutral-500">{t('applicationModal.or')}</span>
                                <div className="h-px flex-1 bg-neutral-200"></div>
                            </div>
                            <div>
                                <Label htmlFor="admApplicationPhone">{t('applicationModal.phoneLabel')}</Label>
                                <Input
                                    id="admApplicationPhone"
                                    type="tel"
                                    placeholder={t('applicationModal.phonePlaceholder')}
                                    value={applicationPhone}
                                    onChange={(e) => setApplicationPhone(e.target.value)}
                                    className="mt-1"
                                />
                            </div>
                            <p className="text-xs text-neutral-500">
                                {t('applicationModal.helperText')}
                            </p>
                            <div className="flex gap-3">
                                <MyButton
                                    buttonType="secondary"
                                    onClick={() => { setShowApplicationModal(false); setApplicationId(''); setApplicationPhone(''); }}
                                    className="flex-1"
                                >
                                    {t('applicationModal.cancel')}
                                </MyButton>
                                <MyButton
                                    buttonType="primary"
                                    onClick={handleFetchApplication}
                                    disabled={isLoadingLookup || (!applicationId.trim() && !applicationPhone.trim())}
                                    className="flex-1"
                                >
                                    {isLoadingLookup ? t('applicationModal.loading') : t('applicationModal.continueButton')}
                                </MyButton>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            <ParentTypeModal
                isOpen={showParentTypeModal}
                onClose={() => setShowParentTypeModal(false)}
                onSelect={handleParentTypeSelection}
            />

            <AdmissionBulkImportDialog
                open={isBulkImportOpen}
                onOpenChange={setIsBulkImportOpen}
                sessionId={selectedSessionId}
                onSuccess={() => {
                    // Refresh current search results if user had already searched.
                    handleSearch();
                }}
            />
        </div>
    );
}
