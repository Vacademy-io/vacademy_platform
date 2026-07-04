import autoTable from 'jspdf-autotable';
import dayjs from 'dayjs';
import {
    BatchLiveSummary,
    LearnerLiveStats,
    formatDuration,
    parseEngagement,
} from './liveCompute';
import { LiveSessionRow } from '../-services/liveReportApi';
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
} from '../../../-utils/reportPdfKit';

/**
 * Live-class report export. Reuses the shared report PDF kit for all branded
 * chrome (theme colour, logo header + watermark, cards, tables, footer).
 */

export interface LivePdfMeta {
    instituteName: string;
    logoUrl: string | null;
    courseName: string;
    batchLabel: string;
    dateRange: string;
    generatedOn: string;
}

const CORNER = 'LIVE CLASS REPORT';
const SUBTITLE = 'Attendance & Engagement Report';

export async function exportBatchLivePdf(meta: LivePdfMeta, summary: BatchLiveSummary) {
    const doc = createReportDoc();
    const logo = await loadLogo(meta.logoUrl);
    const theme = resolveTheme();

    let y = drawTitleAndInfo(doc, 'Batch Live Class Report', [
        { label: 'Course', value: meta.courseName },
        { label: 'Batch', value: meta.batchLabel || meta.courseName },
        { label: 'Period', value: meta.dateRange },
    ]);

    y = drawCards(doc, theme, [
        { label: 'Avg Attendance', value: `${summary.avgAttendancePct.toFixed(1)}%`, sub: `${summary.learnerCount} learners` },
        { label: 'Classes Held', value: `${summary.totalClassesHeld}` },
        { label: 'Avg Duration', value: formatDuration(summary.avgDurationMinutes), sub: 'per present learner' },
        { label: 'Avg Engagement', value: `${summary.avgEngagementIndex}`, sub: 'participation points' },
    ], y);

    y = sectionTitle(doc, 'Class-wise Attendance', y, theme);
    autoTable(doc, {
        ...tableBase(theme),
        startY: y,
        head: [['Date', 'Class', 'Present', 'Absent', 'Attendance', 'Avg Duration', 'Engagement']],
        columnStyles: {
            2: { halign: 'right' }, 3: { halign: 'right' }, 4: { halign: 'right' },
            5: { halign: 'right' }, 6: { halign: 'right' },
        },
        body: summary.perClass.map((c) => [
            fmtDate(c.date),
            c.title,
            String(c.present),
            String(c.total - c.present),
            `${c.attendancePct.toFixed(0)}%`,
            formatDuration(c.avgDurationMinutes),
            String(c.avgEngagementIndex),
        ]),
    });

    y = sectionTitle(doc, 'Leaderboard', lastY(doc) + 11, theme);
    autoTable(doc, {
        ...tableBase(theme),
        startY: y,
        head: [['Rank', 'Name', 'Attendance', 'Classes', 'Avg Duration', 'Engagement']],
        columnStyles: {
            0: { halign: 'center', cellWidth: 16 },
            2: { halign: 'right' }, 3: { halign: 'right' }, 4: { halign: 'right' }, 5: { halign: 'right' },
        },
        body: summary.leaderboard.map((r) => [
            String(r.rank),
            r.fullName,
            `${r.attendancePercentage.toFixed(1)}%`,
            `${r.attended}/${r.total}`,
            formatDuration(r.avgDurationMinutes),
            String(r.engagementIndex),
        ]),
    });

    stampAllPages(doc, meta.instituteName, logo, theme, SUBTITLE, CORNER);
    doc.save(`live-class-batch-report-${dayjs().format('YYYYMMDD')}.pdf`);
}

export async function exportLearnerLivePdf(
    meta: LivePdfMeta,
    learner: LearnerLiveStats,
    rows: LiveSessionRow[],
    batch: BatchLiveSummary
) {
    const doc = createReportDoc();
    const logo = await loadLogo(meta.logoUrl);
    const theme = resolveTheme();

    let y = drawTitleAndInfo(doc, 'Learner Live Class Report', [
        { label: 'Learner', value: learner.fullName },
        { label: 'Course', value: meta.courseName },
        { label: 'Period', value: meta.dateRange },
    ]);

    y = drawCards(doc, theme, [
        { label: 'Attendance', value: `${learner.attendancePercentage.toFixed(1)}%`, sub: `Batch ${batch.avgAttendancePct.toFixed(1)}%` },
        { label: 'Classes Attended', value: `${learner.attended}/${learner.total}` },
        { label: 'Avg Duration', value: formatDuration(learner.avgDurationMinutes), sub: `Batch ${formatDuration(batch.avgDurationMinutes)}` },
        { label: 'Engagement', value: `${learner.engagementIndex}`, sub: `Batch avg ${batch.avgEngagementIndex} pts` },
    ], y);

    y = sectionTitle(doc, 'Class History', y, theme);
    autoTable(doc, {
        ...tableBase(theme),
        startY: y,
        head: [['Date', 'Class', 'Status', 'Duration', 'Talk Time', 'Chats', 'Polls', 'Raise Hand']],
        columnStyles: {
            3: { halign: 'right' }, 4: { halign: 'right' }, 5: { halign: 'right' },
            6: { halign: 'right' }, 7: { halign: 'right' },
        },
        body: [...rows]
            .sort((a, b) => (a.meetingDate ?? '').localeCompare(b.meetingDate ?? ''))
            .map((r) => {
                const e = parseEngagement(r.engagementData);
                return [
                    fmtDate(r.meetingDate),
                    r.title,
                    r.attendanceStatus === 'PRESENT' ? 'Present' : 'Absent',
                    formatDuration(r.durationMinutes),
                    e ? `${Math.round(e.talkTimeSeconds / 60)}m` : '—',
                    e ? String(e.chats) : '—',
                    e ? String(e.pollVotes) : '—',
                    e ? String(e.raiseHand) : '—',
                ];
            }),
    });

    stampAllPages(doc, meta.instituteName, logo, theme, SUBTITLE, CORNER);
    doc.save(`live-class-learner-${learner.fullName.replace(/\s+/g, '-')}-${dayjs().format('YYYYMMDD')}.pdf`);
}
