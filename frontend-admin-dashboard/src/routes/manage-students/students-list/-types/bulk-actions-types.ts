import { StudentTable } from '@/types/student-table-types';
import { SubmissionStudentData } from '@/types/assessments/assessment-overview';

export interface BulkActionInfo {
    selectedStudentIds: string[];
    selectedStudents: StudentTable[]; // Add this
    displayText: string;
}

export interface AssessmentSubmissionsBulkActionInfo {
    selectedStudentIds: string[];
    selectedStudents: SubmissionStudentData[]; // Add this
    displayText: string;
}
