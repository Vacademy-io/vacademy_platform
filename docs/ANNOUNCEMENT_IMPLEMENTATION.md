# Learner-Facing Announcement UI Implementation

This document describes the implementation of the learner-facing Announcement UI using the Notification Service APIs.

## Overview

The announcement system provides three main components:
1. **System Alerts Bar** - Global top-of-app alerts with unread badge
2. **Dashboard Pins Panel** - Active pins displayed on the dashboard
3. **Package Session Messages** - Stream and Discussion messages for enrolled courses

## Architecture

### Core Components

#### 1. Types (`src/types/announcement.ts`)
- Defines all TypeScript interfaces for messages, replies, and API responses
- Includes `ModeType`, `MessageStatus`, `UserMessage`, `MessageReply`, etc.

#### 2. API Service (`src/services/announcementApi.ts`)
- Handles all API calls to `/notification-service/v1`
- Includes functions for system alerts, dashboard pins, stream messages, and replies
- Uses internal authentication (no JWT required)
- Includes error handling and toast notifications

#### 3. State Management (`src/stores/announcement-store.ts`)
- Zustand store for managing announcement state
- Handles system alerts, dashboard pins, and package session messages
- Includes optimistic updates and error handling

#### 4. Custom Hooks
- `useSystemAlerts` - Manages system alerts with polling
- `useDashboardPins` - Manages dashboard pins with polling
- `usePackageSessionMessages` - Manages package session messages

#### 5. UI Components
- `SystemAlertsBar` - Global alerts bar with dropdown
- `DashboardPinsPanel` - Dashboard pins display
- `PackageSessionMessages` - Stream and Discussion tabs

## Features

### System Alerts Bar
- **Location**: Fixed at top of app (`src/routes/__root.tsx`)
- **Features**:
  - Unread count badge
  - Dropdown panel with infinite scroll
  - Auto mark-as-read on visibility
  - Dismiss functionality
  - Priority-based sorting (HIGH > MEDIUM > LOW)
  - 15-second polling interval

### Dashboard Pins Panel
- **Location**: Dashboard page (`src/routes/dashboard/index.tsx`)
- **Features**:
  - Shows active pins only (filters expired pins)
  - Priority-based sorting
  - Mark-as-read on click
  - Time remaining display for expiring pins
  - 15-second polling interval

### Package Session Messages
- **Location**: Course details page for enrolled students
- **Features**:
  - Stream tab (LIVE/RECORDED filter)
  - Discussion tab (SCHOOL/CLASS filter with tags)
  - Reply functionality
  - Auto mark-as-read on visibility
  - Load more pagination
  - 15-second polling interval

## Student Display Settings Integration

The system respects student display settings:
- `allowSystemAlerts` - Controls system alerts visibility
- `allowDashboardPins` - Controls dashboard pins visibility  
- `allowBatchStream` - Controls package session messages visibility

## API Endpoints Used

### System Alerts
- `GET /notification-service/v1/user-messages/user/{userId}/system-alerts`
- `GET /notification-service/v1/user-messages/user/{userId}/unread-count?modeType=SYSTEM_ALERT`
- `POST /notification-service/v1/user-messages/interactions` (requires body with `interactionType`)

### Dashboard Pins
- `GET /notification-service/v1/user-messages/user/{userId}/dashboard-pins`

### Stream Messages
- `GET /notification-service/v1/user-messages/user/{userId}/streams/{packageSessionId}`

### Community Messages
- `GET /notification-service/v1/user-messages/user/{userId}/community`

### Message Replies
- `GET /notification-service/v1/message-replies/announcement/{announcementId}`
- `POST /notification-service/v1/message-replies`

## Analytics Integration

The system tracks user interactions:
- Alert viewed, marked as read, dismissed
- Pin clicked
- Stream/discussion messages scrolled
- Reply posted
- Load more actions

## Interaction Tracking

All message interactions are recorded via a single endpoint:

`POST /notification-service/v1/user-messages/interactions`

Request body:

```
{
  "recipientMessageId": "<uuid>",
  "userId": "<uuid>",
  "interactionType": "READ" | "DISMISSED" | "CLICKED" | "LIKED" | "SHARED",
  "additionalData": { "source": "<optional>" }
}
```

Current triggers implemented:
- READ: on opening alerts, pins, stream/discussion messages; also batch mark-as-read
- DISMISSED: on alert dismissal
- CLICKED: on clicking alerts, pins, stream/discussion messages
- LIKED/SHARED: not used yet (add via `announcementApi.recordInteraction` when UI actions are added)

## Performance Optimizations

1. **Polling**: 15-second intervals for real-time updates
2. **Intersection Observer**: Auto mark-as-read when messages become visible
3. **Optimistic Updates**: Immediate UI updates with rollback on error
4. **Pagination**: Load more functionality to avoid loading all data
5. **Memoization**: Content renderers are memoized for HTML content

## Error Handling

- Toast notifications for user-facing errors
- Silent retries for interaction tracking
- Fallback to default settings if student display settings fail to load
- Graceful degradation when APIs are unavailable

## Testing

To test the implementation:

1. **System Alerts**: Check the top bar on any page
2. **Dashboard Pins**: Visit the dashboard page
3. **Package Session Messages**: Visit a course details page for an enrolled course

## Future Enhancements

1. **SSE Integration**: Replace polling with Server-Sent Events for real-time updates
2. **Virtualization**: Implement virtual scrolling for large message lists
3. **Push Notifications**: Integrate with push notification service
4. **Offline Support**: Cache messages for offline viewing
5. **Advanced Filtering**: Add more filter options for messages

## Dependencies

- Zustand for state management
- React Query for data fetching (future enhancement)
- Lucide React for icons
- Date-fns for date formatting
- Sonner for toast notifications
