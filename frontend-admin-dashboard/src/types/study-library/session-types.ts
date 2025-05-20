interface Session {
    id: string;
    session_name: string;
    status: string;
    start_date: string;
}

interface PackageDTO {
    id: string;
    package_name: string;
    thumbnail_file_id: string | null;
}

interface Level {
    id: string;
    level_name: string;
    duration_in_days: number | null;
    thumbnail_id: string | null;
}

interface LevelWithStatus {
    level_dto: Level;
    package_session_id: string;
    package_session_status: string;
    start_date: string;
}

export interface Package {
    package_dto: PackageDTO;
    level: LevelWithStatus[];
}

export interface SessionData {
    session: Session;
    packages: Package[];
}

export type SessionsResponse = SessionData[];
