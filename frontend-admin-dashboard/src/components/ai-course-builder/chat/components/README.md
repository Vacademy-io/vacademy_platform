# Course Structure Display Component

## Overview

The `CourseStructureDisplay` component provides a user-friendly interface for displaying course structure JSON data in the AI Course Builder chat interface. Instead of showing raw JSON data, it presents the information in an organized, visually appealing format.

## Features

### 🎯 Intelligent JSON Detection
- Automatically detects course structure data containing `modifications`, `todos`, or `explanation`
- Falls back to raw JSON display for other types of data

### 📋 Tabbed Interface
- **Structure Tab**: Shows course modifications with visual icons and badges
- **Tasks Tab**: Displays todo items with detailed prompts and metadata
- **Details Tab**: Presents explanations in a clean, readable format

### 🎨 Visual Enhancements
- Color-coded action badges (Add/Update/Delete)
- Type-specific icons (Course, Module, Chapter, Slide, Video)
- Gradient backgrounds and smooth animations
- Hover effects and transitions

## Component Structure

```tsx
interface CourseStructureData {
    modifications?: Modification[];
    todos?: Todo[];
    explanation?: string;
}
```

### Modification Display
- Shows action type with color-coded badges
- Displays target type with appropriate icons
- Includes description and path information
- Visual hierarchy based on content depth

### Todo Display
- Task titles and descriptions
- Truncated prompts with full content available
- Model and path metadata
- Order indicators

### Explanation Display
- Clean HTML parsing
- Readable typography
- Proper spacing and formatting

## Usage

The component is automatically used when the ChatView detects course structure JSON data:

```tsx
// In ChatView.tsx - JsonSection component
if (isCourseStructureData && parsedData) {
    return (
        <div className="mb-4">
            <CourseStructureDisplay data={parsedData} />
        </div>
    );
}
```

## Styling

Custom CSS classes provide:
- Smooth fade-in animations
- Card hover effects
- Status badge transitions
- Tab button interactions

## Benefits

1. **User Experience**: Clean, organized display instead of raw JSON
2. **Context Awareness**: Different presentations for different data types
3. **Visual Hierarchy**: Clear organization of complex data structures
4. **Interactive Elements**: Tabbed navigation for better content organization
5. **Responsive Design**: Works well across different screen sizes

## Integration

The component integrates seamlessly with the existing chat interface:
- Maintains consistent styling with other chat elements
- Follows the same component patterns
- Uses existing UI component library (shadcn/ui)
- Preserves accessibility standards

This enhancement transforms technical JSON output into user-friendly, actionable information that helps users understand what the AI has created for their course structure.
