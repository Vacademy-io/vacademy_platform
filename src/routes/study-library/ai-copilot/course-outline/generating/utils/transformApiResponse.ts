import { SlideGeneration, SlideType } from '../../../shared/types';

/**
 * Transform API response to slides format using tree for hierarchy and todos for content
 */
export function transformApiResponseToSlides(
    apiResponse: any,
    courseConfig: any
): SlideGeneration[] {
    const slides: SlideGeneration[] = [];
    const tree = apiResponse.tree;
    const todos = apiResponse.todos;
    
    if (!tree || tree.length === 0) {
        console.warn('No tree found in API response');
        return slides;
    }

    if (!todos || todos.length === 0) {
        console.warn('No todos found in API response');
        return slides;
    }

    console.log('Processing tree and todos');
    console.log('Tree:', tree);
    console.log('Todos:', todos);

    const courseNode = tree[0]; // Root course node
    const courseDepth = apiResponse.courseMetadata?.course_depth || 3;
    
    console.log('Course depth:', courseDepth);

    // Extract chapters based on depth
    let chapters: any[] = [];
    
    if (courseDepth === 5) {
        // Course → Subject → Module → Chapter → Slide
        const subjects = courseNode.children || [];
        subjects.forEach((subject: any) => {
            const modules = subject.children || [];
            modules.forEach((module: any) => {
                const moduleChapters = module.children || [];
                chapters.push(...moduleChapters);
            });
        });
    } else if (courseDepth === 4) {
        // Course → Module → Chapter → Slide
        const modules = courseNode.children || [];
        modules.forEach((module: any) => {
            const moduleChapters = module.children || [];
            chapters.push(...moduleChapters);
        });
    } else {
        // Course → Chapter → Slide (depth 3 or less)
        chapters = courseNode.children || [];
    }

    console.log('Extracted chapters:', chapters);

    // Group todos by chapter_name for mapping
    const todosByChapter = new Map<string, any[]>();
    todos.forEach((todo: any) => {
        const chapterName = todo.chapter_name || 'Uncategorized';
        if (!todosByChapter.has(chapterName)) {
            todosByChapter.set(chapterName, []);
        }
        todosByChapter.get(chapterName)!.push(todo);
    });

    console.log('Todos grouped by chapter:', Array.from(todosByChapter.entries()));

    // Create slides from chapters and their todos
    chapters.forEach((chapter: any, chapterIndex: number) => {
        const sessionId = `session-${chapterIndex + 1}`;
        const sessionTitle = chapter.title;
        
        // Get todos for this chapter
        const chapterTodos = todosByChapter.get(sessionTitle) || [];
        
        // Sort todos by order
        chapterTodos.sort((a, b) => (a.order || 0) - (b.order || 0));

        console.log(`Chapter "${sessionTitle}" has ${chapterTodos.length} todos`);

        // Create slides from todos
        chapterTodos.forEach((todo: any, todoIndex: number) => {
            // Map todo type to slide type - check for AI_VIDEO first
            let slideType: SlideType = 'doc';
            
            // Check for AI_VIDEO type (case-sensitive check)
            if (todo.type === 'AI_VIDEO') {
                slideType = 'ai-video';
                console.log('🎬 Found AI_VIDEO todo:', {
                    title: todo.title || todo.name,
                    path: todo.path,
                    type: todo.type,
                    hasPrompt: !!todo.prompt,
                    promptPreview: todo.prompt ? todo.prompt.substring(0, 150) + '...' : 'No prompt'
                });
            } else if (todo.type === 'AI_SLIDES') {
                slideType = 'ai-slides';
            } else if (todo.type === 'AI_STORYBOOK') {
                slideType = 'ai-storybook';
            } else if (todo.type === 'DOCUMENT') {
                slideType = 'doc';
            } else if (todo.type === 'VIDEO') {
                slideType = 'video';
            } else if (todo.type === 'VIDEO_CODE') {
                slideType = 'video-code';
            } else if (todo.type === 'AI_VIDEO_CODE') {
                slideType = 'ai-video-code';
            } else if (todo.type === 'QUIZ' || todo.type === 'ASSESSMENT') {
                slideType = 'quiz';
            }

            // For AI_VIDEO, ensure prompt is stored properly
            const prompt = todo.prompt || (todo.type === 'AI_VIDEO' ? `Generate AI video for ${todo.title || todo.name}` : `Content for ${todo.title || todo.name}`);

            slides.push({
                id: `${sessionId}-slide-${todoIndex + 1}`,
                sessionId,
                sessionTitle,
                slideTitle: todo.title || todo.name,
                slideType,
                status: 'pending', // Will be updated when content is generated
                progress: 0,
                content: prompt, // Store prompt in content for AI_VIDEO
                topicIndex: todoIndex,
                prompt: prompt, // Also store in prompt field
            });
        });
    });

    console.log('Generated slides:', slides.length);
    return slides;
}
