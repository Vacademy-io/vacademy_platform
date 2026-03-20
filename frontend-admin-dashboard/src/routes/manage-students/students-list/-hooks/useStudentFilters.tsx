import { useState, useEffect, useCallback, useRef } from 'react';
import { StudentFilterRequest } from '@/types/student-table-types';
import { useInstituteDetailsStore } from '@/stores/students/students-list/useInstituteDetailsStore';
import { getCurrentInstituteId } from '@/lib/auth/instituteUtils';
import { useSelectedSessionStore } from '@/stores/study-library/selected-session-store';
import {
    DropdownItemType,
    DropdownValueType,
} from '@/components/common/students/enroll-manually/dropdownTypesForPackageItems';
import { useNavigate, useSearch } from '@tanstack/react-router';

export const useStudentFilters = () => {
    const navigate = useNavigate();
    const searchParams = useSearch({ strict: false }) as Record<string, any>;
    const INSTITUTE_ID = getCurrentInstituteId();
    const { getAllSessions, instituteDetails } = useInstituteDetailsStore();
    const { selectedSession, setSelectedSession } = useSelectedSessionStore();
    const [columnFilters, setColumnFilters] = useState<
        { id: string; value: { id: string; label: string }[] }[]
    >([]);
    const [searchInput, setSearchInput] = useState<string>('');
    const [searchFilter, setSearchFilter] = useState('');
    const [clearFilters, setClearFilters] = useState<boolean>(false);
    const hasInitializedFilters = useRef(false);
    const [sessionList, setSessionList] = useState<DropdownItemType[]>(
        getAllSessions().map((session) => ({
            id: session.id,
            name: session.session_name,
        }))
    );
    const [currentSession, setCurrentSession] = useState<DropdownItemType>(() => {
        const defaultSession = sessionList[0] || { id: '', name: '' };
        return selectedSession && sessionList.find((session) => session.id === selectedSession.id)
            ? { id: selectedSession.id, name: selectedSession.session_name }
            : defaultSession;
    });

    useEffect(() => {
        setSessionList(
            getAllSessions().map((session) => ({
                id: session.id,
                name: session.session_name,
            }))
        );
        if (currentSession && sessionList.includes(currentSession)) {
            const session = getAllSessions().find((session) => session.id === currentSession.id);
            if (session) {
                setSelectedSession(session);
            }
        } else {
            const defaultSession = sessionList[0] || { id: '', name: '' };
            const newSession = selectedSession
                ? { id: selectedSession.id, name: selectedSession.session_name }
                : defaultSession;
            setCurrentSession(newSession);
            const session = getAllSessions().find((session) => session.id === newSession.id);
            if (session) {
                setSelectedSession(session);
            }
        }
    }, [instituteDetails]);

    const [allPackageSessionIds, setAllPackageSessionIds] = useState<string[]>([]);

    // Ref to track if we've done the initial package session setup
    const hasInitialSessionSetupRef = useRef(false);

    // Compute initial package session IDs from current session
    const getPackageSessionIdsForSession = useCallback((sessionId: string) => {
        return (instituteDetails?.batches_for_sessions || [])
            .filter((batch) => batch.session.id === sessionId)
            .map((batch) => batch.id);
    }, [instituteDetails]);

    const [appliedFilters, setAppliedFilters] = useState<StudentFilterRequest>(() => {
        // Compute initial package session IDs at initialization time
        const initialSessionId = selectedSession?.id || getAllSessions()[0]?.id || '';
        const initialPksIds = (instituteDetails?.batches_for_sessions || [])
            .filter((batch) => batch.session.id === initialSessionId)
            .map((batch) => batch.id);

        return {
            name: '',
            institute_ids: INSTITUTE_ID ? [INSTITUTE_ID] : [],
            package_session_ids: initialPksIds,
            group_ids: [],
            gender: [],
            statuses: instituteDetails?.student_statuses || [],
            session_expiry_days: [],
            sort_columns: {},
            sub_org_user_types: [],
            payment_statuses: [],
            sources: [],
            types: [],
            type_ids: [],
            destination_package_session_ids: [],
            level_ids: [],
        };
    });

    useEffect(() => {
        let pksIds =
            columnFilters
                .find((filter) => filter.id === 'batch')
                ?.value.map((option) => option.id) ||
            getPackageSessionIdsForSession(currentSession.id);

        // Check active status filters (both regular and approval) to see if we need to force empty batches
        const statusFilter = columnFilters.find((filter) => filter.id === 'statuses');
        const approvalFilter = columnFilters.find((filter) => filter.id === 'approval_statuses');

        const activeStatuses = [
            ...(statusFilter?.value.map(opt => opt.label) || []),
            ...(approvalFilter?.value.map(opt => opt.id) || [])
        ];

        if (activeStatuses.some(s => ['INVITED', 'PENDING_FOR_APPROVAL'].includes(s))) {
            pksIds = [];
        }

        setAllPackageSessionIds(pksIds);
    }, [currentSession, getPackageSessionIdsForSession, columnFilters]);

    useEffect(() => {
        if (columnFilters.length === 0) {
            setClearFilters(false);
        }
    }, [columnFilters.length]);

    // Initialize filters from URL params
    useEffect(() => {
        if (!instituteDetails) return;

        // Prevent running this logic multiple times
        if (hasInitializedFilters.current) return;
        hasInitializedFilters.current = true;

        const initialFilters: { id: string; value: { id: string; label: string }[] }[] = [];

        // Session from URL - set current session if provided
        if (searchParams.session) {
            const session = getAllSessions().find((s) => s.id === searchParams.session);
            if (session) {
                const sessionItem = { id: session.id, name: session.session_name };
                setCurrentSession(sessionItem);
                setSelectedSession(session);
            }
        } else if (currentSession?.id) {
            // Set session in URL if not present
            const currentParams = new URLSearchParams(window.location.search);
            currentParams.set('session', currentSession.id);
            const newUrl = `${window.location.pathname}?${currentParams.toString()}`;
            window.history.replaceState({}, '', newUrl);
        }

        // Role filter from URL
        if (searchParams.role) {
            const roles = Array.isArray(searchParams.role) ? searchParams.role : [searchParams.role];
            const roleOptions = roles.map((roleId) => ({
                id: roleId,
                label: roleId.replace(/_/g, ' '),
            }));
            if (roleOptions.length > 0) {
                initialFilters.push({ id: 'sub_org_user_types', value: roleOptions });
            }
        }

        // Gender filter from URL
        if (searchParams.gender) {
            const genders = Array.isArray(searchParams.gender) ? searchParams.gender : [searchParams.gender];
            // Deduplicate genders from URL
            const uniqueGenders = [...new Set(genders)];
            const genderOptions = uniqueGenders.map((gender) => ({
                id: gender,
                label: gender,
            }));
            if (genderOptions.length > 0) {
                initialFilters.push({ id: 'gender', value: genderOptions });
            }
        }

        // Status filter from URL
        if (searchParams.status) {
            const statuses = Array.isArray(searchParams.status) ? searchParams.status : [searchParams.status];
            // Deduplicate statuses from URL
            const uniqueStatuses = [...new Set(statuses)];
            const statusOptions = uniqueStatuses.map((status) => ({
                id: status,
                label: status,
            }));
            if (statusOptions.length > 0) {
                initialFilters.push({ id: 'statuses', value: statusOptions });
            }
        }

        // Batch filter from URL
        if (searchParams.batch) {
            const batches = Array.isArray(searchParams.batch) ? searchParams.batch : [searchParams.batch];
            const batchOptions = instituteDetails.batches_for_sessions
                ?.filter((batch) => batches.includes(batch.id))
                .map((batch) => ({
                    id: batch.id,
                    label: batch.package_dto?.package_name || batch.id,
                })) || [];
            if (batchOptions.length > 0) {
                initialFilters.push({ id: 'batch', value: batchOptions });
            }
        }

        // Session expiry filter from URL (using camelCase)
        if (searchParams.sessionExpiry) {
            const expiries = Array.isArray(searchParams.sessionExpiry)
                ? searchParams.sessionExpiry
                : [searchParams.sessionExpiry];
            const expiryOptions = expiries.map((days) => ({
                id: String(days),
                label: `${days} Days`,
            }));
            if (expiryOptions.length > 0) {
                initialFilters.push({ id: 'session_expiry_days', value: expiryOptions });
            }
        }

        // Name filter from URL
        if (searchParams.name) {
            setSearchInput(searchParams.name);
            setSearchFilter(searchParams.name);
        }

        // Payment Status filter from URL
        if (searchParams.paymentStatus) {
            const statuses = Array.isArray(searchParams.paymentStatus) ? searchParams.paymentStatus : [searchParams.paymentStatus];
            const options = statuses.map((status: string) => ({
                id: status,
                label: status === 'PAID' ? 'Paid' : status === 'failed' ? 'Failed' : 'Payment Failed',
            }));
            if (options.length > 0) {
                initialFilters.push({ id: 'payment_statuses', value: options });
            }
        }

        // Approval Status filter from URL
        if (searchParams.approvalStatus) {
            const statuses = Array.isArray(searchParams.approvalStatus) ? searchParams.approvalStatus : [searchParams.approvalStatus];
            const options = statuses.map((status: string) => ({
                id: status,
                label: status === 'PENDING_FOR_APPROVAL' ? 'Pending for Approval' : 'Invited',
            }));
            if (options.length > 0) {
                initialFilters.push({ id: 'approval_statuses', value: options });
            }
        }

        // Learner Type filter from URL (e.g., ABANDONED_CART)
        if (searchParams.learnerType) {
            const learnerType = searchParams.learnerType;
            const options = [{
                id: learnerType,
                label: learnerType === 'ABANDONED_CART' ? 'Abandoned Cart' : learnerType,
            }];
            initialFilters.push({ id: 'learner_type', value: options });
        }

        // Custom field filters from URL
        if (instituteDetails?.dropdown_custom_fields) {
            instituteDetails.dropdown_custom_fields.forEach((customField) => {
                const urlValues = searchParams[customField.fieldKey];
                if (urlValues) {
                    const values = Array.isArray(urlValues) ? urlValues : [urlValues];
                    try {
                        const config = JSON.parse(customField.config);
                        const matchedOptions = values
                            .map((value) => {
                                const option = config.find((opt: any) => opt.value === value);
                                return option ? { id: option.value, label: option.label } : null;
                            })
                            .filter(Boolean) as { id: string; label: string }[];

                        if (matchedOptions.length > 0) {
                            initialFilters.push({ id: customField.fieldKey, value: matchedOptions });
                        }
                    } catch (error) {
                        console.error(`Error parsing custom field ${customField.fieldName}:`, error);
                    }
                }
            });
        }

        if (initialFilters.length > 0) {
            setColumnFilters(initialFilters);
            // Mark that filters have been loaded from URL so they appear as "applied"
            // This ensures the UI shows them as active filters
            setClearFilters(false);

            // Apply the URL filters immediately on initial load
            // Calculate filters from initialFilters to apply them
            const statusFilter = initialFilters.find((filter) => filter.id === 'statuses');
            const statusesToApply = statusFilter?.value.map((option) => option.label) || [];

            const approvalStatusFilter = initialFilters.find((filter) => filter.id === 'approval_statuses');
            const approvalStatusesToApply = approvalStatusFilter?.value.map((option) => option.id) || [];

            // Combine regular statuses and approval statuses
            // Logic: If ANY status filter (regular or approval) is set, use ONLY those.
            // If NO status filter is set, we use default regular statuses.
            let finalStatusesToApply: string[] = [];

            if (statusesToApply.length > 0 || approvalStatusesToApply.length > 0) {
                finalStatusesToApply = [...statusesToApply, ...approvalStatusesToApply];
            } else {
                finalStatusesToApply = instituteDetails?.student_statuses || [];
            }

            const genderFilter = initialFilters.find((filter) => filter.id === 'gender');
            const gendersToApply = genderFilter?.value.map((option) => option.label) || [];

            const roleFilter = initialFilters.find((filter) => filter.id === 'sub_org_user_types');
            const rolesToApply = roleFilter?.value.map((option) => option.id) || [];

            const batchFilter = initialFilters.find((filter) => filter.id === 'batch');
            let pksids = batchFilter?.value.map((option) => option.id) ||
                (instituteDetails?.batches_for_sessions || [])
                    .filter((batch) => batch.session.id === currentSession.id)
                    .map((batch) => batch.id);

            // Special handling for Invited/Pending statuses:
            // These students might not be assigned to a batch yet, so we must clear the batch filter
            // to allow global search across the institute for these statuses.
            // Handle learner type filter (e.g., ABANDONED_CART) - need this early for package_session_ids logic
            const learnerTypeFilter = initialFilters.find((filter) => filter.id === 'learner_type');
            const learnerTypeToApply = learnerTypeFilter?.value[0]?.id || undefined;

            // If ABANDONED_CART is selected, package_session_ids should be empty
            const isAbandonedCart = learnerTypeToApply === 'ABANDONED_CART';

            // Store original pksids for destination_package_session_ids before clearing
            const originalPksids = [...pksids];

            // For ABANDONED_CART, calculate destination_package_session_ids
            let destinationPksids: string[] = [];
            if (isAbandonedCart) {
                // If user selected specific batches, use those; otherwise use all batches for current session
                const batchFilter = initialFilters.find((filter) => filter.id === 'batch');
                const selectedBatchIds = batchFilter?.value.map((option) => option.id);
                destinationPksids = selectedBatchIds && selectedBatchIds.length > 0 
                    ? selectedBatchIds 
                    : originalPksids;
            }

            if (finalStatusesToApply.some(s => ['INVITED', 'PENDING_FOR_APPROVAL'].includes(s)) || isAbandonedCart) {
                pksids = [];
            }

            const sessionExpiryFilter = initialFilters.find((filter) => filter.id === 'session_expiry_days');
            const sessionExpiryDays = sessionExpiryFilter?.value.map((value) => {
                const numberMatch = value.label.match(/\d+/);
                return numberMatch ? parseInt(numberMatch[0]) : 0;
            }) || [];

            const paymentStatusFilter = initialFilters.find((filter) => filter.id === 'payment_statuses');
            const paymentStatusesToApply = paymentStatusFilter?.value.map((option) => option.id) || [];

            // approvalStatusFilter already declared above
            // approvalStatusesToApply already declared above

            // Handle custom field filters
            const customFieldParams: Record<string, any> = {};
            if (instituteDetails?.dropdown_custom_fields) {
                let index = 0;
                instituteDetails.dropdown_custom_fields.forEach((customField) => {
                    const filter = initialFilters.find((f) => f.id === customField.fieldKey);
                    if (filter && filter.value.length > 0) {
                        customFieldParams[`customFieldId${index}`] = customField.id;
                        customFieldParams[`customFieldValues${index}`] = filter.value.map((option) => option.id);
                        index++;
                    }
                });
            }

            setAppliedFilters((prev) => ({
                ...prev,
                name: searchFilter,
                package_session_ids: pksids,
                destination_package_session_ids: isAbandonedCart ? destinationPksids : [],
                gender: gendersToApply,
                statuses: finalStatusesToApply,
                session_expiry_days: sessionExpiryDays,
                sub_org_user_types: rolesToApply,
                payment_statuses: paymentStatusesToApply,
                type: learnerTypeToApply,
                // approval_statuses is removed, merged into statuses
                ...customFieldParams,
            }));
        }
    }, [instituteDetails, searchParams]);

    const handleSessionChange = (value: DropdownValueType) => {
        if (value && typeof value === 'object' && 'id' in value && 'name' in value) {
            const newSessionId = (value as DropdownItemType).id;
            setCurrentSession(value as DropdownItemType);
            const session = getAllSessions().find(
                (session) => session.id === newSessionId
            );
            if (session) {
                setSelectedSession(session);

                // Clear any existing batch filter when session changes
                // This ensures we show ALL students from the new session
                setColumnFilters((prev) => prev.filter((f) => f.id !== 'batch'));

                // Get all batch IDs (package_session_ids) for the new session
                const newSessionBatchIds = (instituteDetails?.batches_for_sessions || [])
                    .filter((batch) => batch.session.id === newSessionId)
                    .map((batch) => batch.id);

                // Update applied filters with new session's batch IDs
                // This triggers the API call to fetch students for the new session
                setAppliedFilters((prev) => ({
                    ...prev,
                    package_session_ids: newSessionBatchIds,
                    // Clear name search when switching sessions for cleaner UX
                }));

                // Update session in URL and clear batch param
                const currentParams = new URLSearchParams(window.location.search);
                currentParams.set('session', session.id);
                currentParams.delete('batch'); // Clear batch from URL
                const newUrl = `${window.location.pathname}?${currentParams.toString()}`;
                window.history.replaceState({}, '', newUrl);
            }
        }
    };

    const handleFilterChange = (filterId: string, options: { id: string; label: string }[]) => {
        setColumnFilters((prev) => {
            const existing = prev.filter((f) => f.id !== filterId);
            if (options.length === 0 && filterId === 'statuses') {
                // If clearing status filter, use all API-provided statuses
                return existing;
            }
            if (options.length === 0) return existing;
            return [...existing, { id: filterId, value: options }];
        });
    };

    const handleFilterClick = async () => {
        const sessionExpiryFilter = columnFilters.find(
            (filter) => filter.id === 'session_expiry_days'
        );
        const sessionExpiryDays = sessionExpiryFilter?.value.map((value) => {
            const numberMatch = value.label.match(/\d+/);
            return numberMatch ? parseInt(numberMatch[0]) : 0;
        });

        // Determine statuses to apply
        let finalStatusesToApply: string[] = [];

        // Check if we have any "regular" statuses selected
        const statusFilter = columnFilters.find((filter) => filter.id === 'statuses');
        const statusesToApply = statusFilter?.value.map((opt) => opt.label) || [];
        if (statusesToApply.length > 0) {
            finalStatusesToApply = [...finalStatusesToApply, ...statusesToApply];
        }

        // Check if we have any "approval" statuses selected
        const approvalFilter = columnFilters.find((filter) => filter.id === 'approval_statuses');
        const approvalStatusesToApply = approvalFilter?.value.map((opt) => opt.id) || [];
        if (approvalStatusesToApply.length > 0) {
            finalStatusesToApply = [...finalStatusesToApply, ...approvalStatusesToApply];
        }

        // If NO status filters are selected (regular or approval), default to ACTIVE/INACTIVE
        if (finalStatusesToApply.length === 0) {
            finalStatusesToApply = instituteDetails?.student_statuses || [];
        }

        // Handle Package Session IDs
        // Requirement: If INVITED or PENDING_FOR_APPROVAL status is selected (explicitly), 
        // we MUST send empty package_session_ids to search globally.
        let finalPackageSessionIds: string[] = [];
        let destinationPackageSessionIds: string[] = [];

        // Combine all explicitly selected statuses to check for special ones
        const allExplicitStatuses = [...statusesToApply, ...approvalStatusesToApply];
        const hasSpecialStatus = allExplicitStatuses.some(s =>
            ['INVITED', 'PENDING_FOR_APPROVAL', 'Invited', 'Pending for Approval'].includes(s)
        );

        // Get Learner Type filter (e.g., ABANDONED_CART) - need this early for package_session_ids logic
        const learnerTypeFilter = columnFilters.find((filter) => filter.id === 'learner_type');
        const learnerType = learnerTypeFilter?.value[0]?.id || undefined;

        // If ABANDONED_CART is selected, package_session_ids should be empty
        const isAbandonedCart = learnerType === 'ABANDONED_CART';

        // Get selected batch IDs from filter
        const selectedBatchIds = columnFilters.find((filter) => filter.id === 'batch')?.value.map((option) => option.id);

        if (hasSpecialStatus || isAbandonedCart) {
            finalPackageSessionIds = [];
            // For ABANDONED_CART, set destination_package_session_ids
            if (isAbandonedCart) {
                // If user selected specific batches, use those; otherwise use all batches
                destinationPackageSessionIds = selectedBatchIds && selectedBatchIds.length > 0 
                    ? selectedBatchIds 
                    : allPackageSessionIds;
            }
        } else {
            finalPackageSessionIds = selectedBatchIds || allPackageSessionIds;
        }

        // Get Payment Statuses
        const paymentFilter = columnFilters.find((filter) => filter.id === 'payment_statuses');
        const paymentStatuses = paymentFilter ? paymentFilter.value.map((opt) => opt.id) : [];

        // Handle custom field filters - convert to flat structure
        const customFieldParams: Record<string, any> = {};
        if (instituteDetails?.dropdown_custom_fields) {
            let index = 0;
            instituteDetails.dropdown_custom_fields.forEach((customField) => {
                const filter = columnFilters.find((f) => f.id === customField.fieldKey);
                if (filter && filter.value.length > 0) {
                    customFieldParams[`customFieldId${index}`] = customField.id;
                    customFieldParams[`customFieldValues${index}`] = filter.value.map((option) => option.id);
                    index++;
                }
            });
        }

        const gendersToApply = columnFilters.find((filter) => filter.id === 'gender')?.value.map((option) => option.label) || [];
        const rolesToApply = columnFilters.find((filter) => filter.id === 'sub_org_user_types')?.value.map((option) => option.id) || [];

        const newFilters: StudentFilterRequest = {
            name: searchFilter,
            package_session_ids: finalPackageSessionIds,
            destination_package_session_ids: isAbandonedCart ? destinationPackageSessionIds : [],
            gender: gendersToApply,
            statuses: finalStatusesToApply,
            session_expiry_days: sessionExpiryDays || [],
            sub_org_user_types: rolesToApply,
            institute_ids: INSTITUTE_ID ? [INSTITUTE_ID] : [],
            group_ids: [],
            sort_columns: {},
            payment_statuses: paymentStatuses,
            type: learnerType,
            ...customFieldParams,
        };

        setAppliedFilters(newFilters);

        // Build URL search params
        const currentParams = new URLSearchParams(window.location.search);

        // Remove old filter params
        currentParams.delete('name');
        currentParams.delete('role');
        currentParams.delete('gender');
        currentParams.delete('status');
        currentParams.delete('batch');
        currentParams.delete('sessionExpiry');
        currentParams.delete('learnerType');

        // Remove old custom field params
        if (instituteDetails?.dropdown_custom_fields) {
            instituteDetails.dropdown_custom_fields.forEach((customField) => {
                currentParams.delete(customField.fieldKey);
            });
        }

        // Keep session
        if (currentSession?.id) {
            currentParams.set('session', currentSession.id);
        }

        // Add new filter values
        if (searchFilter) {
            currentParams.set('name', searchFilter);
        }

        if (rolesToApply.length > 0) {
            [...new Set(rolesToApply)].forEach(role => currentParams.append('role', role));
        }

        if (gendersToApply.length > 0) {
            [...new Set(gendersToApply)].forEach(gender => currentParams.append('gender', gender));
        }

        if (statusesToApply.length > 0) {
            [...new Set(statusesToApply)].forEach(status => currentParams.append('status', status));
        }

        // Use finalPackageSessionIds for batch URL params
        if (finalPackageSessionIds.length > 0 && finalPackageSessionIds.length !== allPackageSessionIds.length) {
            [...new Set(finalPackageSessionIds)].forEach(batch => currentParams.append('batch', batch));
        }

        if (sessionExpiryDays && sessionExpiryDays.length > 0) {
            [...new Set(sessionExpiryDays)].forEach(days => currentParams.append('sessionExpiry', String(days)));
        }

        if (paymentStatuses.length > 0) {
            [...new Set(paymentStatuses)].forEach(status => currentParams.append('paymentStatus', status));
        }

        if (approvalStatusesToApply.length > 0) {
            [...new Set(approvalStatusesToApply)].forEach(status => currentParams.append('approvalStatus', status));
        }

        if (learnerType) {
            currentParams.set('learnerType', learnerType);
        }

        // Handle custom field filters
        if (instituteDetails?.dropdown_custom_fields) {
            instituteDetails.dropdown_custom_fields.forEach((customField) => {
                const filter = columnFilters.find((f) => f.id === customField.fieldKey);
                if (filter && filter.value.length > 0) {
                    const uniqueValues = [...new Set(filter.value.map(opt => opt.id))];
                    uniqueValues.forEach(value => {
                        currentParams.append(customField.fieldKey, value);
                    });
                }
            });
        }

        const newUrl = `${window.location.pathname}?${currentParams.toString()}`;
        window.history.replaceState({}, '', newUrl);
    };

    const handleClearFilters = async () => {
        setClearFilters(true);
        setColumnFilters([]);
        setSearchFilter('');
        setSearchInput('');

        const pksids = (instituteDetails?.batches_for_sessions || [])
            .filter((batch) => batch.session.id === currentSession.id)
            .map((batch) => batch.id);

        // Clear filter params but preserve other URL params (like courseId)
        const currentParams = new URLSearchParams(window.location.search);

        // Remove only filter-related params
        currentParams.delete('name');
        currentParams.delete('role');
        currentParams.delete('gender');
        currentParams.delete('status');
        currentParams.delete('batch');
        currentParams.delete('sessionExpiry');
        currentParams.delete('paymentStatus');
        currentParams.delete('approvalStatus');
        currentParams.delete('learnerType');

        // Remove custom field params
        if (instituteDetails?.dropdown_custom_fields) {
            instituteDetails.dropdown_custom_fields.forEach((customField) => {
                currentParams.delete(customField.fieldKey);
            });
        }

        // Keep session
        if (currentSession?.id) {
            currentParams.set('session', currentSession.id);
        }

        const newUrl = `${window.location.pathname}?${currentParams.toString()}`;
        window.history.replaceState({}, '', newUrl);

        // Remove all custom field params
        const newFilters: StudentFilterRequest = {
            name: '',
            package_session_ids: pksids,
            gender: [],
            statuses: instituteDetails?.student_statuses || [],
            session_expiry_days: [],
            sub_org_user_types: [],
            institute_ids: INSTITUTE_ID ? [INSTITUTE_ID] : [],
            group_ids: [],
            sort_columns: {},
            payment_statuses: [],
            type: undefined,
        };

        setAppliedFilters(newFilters);
    };

    const handleSearchInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        setSearchInput(event.target.value);
    };

    const handleSearchEnter = async () => {
        setSearchFilter(searchInput);

        // Update URL with search name
        const currentParams = new URLSearchParams(window.location.search);
        if (searchInput) {
            currentParams.set('name', searchInput);
        } else {
            currentParams.delete('name');
        }
        const newUrl = `${window.location.pathname}?${currentParams.toString()}`;
        window.history.replaceState({}, '', newUrl);

        setAppliedFilters((prev) => ({
            ...prev,
            name: searchInput,
        }));
    };

    const handleClearSearch = async () => {
        setSearchInput('');
        setSearchFilter('');

        // Remove name from URL but keep session
        const currentParams = new URLSearchParams(window.location.search);
        currentParams.delete('name');
        const newUrl = `${window.location.pathname}?${currentParams.toString()}`;
        window.history.replaceState({}, '', newUrl);

        setAppliedFilters((prev) => ({
            ...prev,
            name: '',
        }));
    };

    const getActiveFiltersState = useCallback(() => {
        const batchFilter = columnFilters.find((filter) => filter.id === 'batch');
        const statusFilter = columnFilters.find((filter) => filter.id === 'statuses');
        const sessionExpiryFilter = columnFilters.find(
            (filter) => filter.id === 'session_expiry_days'
        );
        const paymentStatusFilter = columnFilters.find((filter) => filter.id === 'payment_statuses');
        const approvalStatusFilter = columnFilters.find((filter) => filter.id === 'approval_statuses');
        const learnerTypeFilter = columnFilters.find((filter) => filter.id === 'learner_type');

        const hasBatch = Boolean(batchFilter?.value && batchFilter.value.length > 0);
        const hasName = Boolean(appliedFilters.name?.trim());
        const hasGender = Array.isArray(appliedFilters.gender) && appliedFilters.gender.length > 0;
        const hasStatus = Boolean(statusFilter?.value && statusFilter.value.length > 0);
        const hasSessionExpiry = Boolean(
            sessionExpiryFilter?.value && sessionExpiryFilter.value.length > 0
        );
        const hasPaymentStatus = Boolean(paymentStatusFilter?.value && paymentStatusFilter.value.length > 0);
        const hasApprovalStatus = Boolean(approvalStatusFilter?.value && approvalStatusFilter.value.length > 0);
        const hasLearnerType = Boolean(learnerTypeFilter?.value && learnerTypeFilter.value.length > 0);

        return Boolean(hasName || hasGender || hasStatus || hasBatch || hasSessionExpiry || hasPaymentStatus || hasApprovalStatus || hasLearnerType);
    }, [columnFilters, appliedFilters]);

    return {
        columnFilters,
        appliedFilters,
        clearFilters,
        searchInput,
        searchFilter,
        currentSession,
        sessionList,
        getActiveFiltersState,
        handleFilterChange,
        handleFilterClick,
        handleClearFilters,
        handleSearchInputChange,
        handleSearchEnter,
        handleClearSearch,
        setAppliedFilters,
        handleSessionChange,
        setColumnFilters,
    };
};
