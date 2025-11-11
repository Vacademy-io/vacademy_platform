# User Announcement Preference API

This document captures the public endpoints that allow learners or staff to review and manage
announcement notification preferences per institute. All endpoints are unauthenticated and expect
the username in the path and the institute identifier as a query parameter.

Base path: `/notification-service/public/v1/user-announcement-preferences`

---

## Get Current Preferences

Retrieve the effective settings for a user. The response includes:

- Whether the user is globally unsubscribed for each channel.
- A list of all email sender types configured for the institute with their opt-out status.
- WhatsApp opt-out status and timestamps when available.

```
GET /{username}?instituteId={instituteId}
```

### Example

```
curl -X GET \
  "https://api.example.com/notification-service/public/v1/user-announcement-preferences/jane.doe?instituteId=campus-123" \
  -H "Accept: application/json"
```

---

## Unsubscribe (Email or WhatsApp)

Use `PUT` to set the desired states. Omitted properties remain unchanged.
Setting `unsubscribed: true` stores an entry in `user_announcement_settings`.

```
PUT /{username}?instituteId={instituteId}
```

### Example – Unsubscribe from `DEVELOPER_EMAIL` and WhatsApp

```
curl -X PUT \
  "https://api.example.com/notification-service/public/v1/user-announcement-preferences/jane.doe?instituteId=campus-123" \
  -H "Content-Type: application/json" \
  -d '{
        "preferences": {
          "emailSenders": [
            { "emailType": "DEVELOPER_EMAIL", "unsubscribed": true }
          ],
          "whatsappUnsubscribed": true
        }
      }'
```

---

## Resubscribe

To resume delivery, send the same request with `unsubscribed: false`. The service removes the stored
opt-out entry and future deliveries proceed according to institute defaults.

### Example – Resubscribe to both channels

```
curl -X PUT \
  "https://api.example.com/notification-service/public/v1/user-announcement-preferences/jane.doe?instituteId=campus-123" \
  -H "Content-Type: application/json" \
  -d '{
        "preferences": {
          "emailSenders": [
            { "emailType": "DEVELOPER_EMAIL", "unsubscribed": false }
          ],
          "whatsappUnsubscribed": false
        }
      }'
```

---

### Notes

- `emailType` must match the sender type configured for the institute (e.g. `UTILITY_EMAIL`, `DEVELOPER_EMAIL`).
- `instituteId` is mandatory for both `GET` and `PUT`.
- A `PUT` with an empty body acts as a no-op and simply returns the current view.
- All timestamps in the response are in ISO-8601 format.

