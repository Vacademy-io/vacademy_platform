# 🚨 Troubleshooting 511 Error - Network Authentication Required

## Current Issue
Getting `511 Network Authentication Required` error when calling the API endpoint:
```
POST https://backend-stage.vacademy.io/media-service/course/ai/v1/generate?instituteId=23103559-5632-42c9-b9ce-619d55fce3cb&model=google%2Fgemini-2.5-pro
```

## ✅ Fixes Applied
1. **Fixed Double URL Encoding**: Model parameter was being encoded twice (`google%252F` → `google%2F`)
2. **Enhanced Error Handling**: Added specific handling for 511 errors
3. **Added Debug Logging**: Console logs for request details and errors

## 🔧 Debugging Steps

### 1. Test API Endpoint Directly
Open browser console and run:
```javascript
window.testApiCall()
```
This will show detailed debugging information about:
- Authentication token status
- Institute ID extraction
- Exact URL being called
- Request payload
- Response/error details

### 2. Check Authentication
The 511 error typically indicates authentication issues. Verify:

**Check if user is properly authenticated:**
```javascript
// In browser console
document.cookie.includes('accessToken')
```

**Verify token is valid:**
```javascript
// Check if token exists and is not expired
const token = document.cookie.split(';').find(c => c.includes('accessToken'));
console.log('Token found:', !!token);
```

### 3. Possible Causes of 511 Error

1. **Corporate Network/Proxy**: Some corporate networks require additional authentication
2. **API Gateway Authentication**: The backend might require specific headers or authentication
3. **CORS Issues**: Cross-origin request restrictions
4. **Token Format**: The API might expect a different token format
5. **Missing Headers**: API might require specific headers we're not sending

### 4. Network Analysis
1. Open **DevTools** → **Network** tab
2. Send a message in AI Course Builder
3. Find the failed request to `/generate`
4. Check:
   - **Request Headers**: Verify Authorization header is present
   - **Response Headers**: Look for authentication requirements
   - **Response Body**: Check for specific error messages

### 5. Quick Fixes to Try

#### Option A: Check if endpoint is accessible
```javascript
// Test basic connectivity
fetch('https://backend-stage.vacademy.io/media-service/course/ai/v1/generate?instituteId=test&model=test', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({ prompt: 'test' })
})
.then(res => console.log('Status:', res.status))
.catch(err => console.log('Error:', err));
```

#### Option B: Test with different headers
Check if API requires specific headers by looking at working API calls in your application.

#### Option C: Verify Institute ID
```javascript
// Check the extracted institute ID
window.testApiCall().then(result => {
  console.log('Institute ID being used:', result);
});
```

### 6. Backend API Requirements
The 511 error suggests the API might require:

1. **Specific Authentication Headers**:
   ```javascript
   headers: {
     'Authorization': 'Bearer <token>',
     'X-Institute-Id': '<institute-id>',
     'Content-Type': 'application/json'
   }
   ```

2. **Different URL Format**: Maybe institute ID should be in headers, not query params

3. **API Key**: Additional API key requirement

### 7. What to Check with Backend Team

Ask your backend team:

1. **Is the endpoint active?** `https://backend-stage.vacademy.io/media-service/course/ai/v1/generate`
2. **What authentication is required?** Bearer token, API key, both?
3. **Should institute ID be in query params or headers?**
4. **Are there any CORS restrictions?**
5. **What's the expected request format?**

### 8. Temporary Workaround

If the issue persists, we can temporarily switch back to mock responses while debugging:

```typescript
// In ChatView.tsx, temporarily comment out the API call and use:
const aiResponse: Message = {
  id: (Date.now() + 1).toString(),
  type: 'ai',
  content: "⚠️ Using mock response while API issue is resolved. Backend API returned 511 error.",
  timestamp: new Date(),
  status: 'sent'
};
setMessages(prev => [...prev, aiResponse]);
```

## 📊 Current Debug Information

When you run `window.testApiCall()`, you'll see:
- ✅ Authentication token status
- ✅ Institute ID extraction
- ✅ Exact URL construction
- ✅ Request payload format
- ✅ Detailed error information

This will help identify the exact cause of the 511 error. 