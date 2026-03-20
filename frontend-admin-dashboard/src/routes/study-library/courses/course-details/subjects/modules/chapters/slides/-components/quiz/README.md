# Quiz Components Refactoring

This directory contains the refactored quiz components that were extracted from the large `QuizPreview.tsx` file to make debugging and maintenance easier.

## Structure

```
quiz/
├── README.md                    # This file
├── index.ts                     # Main exports
├── types.ts                     # Type definitions
├── utils/
│   ├── question-transformer.ts  # Question transformation logic
│   └── api-helpers.ts          # API-related utilities
└── components/
    ├── QuestionDisplay.tsx      # Individual question display
    ├── QuestionTypeSelector.tsx # Question type selection dialog
    └── DeleteConfirmDialog.tsx  # Delete confirmation dialog
```

## Components

### 1. QuestionDisplay.tsx
- **Purpose**: Renders individual questions with their options and answers
- **Props**: `question`, `questionIndex`, `onEdit`, `onDelete`
- **Features**: 
  - Displays different question types (MCQS, MCQM, TRUE_FALSE, NUMERIC, LONG_ANSWER, ONE_WORD)
  - Shows correct answers highlighted
  - Handles edit and delete actions

### 2. QuestionTypeSelector.tsx
- **Purpose**: Dialog for selecting question types when adding new questions
- **Props**: `isOpen`, `onOpenChange`, `onSelectQuestionType`
- **Features**:
  - Categorized question types (Quick Access, Writing Skills, Reading Skills)
  - Clean UI with icons and descriptions

### 3. DeleteConfirmDialog.tsx
- **Purpose**: Confirmation dialog for deleting questions
- **Props**: `isOpen`, `onOpenChange`, `onConfirm`, `onCancel`
- **Features**:
  - Warning message with clear action buttons
  - Reusable confirmation pattern

## Utilities

### 1. question-transformer.ts
- **Purpose**: Transform questions between backend and frontend formats
- **Functions**:
  - `transformQuestion()`: Main transformation function
  - `parseValidAnswers()`: Parse auto_evaluation_json
  - `getQuestionText()`: Extract question text from various sources
  - `transformOptions()`: Transform option arrays

### 2. api-helpers.ts
- **Purpose**: Handle API-related operations
- **Functions**:
  - `transformFormQuestionsToBackend()`: Convert form data to API format
  - `createQuizSlidePayload()`: Create payload for quiz slide API calls

## Types

### types.ts
Contains all TypeScript interfaces:
- `QuizPreviewProps`: Main component props
- `BackendQuestion`: Backend question structure
- `TransformedQuestion`: Frontend question structure
- `QuestionTypeProps`: Question type selector props
- `Slide`: Slide interface

## Benefits of Refactoring

1. **Easier Debugging**: Each component has a single responsibility
2. **Better Maintainability**: Changes to specific functionality are isolated
3. **Reusability**: Components can be reused in other parts of the application
4. **Cleaner Code**: Main component is now focused on orchestration
5. **Type Safety**: Better TypeScript support with dedicated type files

## Usage

The main `QuizPreview.tsx` component now imports everything from the `./quiz` directory:

```typescript
import {
    QuizPreviewProps,
    Slide,
    transformQuestion,
    createQuizSlidePayload,
    QuestionDisplay,
    QuestionTypeSelector,
    DeleteConfirmDialog,
} from './quiz';
```

## Debugging Tips

1. **Question Display Issues**: Check `QuestionDisplay.tsx` and `question-transformer.ts`
2. **API Issues**: Check `api-helpers.ts` and the main component's API calls
3. **Dialog Issues**: Check individual dialog components
4. **Type Issues**: Check `types.ts` for interface definitions

## Future Improvements

1. Add unit tests for each component
2. Add error boundaries for better error handling
3. Consider using React.memo for performance optimization
4. Add loading states for async operations 