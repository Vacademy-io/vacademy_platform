import { DoubtType } from "../types/doubt-list-type";

export const doubtListDummy: DoubtType[] = [
    {
        id: "1",
        user_id: "1",
        user_name: "John Doe",
        face_file_id: null,
        doubt_text: "What is the capital of India?",
        slide_progress_marker: 1,
        status: "UNRESOLVED" as const,
        timestamp: "2021-01-01, 12:30pm",
        replies: [
            {
                face_file_id: null,
                user_id: "2",
                user_name: "Jane Doe",
                timestamp: "2021-01-01, 02:15pm",
                role_type: "TEACHER",
                reply_text: "The capital of India is Delhi."
            },
            {
                face_file_id: null,
                user_id: "3",
                user_name: "John Doe",
                timestamp: "2021-01-01",
                role_type: "TEACHER",
                reply_text: "The capital of India is Delhi."
            }
        ]
    },
    {
        id: "1",
        user_id: "1",
        user_name: "John Doe",
        face_file_id: null,
        doubt_text: "What is the capital of India?",
        slide_progress_marker: 30000,
        status: "UNRESOLVED" as const,
        timestamp: "2021-01-01, 12:30pm",
        replies: [
            {
                face_file_id: null,
                user_id: "2",
                user_name: "Jane Doe",
                timestamp: "2021-01-01, 02:15pm",
                role_type: "TEACHER",
                reply_text: "The capital of India is Delhi."
            },
            {
                face_file_id: null,
                user_id: "3",
                user_name: "John Doe",
                timestamp: "2021-01-01",
                role_type: "TEACHER",
                reply_text: "The capital of India is Delhi."
            }
        ]
    }
]