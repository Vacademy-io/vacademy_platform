// Input data structure
interface Level {
    id: string;
    level_name: string;
    duration_in_days: number | null;
}

interface Session {
    id: string;
    session_name: string;
    status: string;
}

interface PackageDTO {
    id: string;
    package_name: string;
}

export interface BatchData {
    id: string;
    level: Level;
    session: Session;
    start_time: string;
    status: string;
    package_dto: PackageDTO;
}
