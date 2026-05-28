import { fetchSlideActivityStats } from './slide-activity-stats';
import { fetchAssignmentSlideLogs } from './user-slide-activity-logs';
import { getPublicUrl } from '@/services/upload_file';
import { convertToLocalDateTime, extractDateTime } from '@/constants/helper';
import type { UserActivity } from '@/types/study-library/activity-stats-response-type';
import type { ActivityContent } from '@/types/study-library/user-slide-activity-response-type';

const csvEscape = (v: string | number | null | undefined) => {
    if (v == null) return '';
    const s = String(v).replace(/"/g, '""');
    return `"${s}"`;
};

const PAGE_SIZE = 50;
const MAX_PAGES = 1000;

export const downloadAllAssignmentSubmissions = async (slideId: string) => {
    if (!slideId) return;

    const allUsers: UserActivity[] = [];
    let currentPage = 0;
    let lastPage = false;
    while (!lastPage && currentPage < MAX_PAGES) {
        const statsPage = await fetchSlideActivityStats(slideId, currentPage, PAGE_SIZE);
        const batch = statsPage.content ?? [];
        allUsers.push(...batch);
        lastPage = statsPage.last;
        currentPage++;
        if (batch.length === 0) break;
    }

    const header = [
        'Student Name',
        'User ID',
        'Status',
        'Late',
        'Upload Date',
        'Upload Time',
        'Marks',
        'Feedback',
        'File URLs',
        'Checked Copy URL',
    ].join(',');
    const csvRows: string[] = [header];

    for (const user of allUsers) {
        let logPage = 0;
        let logLast = false;
        let hasSubmission = false;
        while (!logLast && logPage < MAX_PAGES) {
            const logs = await fetchAssignmentSlideLogs(user.userId, slideId, logPage, PAGE_SIZE);
            const items = (logs.content ?? []) as ActivityContent[];
            for (const item of items) {
                if (!item.assignment_slides?.length) continue;
                for (const submission of item.assignment_slides) {
                    hasSubmission = true;
                    const dateInfo = submission.date_submitted
                        ? extractDateTime(convertToLocalDateTime(submission.date_submitted))
                        : { date: '', time: '' };

                    const fileIds = (submission.comma_separated_file_ids || '')
                        .split(',')
                        .map((s) => s.trim())
                        .filter(Boolean);
                    const fileUrls = await Promise.all(fileIds.map((fid) => getPublicUrl(fid)));
                    const checkedUrl = submission.checked_file_id
                        ? await getPublicUrl(submission.checked_file_id)
                        : '';
                    const isGraded =
                        (submission.marks != null && submission.marks > 0) ||
                        !!submission.feedback ||
                        !!submission.checked_file_id;
                    const status = isGraded ? 'Checked' : 'Pending Review';

                    csvRows.push(
                        [
                            csvEscape(user.fullName),
                            csvEscape(user.userId),
                            csvEscape(status),
                            csvEscape(submission.late_submission ? 'Yes' : 'No'),
                            csvEscape(dateInfo.date),
                            csvEscape(dateInfo.time),
                            csvEscape(submission.marks ?? ''),
                            csvEscape(submission.feedback ?? ''),
                            csvEscape(fileUrls.join(' | ')),
                            csvEscape(checkedUrl),
                        ].join(',')
                    );
                }
            }
            logLast = logs.last;
            logPage++;
            if (items.length === 0) break;
        }

        if (!hasSubmission) {
            csvRows.push(
                [
                    csvEscape(user.fullName),
                    csvEscape(user.userId),
                    csvEscape('Not Submitted'),
                    '',
                    '',
                    '',
                    '',
                    '',
                    '',
                    '',
                ].join(',')
            );
        }
    }

    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'all_assignment_submissions.csv';
    link.click();
    URL.revokeObjectURL(url);
};
