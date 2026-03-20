/**
 * Base types and interfaces for template variable resolution
 */

import type { PageContext } from '../page-context-resolver';

export interface VariableContext {
    studentId?: string;
    courseId?: string;
    batchId?: string;
    instituteId?: string;
    pageContext?: PageContext;
    studentData?: any; // Student data passed from the calling component
    sessionId?: string | null; // Session ID for attendance data
    scheduleId?: string | null; // Schedule ID for attendance data
}

export interface ResolvedVariable {
    name: string;
    value: string;
    source: string;
    isRequired: boolean;
    cached?: boolean;
    timestamp?: number;
}

export interface VariableResolutionResult {
    success: boolean;
    availableVariables: Record<string, string>;
    missingVariables: string[];
    warnings: string[];
    cachedVariables: Record<string, ResolvedVariable>;
}

export interface VariableResolver {
    /**
     * Check if this resolver can handle the given variable
     */
    canResolve(variableName: string): boolean;

    /**
     * Resolve a single variable
     */
    resolve(variableName: string, context?: VariableContext): Promise<ResolvedVariable | null>;

    /**
     * Get all variables this resolver can handle
     */
    getSupportedVariables(): string[];

    /**
     * Get priority (higher number = higher priority)
     */
    getPriority(): number;
}

export interface CachedVariable {
    variable: ResolvedVariable;
    expiresAt: number;
}

export interface VariableCache {
    get(key: string): CachedVariable | null;
    set(key: string, variable: ResolvedVariable, ttl?: number): void;
    clear(): void;
    clearExpired(): void;
    has(key: string): boolean;
}

export type VariableCategory =
    | 'computed'
    | 'institute'
    | 'student'
    | 'course'
    | 'batch'
    | 'attendance'
    | 'live-class'
    | 'referral'
    | 'user'
    | 'custom';

export interface VariableMetadata {
    category: VariableCategory;
    description: string;
    example: string;
    required: boolean;
    fallback?: string;
}
