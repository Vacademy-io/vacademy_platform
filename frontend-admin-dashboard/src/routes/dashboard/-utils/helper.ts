import { UserRolesDataEntry } from '@/types/dashboard/user-roles';

const VALID_ROLES = [
    'ADMIN',
    'COURSE CREATOR',
    'ASSESSMENT CREATOR',
    'EVALUATOR',
    'TEACHER',
] as const;
type RoleName = (typeof VALID_ROLES)[number];

export function countAdminRoles(users: UserRolesDataEntry[]) {
    const roleCounts: Record<RoleName, number> = {
        ADMIN: 0,
        'COURSE CREATOR': 0,
        'ASSESSMENT CREATOR': 0,
        EVALUATOR: 0,
        TEACHER: 0,
    };

    users.forEach((user) => {
        user.roles.forEach((role) => {
            if (VALID_ROLES.includes(role.role_name as RoleName)) {
                roleCounts[role.role_name as RoleName]++;
            }
        });
    });

    return roleCounts;
}
