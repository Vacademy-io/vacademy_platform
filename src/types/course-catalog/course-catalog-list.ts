export interface Instructor {
    id: string;
    username: string;
    email: string;
    full_name: string;
    address_line: string;
    city: string;
    region: string | null;
    pin_code: string;
    mobile_number: string;
    date_of_birth: string | null;
    gender: string;
    password: string | null;
    profile_pic_file_id: string;
    roles: string[];
    root_user: boolean;
}

export interface CoursePackage {
    id: string;
    package_name: string;
    thumbnail_file_id: string;
    is_course_published_to_catalaouge: boolean;
    course_preview_image_media_id: string;
    course_banner_media_id: string;
    course_media_id: string;
    why_learn_html: string;
    who_should_learn_html: string;
    about_the_course_html: string;
    comma_separeted_tags: string;
    course_depth: number;
    course_html_description_html: string;
    percentage_completed: number;
    rating: number;
    package_session_id: string | null;
    level_id: string;
    level_name: string;
    instructors: Instructor[];
    level_ids: string[];
}

interface Pageable {
    pageNumber: number;
    pageSize: number;
    offset: number;
    paged: boolean;
    unpaged: boolean;
    sort: {
        unsorted: boolean;
        sorted: boolean;
        empty: boolean;
    };
}

interface SortInfo {
    unsorted: boolean;
    sorted: boolean;
    empty: boolean;
}

export interface CoursePackageResponse {
    content: CoursePackage[];
    empty: boolean;
    first: boolean;
    last: boolean;
    number: number; // current page number
    numberOfElements: number;
    pageable: Pageable;
    size: number; // page size
    sort: SortInfo;
    totalElements: number;
    totalPages: number;
}
