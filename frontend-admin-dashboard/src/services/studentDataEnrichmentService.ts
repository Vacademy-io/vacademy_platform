/**
 * Student Data Enrichment Service
 *
 * This service handles fetching and enriching student data from various sources
 * with NO hardcoded or generated data - only real backend data
 */

import { STUDENT_DATA_ENRICHMENT_BASE } from '@/constants/urls';
import { getTokenFromCookie } from '@/lib/auth/sessionUtility';
import { TokenKey } from '@/constants/auth/tokens';

export interface EnrichedStudentData {
    // Basic student info
    user_id: string;
    full_name: string;
    email: string;
    mobile_number: string;
    username: string;
    created_at: string;
    enrollment_number: string;
    student_unique_link: string;

    // Course data
    course_name?: string;
    course_description?: string;
    course_price?: string;
    course_duration?: string;
    course_start_date?: string;
    course_end_date?: string;
    course_instructor?: string;

    // Batch data
    batch_name?: string;
    batch_id?: string;
    batch_start_date?: string;
    batch_end_date?: string;

    // Institute data
    institute_id?: string;
    institute_name?: string;
    institute_address?: string;
    institute_phone?: string;
    institute_email?: string;
    institute_website?: string;
    institute_logo?: string;

    // Attendance data
    attendance_status?: string;
    attendance_date?: string;
    attendance_percentage?: string;
    attendance_total_classes?: string;
    attendance_attended_classes?: string;
    attendance_last_class_date?: string;

    // Live class data
    live_class_title?: string;
    live_class_name?: string;
    live_class_date?: string;
    live_class_time?: string;
    live_class_start_time?: string;
    live_class_end_time?: string;
    live_class_duration?: string;
    live_class_instructor?: string;
    live_class_link?: string;
    live_class_meeting_link?: string;
    live_class_meeting_id?: string;
    live_class_password?: string;
    live_class_platform?: string;
    live_class_room?: string;
    live_class_notes?: string;
    live_class_description?: string;
    live_class_batch?: string;
    live_class_recording_link?: string;
    live_class_status?: string;
    next_live_class_date?: string;
    next_live_class_time?: string;
    next_live_class_title?: string;

    // Referral data
    referral_code?: string;
    referral_link?: string;
    referral_count?: string;
    referral_rewards?: string;
    referral_bonus?: string;
    referral_status?: string;
    referred_by?: string;
    referred_by_name?: string;
    referral_date?: string;
    referral_program_start?: string;
    referral_program_end?: string;
    referral_terms?: string;
    referral_benefits?: string;
    referral_custom_content?: string;

    // Student details
    student_name?: string;
    student_email?: string;
    student_phone?: string;
    student_id?: string;
    registration_date?: string;

    // Custom fields
    custom_field_1?: string;
    custom_field_2?: string;
}

export interface DataEnrichmentOptions {
    includeCourse?: boolean;
    includeBatch?: boolean;
    includeInstitute?: boolean;
    includeAttendance?: boolean;
    includeLiveClass?: boolean;
    includeReferral?: boolean;
    includeCustomFields?: boolean;
}

// API Payload interfaces for dynamic data fetching
export interface CourseDataRequest {
    courseId: string;
    instituteId: string;
    includeDetails?: boolean;
    includePricing?: boolean;
    includeInstructor?: boolean;
}

export interface BatchDataRequest {
    batchId: string;
    instituteId: string;
    includeSchedule?: boolean;
    includeStudents?: boolean;
}

export interface AttendanceDataRequest {
    studentId: string;
    instituteId: string;
    courseId?: string;
    batchId?: string;
    dateRange?: {
        startDate: string;
        endDate: string;
    };
    includeDetails?: boolean;
}

export interface LiveClassDataRequest {
    studentId: string;
    instituteId: string;
    courseId?: string;
    batchId?: string;
    includeUpcoming?: boolean;
    includePast?: boolean;
    limit?: number;
}

export interface ReferralDataRequest {
    studentId: string;
    instituteId: string;
    includeStats?: boolean;
    includeRewards?: boolean;
    includeHistory?: boolean;
}

export class StudentDataEnrichmentService {
    private baseURL: string;
    private authToken: string;

    constructor() {
        this.baseURL = STUDENT_DATA_ENRICHMENT_BASE;
        this.authToken = getTokenFromCookie(TokenKey.accessToken) || '';
    }

    /**
     * Refresh the authentication token
     */
    private refreshToken(): void {
        this.authToken = getTokenFromCookie(TokenKey.accessToken) || '';
    }

    /**
     * Make authenticated API request
     */
    private async makeRequest(endpoint: string, options: RequestInit = {}): Promise<any> {
        try {
            // Refresh token if needed
            if (!this.authToken) {
                this.refreshToken();
            }

            if (!this.authToken) {
                throw new Error('No authentication token available');
            }


            const response = await fetch(`${this.baseURL}${endpoint}`, {
                ...options,
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${this.authToken}`,
                    ...options.headers,
                },
            });

            if (!response.ok) {
                throw new Error(`API request failed: ${response.status} ${response.statusText}`);
            }

            const contentType = response.headers.get('content-type');
            if (contentType && contentType.includes('application/json')) {
                return await response.json();
            } else {
                // If not JSON, read as text to see what we got
                const textResponse = await response.text();
                console.warn(
                    `Non-JSON response received for ${endpoint}:`,
                    textResponse.substring(0, 200)
                );
                throw new Error(
                    `API returned non-JSON response: ${textResponse.substring(0, 100)}`
                );
            }
        } catch (error) {
            throw error;
        }
    }

    /**
     * Enrich student data by fetching missing information from APIs
     * NO hardcoded or generated data - only real backend data
     * Only fetches data for variables that are actually used in the template
     */
    async enrichStudentData(
        students: any[],
        options: DataEnrichmentOptions = {},
        usedVariables: string[] = []
    ): Promise<EnrichedStudentData[]> {
        const {
            includeCourse = true,
            includeBatch = true,
            includeInstitute = true,
            includeAttendance = true,
            includeLiveClass = true,
            includeReferral = true,
            includeCustomFields = true,
        } = options;


        try {
            // Determine which data to fetch based on used variables
            const shouldFetchCourse = usedVariables.some(v =>
                v.includes('course_') || v.includes('course_name') || v.includes('course_description') ||
                v.includes('course_price') || v.includes('course_duration') || v.includes('course_instructor')
            );
            const shouldFetchBatch = usedVariables.some(v =>
                v.includes('batch_') || v.includes('batch_name') || v.includes('batch_id') ||
                v.includes('batch_start_date') || v.includes('batch_end_date')
            );
            const shouldFetchAttendance = usedVariables.some(v =>
                v.includes('attendance_') || v.includes('attendance_status') || v.includes('attendance_percentage') ||
                v.includes('attendance_total_classes') || v.includes('attendance_attended_classes')
            );
            const shouldFetchLiveClass = usedVariables.some(v =>
                v.includes('live_class_') || v.includes('live_class_name') || v.includes('live_class_time') ||
                v.includes('live_class_link') || v.includes('live_class_instructor')
            );
            const shouldFetchReferral = usedVariables.some(v =>
                v.includes('referral_') || v.includes('referral_code') || v.includes('referral_count') ||
                v.includes('referral_rewards') || v.includes('referral_status')
            );


            // Get institute data from cache first (no API call needed)
            const instituteData = await this.getCachedInstituteData();

            // Enrich student data with real API calls for missing data
            const enrichedStudents: EnrichedStudentData[] = await Promise.all(
                students.map(async (student) => {
                    const enriched: EnrichedStudentData = {
                        // Basic student info (already available)
                        user_id: student.user_id,
                        full_name: student.full_name,
                        email: student.email,
                        mobile_number: student.mobile_number,
                        username: student.username,
                        created_at: student.created_at,
                        enrollment_number: student.institute_enrollment_id || student.user_id,
                        student_unique_link: this.generateStudentLink(student.user_id),
                    };

                    // Add institute data from cache
                    if (instituteData) {
                        enriched.institute_id = instituteData.institute_id;
                        enriched.institute_name = instituteData.institute_name;
                        enriched.institute_address = instituteData.institute_address;
                        enriched.institute_phone = instituteData.institute_phone;
                        enriched.institute_email = instituteData.institute_email;
                        enriched.institute_website = instituteData.institute_website;
                        enriched.institute_logo = instituteData.institute_logo;
                    }

                    // Fetch missing data via API calls (only for used variables)
                    await this.fetchMissingStudentData(enriched, student, {
                        ...options,
                        includeCourse: shouldFetchCourse,
                        includeBatch: shouldFetchBatch,
                        includeAttendance: shouldFetchAttendance,
                        includeLiveClass: shouldFetchLiveClass,
                        includeReferral: shouldFetchReferral,
                        includeCustomFields: false // Skip custom fields for now
                    });

                    return enriched;
                })
            );


            return enrichedStudents;
        } catch (error) {
            // Return basic student data without enrichment
            return this.createBasicEnrichedStudents(students);
        }
    }

    /**
     * Create basic enriched students with only available data
     */
    private async createBasicEnrichedStudents(students: any[]): Promise<EnrichedStudentData[]> {
        return await Promise.all(
            students.map(async (student) => {
                const enriched: EnrichedStudentData = {
                    user_id: student.user_id,
                    full_name: student.full_name,
                    email: student.email,
                    mobile_number: student.mobile_number,
                    username: student.username,
                    created_at: student.created_at,
                    enrollment_number: student.institute_enrollment_id || student.user_id,
                    student_unique_link: this.generateStudentLink(student.user_id),
                };

                return enriched;
            })
        );
    }

    /**
     * Fetch missing student data via API calls
     * Only fetches data that exists in backend - no fallbacks
     */
    private async fetchMissingStudentData(
        enriched: EnrichedStudentData,
        student: any,
        options: DataEnrichmentOptions
    ): Promise<void> {
        const {
            includeCourse = true,
            includeBatch = true,
            includeAttendance = true,
            includeLiveClass = true,
            includeReferral = true,
            includeCustomFields = true,
        } = options;

        try {
            // Fetch course data if missing and requested
            if (includeCourse && !enriched.course_name) {
                const courseData = await this.fetchCourseData(
                    student.course_id || student.package_session_id,
                    this.getCurrentInstituteId()
                );
                if (courseData) {
                    enriched.course_name = courseData.name;
                    enriched.course_description = courseData.description;
                    enriched.course_price = courseData.price;
                    enriched.course_duration = courseData.duration;
                    enriched.course_instructor = courseData.instructor;
                    enriched.course_start_date = courseData.startDate;
                    enriched.course_end_date = courseData.endDate;
                }
            }

            // Fetch batch data if missing and requested
            if (includeBatch && !enriched.batch_name) {
                const batchData = await this.fetchBatchData(
                    student.batch_id || student.package_session_id,
                    this.getCurrentInstituteId()
                );
                if (batchData) {
                    enriched.batch_name = batchData.name;
                    enriched.batch_id = batchData.id;
                    enriched.batch_start_date = batchData.startDate;
                    enriched.batch_end_date = batchData.endDate;
                }
            }

            // Fetch attendance data if missing and requested
            if (includeAttendance && !enriched.attendance_status) {
                const attendanceData = await this.fetchAttendanceData(
                    student.user_id,
                    student.course_id,
                    student.batch_id
                );
                if (attendanceData) {
                    enriched.attendance_status = attendanceData.status;
                    enriched.attendance_percentage = attendanceData.percentage;
                    enriched.attendance_total_classes = attendanceData.totalClasses;
                    enriched.attendance_attended_classes = attendanceData.attendedClasses;
                    enriched.attendance_last_class_date = attendanceData.lastClassDate;
                }
            }

            // Fetch live class data if missing and requested
            if (includeLiveClass && !enriched.live_class_title) {
                const liveClassData = await this.fetchLiveClassData(
                    student.user_id,
                    student.course_id,
                    student.batch_id
                );
                if (liveClassData) {
                    enriched.live_class_title = liveClassData.title;
                    enriched.live_class_name = liveClassData.name;
                    enriched.live_class_date = liveClassData.date;
                    enriched.live_class_time = liveClassData.time;
                    enriched.live_class_start_time = liveClassData.startTime;
                    enriched.live_class_end_time = liveClassData.endTime;
                    enriched.live_class_duration = liveClassData.duration;
                    enriched.live_class_instructor = liveClassData.instructor;
                    enriched.live_class_meeting_link = liveClassData.meetingLink;
                    enriched.live_class_meeting_id = liveClassData.meetingId;
                    enriched.live_class_password = liveClassData.password;
                    enriched.live_class_platform = liveClassData.platform;
                    enriched.live_class_status = liveClassData.status;
                    enriched.live_class_description = liveClassData.description;
                }
            }

            // Fetch referral data if missing and requested
            if (includeReferral && !enriched.referral_code) {
                const referralData = await this.fetchReferralData(student.user_id);
                if (referralData) {
                    enriched.referral_code = referralData.code;
                    enriched.referral_count = referralData.count;
                    enriched.referral_rewards = referralData.rewards;
                    enriched.referral_bonus = referralData.bonus;
                    enriched.referral_status = referralData.status;
                    enriched.referral_benefits = referralData.benefits;
                    enriched.referral_program_start = referralData.programStart;
                    enriched.referral_program_end = referralData.programEnd;
                }
            }
        } catch (error) {
        }
    }

    /**
     * Fetch course data from API with proper payload
     */
    private async fetchCourseData(courseId: string, instituteId?: string): Promise<any> {
        try {
            const payload: CourseDataRequest = {
                courseId,
                instituteId: instituteId || this.getCurrentInstituteId() || '',
                includeDetails: true,
                includePricing: true,
                includeInstructor: true
            };

            const response = await this.makeRequest('/courses/details', {
                method: 'POST',
                body: JSON.stringify(payload)
            });

            return {
                name: response.name || response.title,
                description: response.description,
                price: response.price || response.cost,
                duration: response.duration || response.length,
                instructor: response.instructor || response.teacher,
                startDate: response.start_date,
                endDate: response.end_date,
            };
        } catch (error) {
            return null;
        }
    }

    /**
     * Fetch batch data from API with proper payload
     */
    private async fetchBatchData(batchId: string, instituteId?: string): Promise<any> {
        try {
            const payload: BatchDataRequest = {
                batchId,
                instituteId: instituteId || this.getCurrentInstituteId() || '',
                includeSchedule: true,
                includeStudents: false
            };

            const response = await this.makeRequest('/batches/details', {
                method: 'POST',
                body: JSON.stringify(payload)
            });

            return {
                name: response.name || response.batch_name,
                id: response.id || response.batch_id,
                startDate: response.start_date || response.startDate,
                endDate: response.end_date || response.endDate,
                capacity: response.capacity,
                enrolled: response.enrolled_count,
                status: response.status
            };
        } catch (error) {
            return null;
        }
    }

    /**
     * Fetch attendance data from API with proper payload
     */
    private async fetchAttendanceData(studentId: string, courseId?: string, batchId?: string): Promise<any> {
        try {
            const payload: AttendanceDataRequest = {
                studentId,
                instituteId: this.getCurrentInstituteId() || '',
                courseId,
                batchId,
                includeDetails: true,
                dateRange: {
                    startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(), // Last 30 days
                    endDate: new Date().toISOString()
                }
            };

            const response = await this.makeRequest('/students/attendance', {
                method: 'POST',
                body: JSON.stringify(payload)
            });

            return {
                status: response.attendance_status || response.status,
                percentage: response.attendance_percentage || response.percentage,
                totalClasses: response.total_classes || response.total_sessions,
                attendedClasses: response.attended_classes || response.attended_sessions,
                lastClassDate: response.last_class_date,
                attendanceHistory: response.attendance_history || []
            };
        } catch (error) {
            return null;
        }
    }

    /**
     * Fetch live class data from API with proper payload
     */
    private async fetchLiveClassData(studentId: string, courseId?: string, batchId?: string): Promise<any> {
        try {
            const payload: LiveClassDataRequest = {
                studentId,
                instituteId: this.getCurrentInstituteId() || '',
                courseId,
                batchId,
                includeUpcoming: true,
                includePast: false,
                limit: 5
            };

            const response = await this.makeRequest('/students/live-classes', {
                method: 'POST',
                body: JSON.stringify(payload)
            });

            // Get the most recent/upcoming live class
            const liveClass = response.live_classes?.[0] || response;

            return {
                title: liveClass.title || liveClass.class_title,
                name: liveClass.name || liveClass.class_name,
                date: liveClass.date || liveClass.class_date,
                time: liveClass.time || liveClass.class_time,
                startTime: liveClass.start_time,
                endTime: liveClass.end_time,
                duration: liveClass.duration,
                instructor: liveClass.instructor || liveClass.teacher,
                meetingLink: liveClass.meeting_link || liveClass.zoom_link,
                meetingId: liveClass.meeting_id,
                password: liveClass.password,
                platform: liveClass.platform || 'Zoom',
                status: liveClass.status,
                description: liveClass.description
            };
        } catch (error) {
            return null;
        }
    }

    /**
     * Fetch referral data from API with proper payload
     */
    private async fetchReferralData(studentId: string): Promise<any> {
        try {
            const payload: ReferralDataRequest = {
                studentId,
                instituteId: this.getCurrentInstituteId() || '',
                includeStats: true,
                includeRewards: true,
                includeHistory: false
            };

            const response = await this.makeRequest('/students/referral', {
                method: 'POST',
                body: JSON.stringify(payload)
            });

            return {
                code: response.referral_code || response.code,
                count: response.referral_count || response.count,
                rewards: response.referral_rewards || response.rewards,
                bonus: response.referral_bonus || response.bonus,
                status: response.referral_status || response.status,
                benefits: response.referral_benefits || response.benefits,
                programStart: response.referral_program_start,
                programEnd: response.referral_program_end,
                totalEarnings: response.total_earnings,
                pendingRewards: response.pending_rewards
            };
        } catch (error) {
            return null;
        }
    }

    /**
     * Get cached institute data from multiple sources
     */
    private async getCachedInstituteData(): Promise<any> {
        try {
            const instituteId = this.getCurrentInstituteId();
            if (!instituteId) {
                return null;
            }

            // 1. Try localStorage with institute ID as key (most common and fastest)
            const localStorageData = this.getInstituteDataFromLocalStorage(instituteId);
            if (localStorageData) return localStorageData;

            // 2. Try Zustand store (most reliable)
            const storeData = await this.getInstituteDataFromStore();
            if (storeData) return storeData;

            // 3. Try domain routing cache
            const domainData = await this.getInstituteDataFromDomainCache();
            if (domainData) return domainData;

            // 4. No cached data found
            return null;
        } catch (error) {
            return null;
        }
    }

    /**
     * Get institute data from localStorage
     */
    private getInstituteDataFromLocalStorage(instituteId: string): any | null {
        try {
            const data = localStorage.getItem(instituteId);
            if (data) {
                const parsed = JSON.parse(data);
                return {
                    institute_id: instituteId,
                    institute_name: parsed.institute_name || parsed.name,
                    institute_address: parsed.address,
                    institute_phone: parsed.phone,
                    institute_email: parsed.email,
                    institute_website: parsed.websiteUrl,
                    institute_logo: parsed.instituteLogoUrl || parsed.instituteLogoFileId,
                };
            }
        } catch (error) {
        }
        return null;
    }

    /**
     * Get institute data from Zustand store
     */
    private async getInstituteDataFromStore(): Promise<any | null> {
        try {
            const { useInstituteDetailsStore } = await import(
                '@/stores/students/students-list/useInstituteDetailsStore'
            );
            const store = useInstituteDetailsStore.getState();
            if (store.instituteDetails) {
                return {
                    institute_id: store.instituteDetails.id,
                    institute_name: store.instituteDetails.institute_name,
                    institute_address: store.instituteDetails.address,
                    institute_phone: store.instituteDetails.phone,
                    institute_email: store.instituteDetails.email,
                    institute_website: store.instituteDetails.website_url,
                    institute_logo: store.instituteDetails.institute_logo_file_id,
                };
            }
        } catch (error) {
        }
        return null;
    }

    /**
     * Get institute data from domain cache
     */
    private async getInstituteDataFromDomainCache(): Promise<any | null> {
        try {
            const { getCachedInstituteBranding } = await import('@/services/domain-routing');
            const domainCache = getCachedInstituteBranding();
            if (domainCache) {
                return {
                    institute_id: domainCache.instituteId,
                    institute_name: domainCache.instituteName,
                    institute_address: '',
                    institute_phone: '',
                    institute_email: '',
                    institute_website: '',
                    institute_logo:
                        domainCache.instituteLogoUrl || domainCache.instituteLogoFileId || '',
                };
            }
        } catch (error) {
        }
        return null;
    }

    /**
     * Generate student link
     */
    private generateStudentLink(userId: string): string {
        const baseUrl = window.location.origin;
        return `${baseUrl}/student/login?ref=${userId}`;
    }

    /**
     * Get current institute ID
     */
    private getCurrentInstituteId(): string | undefined {
        try {
            return (
                localStorage.getItem('selectedInstituteId') ||
                sessionStorage.getItem('selectedInstituteId') ||
                undefined
            );
        } catch {
            return undefined;
        }
    }

    /**
     * Get available variables for a specific context
     */
    getAvailableVariablesForContext(context: string): string[] {
        const baseVariables = [
            '{{current_date}}',
            '{{current_time}}',
            '{{year}}',
            '{{month}}',
            '{{day}}',
            '{{custom_message_text}}',
            '{{support_email}}',
            '{{support_link}}',
        ];

        const contextVariables: Record<string, string[]> = {
            'student-management': [
                ...baseVariables,
                '{{name}}',
                '{{student_name}}',
                '{{email}}',
                '{{student_email}}',
                '{{mobile_number}}',
                '{{student_phone}}',
                '{{student_id}}',
                '{{enrollment_number}}',
                '{{username}}',
                '{{registration_date}}',
                '{{student_unique_link}}',
                '{{course_name}}',
                '{{course_description}}',
                '{{course_price}}',
                '{{batch_name}}',
                '{{batch_id}}',
                '{{batch_start_date}}',
                '{{batch_end_date}}',
                '{{institute_name}}',
                '{{institute_address}}',
                '{{institute_phone}}',
                '{{institute_email}}',
                '{{institute_website}}',
                '{{attendance_status}}',
                '{{attendance_date}}',
                '{{attendance_percentage}}',
                '{{live_class_title}}',
                '{{live_class_date}}',
                '{{live_class_time}}',
                '{{referral_code}}',
                '{{referral_count}}',
                '{{referral_rewards}}',
                '{{custom_field_1}}',
                '{{custom_field_2}}',
            ],
            announcements: [
                ...baseVariables,
                '{{name}}',
                '{{student_name}}',
                '{{email}}',
                '{{student_email}}',
                '{{institute_name}}',
                '{{institute_address}}',
                '{{institute_phone}}',
                '{{institute_email}}',
                '{{institute_website}}',
            ],
            'attendance-report': [
                ...baseVariables,
                '{{name}}',
                '{{student_name}}',
                '{{email}}',
                '{{student_email}}',
                '{{course_name}}',
                '{{batch_name}}',
                '{{attendance_status}}',
                '{{attendance_date}}',
                '{{attendance_percentage}}',
                '{{live_class_title}}',
                '{{live_class_date}}',
                '{{live_class_time}}',
                '{{institute_name}}',
                '{{institute_address}}',
                '{{institute_phone}}',
            ],
            'referral-settings': [
                ...baseVariables,
                '{{name}}',
                '{{student_name}}',
                '{{email}}',
                '{{student_email}}',
                '{{referral_code}}',
                '{{referral_count}}',
                '{{referral_rewards}}',
                '{{referral_bonus}}',
                '{{referral_status}}',
                '{{referral_benefits}}',
                '{{institute_name}}',
                '{{institute_address}}',
                '{{institute_phone}}',
            ],
        };

        return contextVariables[context] || baseVariables;
    }
}

// Export singleton instance
export const studentDataEnrichmentService = new StudentDataEnrichmentService();
