/**
 * Template Variable Resolver Service
 *
 * This service handles the resolution of template variables from various sources:
 * - Cookies and localStorage
 * - Application state/stores
 * - API calls for dynamic data
 *
 * It ensures all required variables are available before sending emails/WhatsApp messages.
 */

import { getTokenFromCookie } from '@/lib/auth/sessionUtility';
import { TokenKey } from '@/constants/auth/tokens';
import { STUDENT_DATA_ENRICHMENT_BASE } from '@/constants/urls';
import { fetchInstituteDetails } from '@/services/student-list-section/getInstituteDetails';
import { pageContextResolver, PageContext } from './page-context-resolver';
import { templateVariableResolverManager, VariableContext } from './template-variables';

export interface VariableResolutionResult {
    success: boolean;
    availableVariables: Record<string, string>;
    missingVariables: string[];
    warnings: string[];
}

export interface VariableSource {
    name: string;
    value: string;
    source: 'cookie' | 'localStorage' | 'sessionStorage' | 'store' | 'api' | 'computed';
}

export interface ResolvedVariable {
    name: string;
    value: string;
    source: string;
    isRequired: boolean;
}

export class TemplateVariableResolver {
    private baseURL: string;
    private authToken: string;

    constructor() {
        this.baseURL = STUDENT_DATA_ENRICHMENT_BASE;
        this.authToken = this.getAuthToken();
    }

    private getAuthToken(): string {
        return getTokenFromCookie(TokenKey.accessToken) || '';
    }

    private refreshToken(): void {
        this.authToken = this.getAuthToken();
    }

    /**
     * Extract all template variables from content
     */
    public extractVariables(templateContent: string): string[] {
        return templateVariableResolverManager.extractVariables(templateContent);
    }

    /**
     * Resolve all template variables from available sources
     */
    public async resolveTemplateVariables(
        templateContent: string,
        context?: {
            studentId?: string;
            courseId?: string;
            batchId?: string;
            instituteId?: string;
            pageContext?: PageContext;
            studentData?: any;
            sessionId?: string;
            scheduleId?: string;
        }
    ): Promise<VariableResolutionResult> {
        // Convert context to the new format
        const variableContext: VariableContext = {
            studentId: context?.studentId,
            courseId: context?.courseId,
            batchId: context?.batchId,
            instituteId: context?.instituteId,
            pageContext: context?.pageContext,
            studentData: context?.studentData,
            sessionId: context?.sessionId,
            scheduleId: context?.scheduleId
        };

        // Use the modular resolver manager
        return await templateVariableResolverManager.resolveTemplateVariables(templateContent, variableContext);
    }

    /**
     * Resolve a single variable from available sources
     */
    private async resolveVariable(
        variableName: string,
        context?: {
            studentId?: string;
            courseId?: string;
            batchId?: string;
            instituteId?: string;
            pageContext?: PageContext;
        }
    ): Promise<ResolvedVariable | null> {
        // 1. Try to resolve from computed/system variables
        const computedValue = this.resolveComputedVariable(variableName);
        if (computedValue) {
            return {
                name: variableName,
                value: computedValue,
                source: 'computed',
                isRequired: true
            };
        }

        // 2. Try to resolve from cookies
        const cookieValue = this.resolveFromCookies(variableName);
        if (cookieValue) {
            return {
                name: variableName,
                value: cookieValue,
                source: 'cookie',
                isRequired: true
            };
        }

        // 3. Try to resolve from localStorage
        const localStorageValue = this.resolveFromLocalStorage(variableName);
        if (localStorageValue) {
            return {
                name: variableName,
                value: localStorageValue,
                source: 'localStorage',
                isRequired: true
            };
        }

        // 4. Try to resolve from sessionStorage
        const sessionStorageValue = this.resolveFromSessionStorage(variableName);
        if (sessionStorageValue) {
            return {
                name: variableName,
                value: sessionStorageValue,
                source: 'sessionStorage',
                isRequired: true
            };
        }

        // 5. Try to resolve from application stores
        const storeValue = await this.resolveFromStores(variableName);
        if (storeValue) {
            return {
                name: variableName,
                value: storeValue,
                source: 'store',
                isRequired: true
            };
        }

        // 6. Try to resolve from API calls (for dynamic data)
        if (context) {
            const apiValue = await this.resolveFromAPI(variableName, context);
            if (apiValue) {
                return {
                    name: variableName,
                    value: apiValue,
                    source: 'api',
                    isRequired: true
                };
            }
        }

        return null;
    }

    /**
     * Resolve computed/system variables (current date, time, etc.)
     */
    private resolveComputedVariable(variableName: string): string | null {
        const now = new Date();

        switch (variableName) {
            case 'current_date':
                return now.toLocaleDateString();
            case 'current_time':
                return now.toLocaleTimeString();
            case 'year':
                return now.getFullYear().toString();
            case 'month':
                return (now.getMonth() + 1).toString();
            case 'day':
                return now.getDate().toString();
            default:
                return null;
        }
    }

    /**
     * Resolve variable from cookies
     */
    private resolveFromCookies(variableName: string): string | null {
        try {
            const cookies = document.cookie.split(';');
            for (const cookie of cookies) {
                const [name, value] = cookie.trim().split('=');
                if (name === variableName && value) {
                    return decodeURIComponent(value);
                }
            }
        } catch (error) {
            console.warn('Error reading cookies:', error);
        }
        return null;
    }

    /**
     * Resolve variable from localStorage
     */
    private resolveFromLocalStorage(variableName: string): string | null {
        try {
            const value = localStorage.getItem(variableName);
            return value || null;
        } catch (error) {
            console.warn('Error reading localStorage:', error);
            return null;
        }
    }

    /**
     * Resolve variable from sessionStorage
     */
    private resolveFromSessionStorage(variableName: string): string | null {
        try {
            const value = sessionStorage.getItem(variableName);
            return value || null;
        } catch (error) {
            console.warn('Error reading sessionStorage:', error);
            return null;
        }
    }

    /**
     * Resolve variable from application stores
     */
    private async resolveFromStores(variableName: string): Promise<string | null> {
        try {
            // Use the existing fetchInstituteDetails API
            console.log('Fetching institute details from API...');
            const instituteData = await fetchInstituteDetails();

            if (instituteData) {
                console.log('Successfully fetched institute data from API:', instituteData);

                switch (variableName) {
                    case 'institute_name':
                        return instituteData.institute_name || null;
                    case 'institute_address':
                        // Check if address is not empty (not null, undefined, or empty string)
                        return instituteData.address && instituteData.address.trim() !== '' ? instituteData.address : null;
                    case 'institute_phone':
                        return instituteData.phone || null;
                    case 'institute_email':
                        return instituteData.email || null;
                    case 'institute_website':
                        return instituteData.website_url || null;
                    case 'institute_logo':
                        return instituteData.institute_logo_file_id || null;
                    case 'support_email':
                        return instituteData.email || null; // Use email as support email
                    case 'support_link':
                        return instituteData.website_url || null; // Use website as support link
                    case 'custom_message_text':
                        // Check if description is not empty (not null, undefined, or empty string)
                        return instituteData.description && instituteData.description.trim() !== '' ? instituteData.description : null;
                }
            } else {
                console.warn('No institute data returned from API');
            }

            // Try to get user data
            const userData = localStorage.getItem('userDetails');
            if (userData) {
                const parsed = JSON.parse(userData);

                switch (variableName) {
                    case 'name':
                    case 'student_name':
                        return parsed.full_name || parsed.name || parsed.student_name || null;
                    case 'email':
                    case 'student_email':
                        return parsed.email || parsed.student_email || null;
                    case 'mobile_number':
                    case 'student_phone':
                        return parsed.mobile_number || parsed.phone || parsed.student_phone || null;
                    case 'username':
                        return parsed.username || parsed.user_name || null;
                    case 'student_id':
                        return parsed.user_id || parsed.student_id || null;
                }
            }

        } catch (error) {
            console.warn('Error reading from stores:', error);
        }
        return null;
    }

    /**
     * Resolve variable from API calls
     */
    private async resolveFromAPI(
        variableName: string,
        context: {
            studentId?: string;
            courseId?: string;
            batchId?: string;
            instituteId?: string;
        }
    ): Promise<string | null> {
        try {
            if (!this.authToken) {
                this.refreshToken();
            }

            if (!this.authToken) {
                console.warn('No auth token available for API calls');
                return null;
            }

            // Course-related variables
            if (variableName.startsWith('course_') && context.courseId) {
                return await this.fetchCourseVariable(variableName, context.courseId, context.instituteId);
            }

            // Batch-related variables
            if (variableName.startsWith('batch_') && context.batchId) {
                return await this.fetchBatchVariable(variableName, context.batchId, context.instituteId);
            }

            // Student-related variables
            if (variableName.startsWith('student_') && context.studentId) {
                return await this.fetchStudentVariable(variableName, context.studentId, context.instituteId);
            }

            // Attendance-related variables
            if (variableName.startsWith('attendance_') && context.studentId) {
                return await this.fetchAttendanceVariable(variableName, context.studentId, context.courseId, context.batchId, context.instituteId);
            }

            // Live class-related variables
            if (variableName.startsWith('live_class_') && context.studentId) {
                return await this.fetchLiveClassVariable(variableName, context.studentId, context.courseId, context.batchId, context.instituteId);
            }

            // Referral-related variables
            if (variableName.startsWith('referral_') && context.studentId) {
                return await this.fetchReferralVariable(variableName, context.studentId, context.instituteId);
            }

        } catch (error) {
            console.warn(`Error fetching ${variableName} from API:`, error);
        }

        return null;
    }

    /**
     * Fetch course-related variable from API
     */
    private async fetchCourseVariable(variableName: string, courseId: string, instituteId?: string): Promise<string | null> {
        try {
            const payload = {
                courseId,
                instituteId: instituteId || this.getCurrentInstituteId() || '',
                includeDetails: true,
                includePricing: true,
                includeInstructor: true
            };

            const response = await fetch(`${this.baseURL}/courses/details`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.authToken}`,
                },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                throw new Error(`API request failed: ${response.status}`);
            }

            const data = await response.json();

            switch (variableName) {
                case 'course_name':
                    return data.name || data.title || null;
                case 'course_description':
                    return data.description || null;
                case 'course_price':
                    return data.price || data.cost || null;
                case 'course_duration':
                    return data.duration || data.length || null;
                case 'course_instructor':
                    return data.instructor || data.teacher || null;
                case 'course_start_date':
                    return data.start_date || null;
                case 'course_end_date':
                    return data.end_date || null;
                default:
                    return null;
            }
        } catch (error) {
            console.warn(`Error fetching course variable ${variableName}:`, error);
            return null;
        }
    }

    /**
     * Fetch batch-related variable from API
     */
    private async fetchBatchVariable(variableName: string, batchId: string, instituteId?: string): Promise<string | null> {
        try {
            const payload = {
                batchId,
                instituteId: instituteId || this.getCurrentInstituteId() || '',
                includeSchedule: true,
                includeStudents: false
            };

            const response = await fetch(`${this.baseURL}/batches/details`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.authToken}`,
                },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                throw new Error(`API request failed: ${response.status}`);
            }

            const data = await response.json();

            switch (variableName) {
                case 'batch_name':
                    return data.name || data.batch_name || null;
                case 'batch_id':
                    return data.id || data.batch_id || null;
                case 'batch_start_date':
                    return data.start_date || data.startDate || null;
                case 'batch_end_date':
                    return data.end_date || data.endDate || null;
                default:
                    return null;
            }
        } catch (error) {
            console.warn(`Error fetching batch variable ${variableName}:`, error);
            return null;
        }
    }

    /**
     * Fetch student-related variable from API
     */
    private async fetchStudentVariable(variableName: string, studentId: string, instituteId?: string): Promise<string | null> {
        try {
            const response = await fetch(`${this.baseURL}/students/${studentId}`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${this.authToken}`,
                }
            });

            if (!response.ok) {
                throw new Error(`API request failed: ${response.status}`);
            }

            const data = await response.json();

            switch (variableName) {
                case 'student_name':
                case 'name':
                    return data.full_name || data.name || data.student_name || null;
                case 'student_email':
                case 'email':
                    return data.email || data.student_email || null;
                case 'student_phone':
                case 'mobile_number':
                    return data.mobile_number || data.phone || data.student_phone || null;
                case 'student_id':
                    return data.user_id || data.student_id || null;
                case 'username':
                    return data.username || data.user_name || null;
                case 'enrollment_number':
                    return data.enrollment_number || null;
                case 'student_unique_link':
                    return data.unique_link || data.student_unique_link || null;
                default:
                    return null;
            }
        } catch (error) {
            console.warn(`Error fetching student variable ${variableName}:`, error);
            return null;
        }
    }

    /**
     * Fetch attendance-related variable from API
     */
    private async fetchAttendanceVariable(
        variableName: string,
        studentId: string,
        courseId?: string,
        batchId?: string,
        instituteId?: string
    ): Promise<string | null> {
        try {
            const payload = {
                studentId,
                instituteId: instituteId || this.getCurrentInstituteId() || '',
                courseId,
                batchId,
                includeDetails: true,
                dateRange: {
                    startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
                    endDate: new Date().toISOString()
                }
            };

            const response = await fetch(`${this.baseURL}/students/attendance`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.authToken}`,
                },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                throw new Error(`API request failed: ${response.status}`);
            }

            const data = await response.json();

            switch (variableName) {
                case 'attendance_status':
                    return data.attendance_status || data.status || null;
                case 'attendance_percentage':
                    return data.attendance_percentage || data.percentage || null;
                case 'attendance_total_classes':
                    return data.total_classes || data.total_sessions || null;
                case 'attendance_attended_classes':
                    return data.attended_classes || data.attended_sessions || null;
                case 'attendance_last_class_date':
                    return data.last_class_date || null;
                case 'attendance_date':
                    return data.attendance_date || null;
                default:
                    return null;
            }
        } catch (error) {
            console.warn(`Error fetching attendance variable ${variableName}:`, error);
            return null;
        }
    }

    /**
     * Fetch live class-related variable from API
     */
    private async fetchLiveClassVariable(
        variableName: string,
        studentId: string,
        courseId?: string,
        batchId?: string,
        instituteId?: string
    ): Promise<string | null> {
        try {
            const payload = {
                studentId,
                instituteId: instituteId || this.getCurrentInstituteId() || '',
                courseId,
                batchId,
                includeDetails: true,
                includeUpcoming: true
            };

            const response = await fetch(`${this.baseURL}/students/live-classes`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.authToken}`,
                },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                throw new Error(`API request failed: ${response.status}`);
            }

            const data = await response.json();

            switch (variableName) {
                case 'live_class_name':
                case 'live_class_title':
                    return data.title || data.name || data.live_class_title || null;
                case 'live_class_date':
                    return data.date || data.live_class_date || null;
                case 'live_class_time':
                    return data.time || data.live_class_time || null;
                case 'live_class_start_time':
                    return data.start_time || data.live_class_start_time || null;
                case 'live_class_end_time':
                    return data.end_time || data.live_class_end_time || null;
                case 'live_class_duration':
                    return data.duration || data.live_class_duration || null;
                case 'live_class_link':
                    return data.link || data.live_class_link || null;
                case 'live_class_meeting_link':
                    return data.meeting_link || data.live_class_meeting_link || null;
                case 'live_class_platform':
                    return data.platform || data.live_class_platform || null;
                case 'live_class_description':
                    return data.description || data.live_class_description || null;
                default:
                    return null;
            }
        } catch (error) {
            console.warn(`Error fetching live class variable ${variableName}:`, error);
            return null;
        }
    }

    /**
     * Fetch referral-related variable from API
     */
    private async fetchReferralVariable(
        variableName: string,
        studentId: string,
        instituteId?: string
    ): Promise<string | null> {
        try {
            const payload = {
                studentId,
                instituteId: instituteId || this.getCurrentInstituteId() || '',
                includeStats: true,
                includeRewards: true,
                includeHistory: false
            };

            const response = await fetch(`${this.baseURL}/students/referral`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.authToken}`,
                },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                throw new Error(`API request failed: ${response.status}`);
            }

            const data = await response.json();

            switch (variableName) {
                case 'referral_code':
                case 'student_referral_code':
                    return data.referral_code || data.code || null;
                case 'referral_count':
                    return data.referral_count || data.count || null;
                case 'referral_rewards':
                    return data.referral_rewards || data.rewards || null;
                case 'referral_status':
                    return data.referral_status || data.status || null;
                case 'referral_date':
                    return data.referral_date || data.date || null;
                case 'referral_benefits':
                    return data.referral_benefits || data.benefits || null;
                default:
                    return null;
            }
        } catch (error) {
            console.warn(`Error fetching referral variable ${variableName}:`, error);
            return null;
        }
    }

    /**
     * Get current institute ID from token or localStorage
     */
    private getCurrentInstituteId(): string | null {
        try {
            // Try to get from token
            const tokenData = this.getTokenDecodedData(this.authToken);
            if (tokenData && tokenData.authorities) {
                const instituteId = Object.keys(tokenData.authorities)[0];
                if (instituteId) return instituteId;
            }

            // Fallback to localStorage
            const instituteData = localStorage.getItem('instituteDetails');
            if (instituteData) {
                const parsed = JSON.parse(instituteData);
                return parsed.institute_id || parsed.id || null;
            }

            return null;
        } catch (error) {
            console.warn('Error getting institute ID:', error);
            return null;
        }
    }

    /**
     * Decode JWT token data
     */
    private getTokenDecodedData(token: string): any {
        try {
            if (!token) return null;
            const payload = token.split('.')[1];
            if (!payload) return null;
            return JSON.parse(atob(payload));
        } catch (error) {
            console.warn('Error decoding token:', error);
            return null;
        }
    }

}

// Export singleton instance
export const templateVariableResolver = new TemplateVariableResolver();
