// Mode types for different announcement categories
export type ModeType = 'SYSTEM_ALERT' | 'DASHBOARD_PIN' | 'DM' | 'STREAM' | 'RESOURCES' | 'COMMUNITY' | 'TASKS';

// Interaction types aligned with backend enum
export type InteractionType = 'READ' | 'DISMISSED' | 'CLICKED' | 'LIKED' | 'SHARED';

// Message status types
export type MessageStatus = 'PENDING' | 'SENT' | 'DELIVERED' | 'FAILED' | 'READ';

// Rich text content types
export type ContentType = 'text' | 'html' | 'video' | 'image';

// Rich text content interface
export interface RichText {
  id: string;
  type: ContentType;
  content: string;
}

// Reply interface for community discussions
export interface MessageReply {
  id: string;
  userId: string;
  userName?: string;
  userRole?: string;
  createdAt: string;
  content: RichText;
  childRepliesCount: number;
  parentMessageId?: string;
}

// Main user message interface
export interface UserMessage {
  messageId: string;
  announcementId: string;
  modeType: ModeType;
  status: MessageStatus;
  createdAt: string;
  isRead: boolean;
  isDismissed: boolean;
  title?: string;
  createdBy?: string;
  createdByName?: string;
  content: RichText;
  repliesCount: number;
  recentReplies: MessageReply[];
  priority?: 'HIGH' | 'MEDIUM' | 'LOW';
  pinEndTime?: string;
  packageSessionId?: string;
  streamType?: 'LIVE' | 'RECORDED';
  communityType?: 'SCHOOL' | 'CLASS';
  tag?: string;
}

// API request interfaces
export interface MarkAsReadRequest {
  recipientMessageId: string;
  userId: string;
}

export interface DismissMessageRequest {
  recipientMessageId: string;
  userId: string;
}

export interface CreateReplyRequest {
  announcementId: string;
  parentMessageId?: string;
  userId: string;
  userName?: string;
  userRole?: string;
  content: {
    type: 'text' | 'html';
    content: string;
  };
}

export interface MessageInteractionRequest {
  recipientMessageId: string;
  userId: string;
  interactionType: InteractionType;
  additionalData?: Record<string, unknown>;
}

// API response interfaces
export interface UserMessagesResponse {
  content: UserMessage[];
  totalElements: number;
  totalPages: number;
  size: number;
  number: number;
}

export interface UnreadCountResponse {
  count: number;
  modeType?: ModeType;
}

export interface MessageRepliesResponse {
  content: MessageReply[];
  totalElements: number;
  totalPages: number;
  size: number;
  number: number;
}

// SSE event interface
export interface SseEvent {
  type: string;
  targetUserId?: string;
  announcementId?: string;
  modeType?: ModeType;
  instituteId?: string;
  data?: unknown;
  timestamp: string;
}

// Filter and pagination interfaces
export interface SystemAlertsFilters {
  priority?: 'HIGH' | 'MEDIUM' | 'LOW';
  page?: number;
  size?: number;
}

export interface StreamMessagesFilters {
  streamType?: 'LIVE' | 'RECORDED';
  page?: number;
  size?: number;
}

export interface CommunityMessagesFilters {
  communityType?: 'SCHOOL' | 'CLASS';
  tag?: string;
  page?: number;
  size?: number;
}

export interface RepliesFilters {
  page?: number;
  size?: number;
}

// Store state interfaces
export interface SystemAlertsState {
  items: UserMessage[];
  unreadCount: number;
  loading: boolean;
  error: string | null;
  hasMore: boolean;
  currentPage: number;
}

export interface DashboardPinsState {
  items: UserMessage[];
  loading: boolean;
  error: string | null;
}

export interface PackageSessionMessagesState {
  stream: {
    items: UserMessage[];
    loading: boolean;
    error: string | null;
    hasMore: boolean;
    currentPage: number;
  };
  discussion: {
    items: UserMessage[];
    loading: boolean;
    error: string | null;
    hasMore: boolean;
    currentPage: number;
  };
}

export interface MessageRepliesState {
  items: MessageReply[];
  loading: boolean;
  error: string | null;
  hasMore: boolean;
  currentPage: number;
}

// Analytics event types
export interface AnnouncementAnalyticsEvents {
  alertViewed: (messageId: string, modeType: ModeType) => void;
  pinClicked: (messageId: string) => void;
  streamScrolled: (packageSessionId: string) => void;
  discussionScrolled: (packageSessionId: string) => void;
  replyPosted: (announcementId: string, parentReplyId?: string) => void;
  messageMarkedAsRead: (messageId: string) => void;
  messageDismissed: (messageId: string) => void;
}
