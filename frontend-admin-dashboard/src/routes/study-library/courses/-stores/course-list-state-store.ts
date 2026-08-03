import { create } from 'zustand';
import { getAccessiblePackageFilters } from '@/lib/auth/facultyAccessUtils';
import type { AllCourseFilters } from '../-components/course-material';

/**
 * Browsing state for the Explore Courses page (All Courses + Authored Courses tabs).
 *
 * It lives outside the route component on purpose: opening a course unmounts
 * `CourseMaterial`, so component-local `useState` used to drop the applied
 * filters, the search term and the page number, dumping the user back on
 * page 1 of an unfiltered list when they navigated back.
 *
 * The state is only ever reset by an explicit user action:
 *   - "Clear" in the filter panel  -> `clearAllCoursesFilters()`
 *   - switching to another tab     -> `resetCourseListState()`
 * A full page reload starts fresh because this is in-memory only.
 */

type Updater<T> = T | ((prev: T) => T);

const resolve = <T>(updater: Updater<T>, prev: T): T =>
    typeof updater === 'function' ? (updater as (p: T) => T)(prev) : updater;

/**
 * Default filters. Seeded with the caller's accessible packages so faculty /
 * sub-org users stay scoped to their own courses even after "Clear".
 */
export const createDefaultCourseFilters = (): AllCourseFilters => {
    const accessFilters = getAccessiblePackageFilters();
    return {
        status: ['ACTIVE'],
        level_ids: [],
        tag: [],
        faculty_ids: [],
        search_by_name: '',
        min_percentage_completed: 0,
        max_percentage_completed: 100,
        sort_columns: { created_at: 'DESC' },
        package_ids: accessFilters?.package_ids || [],
        package_session_ids: accessFilters?.package_session_ids || [],
        package_session_filter: null,
        session_ids: [],
        package_view: true,
    };
};

export const DEFAULT_COURSE_SORT_BY = 'oldest';

interface CourseListStateStore {
    /* ---- All Courses tab ---- */
    /** Zero-based page index of the All Courses grid. */
    page: number;
    sortBy: string;
    /** Raw text in the search box (only committed to `filters` on Enter). */
    searchValue: string;
    filters: AllCourseFilters;

    /* ---- Authored Courses tab ---- */
    /** Zero-based page index of the Authored Courses grid. */
    authoredPage: number;
    authoredSearchValue: string;

    setPage: (updater: Updater<number>) => void;
    setSortBy: (updater: Updater<string>) => void;
    setSearchValue: (updater: Updater<string>) => void;
    setFilters: (updater: Updater<AllCourseFilters>) => void;
    setAuthoredPage: (updater: Updater<number>) => void;
    setAuthoredSearchValue: (updater: Updater<string>) => void;

    /** "Clear" button in the filter panel: filters + search + page for All Courses. */
    clearAllCoursesFilters: () => void;
    /** Tab switch: wipe browsing state for every tab. */
    resetCourseListState: () => void;
}

export const useCourseListStateStore = create<CourseListStateStore>((set) => ({
    page: 0,
    sortBy: DEFAULT_COURSE_SORT_BY,
    searchValue: '',
    filters: createDefaultCourseFilters(),
    authoredPage: 0,
    authoredSearchValue: '',

    setPage: (updater) => set((s) => ({ page: resolve(updater, s.page) })),
    setSortBy: (updater) => set((s) => ({ sortBy: resolve(updater, s.sortBy) })),
    setSearchValue: (updater) => set((s) => ({ searchValue: resolve(updater, s.searchValue) })),
    setFilters: (updater) => set((s) => ({ filters: resolve(updater, s.filters) })),
    setAuthoredPage: (updater) => set((s) => ({ authoredPage: resolve(updater, s.authoredPage) })),
    setAuthoredSearchValue: (updater) =>
        set((s) => ({ authoredSearchValue: resolve(updater, s.authoredSearchValue) })),

    clearAllCoursesFilters: () =>
        set({
            filters: createDefaultCourseFilters(),
            searchValue: '',
            page: 0,
        }),

    resetCourseListState: () =>
        set({
            page: 0,
            sortBy: DEFAULT_COURSE_SORT_BY,
            searchValue: '',
            filters: createDefaultCourseFilters(),
            authoredPage: 0,
            authoredSearchValue: '',
        }),
}));
