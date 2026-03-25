import { getTerminology } from '@/components/common/layout-container/sidebar/utils';
import { RoleTerms, SystemTerms } from '@/routes/settings/-components/NamingSettings';

const ROLE_MAPPING = {
    ADMIN: SystemTerms.Admin,
    'COURSE CREATOR': SystemTerms.CourseCreator,
    'ASSESSMENT CREATOR': SystemTerms.AssessmentCreator,
    EVALUATOR: SystemTerms.Evaluator,
    TEACHER: SystemTerms.Teacher,
    STUDENT: SystemTerms.Learner,
} as const;

type BackendRole = keyof typeof ROLE_MAPPING;

// Special mapping for role names that need to be normalized
const specialRoleMapping = (roleName: string): string => {
    // Remove spaces and convert to proper case for special roles
    switch (roleName) {
        case 'COURSE CREATOR':
            return RoleTerms.CourseCreator;
        case 'ASSESSMENT CREATOR':
            return RoleTerms.AssessmentCreator;
        default:
            return ROLE_MAPPING[roleName as BackendRole];
    }
};

const isSpecialRole = (roleName: string): boolean => {
    return roleName === 'COURSE CREATOR' || roleName === 'ASSESSMENT CREATOR';
};
/**
 * Maps a backend role name to its custom terminology based on naming settings
 * @param backendRole - The role name as received from backend
 * @returns The custom role name based on naming settings, or the original name if no mapping exists
 */
export const mapRoleToCustomName = (backendRole: string): string => {
    // Normalize the role name first
    if (isSpecialRole(backendRole)) {
        const systemTerm = ROLE_MAPPING[backendRole as BackendRole];
        return getTerminology(specialRoleMapping(backendRole), systemTerm);
    }
    const systemTerm = ROLE_MAPPING[backendRole as BackendRole];
    if (!systemTerm) return backendRole;
    return getTerminology(systemTerm, systemTerm);
};
