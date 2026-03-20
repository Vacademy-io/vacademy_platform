/**
 * Resolver for attendance-related variables
 */

import { VariableResolver, ResolvedVariable, VariableContext, VariableCategory } from '../types';
import { variableCache } from '../cache';
import { LIVE_SESSION_REPORT_BY_SESSION_ID } from '@/constants/urls';
import { getTokenFromCookie } from '@/lib/auth/sessionUtility';
import { TokenKey } from '@/constants/auth/tokens';

export class AttendanceVariableResolver implements VariableResolver {
    private readonly supportedVariables = [
        'attendance_status',
        'attendance_date',
        'attendance_percentage',
        'attendance_total_classes',
        'attendance_attended_classes',
        'attendance_last_class_date',
        'attendance_marks',
    ];

    canResolve(variableName: string): boolean {
        // Handle both with and without brackets
        const cleanName = variableName.replace(/[{}]/g, '');
        return (
            this.supportedVariables.includes(cleanName) ||
            this.supportedVariables.includes(variableName)
        );
    }

    async resolve(
        variableName: string,
        context?: VariableContext
    ): Promise<ResolvedVariable | null> {
        if (!this.canResolve(variableName)) {
            return null;
        }

        if (!context?.studentId) {
            return null;
        }

        // Clean the variable name (remove brackets if present)
        const cleanName = variableName.replace(/[{}]/g, '');

        // Check cache first
        const cacheKey = `attendance:${cleanName}:${context.studentId}:${context.courseId || 'default'}`;
        const cached = variableCache.get(cacheKey);
        if (cached) {
            return cached.variable;
        }

        try {
            console.log(`🔍 Resolving ${cleanName} for student ${context.studentId}`);
            // Fetch attendance data from API
            const attendanceData = await this.fetchAttendanceData(
                context.studentId,
                context.courseId,
                context.batchId,
                context.instituteId,
                context
            );

            if (!attendanceData) {
                console.log(`❌ No attendance data for ${cleanName}`);
                return null;
            }

            console.log(`✅ Attendance data available for ${cleanName}:`, attendanceData);

            let value: string | null = null;

            switch (cleanName) {
                case 'attendance_status':
                    value = attendanceData.status || attendanceData.attendance_status || null;
                    break;
                case 'attendance_date':
                    value = attendanceData.date || attendanceData.attendance_date || null;
                    break;
                case 'attendance_percentage':
                    value =
                        attendanceData.percentage || attendanceData.attendance_percentage || null;
                    break;
                case 'attendance_total_classes':
                    value = attendanceData.total_classes || attendanceData.total_sessions || null;
                    break;
                case 'attendance_attended_classes':
                    console.log('🔍 Mapping attendance_attended_classes:', {
                        attended_classes: attendanceData.attended_classes,
                        attended_sessions: attendanceData.attended_sessions,
                        fullData: attendanceData
                    });
                    value =
                        attendanceData.attended_classes || attendanceData.attended_sessions || '0';
                    console.log('🔍 Final value for attendance_attended_classes:', value);
                    break;
                case 'attendance_last_class_date':
                    value =
                        attendanceData.last_class_date ||
                        attendanceData.last_attendance_date ||
                        null;
                    break;
                case 'attendance_marks':
                    value = attendanceData.marks || attendanceData.attendance_marks || null;
                    break;
            }

            if (value === null) {
                return null;
            }

            const resolved: ResolvedVariable = {
                name: variableName,
                value,
                source: 'attendance-api',
                isRequired: true,
            };

            // Cache the result for 5 minutes (attendance data changes frequently)
            variableCache.set(cacheKey, resolved, 5 * 60 * 1000);

            return resolved;
        } catch (error) {
            console.warn(`Error resolving attendance variable ${variableName}:`, error);
            return null;
        }
    }

    getSupportedVariables(): string[] {
        return [...this.supportedVariables];
    }

    getPriority(): number {
        return 40; // Medium priority
    }

    private async fetchAttendanceData(
        studentId: string,
        courseId?: string,
        batchId?: string,
        instituteId?: string,
        context?: VariableContext
    ): Promise<any> {
        try {
            console.log(
                `Fetching attendance data for studentId: ${studentId}, courseId: ${courseId}, batchId: ${batchId}`
            );

            // Get session ID from context
            const sessionId = this.getSessionIdFromContext(context);

            if (!sessionId) {
                console.warn('No session ID available for attendance data');
                return null;
            }

            const token = getTokenFromCookie(TokenKey.accessToken);
            if (!token) {
                console.warn('No authentication token available');
                return null;
            }

            // Make API call to get attendance data
            const response = await fetch(
                `${LIVE_SESSION_REPORT_BY_SESSION_ID}?sessionId=${sessionId}&scheduleId=${context?.scheduleId || courseId || ''}&accessType=public`,
                {
                    method: 'GET',
                    headers: {
                        Authorization: `Bearer ${token}`,
                        'Content-Type': 'application/json',
                        Accept: 'application/json',
                    },
                }
            );

            if (!response.ok) {
                console.warn(
                    `Attendance API request failed: ${response.status} ${response.statusText}`
                );
                return null;
            }

            const attendanceData = await response.json();

            // Find the specific student's attendance data
            const studentAttendance = attendanceData.find(
                (student: any) => student.studentId === studentId
            );

            if (!studentAttendance) {
                console.warn(`No attendance data found for student ${studentId}`);
                return null;
            }

            // Map the API response to our expected format
            // Note: The API returns attendanceStatus: null for all students
            // This means attendance data is not available for this session
            console.log('📊 Attendance data mapping:', {
                studentId: studentId,
                attendanceStatus: studentAttendance.attendanceStatus,
                attendanceTimestamp: studentAttendance.attendanceTimestamp,
                totalStudentsInSession: attendanceData.length,
                studentData: {
                    fullName: studentAttendance.fullName,
                    email: studentAttendance.email,
                    enrollmentNumber: studentAttendance.instituteEnrollmentNumber
                }
            });

            // Log API response data mapping with null values
            console.log('🔍 API Response Data Mapping:');
            console.log('  - attendanceStatus:', studentAttendance.attendanceStatus, '(null = not available)');
            console.log('  - attendanceTimestamp:', studentAttendance.attendanceTimestamp, '(null = not available)');
            console.log('  - fullName:', studentAttendance.fullName, '(available)');
            console.log('  - email:', studentAttendance.email, '(available)');
            console.log('  - enrollmentNumber:', studentAttendance.instituteEnrollmentNumber, '(available)');

            // Since attendanceStatus is null, we'll provide default values
            const defaultStatus = 'Not Available';
            const defaultPercentage = '0%';
            const defaultMarks = '0/100';

            return {
                status: defaultStatus,
                attendance_status: defaultStatus,
                percentage: defaultPercentage,
                attendance_percentage: defaultPercentage,
                total_classes: attendanceData.length, // Total students in session
                total_sessions: attendanceData.length,
                attended_classes: 0, // No attendance data available
                attended_sessions: 0,
                date: studentAttendance.attendanceTimestamp || new Date().toISOString(),
                attendance_date: studentAttendance.attendanceTimestamp || new Date().toISOString(),
                last_class_date: studentAttendance.attendanceTimestamp || new Date().toISOString(),
                last_attendance_date: studentAttendance.attendanceTimestamp || new Date().toISOString(),
                marks: defaultMarks,
                attendance_marks: defaultMarks,
            };
        } catch (error) {
            console.warn('Error fetching attendance data:', error);
            return null;
        }
    }

    private getSessionIdFromContext(context?: VariableContext): string | null {
        console.log('🔍 Getting session ID from context:', context?.sessionId);
        console.log('🔍 Full context for attendance:', context);
        return context?.sessionId || null;
    }

    private calculateAttendancePercentage(studentAttendance: any): string {
        // Handle null/undefined attendance status
        if (!studentAttendance.attendanceStatus) {
            return 'Not Available';
        }

        if (studentAttendance.attendanceStatus === 'Present') {
            return '100%';
        } else if (studentAttendance.attendanceStatus === 'Absent') {
            return '0%';
        }
        return 'Not Available';
    }

    private calculateAttendanceMarks(studentAttendance: any): string {
        // Handle null/undefined attendance status
        if (!studentAttendance.attendanceStatus) {
            return 'Not Available';
        }

        if (studentAttendance.attendanceStatus === 'Present') {
            return '100/100';
        } else if (studentAttendance.attendanceStatus === 'Absent') {
            return '0/100';
        }
        return 'Not Available';
    }

    getMetadata() {
        return {
            category: 'attendance' as VariableCategory,
            description: 'Attendance-related information',
            variables: this.supportedVariables.map((variable) => ({
                name: variable,
                description: this.getVariableDescription(variable),
                example: this.getVariableExample(variable),
                required: this.isRequired(variable),
            })),
        };
    }

    private getVariableDescription(variable: string): string {
        const descriptions: Record<string, string> = {
            attendance_status: 'Current attendance status (Present/Absent)',
            attendance_date: 'Date of attendance',
            attendance_percentage: 'Overall attendance percentage',
            attendance_total_classes: 'Total number of classes',
            attendance_attended_classes: 'Number of classes attended',
            attendance_last_class_date: 'Date of last attended class',
            attendance_marks: 'Attendance marks or score',
        };
        return descriptions[variable] || 'Attendance variable';
    }

    private getVariableExample(variable: string): string {
        const examples: Record<string, string> = {
            attendance_status: 'Present',
            attendance_date: '2024-01-15',
            attendance_percentage: '85%',
            attendance_total_classes: '20',
            attendance_attended_classes: '17',
            attendance_last_class_date: '2024-01-14',
            attendance_marks: '85/100',
        };
        return examples[variable] || 'N/A';
    }

    private isRequired(variable: string): boolean {
        const requiredVariables = ['attendance_status', 'attendance_percentage'];
        return requiredVariables.includes(variable);
    }
}
