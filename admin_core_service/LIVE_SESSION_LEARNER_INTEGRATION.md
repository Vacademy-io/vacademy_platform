# Learner Frontend Integration Guide
## Live Session Display with Custom Links & Buttons

---

## 📋 Overview

This guide shows how to display live sessions to learners with support for:
- **Join buttons** when sessions are live
- **Custom buttons** with configurable text, colors, and URLs when sessions end
- **Default links** as fallback when no custom button is configured

---

## 🔌 API Endpoint

### Get Live & Upcoming Sessions
```
GET /admin-core-service/get-sessions/learner/live-and-upcoming
```

**Query Parameters:**
- `batchId` (optional) - Filter by batch
- `userId` (optional) - Filter by user  
- `page` (optional, default: 0) - Page number
- `size` (optional) - Page size
- `startDate` (optional) - Start date filter (YYYY-MM-DD)
- `endDate` (optional) - End date filter (YYYY-MM-DD)

---

## 📦 Response Structure

```json
[
  {
    "date": "2026-02-27",
    "sessions": [
      {
        "session_id": "49b07dca-c743-4d67-86f1-f7a1a1696987",
        "schedule_id": "85d5ea57-71e7-4f53-a142-8eb0e8af88cf",
        "title": "Math Class",
        "subject": "Mathematics",
        "meeting_date": "2026-02-27",
        "start_time": "19:45:00",
        "last_entry_time": "20:15:00",
        "timezone": "Asia/Kolkata",
        "meeting_link": "https://zoom.us/j/...",
        
        // NEW: Custom button configuration
        "learner_button_config": {
          "text": "Watch Recording",
          "url": "https://youtube.com/recording",
          "background_color": "#FF0000",
          "text_color": "#FFFFFF",
          "visible": true
        },
        
        // NEW: Default fallback link
        "default_class_link": "https://youtube.com/recording"
      }
    ]
  }
]
```

### Field Details

| Field | Type | Description |
|-------|------|-------------|
| `learner_button_config` | Object \| null | Custom button config (can be null) |
| `learner_button_config.text` | String | Button label text |
| `learner_button_config.url` | String | URL to open when clicked |
| `learner_button_config.background_color` | String | Hex color code (e.g., "#FF0000") |
| `learner_button_config.text_color` | String | Hex color code for text |
| `learner_button_config.visible` | Boolean | Whether to show the button |
| `default_class_link` | String \| null | Fallback URL (can be null) |

---

## 🎨 Display Logic

### Step 1: Determine Session State

```javascript
function getSessionState(session) {
  const now = new Date();
  const startTime = new Date(session.meeting_date + 'T' + session.start_time);
  const endTime = new Date(session.meeting_date + 'T' + session.last_entry_time);
  
  if (now >= startTime && now <= endTime) {
    return 'LIVE';
  } else if (now < startTime) {
    return 'UPCOMING';
  } else {
    return 'ENDED';
  }
}
```

### Step 2: Render Based on State

```javascript
function renderSessionAction(session) {
  const state = getSessionState(session);
  
  switch (state) {
    case 'LIVE':
      // Show join button
      return (
        <button 
          className="btn-join"
          onClick={() => window.open(session.meeting_link, '_blank')}
        >
          Join Class
        </button>
      );
      
    case 'UPCOMING':
      // Show start time
      return (
        <div className="upcoming">
          <p>Starts at {session.start_time}</p>
        </div>
      );
      
    case 'ENDED':
      // Priority 1: Custom button (if visible)
      if (session.learner_button_config?.visible) {
        return (
          <button
            onClick={() => window.open(session.learner_button_config.url, '_blank')}
            style={{
              backgroundColor: session.learner_button_config.background_color,
              color: session.learner_button_config.text_color
            }}
          >
            {session.learner_button_config.text}
          </button>
        );
      }
      
      // Priority 2: Default link
      if (session.default_class_link) {
        return (
          <button 
            onClick={() => window.open(session.default_class_link, '_blank')}
          >
            View Class Material
          </button>
        );
      }
      
      // Priority 3: No action
      return <p className="ended">Class Ended</p>;
  }
}
```

---

## 💻 Complete React Example

```jsx
import React from 'react';

function SessionCard({ session }) {
  const now = new Date();
  const startTime = new Date(session.meeting_date + 'T' + session.start_time);
  const endTime = new Date(session.meeting_date + 'T' + session.last_entry_time);
  
  const isLive = now >= startTime && now <= endTime;
  const isUpcoming = now < startTime;
  const isEnded = now > endTime;

  const renderButton = () => {
    if (isLive) {
      return (
        <button 
          className="btn btn-primary"
          onClick={() => window.open(session.meeting_link, '_blank')}
        >
          🎥 Join Class
        </button>
      );
    }

    if (isUpcoming) {
      return (
        <div className="badge badge-info">
          Starts at {session.start_time}
        </div>
      );
    }

    // Session ended - check for custom button or default link
    if (session.learner_button_config?.visible) {
      return (
        <button
          className="btn btn-custom"
          onClick={() => window.open(session.learner_button_config.url, '_blank')}
          style={{
            backgroundColor: session.learner_button_config.background_color,
            color: session.learner_button_config.text_color
          }}
        >
          {session.learner_button_config.text}
        </button>
      );
    }

    if (session.default_class_link) {
      return (
        <button 
          className="btn btn-secondary"
          onClick={() => window.open(session.default_class_link, '_blank')}
        >
          📚 View Class Material
        </button>
      );
    }

    return <div className="badge badge-secondary">Class Ended</div>;
  };

  return (
    <div className="session-card">
      <h3>{session.title}</h3>
      <p className="subject">{session.subject}</p>
      <p className="time">
        {session.meeting_date} at {session.start_time}
      </p>
      {renderButton()}
    </div>
  );
}

export default SessionCard;
```

---

## 🔒 Security & Validation

### Validate Colors
```javascript
function isValidHexColor(color) {
  return /^#[0-9A-F]{6}$/i.test(color);
}

// Use with fallback
const bgColor = isValidHexColor(config?.background_color) 
  ? config.background_color 
  : '#000000';
```

### Validate URLs
```javascript
function isValidUrl(url) {
  try {
    new URL(url);
    return url.startsWith('http://') || url.startsWith('https://');
  } catch {
    return false;
  }
}

// Use before opening
if (isValidUrl(session.learner_button_config.url)) {
  window.open(session.learner_button_config.url, '_blank');
}
```

---

## 📱 TypeScript Interface

```typescript
interface LearnerButtonConfig {
  text: string;
  url: string;
  background_color: string;
  text_color: string;
  visible: boolean;
}

interface LiveSession {
  session_id: string;
  schedule_id: string;
  title: string;
  subject: string;
  meeting_date: string;
  start_time: string;
  last_entry_time: string;
  timezone: string;
  meeting_link: string;
  learner_button_config: LearnerButtonConfig | null;
  default_class_link: string | null;
}

interface GroupedSessions {
  date: string;
  sessions: LiveSession[];
}
```

---

## ✅ Testing Checklist

- [ ] Live session shows "Join Class" button
- [ ] Upcoming session shows start time
- [ ] Ended session with custom button shows styled button
- [ ] Ended session with only default link shows generic button
- [ ] Ended session with no links shows "Class Ended"
- [ ] Custom button respects `visible: false` flag
- [ ] Null values don't cause errors
- [ ] Color codes are validated
- [ ] URLs open in new tab
- [ ] Timezone handling is correct

---

## 🎯 Quick Reference

| Session State | Condition | Display |
|---------------|-----------|---------|
| **LIVE** | `now >= start_time && now <= end_time` | "Join Class" button → `meeting_link` |
| **UPCOMING** | `now < start_time` | "Starts at [time]" |
| **ENDED + Custom** | `now > end_time && learner_button_config.visible` | Custom button → `learner_button_config.url` |
| **ENDED + Default** | `now > end_time && default_class_link` | "View Material" → `default_class_link` |
| **ENDED + None** | `now > end_time` | "Class Ended" |

---

## 📝 Example Scenarios

### Scenario 1: Live Session
```json
{
  "title": "Math Class",
  "start_time": "10:00:00",
  "last_entry_time": "11:00:00",
  "meeting_link": "https://zoom.us/j/123"
}
```
**Current time: 10:30 AM**  
**Display:** "Join Class" button

---

### Scenario 2: Ended with Custom Button
```json
{
  "title": "Physics Class",
  "start_time": "10:00:00",
  "last_entry_time": "11:00:00",
  "learner_button_config": {
    "text": "Watch Recording",
    "url": "https://youtube.com/watch?v=abc",
    "background_color": "#FF0000",
    "text_color": "#FFFFFF",
    "visible": true
  }
}
```
**Current time: 12:00 PM**  
**Display:** Red "Watch Recording" button

---

### Scenario 3: Ended with Default Link
```json
{
  "title": "Chemistry Class",
  "start_time": "10:00:00",
  "last_entry_time": "11:00:00",
  "learner_button_config": null,
  "default_class_link": "https://notes.example.com/chem"
}
```
**Current time: 12:00 PM**  
**Display:** "View Class Material" button

---

**Last Updated:** February 16, 2026
