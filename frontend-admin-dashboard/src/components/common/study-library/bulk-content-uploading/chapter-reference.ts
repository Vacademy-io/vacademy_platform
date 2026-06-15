// Bulk Content Uploading — chapter-reference CSV generator (CSV mode helper).
//
// Exports every chapter the institute has as CSV rows so a teacher can copy the
// chapter_id / package_session_id into their manifest. The empty file_name /
// title columns make it double as a manifest skeleton. Downloaded once (or when
// structure changes) — not part of the daily upload.

import Papa from 'papaparse';
import type { CourseWithSessionsType } from '@/stores/study-library/use-study-library-store';
import { buildExistingSnapshot, pooled } from './matching';
import type { BulkUploadContext } from './types';

export interface ChapterReferenceOptions {
    /** Restrict to these courses; omitted = every accessible course. */
    courseIds?: string[];
    /** Called as each package session's structure is fetched (drives the button label). */
    onProgress?: (done: number, total: number) => void;
}

interface ReferenceTarget {
    context: BulkUploadContext;
    courseName: string;
    batch: string;
}

export const generateChapterReferenceCsv = async (
    studyLibraryData: CourseWithSessionsType[],
    instituteId: string,
    options?: ChapterReferenceOptions
): Promise<Blob> => {
    const wanted = options?.courseIds?.length ? new Set(options.courseIds) : null;
    const courses = wanted
        ? studyLibraryData.filter((c) => wanted.has(c.course.id))
        : studyLibraryData;

    const targets: ReferenceTarget[] = [];
    for (const entry of courses) {
        for (const ps of entry.package_sessions ?? []) {
            targets.push({
                context: {
                    courseId: entry.course.id,
                    sessionId: ps.session.id,
                    levelId: ps.level.id,
                    packageSessionId: ps.id,
                    courseDepth: entry.course.course_depth ?? 5,
                    instituteId,
                },
                courseName: entry.course.package_name,
                batch: `${ps.session.session_name} - ${ps.level.level_name}`,
            });
        }
    }

    let done = 0;
    options?.onProgress?.(0, targets.length);
    const perTarget = await pooled(targets, 3, async (target) => {
        const rows: Record<string, string>[] = [];
        try {
            const snapshot = await buildExistingSnapshot(target.context);
            for (const subject of snapshot.subjects) {
                for (const moduleEntity of subject.modules) {
                    for (const chapter of moduleEntity.chapters) {
                        rows.push({
                            package_session_id: target.context.packageSessionId,
                            chapter_id: chapter.id,
                            chapter_name: chapter.name,
                            course: target.courseName,
                            batch: target.batch,
                            file_name: '',
                            title: '',
                            order: '',
                        });
                    }
                }
            }
        } catch {
            // skip courses whose structure can't be read
        }
        done += 1;
        options?.onProgress?.(done, targets.length);
        return rows;
    });

    const csv = Papa.unparse({
        fields: [
            'package_session_id',
            'chapter_id',
            'chapter_name',
            'course',
            'batch',
            'file_name',
            'title',
            'order',
        ],
        data: perTarget.flat(),
    });
    return new Blob([csv], { type: 'text/csv;charset=utf-8;' });
};
