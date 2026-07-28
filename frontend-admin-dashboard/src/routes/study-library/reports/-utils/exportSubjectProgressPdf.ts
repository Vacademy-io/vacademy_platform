import autoTable from 'jspdf-autotable';
import dayjs from 'dayjs';
import {
    createReportDoc,
    drawCards,
    drawTitleAndInfo,
    lastY,
    loadLogo,
    resolveTheme,
    sectionTitle,
    stampAllPages,
    tableBase,
} from './reportPdfKit';
import { convertMinutesToTimeFormat, formatToTwoDecimalPlaces } from '../-services/helper';
import { SubjectProgressResponse } from '../-types/types';

/**
 * Branded client-side PDF for the learner "Learning Progress" (subject/module-wise)
 * report — same institute chrome (logo, theme colour, watermark, footer) as the
 * Learning Timeline export, so both reports read as one professional set.
 *
 * Built from the data already on screen (no extra network round-trip). Courses
 * shallower than the full Subject → Module structure come back with a single
 * "DEFAULT" subject; those render under a plain "Module-wise Progress" heading
 * instead of "Subject: DEFAULT".
 */

export interface SubjectProgressPdfMeta {
    instituteName: string;
    logoUrl: string | null;
    learnerName: string;
    courseName: string;
    sessionName: string;
    levelName: string;
    // Institute terminology (naming settings) for labels/headings.
    courseTerm: string;
    sessionTerm: string;
    levelTerm: string;
    moduleTerm: string;
    subjectTerm: string;
    batchTerm: string;
}

const isDefaultLevel = (value: string | null | undefined) =>
    (value ?? '').trim().toUpperCase() === 'DEFAULT';

export async function exportSubjectProgressPdf(
    meta: SubjectProgressPdfMeta,
    data: SubjectProgressResponse
) {
    const doc = createReportDoc();
    const logo = await loadLogo(meta.logoUrl);
    const theme = resolveTheme();
    const pageH = doc.internal.pageSize.getHeight();

    let y = drawTitleAndInfo(doc, 'Learner Progress Report', [
        { label: 'Learner', value: meta.learnerName || '—' },
        { label: meta.courseTerm, value: meta.courseName || '—' },
        { label: meta.sessionTerm, value: meta.sessionName || '—' },
        { label: meta.levelTerm, value: meta.levelName || '—' },
    ]);

    // Overall completion = mean over subjects of (mean over that subject's
    // modules), mirroring the backend course rollup so the headline number lines
    // up with what the learner sees.
    const subjectStats = data
        .map((subject) => {
            const modules = subject.modules ?? [];
            const n = modules.length;
            if (n === 0) return null;
            const learner =
                modules.reduce((sum, m) => sum + (m.module_completion_percentage ?? 0), 0) / n;
            const batch =
                modules.reduce(
                    (sum, m) => sum + (m.module_completion_percentage_by_batch ?? 0),
                    0
                ) / n;
            return { learner, batch };
        })
        .filter((s): s is { learner: number; batch: number } => s !== null);

    const overallLearner = subjectStats.length
        ? subjectStats.reduce((sum, s) => sum + s.learner, 0) / subjectStats.length
        : 0;
    const overallBatch = subjectStats.length
        ? subjectStats.reduce((sum, s) => sum + s.batch, 0) / subjectStats.length
        : 0;
    const totalModules = data.reduce((sum, s) => sum + (s.modules?.length ?? 0), 0);

    y = drawCards(
        doc,
        theme,
        [
            {
                label: `${meta.courseTerm} Completed`,
                value: `${formatToTwoDecimalPlaces(overallLearner)}%`,
                sub: `${meta.batchTerm} ${formatToTwoDecimalPlaces(overallBatch)}%`,
            },
            {
                label: `${meta.batchTerm} Completed`,
                value: `${formatToTwoDecimalPlaces(overallBatch)}%`,
            },
            {
                label: `${meta.moduleTerm}s Tracked`,
                value: String(totalModules),
            },
        ],
        y
    );

    data.forEach((subject) => {
        const modules = subject.modules ?? [];
        if (modules.length === 0) return;

        // Keep a section heading with its table together: start a fresh page
        // when there isn't room for the heading + a couple of rows.
        if (y > pageH - 45) {
            doc.addPage();
            y = 33;
        }

        const heading = isDefaultLevel(subject.subject_name)
            ? `${meta.moduleTerm}-wise Progress`
            : `${meta.subjectTerm}: ${subject.subject_name}`;
        y = sectionTitle(doc, heading, y, theme);

        autoTable(doc, {
            ...tableBase(theme),
            startY: y,
            head: [
                [
                    meta.moduleTerm,
                    'Completed',
                    `${meta.batchTerm} Completed`,
                    'Daily Time (Avg)',
                    `${meta.batchTerm} Daily Time (Avg)`,
                ],
            ],
            columnStyles: {
                1: { halign: 'right' },
                2: { halign: 'right' },
                3: { halign: 'right' },
                4: { halign: 'right' },
            },
            body: modules.map((m) => [
                m.module_name,
                `${formatToTwoDecimalPlaces(m.module_completion_percentage)}%`,
                `${formatToTwoDecimalPlaces(m.module_completion_percentage_by_batch)}%`,
                convertMinutesToTimeFormat(m.avg_time_spent_minutes ?? 0),
                convertMinutesToTimeFormat(m.avg_time_spent_minutes_by_batch ?? 0),
            ]),
        });
        y = lastY(doc) + 11;
    });

    stampAllPages(doc, meta.instituteName, logo, theme, 'Learning Progress Report');

    const safeName = (meta.learnerName || 'learner').replace(/\s+/g, '-');
    doc.save(`learning-progress-${safeName}-${dayjs().format('YYYYMMDD')}.pdf`);
}
