import { DashboardLoader } from '@/components/core/dashboard-loader';
import { useStudyLibraryQuery } from '@/routes/study-library/courses/-services/getStudyLibraryDetails';
import { useStudyLibraryStore } from '@/stores/study-library/use-study-library-store';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, createContext, useContext } from 'react';

interface StudyLibraryContextType {
    isInitLoading: boolean;
}

const StudyLibraryContext = createContext<StudyLibraryContextType>({
    isInitLoading: false,
});

export const useStudyLibraryContext = () => {
    const context = useContext(StudyLibraryContext);
    if (!context) {
        throw new Error('useStudyLibraryContext must be used within InitStudyLibraryProvider');
    }
    return context;
};

interface InitStudyLibraryProviderProps {
    children: React.ReactNode;
    /** When provided, uses course-init API to fetch study library data for a specific course */
    courseId?: string;
}

export const InitStudyLibraryProvider = ({ children, courseId }: InitStudyLibraryProviderProps) => {
    const queryClient = useQueryClient();

    const { studyLibraryData, isInitLoading } = useStudyLibraryStore();

    // Trigger refetch manually on mount
    useEffect(() => {
        if (studyLibraryData == null) {
            const queryKey = courseId
                ? ['GET_INIT_STUDY_LIBRARY', 'course', courseId]
                : ['GET_INIT_STUDY_LIBRARY'];
            queryClient.invalidateQueries({ queryKey });
        }
    }, [queryClient, courseId]);

    const { isLoading: queryLoading } = useQuery({
        ...useStudyLibraryQuery(courseId),
    });

    // Only show full page loader on initial load, not on subsequent refreshes
    const showFullPageLoader = queryLoading && studyLibraryData == null;

    return (
        <StudyLibraryContext.Provider value={{ isInitLoading }}>
            <div className="flex flex-1 flex-col">
                {showFullPageLoader ? <DashboardLoader /> : children}
            </div>
        </StudyLibraryContext.Provider>
    );
};
