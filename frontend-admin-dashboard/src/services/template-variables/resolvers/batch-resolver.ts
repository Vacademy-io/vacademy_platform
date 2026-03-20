/**
 * Resolver for batch-related variables
 */

import { VariableResolver, ResolvedVariable, VariableContext, VariableCategory } from '../types';
import { variableCache } from '../cache';

export class BatchVariableResolver implements VariableResolver {
    private readonly supportedVariables = [
        'batch_name',
        'batch_id',
        'batch_start_date',
        'batch_end_date',
        'batch_schedule',
        'batch_capacity',
        'batch_students_count'
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

        if (!context?.batchId) {
            return null;
        }

        // Clean the variable name (remove brackets if present)
        const cleanName = variableName.replace(/[{}]/g, '');

        // Check cache first
        const cacheKey = `batch:${cleanName}:${context.batchId}`;
        const cached = variableCache.get(cacheKey);
        if (cached) {
            return cached.variable;
        }

        try {
            // Fetch batch data from API
            const batchData = await this.fetchBatchData(context.batchId, context.instituteId);

            if (!batchData) {
                return null;
            }

            let value: string | null = null;

            switch (cleanName) {
                case 'batch_name':
                    value = batchData.name || batchData.batch_name || null;
                    break;
                case 'batch_id':
                    value = batchData.id || context.batchId || null;
                    break;
                case 'batch_start_date':
                    value = batchData.start_date || batchData.startDate || null;
                    break;
                case 'batch_end_date':
                    value = batchData.end_date || batchData.endDate || null;
                    break;
                case 'batch_schedule':
                    value = batchData.schedule || batchData.timing || null;
                    break;
                case 'batch_capacity':
                    value = batchData.capacity || batchData.max_students || null;
                    break;
                case 'batch_students_count':
                    value = batchData.students_count || batchData.enrolled_count || null;
                    break;
            }

            if (value === null) {
                return null;
            }

            const resolved: ResolvedVariable = {
                name: variableName,
                value,
                source: 'batch-api',
                isRequired: true
            };

            // Cache the result for 10 minutes
            variableCache.set(cacheKey, resolved, 10 * 60 * 1000);

            return resolved;

        } catch (error) {
            console.warn(`Error resolving batch variable ${variableName}:`, error);
            return null;
        }
    }

    getSupportedVariables(): string[] {
        return [...this.supportedVariables];
    }

    getPriority(): number {
        return 50; // Medium priority
    }

    private async fetchBatchData(batchId: string, instituteId?: string): Promise<any> {
        try {
            // This would typically make an API call to fetch batch details
            // For now, return null to indicate no data available
            console.log(`Fetching batch data for batchId: ${batchId}, instituteId: ${instituteId}`);
            return null;
        } catch (error) {
            console.warn('Error fetching batch data:', error);
            return null;
        }
    }

    getMetadata() {
        return {
            category: 'batch' as VariableCategory,
            description: 'Batch-related information',
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
            'batch_name': 'Name of the batch',
            'batch_id': 'Unique batch identifier',
            'batch_start_date': 'Batch start date',
            'batch_end_date': 'Batch end date',
            'batch_schedule': 'Batch schedule or timing',
            'batch_capacity': 'Maximum number of students in batch',
            'batch_students_count': 'Current number of students in batch'
        };
        return descriptions[variable] || 'Batch variable';
    }

    private getVariableExample(variable: string): string {
        const examples: Record<string, string> = {
            'batch_name': 'Morning Batch A',
            'batch_id': 'BATCH001',
            'batch_start_date': '2024-01-15',
            'batch_end_date': '2024-04-15',
            'batch_schedule': 'Mon-Fri 9:00 AM - 12:00 PM',
            'batch_capacity': '30',
            'batch_students_count': '25'
        };
        return examples[variable] || 'N/A';
    }

    private isRequired(variable: string): boolean {
        const requiredVariables = [
            'batch_name',
            'batch_id'
        ];
        return requiredVariables.includes(variable);
    }
}
