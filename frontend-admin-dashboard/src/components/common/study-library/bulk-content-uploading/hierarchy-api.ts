// Bulk Content Uploading — plain async hierarchy creation calls.
//
// These mirror the request shapes used by the AI copilot's courseCreationService
// and the add-subject/module/chapter mutation hooks, but as plain functions so
// the commit engine can loop over many chapters without hook constraints.

import authenticatedAxiosInstance from '@/lib/auth/axiosInstance';
import { ADD_CHAPTER, ADD_MODULE, ADD_SUBJECT } from '@/constants/urls';

/** Backend responses vary between {id}, {data:{id}} and bare entity — normalize. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const extractId = (data: any): string | undefined => data?.id || data?.data?.id;

export const createSubject = async (
    subjectName: string,
    packageSessionIds: string
): Promise<string> => {
    const payload = {
        id: crypto.randomUUID(),
        subject_name: subjectName,
        subject_code: subjectName.substring(0, 3).toUpperCase(),
        credit: 0,
        thumbnail_id: null,
        created_at: '',
        updated_at: '',
    };
    const response = await authenticatedAxiosInstance.post(
        `${ADD_SUBJECT}?commaSeparatedPackageSessionIds=${packageSessionIds}`,
        payload
    );
    const id = extractId(response.data);
    if (!id) throw new Error(`Subject "${subjectName}" was not created (no id returned).`);
    return id;
};

export const createModule = async (
    moduleName: string,
    subjectId: string,
    packageSessionId: string
): Promise<string> => {
    const payload = {
        id: crypto.randomUUID(),
        module_name: moduleName,
        status: 'ACTIVE',
        description: '',
        thumbnail_id: null,
    };
    const response = await authenticatedAxiosInstance.post(
        `${ADD_MODULE}?subjectId=${subjectId}&packageSessionId=${packageSessionId}`,
        payload
    );
    const id = extractId(response.data);
    if (!id) throw new Error(`Module "${moduleName}" was not created (no id returned).`);
    return id;
};

export const createChapter = async (
    chapterName: string,
    chapterOrder: number,
    subjectId: string,
    moduleId: string,
    packageSessionIds: string
): Promise<string> => {
    const payload = {
        id: crypto.randomUUID(),
        chapter_name: chapterName,
        status: 'ACTIVE',
        file_id: null,
        description: '',
        chapter_order: chapterOrder,
    };
    const response = await authenticatedAxiosInstance.post(
        `${ADD_CHAPTER}?subjectId=${subjectId}&moduleId=${moduleId}&commaSeparatedPackageSessionIds=${packageSessionIds}`,
        payload
    );
    const id = extractId(response.data);
    if (!id) throw new Error(`Chapter "${chapterName}" was not created (no id returned).`);
    return id;
};
