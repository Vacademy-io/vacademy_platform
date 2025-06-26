export interface ReplyType {
    face_file_id: string | null;
    user_id: string;
    user_name: string;
    timestamp: string;
    role_type: string;
    reply_text: string;
}

export interface DoubtType {
    id: string;
    user_id: string;
    user_name: string;
    face_file_id: string | null;
    doubt_text: string;
    slide_progress_marker: number;
    status: "RESOLVED" | "UNRESOLVED";
    timestamp: string;
    replies: ReplyType[];
}