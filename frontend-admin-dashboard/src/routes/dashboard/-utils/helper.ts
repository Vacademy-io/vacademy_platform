import { UserRole } from '@/services/student-list-section/getAdminDetails';
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

    if (!Array.isArray(users)) {
        return roleCounts;
    }

    users.forEach((user) => {
        user.roles.forEach((role) => {
            if (VALID_ROLES.includes(role.role_name as RoleName)) {
                roleCounts[role.role_name as RoleName]++;
            }
        });
    });

    return roleCounts;
}

export function getModifiedAdminRoles(roles: UserRole[], oldRoles: string[], newRoles: string[]) {
    const add_user_role_request: string[] = [];
    const delete_user_role_request: string[] = [];

    // Convert old and new roles to Sets for efficient lookup
    const oldSet = new Set(oldRoles);
    const newSet = new Set(newRoles);

    // Add: roles in newRoles but not in oldRoles
    for (const roleName of newRoles) {
        if (!oldSet.has(roleName)) {
            add_user_role_request.push(roleName); // push the 'id' for adding
        }
    }

    // Delete: roles in oldRoles but not in newRoles
    for (const roleName of oldRoles) {
        if (!newSet.has(roleName)) {
            const matchedRoles = roles.filter((role) => role.role_name === roleName);
            for (const role of matchedRoles) {
                delete_user_role_request.push(role.id); // push the 'role_id' for deleting
            }
        }
    }

    return { add_user_role_request, delete_user_role_request };
}
