// utils/subject.ts
import { useStudyLibraryStore } from "@/stores/study-library/use-study-library-store";

export const getSubjectName = (subjectId: string): string | null => {
    const { studyLibraryData } = useStudyLibraryStore();
    if(studyLibraryData==null) return null;

    const subject = studyLibraryData.find((subject)=>(subject.id==subjectId));
    return subject==undefined ? null : subject.subject_name;
};