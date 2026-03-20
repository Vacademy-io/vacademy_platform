/**
 * Resolver for student-related variables
 */

import { VariableResolver, ResolvedVariable, VariableContext, VariableCategory } from '../types';
import { variableCache } from '../cache';

export class StudentVariableResolver implements VariableResolver {
    private readonly supportedVariables = [
        'name',
        'student_name',
        'email',
        'student_email',
        'mobile_number',
        'student_phone',
        'student_id',
        'enrollment_number',
        'username',
        'registration_date',
        'student_unique_link',
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

        // Clean the variable name (remove brackets if present)
        const cleanName = variableName.replace(/[{}]/g, '');

        // Check cache first
        const cacheKey = `student:${cleanName}:${context?.studentId || 'default'}`;
        const cached = variableCache.get(cacheKey);
        if (cached) {
            return cached.variable;
        }

        try {
            // Get student data from context or localStorage
            const studentData = await this.getStudentData(context?.studentId, context);

            if (!studentData) {
                return null;
            }

            let value: string | null = null;

            switch (cleanName) {
                case 'name':
                case 'student_name':
                    value =
                        studentData.fullName || studentData.full_name || studentData.name || null;
                    break;
                case 'email':
                case 'student_email':
                    value = studentData.email || null;
                    break;
                case 'mobile_number':
                case 'student_phone':
                    value =
                        studentData.mobileNumber ||
                        studentData.mobile_number ||
                        studentData.phone ||
                        null;
                    break;
                case 'student_id':
                    value = studentData.studentId || studentData.user_id || studentData.id || null;
                    break;
                case 'enrollment_number':
                    value =
                        studentData.instituteEnrollmentNumber ||
                        studentData.enrollment_number ||
                        studentData.student_id ||
                        null;
                    break;
                case 'username':
                    value = studentData.username || studentData.email || null;
                    break;
                case 'registration_date':
                    value = studentData.registration_date || studentData.created_at || null;
                    break;
                case 'student_unique_link':
                    value = studentData.unique_link || studentData.profile_url || null;
                    break;
            }

            if (value === null) {
                return null;
            }

            const resolved: ResolvedVariable = {
                name: variableName,
                value,
                source: 'student-data',
                isRequired: true,
            };

            // Cache the result for 5 minutes
            variableCache.set(cacheKey, resolved, 5 * 60 * 1000);

            return resolved;
        } catch (error) {
            console.warn(`Error resolving student variable ${variableName}:`, error);
            return null;
        }
    }

    getSupportedVariables(): string[] {
        return [...this.supportedVariables];
    }

    getPriority(): number {
        return 70; // Medium-high priority
    }

    private async getStudentData(studentId?: string, context?: VariableContext): Promise<any> {
        console.log('🔍 Getting student data for:', studentId, 'Context:', context);
        console.log('🔍 Context has studentData:', !!context?.studentData);
        console.log('🔍 StudentData content:', context?.studentData);
        console.log('🔍 Full context keys:', context ? Object.keys(context) : 'No context');

        // Try to get from current context first (if available)
        if (context?.studentData) {
            console.log('✅ Found student data in context:', context.studentData);
            console.log('📋 Student data fields:', {
                name:
                    context.studentData.fullName ||
                    context.studentData.full_name ||
                    context.studentData.name,
                email: context.studentData.email,
                student_id:
                    context.studentData.studentId ||
                    context.studentData.user_id ||
                    context.studentData.id,
                mobile:
                    context.studentData.mobileNumber ||
                    context.studentData.mobile_number ||
                    context.studentData.phone,
                enrollment:
                    context.studentData.instituteEnrollmentNumber ||
                    context.studentData.enrollment_number,
            });
            return context.studentData;
        } else {
            console.log('❌ No student data found in context');
        }

        // Try localStorage as fallback - first try specific student, then general user data
        if (studentId) {
            const cachedData = localStorage.getItem(`student_${studentId}`);
            if (cachedData) {
                try {
                    return JSON.parse(cachedData);
                } catch (error) {
                    console.warn('Error parsing cached student data:', error);
                }
            }
        }

        // Try general user data from localStorage (fallback for template creation/editing)
        try {
            const userData = localStorage.getItem('userDetails');
            if (userData) {
                const parsed = JSON.parse(userData);
                console.log('✅ Found user data in localStorage:', parsed);
                return parsed;
            }
        } catch (error) {
            console.warn('Error parsing user data from localStorage:', error);
        }

        return null;
    }

    getMetadata() {
        return {
            category: 'student' as VariableCategory,
            description: 'Student-related information',
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
            name: 'Student full name',
            student_name: 'Student full name (alias)',
            email: 'Student email address',
            student_email: 'Student email address (alias)',
            mobile_number: 'Student mobile phone number',
            student_phone: 'Student phone number (alias)',
            student_id: 'Unique student identifier',
            enrollment_number: 'Student enrollment number',
            username: 'Student username or email',
            registration_date: 'Student registration date',
            student_unique_link: 'Unique link to student profile',
        };
        return descriptions[variable] || 'Student variable';
    }

    private getVariableExample(variable: string): string {
        const examples: Record<string, string> = {
            name: 'John Doe',
            student_name: 'John Doe',
            email: 'john.doe@example.com',
            student_email: 'john.doe@example.com',
            mobile_number: '+1234567890',
            student_phone: '+1234567890',
            student_id: 'STU001',
            enrollment_number: 'ENR2024001',
            username: 'john.doe',
            registration_date: '2024-01-15',
            student_unique_link: `${window.location.origin}/student/[studentId]`,
        };
        return examples[variable] || 'N/A';
    }

    private isRequired(variable: string): boolean {
        const requiredVariables = ['name', 'student_name', 'email', 'student_email', 'student_id'];
        return requiredVariables.includes(variable);
    }
}
