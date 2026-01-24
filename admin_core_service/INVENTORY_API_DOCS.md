# Inventory Management API Documentation

This document outlines the API endpoints for managing the inventory (seats/slots) of Package Sessions.

**Base URL**: `/admin-core-service/package-session/{packageSessionId}/inventory`

## Table of Contents

1. [Update Capacity](#1-update-capacity)
2. [Get Availability](#2-get-availability)
3. [Reserve Slot](#3-reserve-slot)
4. [Release Slot](#4-release-slot)

---

## 1. Update Capacity

Sets the maximum number of seats (`max_seats`) for a specific Package Session. This defines the total inventory.

- **Endpoint**: `/update-capacity`
- **Method**: `PUT`
- **Description**: Updates the `maxSeats` and adjusts `availableSlots` accordingly. Setting `max_seats` to `null` makes the session **Unlimited**.

### Request Body

**Content-Type**: `application/json`

| Field       | Type      | Description                                                          |
| :---------- | :-------- | :------------------------------------------------------------------- |
| `max_seats` | `Integer` | The total capacity of the batch. Pass `null` for unlimited capacity. |

**Example Request:**

```json
{
  "max_seats": 50
}
```

### Response

**Status**: `200 OK`
**Content-Type**: `application/json`

Returns the updated `PackageSession` entity.

**Example Response:**

```json
{
  "id": "ps_12345",
  "level": { ... },
  "session": { ... },
  "startTime": "2024-01-01T10:00:00.000+00:00",
  "status": "ACTIVE",
  "availableSlots": 50,
  "maxSeats": 50,
  "version": 1,
  ...
}
```

---

## 2. Get Availability

Retrieves the current inventory status of a Package Session.

- **Endpoint**: `/availability`
- **Method**: `GET`
- **Description**: Returns current capacity, available slots, and unlimited status.

### Response

**Status**: `200 OK`
**Content-Type**: `application/json`

| Field              | Type      | Description                                  |
| :----------------- | :-------- | :------------------------------------------- |
| `packageSessionId` | `String`  | The ID of the session.                       |
| `maxSeats`         | `Integer` | Total capacity (null if unlimited).          |
| `availableSlots`   | `Integer` | Current remaining slots (null if unlimited). |
| `isUnlimited`      | `Boolean` | True if the session has no seat limit.       |

**Example Response:**

```json
{
  "packageSessionId": "ps_12345",
  "maxSeats": 50,
  "availableSlots": 48,
  "isUnlimited": false
}
```

**Example Response (Unlimited):**

```json
{
  "packageSessionId": "ps_67890",
  "maxSeats": null,
  "availableSlots": null,
  "isUnlimited": true
}
```

---

## 3. Reserve Slot

Decrements the available slots by 1. Intended for use when a user initiates enrollment or payment.

- **Endpoint**: `/reserve`
- **Method**: `POST`
- **Description**:
  - Checks if `availableSlots > 0`.
  - If yes, decrements `availableSlots`.
  - If `maxSeats` is unlimited, does nothing and succeeds.
  - Uses **Optimistic Locking** to prevent race conditions.

### Response

**Status**: `200 OK`

**Body**:

```text
Slot reserved successfully
```

### Error Response

If no slots are available:
**Status**: `500 Internal Server Error` (or configured Exception mapping)
**Body**:

```json
{
  "message": "No slots available",
  ...
}
```

---

## 4. Release Slot

Increments the available slots by 1. Intended for use when a transaction fails, receives a refund, or a user cancels.

- **Endpoint**: `/release`
- **Method**: `POST`
- **Description**:
  - Increments `availableSlots`.
  - Ensures `availableSlots` does not exceed `maxSeats`.
  - If `maxSeats` is unlimited, does nothing and succeeds.

### Response

**Status**: `200 OK`

**Body**:

```text
Slot released successfully
```
