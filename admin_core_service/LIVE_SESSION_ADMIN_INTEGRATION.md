# Admin Frontend Integration Guide
## Live Session Custom Links & Buttons Configuration

---

## 📋 Overview

This guide shows how to build the admin interface for configuring:
- **Default Class Link** - URL shown to learners when session is not live
- **Learner Button Config** - Custom button with text, colors, and URL

These can be configured at the **schedule level** (per occurrence).

---

## 🔌 API Endpoints

### 1. Create/Update Session (Step 1)
```
POST /admin-core-service/live-session/step1
```

### 2. Get Session Details
```
GET /admin-core-service/get-sessions/by-id?sessionId={sessionId}
```

### 3. Get Schedule Details
```
GET /admin-core-service/get-sessions/by-schedule-id?scheduleId={scheduleId}
```

---

## 📤 Request Structure (Create/Update)

### Step 1 Request Body

```json
{
  "session_id": "49b07dca-c743-4d67-86f1-f7a1a1696987",
  "title": "Advanced Mathematics",
  "subject": "Mathematics",
  "access_level": "public",
  
  "added_schedules": [
    {
      "schedule_id": "85d5ea57-71e7-4f53-a142-8eb0e8af88cf",
      "meeting_date": "2026-02-27",
      "start_time": "19:45:00",
      "last_entry_time": "20:15:00",
      
      // NEW: Default class link
      "default_class_link": "https://youtube.com/watch?v=recording123",
      
      // NEW: Custom button configuration
      "learner_button_config": {
        "text": "Watch Recording",
        "url": "https://youtube.com/watch?v=recording123",
        "background_color": "#FF0000",
        "text_color": "#FFFFFF",
        "visible": true
      }
    }
  ]
}
```

### Field Specifications

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `default_class_link` | String | No | URL to show when session is not live |
| `learner_button_config` | Object | No | Custom button configuration |
| `learner_button_config.text` | String | Yes* | Button label (max 50 chars) |
| `learner_button_config.url` | String | Yes* | Target URL |
| `learner_button_config.background_color` | String | Yes* | Hex color code (e.g., "#FF0000") |
| `learner_button_config.text_color` | String | Yes* | Hex color code for text |
| `learner_button_config.visible` | Boolean | Yes* | Whether to show the button |

*Required if `learner_button_config` object is provided

---

## 📥 Response Structure (Get Session)

```json
{
  "session_id": "49b07dca-c743-4d67-86f1-f7a1a1696987",
  "title": "Advanced Mathematics",
  
  "schedules": [
    {
      "schedule_id": "85d5ea57-71e7-4f53-a142-8eb0e8af88cf",
      "meeting_date": "2026-02-27",
      "start_time": "19:45:00",
      "last_entry_time": "20:15:00",
      
      "default_class_link": "https://youtube.com/watch?v=recording123",
      
      "learner_button_config": {
        "text": "Watch Recording",
        "url": "https://youtube.com/watch?v=recording123",
        "background_color": "#FF0000",
        "text_color": "#FFFFFF",
        "visible": true
      }
    }
  ]
}
```

---

## 🎨 UI Components

### 1. Default Class Link Input

```jsx
import React from 'react';

function DefaultClassLinkInput({ value, onChange }) {
  return (
    <div className="form-group">
      <label htmlFor="default-class-link">
        Default Class Link
        <span className="help-text">
          URL shown to learners when session is not live (e.g., recording, notes)
        </span>
      </label>
      
      <input
        id="default-class-link"
        type="url"
        className="form-control"
        placeholder="https://youtube.com/watch?v=..."
        value={value || ''}
        onChange={(e) => onChange(e.target.value || null)}
      />
      
      {value && (
        <button 
          type="button"
          className="btn-clear"
          onClick={() => onChange(null)}
        >
          Clear
        </button>
      )}
    </div>
  );
}
```

---

### 2. Custom Button Configuration

```jsx
import React, { useState } from 'react';

function LearnerButtonConfig({ value, onChange }) {
  const [config, setConfig] = useState(value || {
    text: '',
    url: '',
    background_color: '#1976D2',
    text_color: '#FFFFFF',
    visible: false
  });

  const handleChange = (field, newValue) => {
    const updated = { ...config, [field]: newValue };
    setConfig(updated);
    onChange(updated);
  };

  const handleClear = () => {
    setConfig(null);
    onChange(null);
  };

  if (!config) {
    return (
      <button 
        type="button"
        className="btn btn-secondary"
        onClick={() => setConfig({
          text: '',
          url: '',
          background_color: '#1976D2',
          text_color: '#FFFFFF',
          visible: true
        })}
      >
        + Add Custom Button
      </button>
    );
  }

  return (
    <div className="custom-button-config">
      <h4>Custom Button Configuration</h4>
      
      {/* Visibility Toggle */}
      <div className="form-group">
        <label>
          <input
            type="checkbox"
            checked={config.visible}
            onChange={(e) => handleChange('visible', e.target.checked)}
          />
          Show custom button to learners
        </label>
      </div>

      {/* Button Text */}
      <div className="form-group">
        <label htmlFor="button-text">Button Text</label>
        <input
          id="button-text"
          type="text"
          className="form-control"
          placeholder="Watch Recording"
          maxLength={50}
          value={config.text}
          onChange={(e) => handleChange('text', e.target.value)}
          required
        />
      </div>

      {/* Button URL */}
      <div className="form-group">
        <label htmlFor="button-url">Button URL</label>
        <input
          id="button-url"
          type="url"
          className="form-control"
          placeholder="https://youtube.com/watch?v=..."
          value={config.url}
          onChange={(e) => handleChange('url', e.target.value)}
          required
        />
      </div>

      {/* Color Pickers */}
      <div className="form-row">
        <div className="form-group col-md-6">
          <label htmlFor="bg-color">Background Color</label>
          <input
            id="bg-color"
            type="color"
            className="form-control"
            value={config.background_color}
            onChange={(e) => handleChange('background_color', e.target.value)}
          />
        </div>

        <div className="form-group col-md-6">
          <label htmlFor="text-color">Text Color</label>
          <input
            id="text-color"
            type="color"
            className="form-control"
            value={config.text_color}
            onChange={(e) => handleChange('text_color', e.target.value)}
          />
        </div>
      </div>

      {/* Preview */}
      <div className="preview">
        <label>Preview:</label>
        <button
          type="button"
          style={{
            backgroundColor: config.background_color,
            color: config.text_color,
            padding: '10px 20px',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer'
          }}
        >
          {config.text || 'Button Text'}
        </button>
      </div>

      {/* Remove Button */}
      <button 
        type="button"
        className="btn btn-danger"
        onClick={handleClear}
      >
        Remove Custom Button
      </button>
    </div>
  );
}
```

---

### 3. Complete Schedule Form

```jsx
import React, { useState } from 'react';

function ScheduleForm({ schedule, onSave }) {
  const [formData, setFormData] = useState({
    schedule_id: schedule?.schedule_id || null,
    meeting_date: schedule?.meeting_date || '',
    start_time: schedule?.start_time || '',
    last_entry_time: schedule?.last_entry_time || '',
    default_class_link: schedule?.default_class_link || null,
    learner_button_config: schedule?.learner_button_config || null
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    
    // Validate
    if (formData.learner_button_config) {
      if (!formData.learner_button_config.text || 
          !formData.learner_button_config.url) {
        alert('Please fill in all custom button fields');
        return;
      }
    }
    
    onSave(formData);
  };

  return (
    <form onSubmit={handleSubmit}>
      <h3>Schedule Configuration</h3>
      
      {/* Basic fields */}
      <div className="form-group">
        <label>Meeting Date</label>
        <input
          type="date"
          className="form-control"
          value={formData.meeting_date}
          onChange={(e) => setFormData({
            ...formData,
            meeting_date: e.target.value
          })}
          required
        />
      </div>

      {/* ... other basic fields ... */}

      <hr />

      {/* Default Class Link */}
      <DefaultClassLinkInput
        value={formData.default_class_link}
        onChange={(value) => setFormData({
          ...formData,
          default_class_link: value
        })}
      />

      <hr />

      {/* Custom Button Config */}
      <LearnerButtonConfig
        value={formData.learner_button_config}
        onChange={(value) => setFormData({
          ...formData,
          learner_button_config: value
        })}
      />

      <hr />

      <button type="submit" className="btn btn-primary">
        Save Schedule
      </button>
    </form>
  );
}
```

---

## ✅ Validation Rules

### Client-Side Validation

```javascript
function validateScheduleConfig(config) {
  const errors = [];

  // Validate default class link
  if (config.default_class_link) {
    if (!isValidUrl(config.default_class_link)) {
      errors.push('Default class link must be a valid URL');
    }
  }

  // Validate learner button config
  if (config.learner_button_config) {
    const btn = config.learner_button_config;
    
    if (!btn.text || btn.text.trim().length === 0) {
      errors.push('Button text is required');
    }
    
    if (btn.text && btn.text.length > 50) {
      errors.push('Button text must be 50 characters or less');
    }
    
    if (!btn.url || !isValidUrl(btn.url)) {
      errors.push('Button URL must be a valid URL');
    }
    
    if (!isValidHexColor(btn.background_color)) {
      errors.push('Invalid background color format');
    }
    
    if (!isValidHexColor(btn.text_color)) {
      errors.push('Invalid text color format');
    }
  }

  return errors;
}

function isValidUrl(url) {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

function isValidHexColor(color) {
  return /^#[0-9A-F]{6}$/i.test(color);
}
```

---

## 🔄 Update vs Delete

### To Update
Send the new values:
```json
{
  "default_class_link": "https://new-link.com",
  "learner_button_config": {
    "text": "New Button",
    "url": "https://new-url.com",
    "background_color": "#00FF00",
    "text_color": "#000000",
    "visible": true
  }
}
```

### To Delete/Clear
Send `null`:
```json
{
  "default_class_link": null,
  "learner_button_config": null
}
```

---

## 📱 TypeScript Interfaces

```typescript
interface LearnerButtonConfig {
  text: string;
  url: string;
  background_color: string;
  text_color: string;
  visible: boolean;
}

interface Schedule {
  schedule_id: string | null;
  meeting_date: string;
  start_time: string;
  last_entry_time: string;
  default_class_link: string | null;
  learner_button_config: LearnerButtonConfig | null;
}

interface SessionStep1Request {
  session_id: string | null;
  title: string;
  subject: string;
  access_level: string;
  added_schedules: Schedule[];
}
```

---

## ✅ Testing Checklist

### Form Functionality
- [ ] Can add default class link
- [ ] Can clear default class link
- [ ] Can add custom button configuration
- [ ] Can remove custom button configuration
- [ ] Color pickers work correctly
- [ ] Preview shows correct styling
- [ ] Visibility toggle works

### Validation
- [ ] URL validation works
- [ ] Color validation works
- [ ] Required fields are enforced
- [ ] Character limits are enforced
- [ ] Error messages are clear

### Data Flow
- [ ] Form loads existing values correctly
- [ ] Changes save correctly
- [ ] Null values are handled properly
- [ ] API errors are displayed to user

---

## 🎨 UI/UX Best Practices

### 1. Clear Labels
```jsx
<label>
  Default Class Link
  <span className="help-text">
    This link will be shown to learners when the session is not live
  </span>
</label>
```

### 2. Visual Preview
Always show a preview of how the custom button will appear to learners.

### 3. Smart Defaults
```javascript
const DEFAULT_BUTTON_CONFIG = {
  text: 'View Class Material',
  url: '',
  background_color: '#1976D2',
  text_color: '#FFFFFF',
  visible: true
};
```

### 4. Helpful Placeholders
```jsx
<input
  placeholder="e.g., Watch Recording, View Notes, Download Materials"
/>
```

---

## 📝 Example Workflows

### Workflow 1: Add Recording Link
1. Admin creates session
2. After class ends, admin edits schedule
3. Admin adds default class link: `https://youtube.com/watch?v=abc`
4. Learners see "View Class Material" button after class

### Workflow 2: Add Custom Button
1. Admin edits schedule
2. Admin clicks "Add Custom Button"
3. Admin fills in:
   - Text: "Watch Recording"
   - URL: `https://youtube.com/watch?v=abc`
   - Background: Red (#FF0000)
   - Text: White (#FFFFFF)
4. Admin toggles visibility ON
5. Learners see red "Watch Recording" button after class

### Workflow 3: Remove Links
1. Admin edits schedule
2. Admin clicks "Clear" on default class link
3. Admin clicks "Remove Custom Button"
4. Learners see "Class Ended" after class

---

**Last Updated:** February 16, 2026
