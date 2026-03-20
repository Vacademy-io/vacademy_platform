# Backend Task: Implement Trusted Login by Username Endpoint

## Context

Our SES email service is currently down, which means users cannot receive OTP codes for authentication. We need a **temporary** fallback endpoint that allows users to login using just their username (without OTP verification) for the Live Session login flow.

## Endpoint Details

### URL

```
POST /auth-service/learner/v1/login-by-username-trusted
```

### Request Body

```json
{
  "username": "string",
  "institute_id": "string"
}
```

### Response (Success - 200 OK)

```json
{
  "accessToken": "string (JWT)",
  "refreshToken": "string (JWT)"
}
```

### Response (Error - 404 Not Found)

```json
{
  "message": "User not found",
  "responseCode": "USER_NOT_FOUND"
}
```

### Response (Error - 400 Bad Request)

```json
{
  "message": "Username and institute_id are required",
  "responseCode": "INVALID_REQUEST"
}
```

## Implementation Requirements

1. **Lookup User**: Find the user by `username` and `institute_id` in the database
2. **Generate Tokens**: If user exists, generate `accessToken` and `refreshToken` (same as regular login flow)
3. **Token Validity**: Use the same token expiry as the existing `login-otp-ten-days` endpoint (10 days for access token)
4. **No Password/OTP Required**: This endpoint bypasses password and OTP verification

## Security Considerations

⚠️ **This is a TEMPORARY endpoint for emergency use only!**

Since this bypasses authentication, consider adding these safeguards:

1. **Feature Flag**: Add a server-side feature flag to enable/disable this endpoint

   ```java
   @Value("${security.trusted-login.enabled:false}")
   private boolean trustedLoginEnabled;
   ```

2. **Rate Limiting**: Implement aggressive rate limiting (e.g., 5 requests per minute per IP)

3. **Logging**: Log all requests to this endpoint for audit purposes

   ```java
   logger.warn("TRUSTED_LOGIN: User {} logged in via trusted endpoint from IP {}", username, requestIP);
   ```

4. **Optional IP Whitelist**: If possible, restrict to known IPs or internal networks

5. **Deprecation Plan**: Add a TODO to remove this endpoint once email service is restored

## Reference Implementation (Java/Spring)

```java
@RestController
@RequestMapping("/auth-service/learner/v1")
public class TrustedLoginController {

    @Value("${security.trusted-login.enabled:false}")
    private boolean trustedLoginEnabled;

    @Autowired
    private UserService userService;

    @Autowired
    private TokenService tokenService;

    @PostMapping("/login-by-username-trusted")
    public ResponseEntity<?> loginByUsernameTrusted(@RequestBody TrustedLoginRequest request) {

        // Check if feature is enabled
        if (!trustedLoginEnabled) {
            return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE)
                .body(Map.of("message", "Trusted login is currently disabled"));
        }

        // Validate request
        if (request.getUsername() == null || request.getInstituteId() == null) {
            return ResponseEntity.badRequest()
                .body(Map.of("message", "Username and institute_id are required"));
        }

        // Find user
        Optional<User> user = userService.findByUsernameAndInstitute(
            request.getUsername(),
            request.getInstituteId()
        );

        if (user.isEmpty()) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND)
                .body(Map.of("message", "User not found"));
        }

        // Log for audit
        log.warn("TRUSTED_LOGIN: User {} logged in via trusted endpoint", request.getUsername());

        // Generate tokens (same as regular login)
        String accessToken = tokenService.generateAccessToken(user.get(), Duration.ofDays(10));
        String refreshToken = tokenService.generateRefreshToken(user.get());

        return ResponseEntity.ok(Map.of(
            "accessToken", accessToken,
            "refreshToken", refreshToken
        ));
    }
}

@Data
class TrustedLoginRequest {
    private String username;
    private String instituteId;
}
```

## Frontend Usage

Once implemented, the frontend will:

1. Check if `EMAIL_OTP_VERIFICATION_ENABLED` is `false`
2. Call this endpoint directly with username from URL and instituteId
3. Skip the OTP step entirely
4. Use returned tokens for authentication

## Testing

1. Test with valid username + instituteId → Should return tokens
2. Test with invalid username → Should return 404
3. Test with missing fields → Should return 400
4. Test when feature flag is disabled → Should return 503

## Timeline

**Priority: HIGH** - This is blocking users from accessing live sessions

## Rollback Plan

Once email service is restored:

1. Set `security.trusted-login.enabled=false` in config
2. Update frontend: `EMAIL_OTP_VERIFICATION_ENABLED = true`
3. Remove this endpoint in next release

---

**Frontend Changes Ready**: The frontend is already prepared to use this endpoint once available. URL constant will be added as `LOGIN_BY_USERNAME_TRUSTED`.
