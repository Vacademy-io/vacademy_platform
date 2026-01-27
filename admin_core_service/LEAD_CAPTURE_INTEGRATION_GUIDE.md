# Lead Capture & Only Details Filled Integration Guide

This guide details how to integrate the new "Lead Capture" functionality into the enrollment flow. This feature ensures that learner details are captured as an "Only Details Filled" entry immediately after they submit their personal information, even before payment is initiated.

## Overview

The enrollment process has been updated to support early lead capture.
**Old Flow:** User Details -> Payment -> Enrollment (Entry Created)
**New Flow:** User Details -> **Capture Lead API** (Only Details Filled Entry Created) -> Payment -> Enrollment (Entry Updates to Active)

## API Endpoint

**Endpoint:** `POST /admin-core-service/open/learner/enroll-invite/capture-lead`
**Access:** Open (No Auth Token required)

### Request Payload (`LeadCaptureRequestDTO`)

| Field                        | Type          | Required | Description                                                     |
| :--------------------------- | :------------ | :------- | :-------------------------------------------------------------- |
| `institute_id`               | String        | Yes      | The ID of the institute.                                        |
| `enroll_invite_id`           | String        | Yes      | The ID of the enrollment invite.                                |
| `invite_code`                | String        | Yes      | The invite code used.                                           |
| `package_session_ids`        | Array<String> | Yes      | List of IDs for the package sessions the user is enrolling in.  |
| `user_details`               | Object        | Yes      | Basic user information.                                         |
| `user_details.full_name`     | String        | Yes      | User's full name.                                               |
| `user_details.email`         | String        | Yes      | User's email address.                                           |
| `user_details.mobile_number` | String        | Yes      | User's mobile number.                                           |
| `user_details.username`      | String        | No       | Optional. If not provided, a random username will be generated. |
| `learner_extra_details`      | Object        | No       | Additional learner details (parents' info, etc.).               |
| `custom_field_values`        | Array         | No       | Data for any custom fields defined by the institute.            |

#### Example JSON

```json
{
  "institute_id": "ins_1234567890",
  "enroll_invite_id": "inv_0987654321",
  "invite_code": "WELCOME2024",
  "package_session_ids": ["ps_111222333"],
  "user_details": {
    "full_name": "Jane Doe",
    "email": "jane.doe@example.com",
    "mobile_number": "9876543210"
  },
  "learner_extra_details": {
    "fathers_name": "John Doe Sr.",
    "mothers_name": "Jane Doe Sr.",
    "parents_mobile_number": "9876543211",
    "parents_email": "parents@example.com"
  },
  "custom_field_values": []
}
```

### Response

**Status:** `200 OK`
**Body:** Returns the `userId` (String) of the created/updated user.

## Frontend Implementation Steps

1.  **Step 1: Save User Details**
    - When the user clicks "Continue" or "Pay & Enroll" after filling out their personal details form, **immediately** call the `/capture-lead` endpoint.
    - Do this _before_ redirecting them to the payment gateway or opening the payment modal.

2.  **Step 2: Handle Response**
    - **Success:** If the API returns 200, proceed to the Payment initiation step. You may want to store the returned `userId` if needed for subsequent tracking, though it's usually handled via the invite code/auth flow.
    - **Error:** Implement a graceful fallback. Even if lead capture fails (e.g., network error), you might still want to allow the user to proceed to payment to avoid blocking revenue. The system is robust enough to handle enrollment without the prior Only Details Filled entry, but you will lose the specific "Only Details Filled" tracking for that session if variables aren't saved.

3.  **Step 3: Payment**
    - Proceed with the existing payment flow.
    - **Note:** You do **not** need to pass the `userId` returned from capture-lead to the payment initiation manually if your current flow uses the `invite_code` and `email`/`mobile` to identify the user. However, ensures the backend has the freshest data.

## Verification

To verify the integration:

1.  Submit the user details form on the frontend.
2.  Check the `student_to_packages_session` table in the database.
3.  You should see a new entry with:
    - `type`: **ONLY_DETAILS_FILLED**
    - `status`: **ACTIVE**
    - `user_plan_id`: **NULL** (This is expected as no plan exists yet)
4.  Complete the payment.
5.  Check the table again. The previous entry should be marked `DELETED`, and a new entry with `type`: `PACKAGE_SESSION` (or similar) and `status`: `ACTIVE` should exist.
