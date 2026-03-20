import { TestReport } from './test-record-type';

export const TestReportDataFormat = (testReport: TestReport) => {
    const responseData = [
        {
            name: 'Attempted',
            value: testReport.charts.responseBreakdown.attempted,
            color: 'rgb(151, 212, 180)',
        },
        {
            name: 'Skipped',
            value: testReport.charts.responseBreakdown.skipped,
            color: 'rgb(238, 238, 238)',
        },
    ];

    // Data for marks breakdown pie chart
    const marksData = [
        {
            name: 'Correct',
            value: testReport.charts.marksBreakdown.correctAnswers?.count || 0,
            marks: testReport.charts.marksBreakdown.correctAnswers?.marks || 0,
            color: 'rgb(151, 212, 180)',
        },
        {
            name: 'Incorrect',
            value: testReport.charts.marksBreakdown.incorrectAnswers?.count || 0,
            marks: testReport.charts.marksBreakdown.incorrectAnswers?.marks || 0,
            color: 'rgb(244, 152, 152)',
        },
        {
            name: 'Partially Correct',
            value: testReport.charts.marksBreakdown.partiallyCorrectAnswers?.count || 0,
            marks: testReport.charts.marksBreakdown.partiallyCorrectAnswers?.marks || 0,
            color: 'rgb(255, 221, 130)',
        },
        {
            name: 'Not Attempted',
            value: testReport.charts.marksBreakdown.notAttempted?.count || 0,
            marks: testReport.charts.marksBreakdown.notAttempted?.marks || 0,
            color: 'rgb(238, 238, 238)',
        },
    ];
    return {
        responseData: responseData,
        marksData: marksData,
    };
};
