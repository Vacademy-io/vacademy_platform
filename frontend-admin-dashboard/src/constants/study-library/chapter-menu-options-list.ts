import { getTerminology } from '@/components/common/layout-container/sidebar/utils';
import { DropdownItem } from '@/components/design-system/utils/types/dropdown-types';
import { ContentTerms, SystemTerms } from '@/routes/settings/-components/NamingSettings';

export const dropdownList: DropdownItem[] = [
    {
        label: `View ${getTerminology(ContentTerms.Chapters, SystemTerms.Chapters)}`,
        value: 'view',
    },
    {
        label: `Edit ${getTerminology(ContentTerms.Chapters, SystemTerms.Chapters)} Details`,
        value: 'edit',
    },
    {
        label: 'Copy to',
        value: 'copy',
    },
    {
        label: 'Move to',
        value: 'move',
    },
    {
        label: 'Delete',
        value: 'delete',
    },
];
