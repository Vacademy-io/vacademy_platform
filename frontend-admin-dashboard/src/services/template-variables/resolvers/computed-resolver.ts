/**
 * Resolver for computed/system variables (date, time, etc.)
 */

import { VariableResolver, ResolvedVariable, VariableContext, VariableCategory } from '../types';

export class ComputedVariableResolver implements VariableResolver {
    private readonly supportedVariables = [
        'current_date',
        'current_time',
        'year',
        'month',
        'day',
        'weekday',
        'timestamp'
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

        // Clean the variable name (remove brackets if present)
        const cleanName = variableName.replace(/[{}]/g, '');
        const now = new Date();
        let value: string;

        switch (cleanName) {
            case 'current_date':
                value = now.toLocaleDateString();
                break;
            case 'current_time':
                value = now.toLocaleTimeString();
                break;
            case 'year':
                value = now.getFullYear().toString();
                break;
            case 'month':
                value = (now.getMonth() + 1).toString();
                break;
            case 'day':
                value = now.getDate().toString();
                break;
            case 'weekday':
                value = now.toLocaleDateString('en-US', { weekday: 'long' });
                break;
            case 'timestamp':
                value = now.getTime().toString();
                break;
            default:
                return null;
        }

        return {
            name: variableName,
            value,
            source: 'computed',
            isRequired: false
        };
    }

    getSupportedVariables(): string[] {
        return [...this.supportedVariables];
    }

    getPriority(): number {
        return 100; // High priority - computed variables are always available
    }

    getMetadata() {
        return {
            category: 'computed' as VariableCategory,
            description: 'System-generated computed variables',
            variables: this.supportedVariables.map(variable => ({
                name: variable,
                description: this.getVariableDescription(variable),
                example: this.getVariableExample(variable)
            }))
        };
    }

    private getVariableDescription(variable: string): string {
        const descriptions: Record<string, string> = {
            'current_date': 'Current date in local format',
            'current_time': 'Current time in local format',
            'year': 'Current year (4 digits)',
            'month': 'Current month (1-12)',
            'day': 'Current day of month (1-31)',
            'weekday': 'Current day of week (e.g., Monday)',
            'timestamp': 'Current Unix timestamp'
        };
        return descriptions[variable] || 'Computed variable';
    }

    private getVariableExample(variable: string): string {
        const now = new Date();
        const examples: Record<string, string> = {
            'current_date': now.toLocaleDateString(),
            'current_time': now.toLocaleTimeString(),
            'year': now.getFullYear().toString(),
            'month': (now.getMonth() + 1).toString(),
            'day': now.getDate().toString(),
            'weekday': now.toLocaleDateString('en-US', { weekday: 'long' }),
            'timestamp': now.getTime().toString()
        };
        return examples[variable] || 'N/A';
    }
}
