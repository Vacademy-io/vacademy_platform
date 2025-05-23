export enum TokenKey {
    accessToken = "accessToken",
    refreshToken = "refreshToken",
}

export interface Tokens {
    accessToken: string;
    refreshToken: string;
}

export interface Role {
    name: string;
    createdTime: string;
    displayName: string;
    description?: string;
    users: string[];
    groups: string[];
    roles: string[];
    domains: string[];
    isEnabled: boolean;
}

interface Authority {
    permissions: string[];
    roles: string[];
}

export interface IAccessToken {
    fullname: string;
    user: string;
    email: string;
    is_root_user: boolean;
    authorities: Record<string, Authority>;
    username: string;
    sub: string;
    iat: number;
    exp: number;
}
