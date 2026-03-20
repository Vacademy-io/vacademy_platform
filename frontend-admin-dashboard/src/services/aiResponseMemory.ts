/* eslint-disable @typescript-eslint/no-explicit-any, complexity */
import type {
    Subject,
    Module,
    Chapter,
    Slide,
} from '../components/ai-course-builder/course/courseData';

export interface TodoTask {
    id: string;
    title: string;
    description: string;
    type: 'subject' | 'module' | 'chapter' | 'slide';
    path?: string;
    completed: boolean;
    metadata?: any;
    createdAt: Date;
    completedAt?: Date;
}

export interface PathData {
    path: string;
    type: 'course' | 'subject' | 'module' | 'chapter' | 'slide';
    name: string;
    description?: string;
    content?: string;
    slideType?: string;
    action: 'ADD' | 'UPDATE' | 'DELETE';
    metadata?: any;
}

export interface StoredAIResponse {
    id: string;
    timestamp: Date;
    userPrompt: string;
    rawResponse: string;

    // Extracted structured data
    summary: string; // Only important headings/tags for display
    todos: TodoTask[];
    courseStructure?: {
        subjects?: Subject[];
        modules?: Module[];
        chapters?: Chapter[];
        slides?: Slide[];
    };

    // Path-based structured storage
    pathData: Map<string, PathData>;

    // Metadata
    model: string;
    processingComplete: boolean;
}

class AIResponseMemoryService {
    private responses: Map<string, StoredAIResponse> = new Map();
    private currentSessionTodos: TodoTask[] = [];

    /**
     * Store a new AI response and extract structured data
     */
    storeResponse(userPrompt: string, rawResponse: string, model: string = 'unknown'): string {
        const responseId = `response-${Date.now()}`;

        console.log('🧠 [MEMORY] Storing AI Response:', {
            responseId,
            userPrompt: userPrompt.substring(0, 100) + '...',
            model,
            rawResponseLength: rawResponse.length,
        });

        // Log the first part of the response to debug content
        console.log('🧠 [MEMORY] Response content sample:', rawResponse.substring(0, 1000));

        // Extract summary (first few lines without technical details)
        const summary = this.extractSummary(rawResponse);
        console.log('📄 [MEMORY] Extracted Summary:', summary);

        // Extract and store path-based data FIRST
        const pathData = this.extractPathData(rawResponse);

        // Create todos from stored path data (not from text parsing)
        const todos = this.createTodosFromPathData(pathData, responseId);
        console.log('✅ [MEMORY] Created Todos from Path Data:', todos);

        // Extract course structure if present
        const courseStructure = this.extractCourseStructure(rawResponse);
        console.log('🏗️ [MEMORY] Extracted Course Structure:', courseStructure);

        const storedResponse: StoredAIResponse = {
            id: responseId,
            timestamp: new Date(),
            userPrompt,
            rawResponse,
            summary,
            todos,
            courseStructure,
            pathData,
            model,
            processingComplete: true,
        };

        this.responses.set(responseId, storedResponse);
        console.log('💾 [MEMORY] Stored Response Object:', {
            id: storedResponse.id,
            timestamp: storedResponse.timestamp,
            todosCount: storedResponse.todos.length,
            summaryLength: storedResponse.summary.length,
            hasStructure: !!storedResponse.courseStructure,
            pathDataCount: storedResponse.pathData.size,
        });

        // Log detailed path data
        if (storedResponse.pathData.size > 0) {
            console.log('🗂️ [MEMORY] Stored Path Data:');
            storedResponse.pathData.forEach((data, path) => {
                console.log(`  ${path} → ${data.name} (${data.type}, ${data.action})`);
            });
        }

        // Add todos to current session
        this.currentSessionTodos.push(...todos);
        console.log('📋 [MEMORY] Current Session Todos Count:', this.currentSessionTodos.length);
        console.log(
            '📋 [MEMORY] All Session Todos:',
            this.currentSessionTodos.map((t) => ({
                id: t.id,
                title: t.title,
                type: t.type,
                completed: t.completed,
                path: t.path,
            }))
        );

        return responseId;
    }

    /**
     * Extract a clean summary for chat display (no paths, slide details, or technical info)
     */
    private extractSummary(rawResponse: string): string {
        const lines = rawResponse.split('\n');
        const summaryLines: string[] = [];

        for (const line of lines) {
            const trimmed = line.trim();

            // Skip empty lines
            if (!trimmed) continue;

            // Skip lines with paths (contain dots like P2.S1.M1)
            if (/\w+\.\w+\.\w+/.test(trimmed)) continue;

            // Skip lines with slide/technical details
            if (
                trimmed.toLowerCase().includes('slide:') ||
                trimmed.toLowerCase().includes('path:') ||
                trimmed.toLowerCase().includes('depth:') ||
                trimmed.toLowerCase().includes('id:')
            )
                continue;

            // Include headers and important content
            if (
                trimmed.startsWith('#') ||
                trimmed.startsWith('**') ||
                trimmed.includes('📚') ||
                trimmed.includes('🎯') ||
                trimmed.includes('📋') ||
                summaryLines.length < 5
            ) {
                summaryLines.push(trimmed);

                // Limit summary to reasonable length
                if (summaryLines.length >= 8) break;
            }
        }

        return summaryLines.join('\n') || 'Course content generated successfully!';
    }

    /**
     * Extract todos from AI response based on course structure
     */
    private extractTodos(rawResponse: string, responseId: string): TodoTask[] {
        console.log('🔍 [MEMORY] Starting todo extraction for response:', responseId);
        console.log('🔍 [MEMORY] Raw response preview:', rawResponse.substring(0, 500));
        const todos: TodoTask[] = [];

        try {
            // Clean the response first - remove streaming artifacts
            let cleanedResponse = rawResponse;

            // Remove "data:" prefixes that appear in streaming responses
            cleanedResponse = cleanedResponse.replace(/data:/g, '');

            // Remove any duplicate prefixes that might have been added
            cleanedResponse = cleanedResponse.replace(/data:data:/g, '');

            // Try to parse JSON if present
            const jsonMatch =
                cleanedResponse.match(/```json\s*(.*?)\s*```/s) ||
                cleanedResponse.match(/\{[\s\S]*?\}/);

            if (jsonMatch) {
                console.log('🔍 [MEMORY] Found JSON in response, attempting to parse...');
                let jsonString = jsonMatch[1] || jsonMatch[0];

                // Additional cleaning for JSON string
                jsonString = jsonString.trim();

                // Remove any remaining data: prefixes within the JSON
                jsonString = jsonString.replace(/^data:\s*/, '');

                console.log('🔍 [MEMORY] JSON string to parse:', jsonString.substring(0, 200));

                const parsed = JSON.parse(jsonString);
                console.log('🔍 [MEMORY] Parsed JSON structure:', {
                    hasTree: !!parsed.tree,
                    hasSubjects: !!parsed.subjects,
                    hasModules: !!parsed.modules,
                    keys: Object.keys(parsed),
                });

                if (parsed.tree || parsed.subjects || parsed.modules) {
                    console.log('🔍 [MEMORY] Extracting todos from tree structure...');
                    this.extractTodosFromTree(parsed, todos, responseId);
                }
            } else {
                console.log('🔍 [MEMORY] No JSON found in response');
            }

            // Fallback: extract from text patterns
            if (todos.length === 0) {
                console.log('🔍 [MEMORY] No todos from JSON, trying text extraction...');
                this.extractTodosFromText(cleanedResponse, todos, responseId);
            }
        } catch (error) {
            console.log('🔍 [MEMORY] Error parsing todos, using text extraction:', error);
            this.extractTodosFromText(rawResponse, todos, responseId);
        }

        console.log('🔍 [MEMORY] Todo extraction completed. Found:', todos.length, 'todos');
        return todos;
    }

    /**
     * Extract todos from course tree structure or modifications
     */
    private extractTodosFromTree(data: any, todos: TodoTask[], responseId: string) {
        console.log('🌳 [MEMORY] Extracting todos from tree data...');

        // Handle modifications array (most common format)
        if (data.modifications && Array.isArray(data.modifications)) {
            console.log(
                '🌳 [MEMORY] Processing modifications array:',
                data.modifications.length,
                'items'
            );

            data.modifications.forEach((mod: any, index: number) => {
                if (mod.name && mod.targetType) {
                    const typeMap: { [key: string]: string } = {
                        COURSE: 'subject',
                        SUBJECT: 'subject',
                        MODULE: 'module',
                        CHAPTER: 'chapter',
                        SLIDE: 'slide',
                    };

                    const todoType = typeMap[mod.targetType.toUpperCase()] || 'module';

                    todos.push({
                        id: `${responseId}-${todoType}-${index}`,
                        title: `Create ${todoType}: ${mod.name}`,
                        description: `Generate ${todoType} content for "${mod.name}"`,
                        type: todoType as any,
                        path: mod.path,
                        completed: false,
                        metadata: mod,
                        createdAt: new Date(),
                    });

                    console.log(
                        '🌳 [MEMORY] Added todo from modification:',
                        mod.name,
                        `(${todoType})`
                    );
                }
            });
        } else {
            // Fallback to original tree processing
            const processNode = (node: any, type: string, parentPath: string = '') => {
                if (!node.name) return;

                const path =
                    node.path || `${parentPath}.${node.id || node.name.replace(/\s+/g, '')}`;

                todos.push({
                    id: `${responseId}-${type}-${node.id || Date.now()}`,
                    title: `Create ${type}: ${node.name}`,
                    description: `Generate ${type} content for "${node.name}"`,
                    type: type as any,
                    path,
                    completed: false,
                    metadata: node,
                    createdAt: new Date(),
                });

                // Process children
                if (node.modules) {
                    node.modules.forEach((module: any) => processNode(module, 'module', path));
                }
                if (node.chapters) {
                    node.chapters.forEach((chapter: any) => processNode(chapter, 'chapter', path));
                }
                if (node.slides) {
                    node.slides.forEach((slide: any) => processNode(slide, 'slide', path));
                }
            };

            // Process tree structure
            if (data.tree) {
                data.tree.forEach((subject: any) => processNode(subject, 'subject'));
            } else if (data.subjects) {
                data.subjects.forEach((subject: any) => processNode(subject, 'subject'));
            } else if (data.modules) {
                data.modules.forEach((module: any) => processNode(module, 'module'));
            }
        }

        console.log('🌳 [MEMORY] Tree extraction completed. Todos created:', todos.length);
    }

    /**
     * Extract todos from text patterns when JSON is not available
     */
    private extractTodosFromText(rawResponse: string, todos: TodoTask[], responseId: string) {
        console.log('🔍 [MEMORY] Extracting todos from text patterns...');
        const lines = rawResponse.split('\n');

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i]!.trim();

            // Look for course structure patterns
            if ((line.includes('Module') || line.includes('module')) && line.includes(':')) {
                const moduleName = line.split(':')[1]?.trim() || line.replace(/module/i, '').trim();
                todos.push({
                    id: `${responseId}-module-${i}`,
                    title: `Create Module: ${moduleName}`,
                    description: `Generate module content for "${moduleName}"`,
                    type: 'module',
                    completed: false,
                    createdAt: new Date(),
                });
                console.log('🔍 [MEMORY] Found module from text:', moduleName);
            }

            if ((line.includes('Chapter') || line.includes('chapter')) && line.includes(':')) {
                const chapterName =
                    line.split(':')[1]?.trim() || line.replace(/chapter/i, '').trim();
                todos.push({
                    id: `${responseId}-chapter-${i}`,
                    title: `Create Chapter: ${chapterName}`,
                    description: `Generate chapter content for "${chapterName}"`,
                    type: 'chapter',
                    completed: false,
                    createdAt: new Date(),
                });
                console.log('🔍 [MEMORY] Found chapter from text:', chapterName);
            }

            // Look for other course-related terms
            if ((line.includes('Lesson') || line.includes('lesson')) && line.includes(':')) {
                const lessonName = line.split(':')[1]?.trim() || line.replace(/lesson/i, '').trim();
                todos.push({
                    id: `${responseId}-lesson-${i}`,
                    title: `Create Lesson: ${lessonName}`,
                    description: `Generate lesson content for "${lessonName}"`,
                    type: 'slide',
                    completed: false,
                    createdAt: new Date(),
                });
                console.log('🔍 [MEMORY] Found lesson from text:', lessonName);
            }
        }

        // If no specific structure found, create generic todos based on response content
        if (todos.length === 0) {
            console.log('🔍 [MEMORY] No specific patterns found, creating generic todos...');

            // Check if response mentions course creation
            if (
                rawResponse.toLowerCase().includes('course') ||
                rawResponse.toLowerCase().includes('curriculum') ||
                rawResponse.toLowerCase().includes('lesson')
            ) {
                todos.push({
                    id: `${responseId}-generic-1`,
                    title: 'Generate Course Structure',
                    description: 'Create the main course outline and modules',
                    type: 'subject',
                    completed: false,
                    createdAt: new Date(),
                });

                todos.push({
                    id: `${responseId}-generic-2`,
                    title: 'Create Course Content',
                    description: 'Generate detailed content for all sections',
                    type: 'module',
                    completed: false,
                    createdAt: new Date(),
                });

                todos.push({
                    id: `${responseId}-generic-3`,
                    title: 'Develop Learning Materials',
                    description: 'Create slides, exercises, and assessments',
                    type: 'slide',
                    completed: false,
                    createdAt: new Date(),
                });

                console.log('🔍 [MEMORY] Created 3 generic course-related todos');
            } else {
                // Very generic fallback
                todos.push({
                    id: `${responseId}-task-1`,
                    title: 'Process AI Response',
                    description: 'Review and implement the AI-generated content',
                    type: 'module',
                    completed: false,
                    createdAt: new Date(),
                });

                console.log('🔍 [MEMORY] Created 1 generic task todo');
            }
        }

        console.log('🔍 [MEMORY] Text extraction completed. Total todos:', todos.length);
    }

    /**
     * Extract course structure data for later use
     */
    private extractCourseStructure(rawResponse: string): any {
        try {
            const jsonMatch =
                rawResponse.match(/```json\s*(.*?)\s*```/s) || rawResponse.match(/\{[\s\S]*\}/);

            if (jsonMatch) {
                return JSON.parse(jsonMatch[1] || jsonMatch[0]);
            }
        } catch (error) {
            console.log('No structured course data found');
        }

        return null;
    }

    /**
     * Extract path-based data from AI response
     */
    private extractPathData(rawResponse: string): Map<string, PathData> {
        const pathData = new Map<string, PathData>();

        try {
            // Clean the response first
            let cleanedResponse = rawResponse;
            cleanedResponse = cleanedResponse.replace(/data:/g, '');
            cleanedResponse = cleanedResponse.replace(/data:data:/g, '');

            // Try to find JSON modifications
            const jsonMatch =
                cleanedResponse.match(/```json\s*(.*?)\s*```/s) ||
                cleanedResponse.match(/\{[\s\S]*?\}/);

            if (jsonMatch) {
                let jsonString = jsonMatch[1] || jsonMatch[0];
                jsonString = jsonString.trim();
                jsonString = jsonString.replace(/^data:\s*/, '');

                console.log('🗂️ [MEMORY] Extracting path data from JSON...');
                console.log('🗂️ [MEMORY] JSON for path extraction:', jsonString.substring(0, 300));

                const parsed = JSON.parse(jsonString);

                if (parsed.modifications && Array.isArray(parsed.modifications)) {
                    for (const mod of parsed.modifications) {
                        if (mod.action && mod.targetType && mod.name) {
                            const pathKey =
                                mod.path || `${mod.targetType.toLowerCase()}-${Date.now()}`;

                            const pathDataItem: PathData = {
                                path: pathKey,
                                type: mod.targetType.toLowerCase() as any,
                                name: mod.name,
                                description: mod.description,
                                content: mod.content,
                                slideType: mod.slideType || mod.type,
                                action: mod.action as any,
                                metadata: {
                                    parentPath: mod.parentPath,
                                    originalMod: mod,
                                },
                            };

                            pathData.set(pathKey, pathDataItem);
                            console.log(
                                '🗂️ [MEMORY] Added path data:',
                                pathKey,
                                '→',
                                pathDataItem.name
                            );
                        }
                    }
                }

                // Also extract todos with proper names
                if (parsed.todos && Array.isArray(parsed.todos)) {
                    for (const todo of parsed.todos) {
                        if (todo.path && todo.title) {
                            const pathDataItem: PathData = {
                                path: todo.path,
                                type: todo.type || 'task',
                                name: todo.title,
                                description: todo.description,
                                action: 'ADD',
                                metadata: { isTodo: true, originalTodo: todo },
                            };

                            pathData.set(todo.path, pathDataItem);
                            console.log(
                                '🗂️ [MEMORY] Added todo path data:',
                                todo.path,
                                '→',
                                todo.title
                            );
                        }
                    }
                }
            }
        } catch (error) {
            console.log('🗂️ [MEMORY] Error extracting path data:', error);
        }

        console.log('🗂️ [MEMORY] Path data extraction completed. Total paths:', pathData.size);
        console.log('🗂️ [MEMORY] All extracted paths:', Array.from(pathData.keys()));

        return pathData;
    }

    /**
     * Create todos from stored path data (Step 2)
     */
    private createTodosFromPathData(
        pathData: Map<string, PathData>,
        responseId: string
    ): TodoTask[] {
        const todos: TodoTask[] = [];

        console.log('📋 [MEMORY STEP 2] Creating todos from stored path data...');

        pathData.forEach((data, path) => {
            // Only create todos for course structure items (not generic tasks)
            if (['course', 'subject', 'module', 'chapter', 'slide'].includes(data.type)) {
                const todo: TodoTask = {
                    id: `${responseId}-${data.type}-${path}`,
                    title: `Create ${data.type}: ${data.name}`,
                    description: `Generate ${data.type} content for "${data.name}"`,
                    type: data.type === 'course' ? 'subject' : (data.type as any),
                    path: path,
                    completed: false,
                    metadata: data,
                    createdAt: new Date(),
                };

                todos.push(todo);
                console.log(`📋 [MEMORY STEP 2] Created todo: ${data.name} (${data.type})`);
            }
        });

        console.log(
            `📋 [MEMORY STEP 2] Completed. Created ${todos.length} todos from ${pathData.size} path items`
        );
        return todos;
    }

    /**
     * Mark a todo as completed
     */
    markTodoCompleted(todoId: string): boolean {
        console.log('🎯 [MEMORY] Marking todo as completed:', todoId);

        // Update in current session todos
        const todo = this.currentSessionTodos.find((t) => t.id === todoId);
        if (todo) {
            todo.completed = true;
            todo.completedAt = new Date();
            console.log('✅ [MEMORY] Todo marked complete in session:', {
                id: todo.id,
                title: todo.title,
                type: todo.type,
                completedAt: todo.completedAt,
            });
        }

        // Update in stored responses
        for (const response of this.responses.values()) {
            const responseTodo = response.todos.find((t) => t.id === todoId);
            if (responseTodo) {
                responseTodo.completed = true;
                responseTodo.completedAt = new Date();
                console.log('✅ [MEMORY] Todo marked complete in stored response:', {
                    responseId: response.id,
                    todoId: responseTodo.id,
                    title: responseTodo.title,
                });
                return true;
            }
        }

        console.log('❌ [MEMORY] Todo not found for completion:', todoId);
        return false;
    }

    /**
     * Get current session todos
     */
    getCurrentTodos(): TodoTask[] {
        const currentTodos = this.currentSessionTodos.filter((todo) => !todo.completed);
        console.log('📖 [MEMORY] Getting current todos:', currentTodos.length, 'pending todos');
        return currentTodos;
    }

    /**
     * Get completed todos
     */
    getCompletedTodos(): TodoTask[] {
        const completedTodos = this.currentSessionTodos.filter((todo) => todo.completed);
        console.log(
            '📖 [MEMORY] Getting completed todos:',
            completedTodos.length,
            'completed todos'
        );
        return completedTodos;
    }

    /**
     * Get all todos
     */
    getAllTodos(): TodoTask[] {
        return [...this.currentSessionTodos];
    }

    /**
     * Get a stored response by ID
     */
    getResponse(responseId: string): StoredAIResponse | undefined {
        return this.responses.get(responseId);
    }

    /**
     * Get response summary for chat display
     */
    getResponseSummary(responseId: string): string {
        const response = this.responses.get(responseId);
        return response?.summary || 'Response processed';
    }

    /**
     * Get path data from a specific response
     */
    getPathData(responseId: string): Map<string, PathData> | undefined {
        const response = this.responses.get(responseId);
        return response?.pathData;
    }

    /**
     * Get all path data from all responses (merged)
     */
    getAllPathData(): Map<string, PathData> {
        const allPaths = new Map<string, PathData>();

        for (const response of this.responses.values()) {
            if (response.pathData) {
                for (const [path, data] of response.pathData) {
                    allPaths.set(path, data);
                }
            }
        }

        console.log('🗂️ [MEMORY] Retrieved all path data. Total paths:', allPaths.size);
        return allPaths;
    }

    /**
     * Get path data by path key
     */
    getPathDataByKey(path: string): PathData | undefined {
        for (const response of this.responses.values()) {
            if (response.pathData?.has(path)) {
                return response.pathData.get(path);
            }
        }
        return undefined;
    }

    /**
     * Get all paths by type
     */
    getPathsByType(type: string): PathData[] {
        const allPaths = this.getAllPathData();
        const filteredPaths: PathData[] = [];

        for (const pathData of allPaths.values()) {
            if (pathData.type === type) {
                filteredPaths.push(pathData);
            }
        }

        return filteredPaths;
    }

    /**
     * Clear all stored data (useful for new sessions)
     */
    clearSession(): void {
        this.currentSessionTodos = [];
        this.responses.clear();
        console.log('🧹 [MEMORY] Session cleared');
    }

    /**
     * Add test todos for debugging (accessible in console as window.addTestTodos())
     */
    addTestTodos(): void {
        const testTodos: TodoTask[] = [
            {
                id: 'test-1',
                title: 'Create Module: Introduction to Python',
                description: 'Generate introduction module content',
                type: 'module',
                completed: false,
                createdAt: new Date(),
            },
            {
                id: 'test-2',
                title: 'Create Chapter: Variables and Data Types',
                description: 'Generate chapter on variables',
                type: 'chapter',
                completed: false,
                createdAt: new Date(),
            },
            {
                id: 'test-3',
                title: 'Create Slide: Hello World Example',
                description: 'Create slide with Hello World code',
                type: 'slide',
                completed: false,
                createdAt: new Date(),
            },
        ];

        this.currentSessionTodos.push(...testTodos);
        console.log('🧪 [MEMORY] Added test todos:', testTodos.length);
    }

    /**
     * Auto-complete todos based on course structure changes
     */
    autoCompleteTodos(courseData: Subject[]): void {
        console.log('🤖 [MEMORY] Starting auto-completion check...');
        console.log('🤖 [MEMORY] Course data items count:', courseData.length);

        // Get all existing paths in course data
        const existingPaths = new Set<string>();

        const collectPaths = (items: any[], prefix: string = '') => {
            items.forEach((item) => {
                if (item.path) existingPaths.add(item.path);
                if (item.modules) collectPaths(item.modules, item.path || prefix);
                if (item.chapters) collectPaths(item.chapters, item.path || prefix);
                if (item.slides) collectPaths(item.slides, item.path || prefix);
            });
        };

        collectPaths(courseData);
        console.log('🤖 [MEMORY] Existing paths in course data:', Array.from(existingPaths));

        // Mark todos as completed if their paths exist in course data
        let completedCount = 0;
        const pendingTodos = this.currentSessionTodos.filter((t) => !t.completed);
        console.log(
            '🤖 [MEMORY] Pending todos to check:',
            pendingTodos.map((t) => ({
                id: t.id,
                title: t.title,
                path: t.path,
                type: t.type,
            }))
        );

        this.currentSessionTodos.forEach((todo) => {
            if (todo.path && existingPaths.has(todo.path) && !todo.completed) {
                console.log('🤖 [MEMORY] Auto-completing todo with matching path:', {
                    todoId: todo.id,
                    title: todo.title,
                    path: todo.path,
                });
                this.markTodoCompleted(todo.id);
                completedCount++;
            }
        });

        console.log('🤖 [MEMORY] Auto-completion finished. Completed count:', completedCount);
    }
}

// Export singleton instance
export const aiResponseMemory = new AIResponseMemoryService();

// Make debug functions available in console for testing
if (typeof window !== 'undefined') {
    (window as any).addTestTodos = () => aiResponseMemory.addTestTodos();
    (window as any).clearMemory = () => aiResponseMemory.clearSession();
    (window as any).showMemoryData = () => {
        console.log('💾 [MEMORY DEBUG] Current todos:', aiResponseMemory.getAllTodos());
        console.log(
            '💾 [MEMORY DEBUG] Stored responses count:',
            (aiResponseMemory as any).responses.size
        );
        console.log('💾 [MEMORY DEBUG] All path data:', aiResponseMemory.getAllPathData());
    };
    (window as any).showPathData = () => {
        const allPaths = aiResponseMemory.getAllPathData();
        console.log('🗂️ [PATH DATA DEBUG] Total paths:', allPaths.size);
        console.log('🗂️ [PATH DATA DEBUG] Paths by type:');
        const byType: { [key: string]: any[] } = {};
        allPaths.forEach((data, path) => {
            if (!byType[data.type]) byType[data.type] = [];
            byType[data.type]!.push({ path, name: data.name, action: data.action });
        });
        console.table(byType);
    };
    console.log(
        '🔧 Debug tools: "window.addTestTodos()", "window.clearMemory()", "window.showMemoryData()", "window.showPathData()"'
    );
}

export default aiResponseMemory;
