export interface BatchType {
    batch_name: string;
    batch_status: 'ACTIVE' | 'INACTIVE';
    count_students: number;
    start_date: string;
    package_session_id: string;
    invite_code: string;
}
export interface PackageType {
    id: string;
    package_name: string;
    thumbnail_file_id: string;
}

export interface batchWithStudentDetails {
    package_dto: PackageType;
    batches: BatchType[];
}

export type batchesWithStudents = batchWithStudentDetails[];
