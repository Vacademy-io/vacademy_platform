import { createFileRoute } from '@tanstack/react-router';

interface CertificateStudentDataSearchParams {
    students?: string | string[];
}

// Route definition only - component is lazy loaded from index.lazy.tsx
export const Route = createFileRoute('/certificate-generation/student-data/')({
    validateSearch: (search): CertificateStudentDataSearchParams => {
        console.log('🔍 Route validateSearch called with:', search);
        console.log('🔍 Route validateSearch - students type:', typeof search.students);
        console.log('🔍 Route validateSearch - students value:', search.students);

        const result = {
            students: search.students as string | string[] | undefined,
        };
        console.log('🔍 Route validateSearch result:', result);
        return result;
    },
});
