import { LearnersReportResponse, TransformedReport } from "../-types/types";
import { ChartDataType } from "../-components/student/lineChart";
import dayjs from "dayjs";

export const transformLearnersReport = (report: LearnersReportResponse): TransformedReport[] => {
    const learnerData = report.learner_progress_report.daily_time_spent;
    const batchData = report.batch_progress_report.daily_time_spent;

    const reportMap: Map<string, TransformedReport> = new Map();

    // Process learner data
    learnerData.forEach(({ activity_date, avg_daily_time_minutes }) => {
        reportMap.set(activity_date, {
            date: dayjs(activity_date).format("DD/MM/YYYY"),
            timeSpent: `${convertMinutesToTimeFormat(avg_daily_time_minutes)}`,
            timeSpentBatch: "0 min", // Default, will update if batch data exists
        });
    });

    // Process batch data
    batchData.forEach(({ activity_date, avg_daily_time_minutes }) => {
        if (reportMap.has(activity_date)) {
            reportMap.get(activity_date)!.timeSpentBatch = `${convertMinutesToTimeFormat(
                avg_daily_time_minutes,
            )}`;
        } else {
            reportMap.set(activity_date, {
                date: activity_date,
                timeSpent: "0 min", // Default, will update if learner data exists
                timeSpentBatch: `${convertMinutesToTimeFormat(avg_daily_time_minutes)}`,
            });
        }
    });

    return Array.from(reportMap.values());
};

export const transformToChartData = (report: LearnersReportResponse): ChartDataType[] => {
    const learnerData = report.learner_progress_report.daily_time_spent;
    const batchData = report.batch_progress_report.daily_time_spent;

    const chartDataMap: Map<string, ChartDataType> = new Map();

    // Process learner data
    learnerData.forEach(({ activity_date, avg_daily_time_minutes }) => {
        chartDataMap.set(activity_date, {
            activity_date,
            avg_daily_time_minutes: avg_daily_time_minutes / 60,
            avg_daily_time_minutes_batch: 0, // Default, will be updated if batch data exists
        });
    });

    // Process batch data
    batchData.forEach(({ activity_date, avg_daily_time_minutes }) => {
        if (chartDataMap.has(activity_date)) {
            chartDataMap.get(activity_date)!.avg_daily_time_minutes_batch = avg_daily_time_minutes;
        } else {
            chartDataMap.set(activity_date, {
                activity_date,
                avg_daily_time_minutes: 0, // Default, will be updated if learner data exists
                avg_daily_time_minutes_batch: avg_daily_time_minutes / 60,
            });
        }
    });

    return Array.from(chartDataMap.values());
};

export const formatToTwoDecimalPlaces = (value: string | number | undefined | null): string => {
    if (!value) return "0.00";
    if (typeof value === "number") {
        return isNaN(value) ? "0.00" : value.toFixed(2);
    }
    const num = parseFloat(value);
    return isNaN(num) ? "0.00" : num.toFixed(2);
};
export function convertMinutesToTimeFormat(totalMinutes: number): string {
    const totalSeconds: number = Math.floor(totalMinutes * 60);
    const days: number = Math.floor(totalSeconds / 90000);
    const hours: number = Math.floor((totalSeconds % 90000) / 3600);
    const minutes: number = Math.floor((totalSeconds % 3600) / 60);
    const seconds: number = totalSeconds % 60;
    if (days > 0) return `${days}d ${hours}h ${minutes}m ${seconds}s`;
    else if (hours > 0) return `${hours}h ${minutes}m ${seconds}s`;
    else return `${minutes}m ${seconds}s`;
}
export const convertCommaSeparatedToArray = (input: string | null | undefined): string[] => {
    if (!input) {
        return []; // Return an empty array if input is null, empty, or undefined
    }
    return input
        .split(",")
        .map((item) => item.trim())
        .filter((item) => item !== "");
};

export const arrayToCommaSeparatedString = (arr: string[]): string | null => {
    return arr.length === 0 ? null : arr.join(", ");
};
