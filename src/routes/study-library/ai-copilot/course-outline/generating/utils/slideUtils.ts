import { SlideGeneration } from '../../../shared/types';

/**
 * Check if a document slide has an image
 */
export function documentHasImage(content?: string): boolean {
    if (!content) return false;
    // Check for img tags or mermaid diagrams (which are converted to images)
    return content.includes('<img') ||
           content.includes('mermaid.ink') ||
           content.includes('graph') ||
           content.includes('flowchart') ||
           content.includes('sequenceDiagram') ||
           content.includes('classDiagram');
}

/**
 * Get slide icon based on slide type
 */
export function getSlideIcon(type: string): string {
    const iconMap: Record<string, string> = {
        'objectives': 'Target',
        'topic': 'FileText',
        'quiz': 'FileQuestion',
        'homework': 'ClipboardList',
        'solution': 'CheckCircle',
        'doc': 'FileText',
        'pdf': 'FileText',
        'video': 'Video',
        'ai-video': 'Video',
        'ai-slides': 'Layers',
        'ai-storybook': 'BookOpen',
        'video-code': 'Video',
        'ai-video-code': 'Video',
        'image': 'Image',
        'jupyter': 'Notebook',
        'code-editor': 'Code',
        'scratch': 'Terminal',
        'video-jupyter': 'Video',
        'video-code-editor': 'Video',
        'video-scratch': 'Video',
        'assignment': 'ClipboardList',
    };
    
    return iconMap[type] || 'File';
}
