# Learner Portal - Iframe Embedding Configuration

This document provides instructions to enable iframe embedding for audience/campaign forms on external websites.

## Problem

When trying to embed the audience response form (`/audience-response`) in an iframe on external websites, browsers block it with the error:

```
Refused to display 'https://learner.vacademy.io/...' in a frame because it set 'X-Frame-Options' to 'sameorigin'.
```

## Solution

We need to configure Cloudflare Pages to send appropriate headers that allow embedding for the `/audience-response` route only.

---

## Recommended Configuration

### Step 1: Create `_headers` file

Create a file named `_headers` (no extension) in your project's `public/` directory:

```
public/_headers
```

### Step 2: Add the following content

```
# ============================================
# Iframe Embedding Configuration for Forms
# ============================================
# Allow audience response forms to be embedded in iframes
# This is required for the "Embed Code" feature in Admin Dashboard

/audience-response
  X-Frame-Options: ALLOWALL
  Content-Security-Policy: frame-ancestors 'self' https://*.vacademy.io https://admin.vacademy.io https://admin-stage.vacademy.io *

/audience-response/*
  X-Frame-Options: ALLOWALL
  Content-Security-Policy: frame-ancestors 'self' https://*.vacademy.io https://admin.vacademy.io https://admin-stage.vacademy.io *

# ============================================
# Security Headers for All Other Pages
# ============================================
# Keep strict security for all other pages

/*
  X-Frame-Options: SAMEORIGIN
  X-Content-Type-Options: nosniff
  Referrer-Policy: strict-origin-when-cross-origin
```

---

## Configuration Breakdown

| Header                                     | Value            | Purpose                                                  |
| ------------------------------------------ | ---------------- | -------------------------------------------------------- |
| `X-Frame-Options: ALLOWALL`                | Allows embedding | Permits the page to be embedded in iframes               |
| `Content-Security-Policy: frame-ancestors` | Domain whitelist | Modern replacement for X-Frame-Options with more control |

### Domain Whitelist Explained

-   `'self'` - Same domain (learner.vacademy.io)
-   `https://*.vacademy.io` - All Vacademy subdomains
-   `https://admin.vacademy.io` - Production admin dashboard
-   `https://admin-stage.vacademy.io` - Staging admin dashboard
-   `*` - Any external website (for customer embed use cases)

---

## Security Considerations

### For Maximum Security (Recommended for Production)

If you want to restrict embedding to only known domains, remove `*` and list specific domains:

```
/audience-response
  X-Frame-Options: ALLOWALL
  Content-Security-Policy: frame-ancestors 'self' https://*.vacademy.io https://admin.vacademy.io https://admin-stage.vacademy.io https://customerdomain1.com https://customerdomain2.com
```

### For Maximum Flexibility (Allows Any Website)

To allow any website to embed the form (needed for "Embed Code" feature):

```
/audience-response
  X-Frame-Options: ALLOWALL
  Content-Security-Policy: frame-ancestors *
```

**Trade-off**: This allows anyone to embed your form, which could be used for phishing. However, since the form is public-facing and meant for lead collection, this is generally acceptable.

---

## Deployment Steps

1. **Add the `_headers` file** to your `public/` directory

2. **Commit and push** to your repository:

    ```bash
    git add public/_headers
    git commit -m "feat: enable iframe embedding for audience response forms"
    git push
    ```

3. **Cloudflare Pages will automatically deploy** with the new headers

4. **Clear Cloudflare Cache** (optional but recommended):
    - Go to Cloudflare Dashboard → Your Site → Caching → Purge Everything
    - Or use the API: `curl -X POST "https://api.cloudflare.com/client/v4/zones/{zone_id}/purge_cache" -H "Authorization: Bearer {token}" -d '{"purge_everything":true}'`

---

## Verification

After deployment, verify the headers are correctly applied:

### Using cURL

```bash
curl -I "https://learner.vacademy.io/audience-response?instituteId=test&audienceId=test"
```

Expected output should include:

```
x-frame-options: ALLOWALL
content-security-policy: frame-ancestors 'self' https://*.vacademy.io ...
```

### Using Browser DevTools

1. Open the audience response page in a browser
2. Open DevTools → Network tab
3. Refresh the page
4. Click on the document request
5. Check Response Headers

---

## Testing Embed

After deployment, test embedding in the Admin Dashboard:

1. Go to **Audience Manager** → Select a campaign
2. Click **Embed** button or go to menu → "Get Embed Code"
3. The preview iframe should now load correctly
4. Copy the embed code and test on an external HTML file

---

## Troubleshooting

### Headers not applying?

1. Make sure `_headers` file is in `public/` directory (not src/)
2. Verify file has no extension (not `_headers.txt`)
3. Check if Cloudflare cache needs purging
4. Confirm deployment completed successfully

### Still getting X-Frame-Options error?

1. Browser may have cached the old response - try incognito/private mode
2. Check if there's a different header source (Cloudflare Page Rules, Workers, etc.)
3. Verify the path pattern matches your URL structure

### CORS errors alongside?

Add CORS headers if needed:

```
/audience-response
  Access-Control-Allow-Origin: *
  X-Frame-Options: ALLOWALL
  Content-Security-Policy: frame-ancestors *
```

---

## Files Changed

| File              | Action          |
| ----------------- | --------------- |
| `public/_headers` | Create new file |

---

## Related Features

This change enables the following Admin Dashboard features:

1. **Embed Code Dialog** - Generate iframe embed code for external websites
2. **Button + Popup Embed** - Customizable button that opens form in a popup
3. **Direct iFrame Embed** - Standard iframe embed for landing pages
4. **Embed Preview** - Live preview of embeds in Admin Dashboard

---

## Contact

For questions about this configuration, contact the platform team.
