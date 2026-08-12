/**
 * Knowledge Base API client.
 *
 * All calls go through authenticatedAxiosInstance: the backend derives the
 * institute from the verified JWT, so no institute id is ever sent from here for
 * dashboard callers.
 */
import authenticatedAxiosInstance from '@/lib/auth/axiosInstance';
import { AI_SERVICE_BASE_URL } from '@/constants/urls';
import type {
    AddSourceResult,
    AskResponse,
    IngestEstimate,
    KbPurpose,
    KnowledgeBase,
    KnowledgeSource,
    OutlineNode,
    ReviewPage,
    SourceKind,
} from '../-types';

const BASE = `${AI_SERVICE_BASE_URL}/knowledge-base/v1`;

export const listKnowledgeBases = async (): Promise<KnowledgeBase[]> => {
    const { data } = await authenticatedAxiosInstance.get<{ knowledge_bases: KnowledgeBase[] }>(
        `${BASE}/bases`
    );
    return data.knowledge_bases ?? [];
};

export const getKnowledgeBase = async (kbId: string): Promise<KnowledgeBase> => {
    const { data } = await authenticatedAxiosInstance.get<KnowledgeBase>(`${BASE}/bases/${kbId}`);
    return data;
};

export const createKnowledgeBase = async (payload: {
    name: string;
    description?: string;
    purpose: KbPurpose;
    language_hint?: string;
}): Promise<KnowledgeBase> => {
    const { data } = await authenticatedAxiosInstance.post<KnowledgeBase>(`${BASE}/bases`, payload);
    return data;
};

export const updateKnowledgeBase = async (
    kbId: string,
    payload: Partial<{
        name: string;
        description: string;
        purpose: KbPurpose;
        language_hint: string;
        status: 'ACTIVE' | 'ARCHIVED';
    }>
): Promise<KnowledgeBase> => {
    const { data } = await authenticatedAxiosInstance.patch<KnowledgeBase>(
        `${BASE}/bases/${kbId}`,
        payload
    );
    return data;
};

export const deleteKnowledgeBase = async (kbId: string): Promise<void> => {
    await authenticatedAxiosInstance.delete(`${BASE}/bases/${kbId}`);
};

export const listSources = async (kbId: string): Promise<KnowledgeSource[]> => {
    const { data } = await authenticatedAxiosInstance.get<{ sources: KnowledgeSource[] }>(
        `${BASE}/bases/${kbId}/sources`
    );
    return data.sources ?? [];
};

/**
 * Credit preview BEFORE committing to an ingest.
 *
 * `numPages` comes from counting the PDF locally with pdfjs, so the number shows
 * up instantly. The server recomputes it at charge time — this is a preview, not
 * an authority.
 */
export const estimateSource = async (
    kbId: string,
    payload: { source_kind: SourceKind; num_pages?: number; file_id?: string }
): Promise<IngestEstimate> => {
    const { data } = await authenticatedAxiosInstance.post<IngestEstimate>(
        `${BASE}/bases/${kbId}/sources/estimate`,
        payload
    );
    return data;
};

export const addSource = async (
    kbId: string,
    payload: {
        source_kind: SourceKind;
        title?: string;
        file_id?: string;
        source_url?: string;
        raw_text?: string;
        expected_pages?: number;
    }
): Promise<AddSourceResult> => {
    const { data } = await authenticatedAxiosInstance.post<AddSourceResult>(
        `${BASE}/bases/${kbId}/sources`,
        payload
    );
    return data;
};

export const getSource = async (sourceId: string): Promise<KnowledgeSource> => {
    const { data } = await authenticatedAxiosInstance.get<KnowledgeSource>(
        `${BASE}/sources/${sourceId}`
    );
    return data;
};

export const setSourceActive = async (
    sourceId: string,
    isActive: boolean
): Promise<KnowledgeSource> => {
    const { data } = await authenticatedAxiosInstance.patch<KnowledgeSource>(
        `${BASE}/sources/${sourceId}`,
        { is_active: isActive }
    );
    return data;
};

export const reindexSource = async (sourceId: string): Promise<void> => {
    await authenticatedAxiosInstance.post(`${BASE}/sources/${sourceId}/reindex`);
};

export const deleteSource = async (sourceId: string): Promise<void> => {
    await authenticatedAxiosInstance.delete(`${BASE}/sources/${sourceId}`);
};

export const listReviewPages = async (kbId: string): Promise<ReviewPage[]> => {
    const { data } = await authenticatedAxiosInstance.get<{ pages: ReviewPage[] }>(
        `${BASE}/bases/${kbId}/review-pages`
    );
    return data.pages ?? [];
};

export const getOutline = async (kbId: string): Promise<OutlineNode[]> => {
    const { data } = await authenticatedAxiosInstance.get<{ nodes: OutlineNode[] }>(
        `${BASE}/bases/${kbId}/outline`
    );
    return data.nodes ?? [];
};

export const askKnowledgeBase = async (
    kbId: string,
    payload: {
        question: string;
        history?: Array<{ role: string; content: string }>;
        answer_language?: string;
    }
): Promise<AskResponse> => {
    const { data } = await authenticatedAxiosInstance.post<AskResponse>(
        `${BASE}/bases/${kbId}/ask`,
        payload
    );
    return data;
};

/**
 * Count pages in a PDF in the browser so the credit estimate can be shown before
 * the upload even starts. Returns null if the file can't be read (encrypted,
 * corrupt) — the caller then falls back to the server-side count.
 */
export const countPdfPages = async (file: File): Promise<number | null> => {
    try {
        const { PDFDocument } = await import('pdf-lib');
        const bytes = await file.arrayBuffer();
        // ignoreEncryption: a password-protected PDF still reports its page count,
        // and refusing here would block the estimate for no benefit.
        const doc = await PDFDocument.load(bytes, { ignoreEncryption: true });
        return doc.getPageCount();
    } catch {
        return null;
    }
};
