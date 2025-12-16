# Migration Testing Guide

This guide provides step-by-step instructions and cURL commands for testing the 6 specific migration scenarios in the Admin Core Service.

## Prerequisites

- **Base URL**: `http://localhost:8080/admin-core-service/migration`
- **Headers**: `Content-Type: application/json` (for Start APIs), `Content-Type: multipart/form-data` (for Upload APIs)

## 1. Individual Member Migration

### A. Active + Renew Migration
**Scenario**: Active members renewing their plan. Status will be forced to `ACTIVE`.
**Mandatory Fields**: `ContactId`, `Email`, `FirstName`, `LastName`, `Phone1`, `StartDate`, `Currency`, `Status` (Must be `ACTIVE`), `NextBillDate`, `Token`.

1.  **Get Setup Configuration**:
    ```bash
    curl -X GET "http://localhost:8080/admin-core-service/migration/setup/v1/individual/active-renew"
    ```
2.  **Upload Users CSV**:
    ```bash
    curl -X POST "http://localhost:8080/admin-core-service/migration/keap/individual/upload-active-renew-users-csv" -F "file=@/path/to/renew_users.csv"
    ```
3.  **Upload Payments CSV**:
    ```bash
    curl -X POST "http://localhost:8080/admin-core-service/migration/keap/individual/upload-payments-csv" -F "file=@/path/to/payments.csv"
    ```
4.  **Start Migration**:
    ```bash
    curl -X POST "http://localhost:8080/admin-core-service/migration/keap/individual/start-active-renew-user-migration?batchSize=10" \
    -H "Content-Type: application/json" \
    -d '{ ...config... }'
    ```

### B. Active + Cancelled Migration
**Scenario**: Active members who have cancelled. Status will be forced to `CANCELLED`.

1.  **Get Setup Configuration**:
    ```bash
    curl -X GET "http://localhost:8080/admin-core-service/migration/setup/v1/individual/active-cancelled"
    ```
2.  **Upload Users CSV**:
    ```bash
    curl -X POST "http://localhost:8080/admin-core-service/migration/keap/individual/upload-active-cancelled-users-csv" -F "file=@/path/to/cancelled_users.csv"
    ```
3.  **Upload Payments CSV**:
    ```bash
    curl -X POST "http://localhost:8080/admin-core-service/migration/keap/individual/upload-payments-csv" -F "file=@/path/to/payments.csv"
    ```
4.  **Start Migration**:
    ```bash
    curl -X POST "http://localhost:8080/admin-core-service/migration/keap/individual/start-active-cancelled-user-migration?batchSize=10" \
    -H "Content-Type: application/json" \
    -d '{ ...config... }'
    ```

### C. Expired Migration
**Scenario**: Migrating expired members. Status will be `EXPIRED`.

1.  **Get Setup Configuration**:
    ```bash
    curl -X GET "http://localhost:8080/admin-core-service/migration/setup/v1/individual/expired"
    ```
2.  **Upload Users CSV**:
    ```bash
    curl -X POST "http://localhost:8080/admin-core-service/migration/keap/expired/upload-users-csv" -F "file=@/path/to/expired_users.csv"
    ```
3.  **Upload Payments CSV**:
    ```bash
    curl -X POST "http://localhost:8080/admin-core-service/migration/keap/expired/upload-payments-csv" -F "file=@/path/to/payments.csv"
    ```
4.  **Start Migration**:
    ```bash
    curl -X POST "http://localhost:8080/admin-core-service/migration/keap/expired/start-individual-migration?batchSize=10" \
    -H "Content-Type: application/json" \
    -d '{ ...config... }'
    ```

---

## 2. Practice Member Migration

### A. Active + Renew Migration
**Scenario**: Active practice members renewing. Status will be forced to `ACTIVE`.

1.  **Get Setup Configuration**:
    ```bash
    curl -X GET "http://localhost:8080/admin-core-service/migration/setup/v1/practice/active-renew"
    ```
2.  **Upload Practice CSV**:
    ```bash
    curl -X POST "http://localhost:8080/admin-core-service/migration/keap/practice/upload-active-renew-practice-csv" -F "file=@/path/to/renew_practice.csv"
    ```
3.  **Upload Payments CSV**:
    ```bash
    curl -X POST "http://localhost:8080/admin-core-service/migration/keap/practice/upload-practice-payment-csv" -F "file=@/path/to/payments.csv"
    ```
4.  **Start Migration**:
    ```bash
    curl -X POST "http://localhost:8080/admin-core-service/migration/keap/practice/start-active-renew-practice-migration?batchSize=10" \
    -H "Content-Type: application/json" \
    -d '{ ...config... }'
    ```

### B. Active + Cancelled Migration
**Scenario**: Active practice members who cancelled. Status will be forced to `CANCELLED`.

1.  **Get Setup Configuration**:
    ```bash
    curl -X GET "http://localhost:8080/admin-core-service/migration/setup/v1/practice/active-cancelled"
    ```
2.  **Upload Practice CSV**:
    ```bash
    curl -X POST "http://localhost:8080/admin-core-service/migration/keap/practice/upload-active-cancelled-practice-csv" -F "file=@/path/to/cancelled_practice.csv"
    ```
3.  **Upload Payments CSV**:
    ```bash
    curl -X POST "http://localhost:8080/admin-core-service/migration/keap/practice/upload-practice-payment-csv" -F "file=@/path/to/payments.csv"
    ```
4.  **Start Migration**:
    ```bash
    curl -X POST "http://localhost:8080/admin-core-service/migration/keap/practice/start-active-cancelled-practice-migration?batchSize=10" \
    -H "Content-Type: application/json" \
    -d '{ ...config... }'
    ```

### C. Expired Migration
**Scenario**: Migrating expired practice members. Status will be `EXPIRED`.

1.  **Get Setup Configuration**:
    ```bash
    curl -X GET "http://localhost:8080/admin-core-service/migration/setup/v1/practice/expired"
    ```
2.  **Upload Practice CSV**:
    ```bash
    curl -X POST "http://localhost:8080/admin-core-service/migration/keap/practice/expired/upload-practice-csv" -F "file=@/path/to/expired_practice.csv"
    ```
3.  **Start Migration**:
    ```bash
    curl -X POST "http://localhost:8080/admin-core-service/migration/keap/practice/expired/start-practice-migration?batchSize=10" \
    -H "Content-Type: application/json" \
    -d '{ ...config... }'
    ```

## 3. Configuration JSON Body
Use this JSON structure for the `config` parameter in Start APIs:

```json
{
  "enrollInviteId": "YOUR_ENROLL_INVITE_ID",
  "paymentGatewayMappingId": "YOUR_GATEWAY_MAPPING_ID",
  "packageSessionId": "YOUR_PACKAGE_SESSION_ID",
  "paymentPlanId": "YOUR_PAYMENT_PLAN_ID",
  "paymentOptionId": "YOUR_PAYMENT_OPTION_ID",
  "instituteId": "YOUR_INSTITUTE_ID"
}
```

## 4. CSV Samples

Use these samples to create your test CSV files.

### A. Individual Active + Renew (renew_users.csv)
*Note: All fields including FirstName, LastName, Address, etc. are MANDATORY.*
```csv
ContactId,Email,NextBillDate,Token,FirstName,LastName,Phone1,City,State,PostalCode,StartDate,Currency,Status
101,user1@example.com,2024-01-01,tok_123,John,Doe,+1-5551234567,,,2023-01-01,USD,ACTIVE
102,user2@example.com,2024-02-01,tok_456,Jane,Smith,+1-5559876543,,,2023-02-01,USD,ACTIVE
```

### B. Individual Active + Cancelled (cancelled_users.csv)
*Note: Status must be CANCELLED.*
```csv
ContactId,Email,FirstName,LastName,Phone1,City,State,PostalCode,StartDate,Currency,Status,NextBillDate,Token
201,cancelled1@example.com,Jane,Smith,+1-5559876543,,,2023-01-01,USD,CANCELLED,2024-01-01,tok_789
```

### C. Individual Expired (expired_users.csv)
*Note: Status must be EXPIRED. Token is optional.*
```csv
ContactId,Email,FirstName,LastName,Phone1,City,State,PostalCode,StartDate,Currency,Status,NextBillDate
301,expired1@example.com,Bob,Brown,+1-5551112222,,,2022-01-01,USD,EXPIRED,2023-01-01
```

### D. Practice Active + Renew (renew_practice.csv)
*Note: All fields including FirstName, LastName, Address, etc. are MANDATORY. ROOT_ADMIN_ID is required for non-ROOT_ADMIN roles.*
```csv
ContactId,Email,NextBillDate,Token,PRACTICE_ROLE,FirstName,LastName,Phone1,City,State,PostalCode,Practice Name,ROOT_ADMIN_ID,StartDate,Currency,Status
401,admin@practice.com,2024-01-01,tok_prac1,ROOT_ADMIN,Alice,Green,+1-5553334444,,,Green Vet,,2023-01-01,USD,ACTIVE
402,learner@practice.com,2024-01-01,tok_prac2,LEARNER,Bob,Blue,+1-5552223333,,,,401,2023-02-01,USD,ACTIVE
```

### E. Practice Active + Cancelled (cancelled_practice.csv)
*Note: Status must be CANCELLED. ROOT_ADMIN_ID is required for non-ROOT_ADMIN roles.*
```csv
ContactId,Email,FirstName,LastName,Phone1,City,State,PostalCode,Practice Name,PRACTICE_ROLE,ROOT_ADMIN_ID,StartDate,Currency,Status,NextBillDate,Token
501,admin@cancelled.com,Charlie,Black,+1-5556667777,,,Black Vet,ROOT_ADMIN,,2023-01-01,USD,CANCELLED,2024-01-01,tok_prac3
```

### F. Practice Expired (expired_practice.csv)
*Note: Status must be EXPIRED. Token is optional. ROOT_ADMIN_ID is required for non-ROOT_ADMIN roles.*
```csv
ContactId,Email,FirstName,LastName,Phone1,City,State,PostalCode,Practice Name,PRACTICE_ROLE,ROOT_ADMIN_ID,StartDate,Currency,Status,NextBillDate
601,admin@expired.com,David,White,+1-5558889999,,,White Vet,ROOT_ADMIN,,2022-01-01,USD,EXPIRED,2023-01-01
```

### G. Payments (payments.csv)
*Common for all scenarios.*
```csv
ContactId,Email,Amount,Date,TransactionId,Status
101,user1@example.com,100.00,2023-12-01,txn_001,PAID
201,cancelled1@example.com,50.00,2023-11-01,txn_002,PAID
401,admin@practice.com,200.00,2023-12-15,txn_003,PAID
```
