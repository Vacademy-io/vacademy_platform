import { Users, Scroll, FileMagnifyingGlass } from '@phosphor-icons/react';
import { SidebarItemsType } from '@/types/layout-container/layout-container-types';
import { getTerminology } from '@/components/common/layout-container/sidebar/utils';
import { RoleTerms, SystemTerms } from '@/routes/settings/-components/NamingSettings';
import i18n from '@/i18n';

// Module-scope data consumed at import time by `mySidebar.tsx` (outside this
// batch); `useTranslation()` can't be called here since this isn't a
// component/hook, so we call the shared i18next singleton directly with a
// fixed namespace (same fallback pattern used elsewhere for module-scope
// strings with no React context).
const NAMESPACE = 'evaluatorAiSidebarUtils';

export const SidebarItemsData: SidebarItemsType[] = [
    {
        icon: Users,
        title: i18n.t('studentListTitle', {
            ns: NAMESPACE,
            term: getTerminology(RoleTerms.Learner, SystemTerms.Learner),
        }),
        id: 'student-mangement',
        to: '/evaluator-ai/students',
    },
    {
        icon: Scroll,
        title: i18n.t('assessmentCentre', { ns: NAMESPACE }),
        id: 'assessment-centre',
        to: '/evaluator-ai/assessment',
    },
    {
        icon: FileMagnifyingGlass,
        title: i18n.t('evaluationCentre', { ns: NAMESPACE }),
        id: 'evaluation-centre',
        to: '/evaluator-ai/evaluation',
    },
];
