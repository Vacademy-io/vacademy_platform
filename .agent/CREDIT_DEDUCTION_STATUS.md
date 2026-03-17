# AI Credit Deduction Status & Required Changes

## Summary

This document tracks which AI API endpoints correctly deduct credits and which need fixes.

---

## ✅ ALREADY FIXED (Backend changes committed)

### AI Service (Python)

| Service                         | Method                           | Status                                    |
| ------------------------------- | -------------------------------- | ----------------------------------------- |
| `video_generation_service.py`   | `generate_till_stage` (line 552) | ✅ Uses `record_usage_and_deduct_credits` |
| `course_outline_service.py`     | Multiple methods                 | ✅ Uses `record_usage_and_deduct_credits` |
| `content_generation_service.py` | Multiple methods                 | ✅ Uses `record_usage_and_deduct_credits` |
| `token_usage.py`                | `/v1/record` endpoint            | ✅ Uses `record_usage_and_deduct_credits` |

### Media Service (Java)

| Service                       | Method                    | Status                    |
| ----------------------------- | ------------------------- | ------------------------- |
| `ExternalAIApiService.java`   | 5 methods with TaskStatus | ✅ Now pass `instituteId` |
| `DeepSeekLectureService.java` | 2 lecture methods         | ✅ Now pass `instituteId` |
| `TaskRetryService.java`       | `processRetryAttempt`     | ✅ Now pass `instituteId` |

---

## ❌ NEEDS BACKEND CHANGES

### 1. Chat Services (No credit deduction at all!)

#### `ai_chat_service.py` - `/chat/v1/ask`

**Problem:** No token usage recording or credit deduction.

**Schema:** `ChatRequest` doesn't have `institute_id`

**Fix Required:**

1. Add `institute_id: Optional[str]` to `ChatRequest` schema
2. Add credit deduction to `AiChatService.generate_chat_response()`

```python
# In schemas/chat_bot.py
class ChatRequest(BaseModel):
    prompt: str
    context: Optional[ChatContext] = None
    institute_id: Optional[str] = None  # ADD THIS
```

#### `ai_chat_agent_service.py` - `/chat-agent/*`

**Problem:** No token usage recording or credit deduction.

**Note:** Already has `institute_id` in `InitSessionRequest`

**Fix Required:**

1. Add credit deduction in the LLM call methods
2. Track tokens and call `record_usage_and_deduct_credits`

---

### 2. Media Service - Category 2 (Needs FE + BE changes)

These endpoints don't have access to `instituteId` in the request:

#### Presentation AI

- `POST /media-service/ai/presentation/generateFromData`
- `POST /media-service/ai/presentation/regenerateASlide`

**Fix:**

1. Add `institute_id` to `PresentationAiGenerateRequest.java`
2. Update controller to pass to service
3. Update FE to send `institute_id`

#### Question Generator

- `POST /media-service/ai/get-question/from-html`
- `POST /media-service/ai/get-question/from-not-html`

**Fix:**

1. Add `instituteId` query parameter to controllers
2. Update FE to send `instituteId`

#### Evaluation AI

- `POST /media-service/ai/evaluate/*`

**Fix:**

1. Add `instituteId` to evaluation request DTOs
2. Update controller and service
3. Update FE

---

## 🔍 INVESTIGATION NEEDED

### Video Generation on Stage

The curl command:

```bash
curl 'https://backend-stage.vacademy.io/ai-service/external/video/v1/generate' \
  -H 'x-institute-key: vac_live_JWIKiAnyMkCMABWiZXs9Poioslf0kWs5' \
  --data-raw '{"prompt":"video on sun rays",...}'
```

**Expected behavior:** Should deduct credits

**Checklist to verify:**

1. [ ] Verify the code is deployed to stage
2. [ ] Verify the institute has a credit record (check `institute_credits` table)
3. [ ] Check logs for credit deduction messages
4. [ ] Verify `validate_api_key` returns the correct `institute_id`

**Debug SQL:**

```sql
-- Check if institute has credits
SELECT * FROM institute_credits WHERE institute_id = '<institute_uuid>';

-- Check recent transactions
SELECT * FROM credit_transactions
WHERE institute_id = '<institute_uuid>'
ORDER BY created_at DESC
LIMIT 10;

-- Check token usage
SELECT * FROM ai_token_usage
WHERE institute_id = '<institute_uuid>'
ORDER BY created_at DESC
LIMIT 10;
```

---

## 📋 FE Changes Summary

| Endpoint                         | Parameter      | Type        | Priority |
| -------------------------------- | -------------- | ----------- | -------- |
| `/chat/v1/ask`                   | `institute_id` | Body field  | HIGH     |
| `/presentation/generateFromData` | `institute_id` | Body field  | MEDIUM   |
| `/presentation/regenerateASlide` | `institute_id` | Body field  | MEDIUM   |
| `/get-question/from-html`        | `instituteId`  | Query param | MEDIUM   |
| `/get-question/from-not-html`    | `instituteId`  | Query param | MEDIUM   |
| `/evaluate/*`                    | `instituteId`  | Body/Query  | LOW      |

---

## Next Steps

1. **Deploy existing changes to stage** and verify video generation credits
2. **Add credit deduction to chat services** (HIGH priority - used frequently)
3. **Add institute_id to media_service endpoints** (MEDIUM priority)

Last Updated: 2026-02-09
