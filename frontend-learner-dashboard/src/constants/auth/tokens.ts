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

interface UserAuthorities {
  permissions: string[];
  roles: string[];
}

export interface IAccessToken {
  user: string;
  email: string;
  is_root_user: boolean;
  authorities: Record<string, UserAuthorities>;
  username: string;
  sub: string;
  iat: number;
  exp: number;
}

// export interface IAccessToken {
//     owner: string;
//     name: string;
//     avatar: string;
//     roles: Role[];
// }
