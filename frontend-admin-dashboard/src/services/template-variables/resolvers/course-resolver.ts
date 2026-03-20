/**
 * Resolver for course-related variables
 */

import { VariableResolver, ResolvedVariable, VariableContext, VariableCategory } from '../types';
import { variableCache } from '../cache';

export class CourseVariableResolver implements VariableResolver {
    private readonly supportedVariables = [
        'course_name',
        'course_description',
        'course_price',
        'course_duration',
        'course_instructor',
        'course_start_date',
        'course_end_date',
        'course_id'
    ];

    canResolve(variableName: string): boolean {
        // Handle both with and without brackets
        const cleanName = variableName.replace(/[{}]/g, '');
        return this.supportedVariables.includes(cleanName) || this.supportedVariables.includes(variableName);
    }

    async resolve(variableName: string, context?: VariableContext): Promise<ResolvedVariable | null> {
        if (!this.canResolve(variableName)) {
            return null;
        }

        if (!context?.courseId) {
            return null;
        }

        // Clean the variable name (remove brackets if present)
        const cleanName = variableName.replace(/[{}]/g, '');

        // Check cache first
        const cacheKey = `course:${cleanName}:${context.courseId}`;
        const cached = variableCache.get(cacheKey);
        if (cached) {
            return cached.variable;
        }

        try {
            // Fetch course data from API
            const courseData = await this.fetchCourseData(context.courseId, context.instituteId);

            if (!courseData) {
                return null;
            }

            let value: string | null = null;

            switch (cleanName) {
                case 'course_name':
                    value = courseData.name || courseData.title || null;
                    break;
                case 'course_description':
                    value = courseData.description || null;
                    break;
                case 'course_price':
                    value = courseData.price || courseData.cost || null;
                    break;
                case 'course_duration':
                    value = courseData.duration || courseData.length || null;
                    break;
                case 'course_instructor':
                    value = courseData.instructor || courseData.teacher || null;
                    break;
                case 'course_start_date':
                    value = courseData.start_date || courseData.startDate || null;
                    break;
                case 'course_end_date':
                    value = courseData.end_date || courseData.endDate || null;
                    break;
                case 'course_id':
                    value = courseData.id || context.courseId || null;
                    break;
            }

            if (value === null) {
                return null;
            }

            const resolved: ResolvedVariable = {
                name: variableName,
                value,
                source: 'course-api',
                isRequired: true
            };

            // Cache the result for 15 minutes
            variableCache.set(cacheKey, resolved, 15 * 60 * 1000);

            return resolved;

        } catch (error) {
            console.warn(`Error resolving course variable ${variableName}:`, error);
            return null;
        }
    }

    getSupportedVariables(): string[] {
        return [...this.supportedVariables];
    }

    getPriority(): number {
        return 60; // Medium priority
    }

    private async fetchCourseData(courseId: string, instituteId?: string): Promise<any> {
        try {
            // This would typically make an API call to fetch course details
            // For now, return null to indicate no data available
            console.log(`Fetching course data for courseId: ${courseId}, instituteId: ${instituteId}`);
            return null;
        } catch (error) {
            console.warn('Error fetching course data:', error);
            return null;
        }
    }

    getMetadata() {
        return {
            category: 'course' as VariableCategory,
            description: 'Course-related information',
            variables: this.supportedVariables.map(variable => ({
                name: variable,
                description: this.getVariableDescription(variable),
                example: this.getVariableExample(variable),
                required: this.isRequired(variable)
            }))
        };
    }

    private getVariableDescription(variable: string): string {
        const descriptions: Record<string, string> = {
            'course_name': 'Name of the course',
            'course_description': 'Description of the course',
            'course_price': 'Price of the course',
            'course_duration': 'Duration of the course',
            'course_instructor': 'Course instructor name',
            'course_start_date': 'Course start date',
            'course_end_date': 'Course end date',
            'course_id': 'Unique course identifier'
        };
        return descriptions[variable] || 'Course variable';
    }

    private getVariableExample(variable: string): string {
        const examples: Record<string, string> = {
            'course_name': 'Advanced Mathematics',
            'course_description': 'Learn advanced mathematical concepts',
            'course_price': '$299',
            'course_duration': '12 weeks',
            'course_instructor': 'Dr. Smith',
            'course_start_date': '2024-01-15',
            'course_end_date': '2024-04-15',
            'course_id': 'MATH101'
        };
        return examples[variable] || 'N/A';
    }

    private isRequired(variable: string): boolean {
        const requiredVariables = [
            'course_name',
            'course_id'
        ];
        return requiredVariables.includes(variable);
    }
}
