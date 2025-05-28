import { StepOneData } from "../../schemas/student/student-list/schema-enroll-students-manually";
import { StepTwoData } from "../../schemas/student/student-list/schema-enroll-students-manually";
import { StepThreeData } from "../../schemas/student/student-list/schema-enroll-students-manually";
import { StepFourData } from "../../schemas/student/student-list/schema-enroll-students-manually";
import { StepFiveData } from "../../schemas/student/student-list/schema-enroll-students-manually";

export interface FormData {
    stepOneData: StepOneData | null;
    stepTwoData: StepTwoData | null;
    stepThreeData: StepThreeData | null;
    stepFourData: StepFourData | null;
    stepFiveData: StepFiveData | null;
}

export interface EnrollStudentRequest {
    formData: FormData;
    packageSessionId: string;
}
