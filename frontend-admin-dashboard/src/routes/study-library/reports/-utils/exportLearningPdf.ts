import autoTable from 'jspdf-autotable';
import dayjs from 'dayjs';
import {
    createReportDoc,
    drawCards,
    drawTitleAndInfo,
    fmtDate,
    lastY,
    loadLogo,
    resolveTheme,
    sectionTitle,
    stampAllPages,
    tableBase,
} from './reportPdfKit';
import { convertMinutesToTimeFormat, formatToTwoDecimalPlaces } from '../-services/helper';
import { BatchReportResponse, LearnersReportResponse } from '../-types/types';

/**
 * Branded PDF export for the slide-wise Learning Reports (Batch & Learner),
 * matching the Live Class report style (institute logo, theme colour, watermark).
 */

export interface LearningPdfMeta {
    instituteName: string;
    logoUrl: string | null;
    courseName: string;
    dateRange: string;
    learnerName?: string;
}

export interface LearningLeaderboardRow {
    rank: number;
    full_name: string;
    avg_concentration: number;
    daily_avg_time: number;
    total_time: number;
}

const SUBTITLE = 'Learning Progress Report';

export async function exportBatchLearningPdf(
    meta: LearningPdfMeta,
    report: BatchReportResponse,
    leaderboard: LearningLeaderboardRow[]
) {
    const doc = createReportDoc();
    const logo = await loadLogo(meta.logoUrl);
    const theme = resolveTheme();

    let y = drawTitleAndInfo(doc, 'Batch Learning Report', [
        { label: 'Course', value: meta.courseName },
        { label: 'Period', value: meta.dateRange },
    ]);

    y = drawCards(doc, theme, [
        { label: 'Course Completed', value: `${formatToTwoDecimalPlaces(report.percentage_course_completed)}%` },
        { label: 'Avg Time Spent', value: convertMinutesToTimeFormat(report.avg_time_spent_in_minutes ?? 0) },
        { label: 'Avg Concentration', value: `${formatToTwoDecimalPlaces(report.percentage_concentration_score)}%` },
    ], y);

    if (leaderboard.length) {
        y = sectionTitle(doc, 'Leaderboard', y, theme);
        autoTable(doc, {
            ...tableBase(theme),
            startY: y,
            head: [['Rank', 'Name', 'Concentration', 'Daily Avg Time', 'Total Time']],
            columnStyles: {
                0: { halign: 'center', cellWidth: 16 },
                2: { halign: 'right' }, 3: { halign: 'right' }, 4: { halign: 'right' },
            },
            body: leaderboard.map((r) => [
                String(r.rank),
                r.full_name,
                `${formatToTwoDecimalPlaces(r.avg_concentration)}%`,
                convertMinutesToTimeFormat(r.daily_avg_time ?? 0),
                convertMinutesToTimeFormat(r.total_time ?? 0),
            ]),
        });
        y = lastY(doc) + 11;
    }

    y = sectionTitle(doc, 'Daily Time Spent', y, theme);
    autoTable(doc, {
        ...tableBase(theme),
        startY: y,
        head: [['Date', 'Time Spent']],
        columnStyles: { 1: { halign: 'right' } },
        body: (report.daily_time_spent ?? []).map((d) => [
            fmtDate(d.activity_date),
            convertMinutesToTimeFormat(d.avg_daily_time_minutes ?? 0),
        ]),
    });

    stampAllPages(doc, meta.instituteName, logo, theme, SUBTITLE);
    doc.save(`batch-learning-report-${dayjs().format('YYYYMMDD')}.pdf`);
}

export async function exportLearnerLearningPdf(meta: LearningPdfMeta, report: LearnersReportResponse) {
    const doc = createReportDoc();
    const logo = await loadLogo(meta.logoUrl);
    const theme = resolveTheme();
    const learner = report.learner_progress_report;
    const batch = report.batch_progress_report;

    let y = drawTitleAndInfo(doc, 'Learner Learning Report', [
        { label: 'Learner', value: meta.learnerName || '—' },
        { label: 'Course', value: meta.courseName },
        { label: 'Period', value: meta.dateRange },
    ]);

    y = drawCards(doc, theme, [
        {
            label: 'Course Completed',
            value: `${formatToTwoDecimalPlaces(learner.percentage_course_completed)}%`,
            sub: `Batch ${formatToTwoDecimalPlaces(batch.percentage_course_completed)}%`,
        },
        {
            label: 'Avg Time Spent',
            value: convertMinutesToTimeFormat(learner.avg_time_spent_in_minutes ?? 0),
            sub: `Batch ${convertMinutesToTimeFormat(batch.avg_time_spent_in_minutes ?? 0)}`,
        },
        {
            label: 'Avg Concentration',
            value: `${formatToTwoDecimalPlaces(learner.percentage_concentration_score)}%`,
            sub: `Batch ${formatToTwoDecimalPlaces(batch.percentage_concentration_score)}%`,
        },
    ], y);

    // Merge daily time spent by date (learner vs batch).
    const byDate = new Map<string, { learner?: number; batch?: number }>();
    (learner.daily_time_spent ?? []).forEach((d) => {
        byDate.set(d.activity_date, { ...(byDate.get(d.activity_date) || {}), learner: d.avg_daily_time_minutes });
    });
    (batch.daily_time_spent ?? []).forEach((d) => {
        byDate.set(d.activity_date, { ...(byDate.get(d.activity_date) || {}), batch: d.avg_daily_time_minutes });
    });
    const dates = [...byDate.keys()].sort((a, b) => a.localeCompare(b));

    y = sectionTitle(doc, 'Daily Time Spent', y, theme);
    autoTable(doc, {
        ...tableBase(theme),
        startY: y,
        head: [['Date', 'Learner', 'Batch (Avg)']],
        columnStyles: { 1: { halign: 'right' }, 2: { halign: 'right' } },
        body: dates.map((date) => {
            const v = byDate.get(date) ?? {};
            return [
                fmtDate(date),
                convertMinutesToTimeFormat(v.learner ?? 0),
                convertMinutesToTimeFormat(v.batch ?? 0),
            ];
        }),
    });

    stampAllPages(doc, meta.instituteName, logo, theme, SUBTITLE);
    doc.save(
        `learner-learning-report-${(meta.learnerName || 'learner').replace(/\s+/g, '-')}-${dayjs().format(
            'YYYYMMDD'
        )}.pdf`
    );
}
