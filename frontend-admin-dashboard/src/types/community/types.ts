import { TagResponse } from "@/types/community/filters/types";
export interface Level {
    levelId: string;
    levelName: string;
}

export interface Stream {
    streamId: string;
    streamName: string;
}

export interface Subject {
    subjectId: string;
    subjectName: string;
}

export interface InitData {
    levels: Level[];
    streams: Record<string, Stream[]>; // Dynamic keys with arrays of Stream objects
    subjects: Record<string, Subject[]>; // Dynamic keys with arrays of Subject objects
    difficulties: string[];
    topics: string[];
    types: string[];
    tags: TagResponse[];
}
