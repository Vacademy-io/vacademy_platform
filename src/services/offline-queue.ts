/**
 * Offline message queue for the chatbot.
 * Queues messages when the device is offline and replays them when connectivity returns.
 */

export interface QueuedMessage {
  id: string;
  sessionId: string;
  message: string;
  intent?: string;
  timestamp: number;
}

const QUEUE_KEY = "chatbot_offline_queue";

function getQueue(): QueuedMessage[] {
  try {
    const raw = localStorage.getItem(QUEUE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveQueue(queue: QueuedMessage[]): void {
  try {
    localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
  } catch {
    // Storage full or unavailable
  }
}

export function enqueueMessage(msg: Omit<QueuedMessage, "id" | "timestamp">): QueuedMessage {
  const queued: QueuedMessage = {
    ...msg,
    id: crypto.randomUUID(),
    timestamp: Date.now(),
  };
  const queue = getQueue();
  queue.push(queued);
  saveQueue(queue);
  return queued;
}

export function dequeueMessage(): QueuedMessage | undefined {
  const queue = getQueue();
  const msg = queue.shift();
  saveQueue(queue);
  return msg;
}

export function peekQueue(): QueuedMessage[] {
  return getQueue();
}

export function clearQueue(): void {
  localStorage.removeItem(QUEUE_KEY);
}

export function isOnline(): boolean {
  return navigator.onLine;
}
