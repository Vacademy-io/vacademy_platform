# Bulk Course Creation API

## Overview

The Bulk Course Creation API allows you to create multiple courses in a single request with flexible configuration options. Each course can have:

- Multiple batches (level-session pairs)
- Custom payment options or use institute defaults
- Inventory management (seat limits)
- Course metadata and media

## Endpoint

```
POST /admin-core-service/course/v1/bulk-add-courses/{instituteId}
```

## Request Structure

```json
{
  "apply_to_all": {
    "enabled": true,
    "batches": [
      { "level_id": "level-uuid-1", "session_id": "session-uuid-1" },
      { "level_id": "level-uuid-2", "session_id": "session-uuid-2" }
    ],
    "payment_config": {
      "payment_type": "ONE_TIME",
      "price": 999,
      "currency": "INR"
    },
    "inventory_config": {
      "max_slots": 50,
      "available_slots": 50
    },
    "course_type": "COURSE",
    "course_depth": 5,
    "tags": ["programming"],
    "publish_to_catalogue": true
  },
  "courses": [
    {
      "course_name": "Java Fundamentals"
    },
    {
      "course_name": "Python Masterclass",
      "course_type": "COURSE",
      "payment_config": {
        "payment_type": "FREE"
      }
    }
  ],
  "dry_run": false
}
```

## Configuration Resolution Order

1. **Course-level configuration** (highest priority)
2. **Global defaults** (`apply_to_all`)
3. **System defaults** (lowest priority)

## Field Reference

### Global Defaults (`apply_to_all`)

| Field                  | Type    | Description                                                |
| ---------------------- | ------- | ---------------------------------------------------------- |
| `enabled`              | Boolean | Whether to apply global settings                           |
| `batches`              | Array   | Default batches for all courses                            |
| `payment_config`       | Object  | Default payment configuration                              |
| `inventory_config`     | Object  | Default inventory settings                                 |
| `course_type`          | String  | Default course type (COURSE, MEMBERSHIP, PRODUCT, SERVICE) |
| `course_depth`         | Integer | Default course depth (default: 5)                          |
| `tags`                 | Array   | Default tags for all courses                               |
| `publish_to_catalogue` | Boolean | Whether to publish to catalogue                            |

### Course Item (`courses[]`)

| Field                           | Type    | Required | Description                          |
| ------------------------------- | ------- | -------- | ------------------------------------ |
| `course_name`                   | String  | ✅ Yes   | Course name                          |
| `course_type`                   | String  | No       | COURSE, MEMBERSHIP, PRODUCT, SERVICE |
| `course_depth`                  | Integer | No       | Course hierarchy depth (default: 5)  |
| `tags`                          | Array   | No       | Course tags (merged with global)     |
| `thumbnail_file_id`             | String  | No       | Thumbnail image ID                   |
| `course_preview_image_media_id` | String  | No       | Preview image ID                     |
| `course_banner_media_id`        | String  | No       | Banner image ID                      |
| `course_media_id`               | String  | No       | Course video ID                      |
| `why_learn_html`                | String  | No       | HTML: Why learn this course          |
| `who_should_learn_html`         | String  | No       | HTML: Target audience                |
| `about_the_course_html`         | String  | No       | HTML: About the course               |
| `course_html_description`       | String  | No       | HTML description                     |
| `publish_to_catalogue`          | Boolean | No       | Publish to catalogue                 |
| `batches`                       | Array   | No       | Override batches for this course     |
| `payment_config`                | Object  | No       | Override payment for this course     |
| `inventory_config`              | Object  | No       | Override inventory for this course   |
| `faculty_user_ids`              | Array   | No       | Faculty to assign                    |

### Batch Configuration (`batches[]`)

| Field              | Type   | Description                       |
| ------------------ | ------ | --------------------------------- |
| `level_id`         | String | Level ID (null = DEFAULT)         |
| `session_id`       | String | Session ID (null = DEFAULT)       |
| `inventory_config` | Object | Override inventory for this batch |

### Payment Configuration (`payment_config`)

| Field                 | Type    | Description                                        |
| --------------------- | ------- | -------------------------------------------------- |
| `payment_option_id`   | String  | Use existing payment option (ignores other fields) |
| `payment_type`        | String  | FREE, ONE_TIME, SUBSCRIPTION, DONATION             |
| `price`               | Number  | Price (required for ONE_TIME, SUBSCRIPTION)        |
| `elevated_price`      | Number  | Strike-through price (optional)                    |
| `currency`            | String  | Currency code (default: INR)                       |
| `validity_in_days`    | Integer | Validity period (default: 365)                     |
| `payment_option_name` | String  | Custom name for payment option                     |
| `plan_name`           | String  | Custom name for plan                               |
| `require_approval`    | Boolean | Require admin approval (default: false)            |

### Inventory Configuration (`inventory_config`)

| Field             | Type    | Description                             |
| ----------------- | ------- | --------------------------------------- |
| `max_slots`       | Integer | Maximum seats (null = unlimited)        |
| `available_slots` | Integer | Available slots (defaults to max_slots) |

## Response Structure

```json
{
  "total_requested": 2,
  "success_count": 2,
  "failure_count": 0,
  "dry_run": false,
  "results": [
    {
      "index": 0,
      "course_name": "Java Fundamentals",
      "status": "SUCCESS",
      "course_id": "course-uuid-1",
      "package_session_ids": ["ps-uuid-1", "ps-uuid-2"],
      "enroll_invite_ids": ["invite-uuid-1", "invite-uuid-2"],
      "payment_option_id": "payment-uuid-1",
      "error_message": null
    },
    {
      "index": 1,
      "course_name": "Python Masterclass",
      "status": "SUCCESS",
      "course_id": "course-uuid-2",
      "package_session_ids": ["ps-uuid-3"],
      "enroll_invite_ids": ["invite-uuid-3"],
      "payment_option_id": null,
      "error_message": null
    }
  ]
}
```

## Examples

### Example 1: Simple Bulk Creation with Global Defaults

Create multiple courses with the same pricing and batches:

```json
{
  "apply_to_all": {
    "enabled": true,
    "payment_config": {
      "payment_type": "ONE_TIME",
      "price": 499,
      "currency": "INR",
      "validity_in_days": 365
    }
  },
  "courses": [
    { "course_name": "Course A" },
    { "course_name": "Course B" },
    { "course_name": "Course C" }
  ]
}
```

### Example 2: Mixed Pricing (Some Free, Some Paid)

```json
{
  "apply_to_all": {
    "enabled": true,
    "payment_config": {
      "payment_type": "ONE_TIME",
      "price": 999
    }
  },
  "courses": [
    { "course_name": "Paid Course A" },
    { "course_name": "Paid Course B" },
    {
      "course_name": "Free Course C",
      "payment_config": { "payment_type": "FREE" }
    }
  ]
}
```

### Example 3: Use Existing Payment Option

```json
{
  "courses": [
    {
      "course_name": "New Course",
      "payment_config": {
        "payment_option_id": "existing-payment-option-uuid"
      }
    }
  ]
}
```

### Example 4: Multiple Batches with Inventory

```json
{
  "courses": [
    {
      "course_name": "Limited Seats Course",
      "batches": [
        {
          "level_id": "beginner-level-uuid",
          "session_id": "jan-2025-uuid",
          "inventory_config": {
            "max_slots": 30,
            "available_slots": 30
          }
        },
        {
          "level_id": "advanced-level-uuid",
          "session_id": "jan-2025-uuid",
          "inventory_config": {
            "max_slots": 20
          }
        }
      ]
    }
  ]
}
```

### Example 5: Dry Run (Validation Only)

```json
{
  "dry_run": true,
  "courses": [{ "course_name": "Test Course" }]
}
```

## Error Handling

- Each course is processed independently
- Failures don't affect other courses in the batch
- Failed courses include `error_message` in the response
- Use `dry_run: true` to validate before committing

## Course Types

| Type         | Description                    |
| ------------ | ------------------------------ |
| `COURSE`     | Standard course (default)      |
| `MEMBERSHIP` | Membership/subscription access |
| `PRODUCT`    | Digital product                |
| `SERVICE`    | Service offering               |

## Payment Types

| Type           | Description         | Price Required |
| -------------- | ------------------- | -------------- |
| `FREE`         | No payment required | No             |
| `ONE_TIME`     | Single payment      | Yes            |
| `SUBSCRIPTION` | Recurring payment   | Yes            |
| `DONATION`     | Variable amount     | No             |

## Notes

1. **Enroll Invite per Batch**: Each batch (PackageSession) gets its own EnrollInvite
2. **Payment Option per Course**: Each course creates its own PaymentOption (not shared)
3. **Duplicate Courses Allowed**: Same course name creates a new course (no deduplication)
4. **Default Batch**: If no batches specified, creates with DEFAULT level and session
