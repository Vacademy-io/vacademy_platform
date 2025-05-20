// utils/table-config.ts
export type ColumnWidthConfig = Record<string, string>;

// Default widths for student list columns
export const STUDENT_LIST_COLUMN_WIDTHS: ColumnWidthConfig = {
    checkbox: 'min-w-[56px] sticky z-10 left-0',
    details: 'min-w-[80px] sticky z-10 left-[52px]',
    full_name: 'min-w-[180px] sticky left-[130px]',
    username: 'min-w-[180px]',
    package_session_id: 'min-w-[240px]',
    institute_enrollment_id: 'min-w-[200px]',
    linked_institute_name: 'min-w-[240px]',
    gender: 'min-w-[120px]',
    mobile_number: 'min-w-[180px]',
    email: 'min-w-[240px]',
    father_name: 'min-w-[180px]',
    mother_name: 'min-w-[180px]',
    guardian_name: 'min-w-[180px]',
    parents_mobile_number: 'min-w-[180px]',
    parents_email: 'min-w-[240px]',
    city: 'min-w-[180px]',
    region: 'min-w-[180px]',
    expiry_date: 'min-w-[180px]',
    status: 'min-w-[180px]',
    options: 'min-w-[56px] sticky z-10 right-0',
};

export const STUDENT_LIST_ASSESSMENT_COLUMN_WIDTHS: ColumnWidthConfig = {
    checkbox: 'min-w-[56px] sticky left-0',
    full_name: 'min-w-[180px] sticky left-[52px]',
    username: 'min-w-[180px]',
    package_session_id: 'min-w-[240px]',
    institute_enrollment_id: 'min-w-[200px]',
    linked_institute_name: 'min-w-[240px]',
    gender: 'min-w-[120px]',
    mobile_number: 'min-w-[180px]',
    email: 'min-w-[240px]',
    city: 'min-w-[180px]',
    region: 'min-w-[180px]',
    status: 'min-w-[180px]',
};

// Activity log column widths
export const ACTIVITY_LOG_COLUMN_WIDTHS: ColumnWidthConfig = {
    activityDate: 'min-w-[120px]',
    startTime: 'min-w-[100px]',
    endTime: 'min-w-[100px]',
    duration: 'min-w-[100px]',
    lastPageRead: 'min-w-[120px]',
};

export const ACTIVITY_RESPONSE_COLUMN_WIDTHS: ColumnWidthConfig = {
    activityDate: 'min-w-[120px]',
    startTime: 'min-w-[100px]',
    endTime: 'min-w-[100px]',
    duration: 'min-w-[100px]',
    response: 'min-w-[120px]',
    responseStatus: 'min-w-[140px]',
};

export const ACTIVITY_RESPONSE_ASSIGNMENT_COLUMN_WIDTHS: ColumnWidthConfig = {
    uploadDate: 'min-w-[120px]',
    uploadTime: 'min-w-[140px]',
    submissions: 'min-w-[100px]',
};

export const ACTIVITY_STATS_COLUMN_WIDTHS: ColumnWidthConfig = {
    details: 'min-w-[80px] sticky left-0',
    full_name: 'min-w-[160px] sticky left-[80px]',
    institute_enrollment_id: 'min-w-[120px]',
    username: 'min-w-[120px]',
    time_spent: 'min-w-[120px]',
    last_active: 'min-w-[120px]',
};

export const ASSESSMENT_STATUS_STUDENT_ATTEMPTED_COLUMNS_INTERNAL_WIDTH: ColumnWidthConfig = {
    checkbox: 'min-w-[56px] sticky left-0',
    details: 'min-w-[72px] sticky left-0',
    full_name: 'min-w-[180px] sticky left-[52px]',
    package_session_id: 'min-w-[240px]',
    attempt_date: 'min-w-[180px]',
    start_time: 'min-w-[240px]',
    end_time: 'min-w-[180px]',
    duration: 'min-w-[180px]',
    score: 'min-w-[180px]',
    evaluation_status: 'min-w-[180px]',
    options: 'min-w-[56px] sticky right-0',
};

export const ASSESSMENT_STATUS_STUDENT_ONGOING_COLUMNS_INTERNAL_WIDTH: ColumnWidthConfig = {
    checkbox: 'min-w-[20px] sticky left-0',
    details: 'min-w-[20px] sticky left-0',
    full_name: 'min-w-[96px] sticky left-[52px]',
    start_time: 'min-w-[240px]',
    options: 'min-w-[56px] sticky right-0',
};

export const ASSESSMENT_STATUS_STUDENT_PENDING_COLUMNS_INTERNAL_WIDTH: ColumnWidthConfig = {
    checkbox: 'min-w-[20px] sticky left-0',
    details: 'min-w-[20px] sticky left-0',
    full_name: 'min-w-[460px] sticky left-[52px]',
    options: 'min-w-[56px] sticky right-0',
};

export const ASSESSMENT_STATUS_STUDENT_ATTEMPTED_COLUMNS_EXTERNAL_WIDTH: ColumnWidthConfig = {
    checkbox: 'min-w-[56px] sticky left-0',
    details: 'min-w-[20px] sticky left-0',
    full_name: 'min-w-[180px] sticky left-[52px]',
    attempt_date: 'min-w-[180px]',
    start_time: 'min-w-[240px]',
    end_time: 'min-w-[180px]',
    duration: 'min-w-[180px]',
    score: 'min-w-[180px]',
    evaluation_status: 'min-w-[180px]',
    options: 'min-w-[56px] sticky right-0',
};

export const ASSESSMENT_STATUS_STUDENT_ONGOING_COLUMNS_EXTERNAL_WIDTH: ColumnWidthConfig = {
    checkbox: 'min-w-[20px] sticky left-0',
    details: 'min-w-[20px] sticky left-0',
    full_name: 'min-w-[96px] sticky left-[52px]',
    start_time: 'min-w-[240px]',
    options: 'min-w-[56px] sticky right-0',
};

export const ASSESSMENT_STATUS_STUDENT_PENDING_COLUMNS_EXTERNAL_WIDTH: ColumnWidthConfig = {
    checkbox: 'min-w-[20px] sticky left-0',
    details: 'min-w-[20px] sticky left-0',
    full_name: 'min-w-[460px] sticky left-[52px]',
    options: 'min-w-[56px] sticky right-0',
};

export const QUESTION_WISE_COLUMNS_INTERNAL_OR_CLOSE_WIDTH: ColumnWidthConfig = {
    full_name: 'min-w-[180px] sticky',
    package_session_id: 'min-w-[240px]',
    registration_id: 'min-w-[180px]',
    response_time_in_seconds: 'min-w-[240px]',
};

export const QUESTION_WISE_COLUMNS_EXTERNAL_WIDTH: ColumnWidthConfig = {
    full_name: 'min-w-[180px] sticky',
    response_time_in_seconds: 'min-w-[240px]',
};
