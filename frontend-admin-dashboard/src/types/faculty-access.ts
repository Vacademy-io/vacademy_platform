/**
 * Faculty Access Types
 * Types for faculty access control and user access details API
 */

export type AccessType = 'PACKAGE' | 'PACKAGE_SESSION';
export type AccessPermission = string;
export type LinkageType = 'INHERITED' | 'DIRECT' | 'PARTNERSHIP' | 'SUB_ORG';
export type AccessStatus = 'ACTIVE' | 'INACTIVE';
export type UserType = 'role' | 'user';

export interface AccessMapping {
    id: string;
    userType: UserType;
    typeId: string;
    accessType: AccessType;
    accessId: string;
    accessPermission: AccessPermission;
    /** INHERITED | DIRECT | PARTNERSHIP; may be omitted in older API responses */
    linkageType?: LinkageType;
    suborgId: string;
    packageSessionId: string;
    subjectId: string;
    status: AccessStatus;
    name: string;
    instituteLogoFileId?: string;
}

export interface UserAccessDetailsResponse {
    userId: string;
    instituteId: string;
    accessMappings: AccessMapping[];
}

export interface SubOrgAccess {
    subOrgId: string;
    subOrgName?: string;
    instituteLogoFileId?: string;
    /** When PARTNERSHIP, show "Powered by [original institute]" in the header */
    linkageType?: LinkageType;
    packageIds: string[];
    packageSessionIds: string[];
    permissions: string[];
}

export interface FacultyAccessData {
    subOrgs: SubOrgAccess[];
    selectedSubOrgId: string | null;
    globalPackageIds: string[];
    globalPackageSessionIds: string[];
    permissions: string[];
}
