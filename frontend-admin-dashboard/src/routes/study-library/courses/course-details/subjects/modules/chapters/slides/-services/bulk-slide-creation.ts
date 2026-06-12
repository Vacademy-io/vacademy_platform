// Plain-function slide creation for bulk flows.
//
// useSlidesMutations is bound to a single chapterId, so multi-chapter bulk flows
// (Bulk Content Uploading) can't use it. These functions post the exact payload
// shapes proven in -quick-add.tsx / the AI copilot's courseCreationService, with
// the chapter/module/subject context passed per call. Slide ids are returned so
// callers can build reorder payloads.

import authenticatedAxiosInstance from '@/lib/auth/axiosInstance';
import {
    ADD_UPDATE_DOCUMENT_SLIDE,
    ADD_UPDATE_VIDEO_SLIDE,
    UPDATE_SLIDE_ORDER,
} from '@/constants/urls';
import type { DocumentSlidePayload, VideoSlidePayload } from '../-hooks/use-slides';

export interface BulkSlideContext {
    chapterId: string;
    moduleId: string;
    subjectId: string;
    packageSessionId: string;
    instituteId: string;
    status: 'PUBLISHED' | 'DRAFT';
    notify: boolean;
}

const documentSlideUrl = (ctx: BulkSlideContext) =>
    `${ADD_UPDATE_DOCUMENT_SLIDE}?chapterId=${ctx.chapterId}&moduleId=${ctx.moduleId}&subjectId=${ctx.subjectId}&packageSessionId=${ctx.packageSessionId}&instituteId=${ctx.instituteId}`;

const videoSlideUrl = (ctx: BulkSlideContext) =>
    `${ADD_UPDATE_VIDEO_SLIDE}?chapterId=${ctx.chapterId}&instituteId=${ctx.instituteId}&packageSessionId=${ctx.packageSessionId}&moduleId=${ctx.moduleId}&subjectId=${ctx.subjectId}`;

const postDocumentSlide = async (
    ctx: BulkSlideContext,
    payload: DocumentSlidePayload
): Promise<string> => {
    const response = await authenticatedAxiosInstance.post(documentSlideUrl(ctx), payload);
    return response.data || payload.id;
};

const postVideoSlide = async (
    ctx: BulkSlideContext,
    payload: VideoSlidePayload
): Promise<string> => {
    const response = await authenticatedAxiosInstance.post(videoSlideUrl(ctx), payload);
    return response.data || payload.id;
};

const escapeForSingleQuotedAttr = (val: string) =>
    String(val).replace(/&/g, '&amp;').replace(/'/g, '&#39;');

export const createPdfSlide = (
    ctx: BulkSlideContext,
    args: { title: string; fileId: string; totalPages: number; slideOrder: number }
): Promise<string> => {
    const published = ctx.status === 'PUBLISHED';
    return postDocumentSlide(ctx, {
        id: crypto.randomUUID(),
        title: args.title,
        image_file_id: '',
        description: null,
        slide_order: args.slideOrder,
        document_slide: {
            id: crypto.randomUUID(),
            type: 'PDF',
            data: args.fileId,
            title: args.title,
            cover_file_id: '',
            total_pages: args.totalPages,
            published_data: published ? args.fileId : null,
            published_document_total_pages: published ? args.totalPages : 0,
        },
        status: ctx.status,
        new_slide: true,
        notify: ctx.notify,
    });
};

export const createDocHtmlSlide = (
    ctx: BulkSlideContext,
    args: {
        title: string;
        html: string;
        totalPages: number;
        slideOrder: number;
        description?: string;
    }
): Promise<string> => {
    const published = ctx.status === 'PUBLISHED';
    return postDocumentSlide(ctx, {
        id: crypto.randomUUID(),
        title: args.title,
        image_file_id: '',
        description: args.description ?? null,
        slide_order: args.slideOrder,
        document_slide: {
            id: crypto.randomUUID(),
            type: 'DOC',
            data: args.html,
            title: args.title,
            cover_file_id: '',
            total_pages: args.totalPages,
            published_data: published ? args.html : null,
            published_document_total_pages: published ? args.totalPages : 0,
        },
        status: ctx.status,
        new_slide: true,
        notify: ctx.notify,
    });
};

/** Image becomes a DOC document slide wrapping an <img> (same as quick-add IMAGE kind). */
export const createImageSlide = (
    ctx: BulkSlideContext,
    args: { title: string; publicImageUrl: string; slideOrder: number }
): Promise<string> => {
    const html = `<!DOCTYPE html><html><head></head><body><div><div style='margin-left: 0px; display: flex; width: 100%; justify-content: center;'><img data-meta-align='center' data-meta-depth='0' src='${args.publicImageUrl}' alt='${escapeForSingleQuotedAttr(args.title)}' width='0' height='0' objectFit='contain'/></div></div></body></html>`;
    return createDocHtmlSlide(ctx, {
        title: args.title,
        html,
        totalPages: 1,
        slideOrder: args.slideOrder,
        description: 'Image',
    });
};

export const createExternalLinkSlide = (
    ctx: BulkSlideContext,
    args: { title: string; url: string; slideOrder: number }
): Promise<string> => {
    const html = `<html><head></head><body><p><a href='${args.url}' target='_blank' rel='noreferrer noopener'>${args.url}</a></p></body></html>`;
    return createDocHtmlSlide(ctx, {
        title: args.title,
        html,
        totalPages: 1,
        slideOrder: args.slideOrder,
        description: 'External link',
    });
};

export const createVideoFileSlide = (
    ctx: BulkSlideContext,
    args: { title: string; fileId: string; slideOrder: number }
): Promise<string> => {
    const published = ctx.status === 'PUBLISHED';
    return postVideoSlide(ctx, {
        id: crypto.randomUUID(),
        title: args.title,
        description: null,
        image_file_id: null,
        slide_order: args.slideOrder,
        video_slide: {
            id: crypto.randomUUID(),
            description: '',
            url: args.fileId,
            title: args.title,
            video_length_in_millis: 0,
            published_url: published ? args.fileId : '',
            published_video_length_in_millis: 0,
            source_type: 'FILE_ID',
        },
        status: ctx.status,
        new_slide: true,
        notify: ctx.notify,
    });
};

/** YouTube link — quick-add uses source_type 'VIDEO' for YouTube URLs. */
export const createYoutubeSlide = (
    ctx: BulkSlideContext,
    args: { title: string; url: string; slideOrder: number }
): Promise<string> => {
    const published = ctx.status === 'PUBLISHED';
    return postVideoSlide(ctx, {
        id: crypto.randomUUID(),
        title: args.title,
        description: null,
        image_file_id: null,
        slide_order: args.slideOrder,
        video_slide: {
            id: crypto.randomUUID(),
            description: '',
            url: args.url,
            title: args.title,
            video_length_in_millis: 0,
            published_url: published ? args.url : '',
            published_video_length_in_millis: 0,
            source_type: 'VIDEO',
        },
        status: ctx.status,
        new_slide: true,
        notify: ctx.notify,
    });
};

export const updateChapterSlideOrder = async (
    chapterId: string,
    slideOrderPayload: { slide_id: string; slide_order: number }[]
): Promise<void> => {
    await authenticatedAxiosInstance.put(
        `${UPDATE_SLIDE_ORDER}?chapterId=${chapterId}`,
        slideOrderPayload
    );
};
