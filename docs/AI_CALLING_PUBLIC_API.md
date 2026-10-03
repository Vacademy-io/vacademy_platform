# AI Calling Public API

Use the API key issued by a Vacademy administrator in the `X-API-Key` header.

## Start a call

`POST /admin-core-service/open/ai-calling/v1`

```json
{
  "numbers": ["+919876543210"],
  "agentId": "agent-or-campaign-id",
  "campaignId": "optional-provider-campaign-id",
  "mode": "CLICK_TO_CALL"
}
```

Use `CLICK_TO_CALL` with exactly one number. Use `BULK_CALL` for multiple numbers (maximum 1000).

Response:

```json
{"mode":"CLICK_TO_CALL","calls":[{"callLogId":"...","status":"INITIATED","dispatched":true}]}
```

## Get call status

`GET /admin-core-service/open/ai-calling/v1/{callLogId}`

The response includes the normalized call status, provider call ID, duration, start/end timestamps, and `recordingUrl`. `recordingUrl` is `null` until the provider recording callback has been processed.

## Authentication errors

Missing, invalid, or revoked keys return HTTP `401`. Calls and status lookups are always restricted to the institute that owns the issued key.

## Issuing keys (internal)

Keys are issued, listed and revoked with `/admin-core-service/v1/telephony/ai-call/api-keys` by an ADMIN of the institute that owns them. The request must carry the `clientId` header set to that institute. The root-user flag no longer grants access. A Vacademy staff member who issues a key for a client institute needs the ADMIN role in that institute until a super-admin route exists (planned after the super-admin allowlist lands).
