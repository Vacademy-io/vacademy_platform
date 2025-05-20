export interface QuestionEntityData {
    id: string;
    textId: string;
    mediaId: string | null;
    createdAt: string;
    updatedAt: string;
    questionResponseType: string;
    questionType: string;
    accessLevel: string;
    autoEvaluationJson: string;
    evaluationType: string;
    explanationTextId: string | null;
    defaultQuestionTimeMins: number | null;
    parentRichTextId: string | null;
}

export interface QuestionPaperEntityData {
    id: string;
    title: string;
    descriptionId: string | null;
    createdOn: string;
    updatedOn: string;
    createdByUserId: string;
    access: string;
}

export interface Entity<T> {
    entityType: "QUESTION" | "QUESTION_PAPER";
    entityId: string;
    entityData: T;
}

export interface FilteredEntityApiResponse {
    content: Array<Entity<QuestionEntityData> | Entity<QuestionPaperEntityData>>;
    pageNo: number;
    pageSize: number;
    totalPages: number;
    totalElements: number;
    last: boolean;
}

export interface Tag {
    tagId: string;
    tagSource: string;
}

export interface FilterRequest {
    type?: "QUESTION_PAPER" | "QUESTION";
    name?: string;
    tags?: Tag[];
}

export interface TagResponse {
    tagId: string;
    tagSource: string;
    tagName: string;
}

export interface QuestionPaperData {
    questionPaper: QuestionPaperEntityData;
    tags: TagResponse[];
}
