import { getTerminology } from '@/components/common/layout-container/sidebar/utils';
import { FilterConfig } from '@/routes/manage-students/students-list/-types/students-list-types';
import { ContentTerms, SystemTerms } from '@/routes/settings/-components/NamingSettings';
import { InstituteDetailsType } from '@/schemas/student/student-list/institute-schema';
import { removeDefaultPrefix } from '@/utils/helpers/removeDefaultPrefix';
import { ALL_SESSIONS_ID } from '@/routes/manage-students/students-list/-hooks/useStudentFilters';

export const GetFilterData = (
    instituteDetails: InstituteDetailsType,
    _currentSession: string,
    campaigns?: { id?: string; campaign_name: string }[]
) => {
    const statuses = instituteDetails?.student_statuses.map((status, index) => ({
        id: index.toString(),
        label: status,
    }));

    const genders = instituteDetails?.genders.map((gender, index) => ({
        id: index.toString(),
        label: gender,
    }));

    const sessionExpiry = instituteDetails?.session_expiry_days.map((days, index) => ({
        id: index.toString(),
        label: `Expiring in ${days} days`,
    }));

    // Check if any batch has is_org_associated = true
    const hasOrgAssociatedBatches = instituteDetails?.batches_for_sessions.some(
        (batch) => batch.is_org_associated === true
    );

    // When the "all sessions" sentinel is selected (or no session yet), don't filter
    // batches by session — that filter is the reason the batch chip used to show empty
    // on first load. The chip's own async autocomplete (PACKAGE_AUTOCOMPLETE_URL) still
    // takes over once admin types a search term.
    const showAllSessionsBatches = !_currentSession || _currentSession === ALL_SESSIONS_ID;
    const batchesInScope = (instituteDetails?.batches_for_sessions || []).filter((batch) =>
        showAllSessionsBatches ? true : batch.session.id === _currentSession
    );

    const filterData: FilterConfig[] = [
        {
            id: 'batch',
            title: getTerminology(ContentTerms.Batch, SystemTerms.Batch),
            filterList: batchesInScope
                .map((batch) => ({
                    id: batch.id,
                    label: `${removeDefaultPrefix(batch.package_dto.package_name)}${batch.level.level_name && batch.level.level_name !== 'DEFAULT' ? ` - ${removeDefaultPrefix(batch.level.level_name)}` : ''}`.trim(),
                }))
                .slice(0, 10),
        },
        {
            id: 'statuses',
            title: 'Status',
            filterList: statuses || [],
        },
        {
            id: 'gender',
            title: 'Gender',
            filterList: genders || [],
        },
        {
            id: 'session_expiry_days',
            title: `${getTerminology(ContentTerms.Session, SystemTerms.Session)} Expiry`,
            filterList: sessionExpiry || [],
        },
        {
            id: 'payment_statuses',
            title: 'Payment Status',
            filterList: [
                { id: 'PAID', label: 'Paid' },
                { id: 'FAILED', label: 'Failed' },
                { id: 'PAYMENT_FAILED', label: 'Payment Failed' },
            ],
        },
        {
            id: 'approval_statuses',
            title: 'Approval Status',
            filterList: [
                { id: 'PENDING_FOR_APPROVAL', label: 'Pending for Approval' },
                { id: 'INVITED', label: 'Invited' },
            ],
        },
        {
            id: 'learner_type',
            title: 'Cart Status',
            filterList: [
                { id: 'ABANDONED_CART', label: 'Abandoned Cart' },
            ],
        },
    ];

    // Add role filter if org-associated batches exist
    if (hasOrgAssociatedBatches && instituteDetails?.sub_org_roles) {
        const roles = instituteDetails.sub_org_roles.map((role, index) => ({
            id: role,
            label: role.replace(/_/g, ' '),
        }));

        filterData.push({
            id: 'sub_org_user_types',
            title: 'Role',
            filterList: roles,
        });
    }

    // Add audience (campaign) filter — joins audience_response when applied
    if (campaigns && campaigns.length > 0) {
        const audienceOptions = campaigns
            .filter((c) => c.id)
            .map((c) => ({ id: c.id!, label: c.campaign_name }));
        if (audienceOptions.length > 0) {
            filterData.push({
                id: 'audience_ids',
                title: 'Audience',
                filterList: audienceOptions,
            });
        }
    }

    // Add custom field filters
    if (instituteDetails?.dropdown_custom_fields) {
        instituteDetails.dropdown_custom_fields.forEach((customField) => {
            try {
                const config = JSON.parse(customField.config);
                const options = config.map((option: any) => ({
                    id: option.value,
                    label: option.label,
                }));

                filterData.push({
                    id: customField.fieldKey,
                    title: customField.fieldName,
                    filterList: options,
                });
            } catch (error) {
                console.error(`Error parsing custom field config for ${customField.fieldName}:`, error);
            }
        });
    }

    return filterData;
};
