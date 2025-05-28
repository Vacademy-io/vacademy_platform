import { convertMarksRankData } from "./helper";

interface StudentDetailsAttempted {
    userId: string;
    name: string;
    batch: string;
    enrollmentNumber: string;
    gender: string;
    attemptDate: string;
    startTime: string;
    endTime: string;
    duration: number;
    scoredMarks: number;
    totalMarks: number;
}

interface StudentDetailsPending {
    userId: string;
    name: string;
    batch: string;
    enrollmentNumber: string;
    gender: string;
    phoneNo: string;
    email: string;
    city: string;
    state: string;
}

interface StudentDetailsOngoing {
    userId: string;
    name: string;
    batch: string;
    enrollmentNumber: string;
    gender: string;
    startTime: string;
}

interface AssessmentStatus {
    type: string;
    studentDetails: StudentDetailsAttempted[] | StudentDetailsPending[] | StudentDetailsOngoing[];
}

interface StudentLeaderboard {
    userId: string;
    rank: string;
    name: string;
    batch: string;
    percentile: string;
    scoredMarks: number;
    totalMarks: number;
}

interface RankDetails {
    rank: number;
    marks: number;
    percentile: number;
    noOfParticipants: number;
}

export const overviewTabCloseTestData: {
    createdOn: string;
    startDate: string;
    endDate: string;
    subject: string;
    duration: number;
    totalParticipants: number;
    avgDuration: number;
    avgMarks: number;
    assessmentStatus: AssessmentStatus[];
    studentLeaderboard: StudentLeaderboard[];
    marksRankData: RankDetails[];
} = {
    createdOn: "13/10/2024",
    startDate: "13/10/2024, 11:15 AM",
    endDate: "15/10/2024, 08:30 PM",
    subject: "Physics",
    duration: 20,
    totalParticipants: 316,
    avgDuration: 17.3,
    avgMarks: 15,
    assessmentStatus: [
        {
            type: "Attempted",
            studentDetails: [
                {
                    userId: "1",
                    name: "John Doe",
                    batch: "1",
                    enrollmentNumber: "ENR12345",
                    gender: "Male",
                    attemptDate: "13/10/2024",
                    startTime: "11:05 AM",
                    endTime: "11:18 AM",
                    duration: 20,
                    scoredMarks: 15,
                    totalMarks: 20,
                },
                {
                    userId: "2",
                    name: "Jane Smith",
                    batch: "2",
                    enrollmentNumber: "ENR67890",
                    gender: "Female",
                    attemptDate: "13/10/2024",
                    startTime: "11:05 AM",
                    endTime: "11:18 AM",
                    duration: 20,
                    scoredMarks: 15,
                    totalMarks: 20,
                },
            ],
        },
        {
            type: "Pending",
            studentDetails: [
                {
                    userId: "1",
                    name: "John Doe",
                    batch: "1",
                    enrollmentNumber: "ENR12345",
                    gender: "Male",
                    phoneNo: "8782372322",
                    email: "test1@gmail.com",
                    city: "Noida",
                    state: "UP",
                },
                {
                    userId: "2",
                    name: "Jane Smith",
                    batch: "2",
                    enrollmentNumber: "ENR67890",
                    gender: "Female",
                    phoneNo: "8782372322",
                    email: "test1@gmail.com",
                    city: "Noida",
                    state: "UP",
                },
            ],
        },
        {
            type: "Ongoing",
            studentDetails: [
                {
                    userId: "1",
                    name: "John Doe",
                    batch: "1",
                    enrollmentNumber: "ENR12345",
                    gender: "Male",
                    startTime: "11:05 AM",
                },
                {
                    userId: "2",
                    name: "Jane Smith",
                    batch: "2",
                    enrollmentNumber: "ENR67890",
                    gender: "Female",
                    startTime: "11:05 AM",
                },
            ],
        },
    ],
    studentLeaderboard: [
        {
            userId: "1",
            rank: "1",
            name: "test 1",
            batch: "1",
            percentile: "100%",
            scoredMarks: 15,
            totalMarks: 20,
        },
        {
            userId: "2",
            rank: "1",
            name: "test 2",
            batch: "1",
            percentile: "100%",
            scoredMarks: 15,
            totalMarks: 20,
        },
        {
            userId: "3",
            rank: "2",
            name: "test 3",
            batch: "1",
            percentile: "100%",
            scoredMarks: 10,
            totalMarks: 20,
        },
        {
            userId: "4",
            rank: "3",
            name: "test 3",
            batch: "1",
            percentile: "100%",
            scoredMarks: 10,
            totalMarks: 20,
        },
        {
            userId: "5",
            rank: "4",
            name: "test 3",
            batch: "1",
            percentile: "100%",
            scoredMarks: 10,
            totalMarks: 20,
        },
        {
            userId: "6",
            rank: "5",
            name: "test 3",
            batch: "1",
            percentile: "100%",
            scoredMarks: 10,
            totalMarks: 20,
        },
        {
            userId: "7",
            rank: "6",
            name: "test 3",
            batch: "1",
            percentile: "100%",
            scoredMarks: 10,
            totalMarks: 20,
        },
        {
            userId: "8",
            rank: "7",
            name: "test 3",
            batch: "1",
            percentile: "100%",
            scoredMarks: 10,
            totalMarks: 20,
        },
        {
            userId: "9",
            rank: "8",
            name: "test 3",
            batch: "1",
            percentile: "100%",
            scoredMarks: 10,
            totalMarks: 20,
        },
    ],
    marksRankData: [],
};

// Extract studentLeaderboard first
const marksRankCloseData = convertMarksRankData(overviewTabCloseTestData.studentLeaderboard);

// Add marksRankData after defining studentLeaderboard
overviewTabCloseTestData.marksRankData = marksRankCloseData;
