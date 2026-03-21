# 🔍 STAGING ENVIRONMENT - SHORT URL VERIFICATION GUIDE

## ⚠️ CRITICAL CONFIGURATION ISSUES FOUND

### **Issue 1: Missing `short.link.base.url` Configuration**

**Location:** `admin_core_service/src/main/java/.../ShortLinkIntegrationService.java` (line 22)

**Current Default Value:** `https://backend-stage.vacademy.io`

**Problem:** This property is NOT explicitly set in `application-stage.properties`. The system is using the hardcoded default value.

**Impact:** 
- ✅ If your staging backend URL is `https://backend-stage.vacademy.io`, it will work
- ❌ If your staging backend URL is different, short URLs will be **INCORRECT**

**Fix Required:**
Add to `admin_core_service/src/main/resources/application-stage.properties`:
```properties
short.link.base.url=https://backend-stage.vacademy.io
```

---

## 📋 VERIFICATION CHECKLIST

### **Step 1: Verify Configuration**

Check the following properties in **STAGING** environment:

#### **admin_core_service/application-stage.properties**
- ✅ `default.learner.portal.url=https://learner.vacademy.io`
- ✅ `default.learner.portal.enroll_invite_path=/learner-invitation-response`
- ✅ `default.learner.portal.coupon_path=/coupon`
- ❓ `short.link.base.url` - **MISSING** (using default: https://backend-stage.vacademy.io)
- ✅ `media.server.baseurl=${MEDIA_SERVER_BASE_URL}`

#### **media_service/application-stage.properties**
- ❓ No short URL specific configuration found

---

### **Step 2: Test Short URL Creation**

#### **Test 1: Create Enrollment Invite**

**Endpoint:** `POST https://backend-stage.vacademy.io/admin-core-service/v1/enroll-invite`

**Expected Behavior:**
1. EnrollInvite is created successfully
2. A short URL is generated and stored in `short_url` field
3. Short URL format: `https://backend-stage.vacademy.io/s/{shortCode}`
4. Example: `https://backend-stage.vacademy.io/s/AbCd12`

**Verification:**
```bash
# Check the response
{
  "id": "...",
  "inviteCode": "abc123",
  "shortUrl": "https://backend-stage.vacademy.io/s/AbCd12",  # ← Should be present
  ...
}
```

#### **Test 1.1: Get Enrollment Invite**

**Endpoint:** `GET https://backend-stage.vacademy.io/admin-core-service/v1/enroll-invite/{instituteId}/{enrollInviteId}`

**Expected Behavior:**
Response JSON must contain `"shortUrl": "..."`.

**Verification:**
```bash
curl https://backend-stage.vacademy.io/admin-core-service/v1/enroll-invite/{instituteId}/{enrollInviteId}
```

---

#### **Test 2: Create Coupon Code**

**Endpoint:** `POST https://backend-stage.vacademy.io/admin-core-service/v1/coupon-code`

**Expected Behavior:**
1. CouponCode is created successfully
2. A short URL is generated and stored in `short_url` field
3. Short URL format: `https://backend-stage.vacademy.io/s/{shortCode}`

**Verification:**
```bash
# Check the response
{
  "id": "...",
  "code": "ABC123",
  "shortUrl": "https://backend-stage.vacademy.io/s/XyZ789",  # ← Should be present
  ...
}
```

#### **Test 2.1: Get Coupon Code**

**Endpoint:** `GET https://backend-stage.vacademy.io/admin-core-service/coupon/v1/by-code?code=ABC123`

**Expected Behavior:**
Response JSON must contain `"shortUrl": "..."`.

**Verification:**
```bash
curl "https://backend-stage.vacademy.io/admin-core-service/coupon/v1/by-code?code=ABC123"
```

---

### **Step 3: Test Short URL Redirection**

#### **Test 3: Access Short URL in Browser**

**URL:** `https://backend-stage.vacademy.io/s/{shortCode}`

**Expected Behavior:**
1. Browser is redirected (HTTP 302) to the destination URL
2. For EnrollInvite: Redirects to `https://learner.vacademy.io/learner-invitation-response?instituteId=X&inviteCode=Y`
3. For CouponCode: Redirects to `https://learner.vacademy.io/coupon?couponCode=ABC123`

**Verification:**
```bash
# Test with curl
curl -I https://backend-stage.vacademy.io/s/{shortCode}

# Expected response:
HTTP/1.1 302 Found
Location: https://learner.vacademy.io/learner-invitation-response?instituteId=...
```

---

#### **Test 4: Get Short URL Info (JSON)**

**URL:** `https://backend-stage.vacademy.io/s/{shortCode}/info`

**Expected Response:**
```json
{
  "shortCode": "AbCd12",
  "destinationUrl": "https://learner.vacademy.io/learner-invitation-response?instituteId=X&inviteCode=Y"
}
```

---

### **Step 4: Test Update Operations**

#### **Test 5: Update Enrollment Invite**

**Endpoint:** `PUT https://backend-stage.vacademy.io/admin-core-service/v1/enroll-invite/{id}`

**Expected Behavior:**
1. EnrollInvite is updated successfully
2. Short URL destination is updated in media-service
3. Short URL code remains the same, but destination URL changes

**Verification:**
```bash
# Access the short URL again
curl -I https://backend-stage.vacademy.io/s/{shortCode}

# Should redirect to UPDATED destination URL
```

---

### **Step 5: Test Delete Operations**

#### **Test 6: Delete Enrollment Invite**

**Endpoint:** `DELETE https://backend-stage.vacademy.io/admin-core-service/v1/enroll-invite/{id}`

**Expected Behavior:**
1. EnrollInvite status is set to "DELETED"
2. Short URL status is set to "DELETED" in media-service
3. Accessing the short URL returns an error

**Verification:**
```bash
# Try to access the deleted short URL
curl https://backend-stage.vacademy.io/s/{shortCode}

# Expected: Error message (404 or "Short link is not active")
```

---

## 🐛 COMMON ISSUES & TROUBLESHOOTING

### **Issue 1: Short URL is NULL**

**Symptoms:** `shortUrl` field is `null` in the response

**Possible Causes:**
1. ❌ Media service is not reachable from admin-core-service
2. ❌ HMAC authentication is failing
3. ❌ Database connection issue in media-service

**Debug Steps:**
```bash
# Check admin-core-service logs
kubectl logs -f deployment/admin-core-service -n vacademy-stage | grep "short"

# Check media-service logs
kubectl logs -f deployment/media-service -n vacademy-stage | grep "short"

# Look for errors like:
# - "Failed to create short link via media service"
# - "Error communicating with media service"
# - 401 Unauthorized
# - 403 Forbidden
```

---

### **Issue 2: Short URL Returns 404**

**Symptoms:** Accessing `https://backend-stage.vacademy.io/s/{shortCode}` returns 404

**Possible Causes:**
1. ❌ Gateway/Nginx is not routing `/s/**` to media-service
2. ❌ Short URL was not created in database
3. ❌ Short code is incorrect

**Debug Steps:**
```bash
# Check if short link exists in database
SELECT * FROM short_link WHERE short_name = '{shortCode}';

# Check Nginx/Gateway configuration
# Ensure /s/** routes to media-service
```

---

### **Issue 3: Wrong Base URL**

**Symptoms:** Short URL is `http://localhost:8075/s/...` or wrong domain

**Possible Causes:**
1. ❌ `short.link.base.url` is not configured correctly
2. ❌ Using default value instead of staging value

**Fix:**
Add to `application-stage.properties`:
```properties
short.link.base.url=https://backend-stage.vacademy.io/s
```

---

### **Issue 4: 401 Unauthorized from Media Service**

**Symptoms:** Logs show "401 Unauthorized" when creating short links

**Possible Causes:**
1. ❌ HMAC authentication is failing
2. ❌ `APP_USERNAME` and `APP_PASSWORD` mismatch between services

**Fix:**
Verify environment variables match:
```bash
# Check admin-core-service
kubectl get secret admin-core-service-secrets -n vacademy-stage -o yaml

# Check media-service
kubectl get secret media-service-secrets -n vacademy-stage -o yaml

# Ensure APP_USERNAME and APP_PASSWORD are identical
```

---

## ✅ EXPECTED FLOW (WORKING CORRECTLY)

### **Create Enrollment Invite Flow:**

```
1. User calls: POST /admin-core-service/v1/enroll-invite
   ↓
2. EnrollInviteService.createEnrollInvite()
   ↓
3. Save EnrollInvite to database
   ↓
4. Build destination URL:
   https://learner.vacademy.io/learner-invitation-response?instituteId=X&inviteCode=Y
   ↓
5. Call ShortUrlManagementService.createShortUrl()
   ↓
6. Call ShortLinkIntegrationService.createShortLink()
   ↓
7. Generate random code (e.g., "AbCd12")
   ↓
8. Make HMAC request to media-service:
   POST /media-service/internal/v1/short-link/create
   ↓
9. Media-service saves to database:
   short_name: "AbCd12"
   destination_url: "https://learner.vacademy.io/learner-invitation-response?..."
   source: "ENROLL_INVITE"
   source_id: "{enrollInviteId}"
   status: "ACTIVE"
   ↓
10. Return short URL: https://backend-stage.vacademy.io/s/AbCd12
    ↓
11. Save short URL to EnrollInvite.shortUrl
    ↓
12. Return response to user
```

### **Access Short URL Flow:**

```
1. User opens: https://backend-stage.vacademy.io/s/AbCd12
   ↓
2. Gateway/Nginx routes to media-service
   ↓
3. PublicShortLinkController.redirectShortLink()
   ↓
4. ShortLinkService.getDestinationUrlAndLogAccess()
   ↓
5. Query database: SELECT * FROM short_link WHERE short_name = 'AbCd12'
   ↓
6. Check status = 'ACTIVE'
   ↓
7. Update last_queried_at timestamp
   ↓
8. Return destination URL
   ↓
9. Send HTTP 302 redirect to browser
   ↓
10. Browser redirects to:
    https://learner.vacademy.io/learner-invitation-response?instituteId=X&inviteCode=Y
```

---

## 🧪 QUICK TEST COMMANDS

### **Test 1: Create and Verify Enrollment Invite**
```bash
# Create enrollment invite
curl -X POST https://backend-stage.vacademy.io/admin-core-service/v1/enroll-invite \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{...}'

# Copy the shortUrl from response
# Example: https://backend-stage.vacademy.io/s/AbCd12

# Test redirection
curl -I https://backend-stage.vacademy.io/s/AbCd12

# Test info endpoint
curl https://backend-stage.vacademy.io/s/AbCd12/info
```

### **Test 2: Check Database**
```sql
-- Check if short link was created
SELECT id, short_name, destination_url, source, source_id, status, created_at 
FROM short_link 
WHERE source = 'ENROLL_INVITE' 
ORDER BY created_at DESC 
LIMIT 10;

-- Check if short link was created for specific invite
SELECT * FROM short_link 
WHERE source = 'ENROLL_INVITE' 
AND source_id = '{enrollInviteId}';
```

---

## 📊 SUCCESS CRITERIA

Your staging environment is working correctly if:

- ✅ Creating EnrollInvite returns a valid `shortUrl`
- ✅ Creating CouponCode returns a valid `shortUrl`
- ✅ Short URL format is `https://backend-stage.vacademy.io/s/{shortCode}`
- ✅ Accessing short URL redirects to correct destination
- ✅ Updating entity updates the short URL destination
- ✅ Deleting entity marks short URL as DELETED
- ✅ Deleted short URLs return error when accessed
- ✅ No errors in admin-core-service logs
- ✅ No errors in media-service logs

---

## 🔧 RECOMMENDED FIXES

### **1. Add Missing Configuration**

**File:** `admin_core_service/src/main/resources/application-stage.properties`

Add after line 43:
```properties
short.link.base.url=https://backend-stage.vacademy.io
```

### **2. Verify Gateway/Nginx Configuration**

Ensure `/s/**` routes to `media-service`:
```nginx
location /s/ {
    proxy_pass http://media-service:8075/s/;
}
```

### **3. Monitor Logs**

```bash
# Watch for short URL creation
kubectl logs -f deployment/admin-core-service -n vacademy-stage | grep -i "short"

# Watch for short URL access
kubectl logs -f deployment/media-service -n vacademy-stage | grep -i "short"
```

---

## 📞 NEXT STEPS

1. **Add the missing configuration** to `application-stage.properties`
2. **Redeploy** admin-core-service to staging
3. **Run the test commands** above
4. **Check the logs** for any errors
5. **Verify** all success criteria are met

If you encounter any issues, check the troubleshooting section above.





