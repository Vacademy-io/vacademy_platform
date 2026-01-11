import { ChatMessage, ChatbotContext } from '../components/chatbot/types';
import { v4 as uuidv4 } from 'uuid';

const MOCK_DELAY_MS = 1500; // Increased slightly to show typing animation better

// Mock processing logic based on context
export const getMockChatResponse = async (
  message: string,
  context: ChatbotContext
): Promise<ChatMessage> => {
  await new Promise((resolve) => setTimeout(resolve, MOCK_DELAY_MS));

  const lowerMessage = message.toLowerCase();
  let responseText = '';

  // Context-aware logic
  if (context.slideId) {
    if (lowerMessage.includes('help') || lowerMessage.includes('explain')) {
      responseText = "I see you're looking at a specific slide. Based on the content here, I can explain the key concepts. What specifically is confusing you about this slide?";
    } else if (lowerMessage.includes('quiz') || lowerMessage.includes('answer')) {
      responseText = "I can help you think through this quiz question! I won't give you the direct answer, but let's break it down together. What do you think is the first step?";
    } else {
      responseText = "I'm here to help with this specific lesson content. Feel free to ask about any code examples or definitions shown on this slide.";
    }
  } else if (context.route.includes('/courses/course-details')) {
    if (lowerMessage.includes('progress') || lowerMessage.includes('next')) {
      responseText = "You're making good progress in this course! Would you like to jump to the next unfinished module?";
    } else {
      responseText = "This course covers a lot of great material. Are you looking for a specific module or just browsing the outline?";
    }
  } else if (context.route === '/dashboard') {
    responseText = "Welcome back to your dashboard! I can help you review your recent activity or suggest what to learn next.";
  } else {
    // General fallback
    if (lowerMessage.includes('code') || lowerMessage.includes('debug')) {
      responseText = "I'd be happy to help you debug your code. Please paste the snippet you're working on and tell me what error you're seeing.";
    } else if (lowerMessage.includes('hello') || lowerMessage.includes('hi')) {
      responseText = "Hello! I'm your AI Tutor. I can help you with programming concepts, debugging, or guiding you through your course.";
    } else {
      responseText = "That's an interesting question. Could you provide a bit more detail so I can give you the best coding advice?";
    }
  }

  return {
    id: uuidv4(),
    role: 'assistant',
    content: responseText,
    timestamp: Date.now(),
    context: context, // Attach context object
  };
};
