/**
 * Template Variables System
 *
 * Modular system for resolving template variables with lazy loading
 * and caching for optimal performance.
 */

// Core types and interfaces
export * from './types';

// Cache system
export * from './cache';

// Individual resolvers
export { ComputedVariableResolver } from './resolvers/computed-resolver';
export { InstituteVariableResolver } from './resolvers/institute-resolver';
export { StudentVariableResolver } from './resolvers/student-resolver';
export { CourseVariableResolver } from './resolvers/course-resolver';
export { BatchVariableResolver } from './resolvers/batch-resolver';
export { AttendanceVariableResolver } from './resolvers/attendance-resolver';

// Main resolver manager
export { TemplateVariableResolverManager, templateVariableResolverManager } from './resolver-manager';

// Convenience exports
export { variableCache } from './cache';
