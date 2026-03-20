/**
 * Simple testing system for chat without wasting API credits
 * Provides mock responses and test scenarios
 */

export const mockAIResponse = `Okay, I'm starting the process of designing a small, introductory course on Artificial Intelligence. The user's request is simple: "create a small course on AI". Since there's no \`existingCourse\`, I'm creating the entire structure from the ground up.

[Thinking...]
First, I will create the main course object. This will be the root of our structure. I'll name it "Introduction to Artificial Intelligence" to clearly define its scope.

[Generating...]
\`\`\`json
{
  "modifications": [
    {
      "action": "ADD",
      "targetType": "COURSE",
      "parentPath": null,
      "name": "Introduction to Artificial Intelligence",
      "description": "A beginner's guide to the world of Artificial Intelligence, from core concepts to real-world applications and future implications.",
      "node": {
        "id": "C1",
        "name": "Introduction to Artificial Intelligence",
        "type": "COURSE",
        "key": "COURSE",
        "depth": 1,
        "path": "C1"
      }
    }
  ]
}
\`\`\`

[Thinking...]
Now I'll add the first module, "Foundations of AI". This module will set the stage, defining AI and its history.

[Generating...]
\`\`\`json
{
  "modifications": [
    {
      "action": "ADD",
      "targetType": "MODULE",
      "parentPath": "C1",
      "name": "Foundations of AI",
      "description": "Understand the fundamental concepts, history, and types of Artificial Intelligence.",
      "node": {
        "id": "M1",
        "name": "Foundations of AI",
        "type": "MODULE",
        "key": "MODULE",
        "depth": 2,
        "path": "C1.M1"
      }
    }
  ]
}
\`\`\`

This creates a structured course with proper hierarchy and demonstrates the AI's thinking and generation process.`;

// Split the response into chunks to simulate streaming
export function createMockChunks(response: string): string[] {
    const chunks: string[] = [];
    const lines = response.split('\n');

    for (const line of lines) {
        if (line.trim()) {
            // Simulate smaller chunks for realistic streaming
            const chunkSize = Math.random() * 50 + 20; // 20-70 characters per chunk
            for (let i = 0; i < line.length; i += chunkSize) {
                const chunk = line.slice(i, i + chunkSize);
                chunks.push(`data:${chunk}`);
            }
            chunks.push('data:\n'); // Line break
        } else {
            chunks.push('data:\n');
        }
    }

    return chunks;
}

// Test function that simulates the streaming API
export function simulateStreamingResponse(
    onChunk: (chunk: string) => void,
    onComplete: (response: string) => void,
    delay: number = 100
): void {
    const chunks = createMockChunks(mockAIResponse);
    let chunkIndex = 0;

    console.log('🎬 Starting mock streaming simulation with', chunks.length, 'chunks');

    const sendNextChunk = () => {
        if (chunkIndex < chunks.length) {
            const chunk = chunks[chunkIndex];
            if (chunk) {
                console.log(
                    `📡 Mock chunk ${chunkIndex + 1}/${chunks.length}:`,
                    chunk.substring(0, 50)
                );
                onChunk(chunk);
            }
            chunkIndex++;
            setTimeout(sendNextChunk, delay);
        } else {
            console.log('✅ Mock streaming complete');
            onComplete(mockAIResponse);
        }
    };

    // Start sending chunks
    setTimeout(sendNextChunk, delay);
}

// Make globally available for console testing
if (typeof window !== 'undefined') {
    (window as any).simulateStreamingResponse = simulateStreamingResponse;
    (window as any).mockAIResponse = mockAIResponse;

    console.log('🧪 Test functions available:');
    console.log('  - window.simulateStreamingResponse(onChunk, onComplete, delay)');
    console.log('  - window.mockAIResponse - Sample AI response');
}
