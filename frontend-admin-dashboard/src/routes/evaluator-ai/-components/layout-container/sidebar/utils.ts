import { Users, Scroll, FileMagnifyingGlass } from '@phosphor-icons/react';
import { SidebarItemsType } from '@/types/layout-container/layout-container-types';

export const SidebarItemsData: SidebarItemsType[] = [
    {
        icon: Users,
        title: 'Learner List',
        id: 'student-mangement',
        to: '/evaluator-ai/students',
    },
    {
        icon: Scroll,
        title: 'Assessment Centre',
        id: 'assessment-centre',
        to: '/evaluator-ai/assessment',
    },
    {
        icon: FileMagnifyingGlass,
        title: 'Evaluation Centre',
        id: 'evaluation-centre',
        to: '/evaluator-ai/evaluation',
    },
];
