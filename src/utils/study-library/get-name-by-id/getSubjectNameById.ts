// utils/subject.ts

import { SubjectType } from "@/stores/study-library/use-study-library-store";

export const getSubjectName = (subjectId: string, studyLibraryData: SubjectType[] | null): string | null => {
    if(studyLibraryData==null) return null;

    const subject = studyLibraryData.find((subject)=>(subject.id==subjectId));
    return subject==undefined ? null : subject.subject_name;
};