# GitHub Secrets Configuration

This document lists all 38 GitHub secrets configured for the Vacademy Platform CI/CD pipelines and deployment workflows.

## 🔐 Required GitHub Secrets

### Core Application Secrets

| Secret Name | Description | Used In |
|-------------|-------------|---------|
| `DB_PASSWORD` | Database password for all services | All services |
| `DB_USERNAME` | Database username for all services | All services |
| `APP_USERNAME` | Application username for internal auth | All services |
| `APP_PASSWORD` | Application password for internal auth | All services |
| `SCHEDULING_TIME_FRAME` | Time frame for notification scheduling | Assessment service |

### Service URLs (Production/Staging)

| Secret Name | Description | Used In |
|-------------|-------------|---------|
| `AUTH_SERVER_BASE_URL` | Base URL for auth service | All services |
| `ADMIN_CORE_SERVICE_BASE_URL` | Base URL for admin core service | Auth, Assessment |
| `NOTIFICATION_SERVER_BASE_URL` | Base URL for notification service | All services |
| `MEDIA_SERVICE_BASE_URL` | Base URL for media service | Assessment |
| `ASSESSMENT_SERVER_BASE_URL` | Base URL for assessment service | Admin, Media |
| `CLOUD_FRONT_URL` | CloudFront distribution URL | All services |

### Database URLs (Production/Staging)

| Secret Name | Description | Used In |
|-------------|-------------|---------|
| `AUTH_SERVICE_DB_URL` | Auth service database URL | Auth service |
| `ADMIN_CORE_SERVICE_DB_URL` | Admin core service database URL | Admin service |
| `COMMUNITY_SERVICE_DB_URL` | Community service database URL | Community service |
| `ASSESSMENT_SERVICE_DB_URL` | Assessment service database URL | Assessment service |
| `MEDIA_SERVICE_DB_URL` | Media service database URL | Media service |
| `NOTIFICATION_SERVICE_DB_URL` | Notification service database URL | Notification service |

### OAuth & Authentication

| Secret Name | Description | Used In |
|-------------|-------------|---------|
| `GOOGLE_CLIENT_ID` | Google OAuth2 client ID | Auth service |
| `GOOGLE_CLIENT_SECRET` | Google OAuth2 client secret | Auth service |
| `OAUTH_GITHUB_CLIENT_ID` | GitHub OAuth2 client ID | Auth service |
| `OAUTH_GITHUB_CLIENT_SECRET` | GitHub OAuth2 client secret | Auth service |

### AWS Configuration

| Secret Name | Description | Used In |
|-------------|-------------|---------|
| `S3_AWS_ACCESS_KEY` | AWS S3 access key | Media service |
| `S3_AWS_ACCESS_SECRET` | AWS S3 secret key | Media service |
| `AWS_BUCKET_NAME` | S3 bucket name for media | Media service |
| `AWS_S3_PUBLIC_BUCKET` | S3 public bucket name | Media service |

### Email Configuration

| Secret Name | Description | Used In |
|-------------|-------------|---------|
| `MAIL_HOST` | SMTP server host | Notification service |
| `MAIL_PORT` | SMTP server port | Notification service |
| `AWS_MAIL_USERNAME` | AWS SES SMTP username | Notification service |
| `AWS_MAIL_PASSWORD` | AWS SES SMTP password | Notification service |
| `SES_SENDER_EMAIL` | Sender email address | Notification service |

### External API Keys

| Secret Name | Description | Used In |
|-------------|-------------|---------|
| `OPENROUTER_API_KEY` | OpenRouter API key for AI services | Media service |
| `GEMINI_API_KEY` | Google Gemini API key | Media service |
| `YOUTUBE_API_KEY` | YouTube Data API key | Media service |
| `DEEPSEEK_API_KEY` | DeepSeek API key for AI services | Media service |

### Communication Services

| Secret Name | Description | Used In |
|-------------|-------------|---------|
| `WHATSAPP_ACCESS_TOKEN` | WhatsApp Business API token | Notification service |

### Build & Deployment (Existing)

| Secret Name | Description | Used In |
|-------------|-------------|---------|
| `JAVA_TOKEN` | GitHub token for Maven packages | All build workflows |
| `ACCESS_GITHUB_USERNAME` | GitHub username for packages | All build workflows |
| `AWS_ACCESS_KEY` | AWS access key for ECR | All build workflows |
| `AWS_SECRET_ACCESS_KEY` | AWS secret key for ECR | All build workflows |

## ✅ GitHub Secrets Status

### Configuration Complete
All 38 secrets have been configured in the repository under **Settings** > **Secrets and variables** > **Actions**.

### Secret Organization
Secrets are organized by category:
- **5** Core Application secrets
- **6** Service URL secrets  
- **6** Database URL secrets
- **4** OAuth & Authentication secrets
- **4** AWS Configuration secrets
- **5** Email Configuration secrets
- **4** External API Keys
- **1** Communication service secret
- **4** Build & Deployment secrets (existing)

### Environment Management
For different environments, update the URL and database secrets accordingly:
- **Staging**: Current configuration points to stage environment
- **Production**: Update URLs and database connections for production deployment

## 🚀 Workflow Usage

### Local Development Test Workflow

The `local-development-test.yml` workflow uses these secrets to:
- Test Docker Compose configuration
- Validate environment variable resolution
- Ensure database connectivity
- Verify service startup

### Service Deployment Workflows

Each service deployment workflow (e.g., `maven-publish-auth-service.yml`) uses:
- Build secrets (`JAVA_TOKEN`, `ACCESS_GITHUB_USERNAME`)
- AWS secrets for ECR push (`AWS_ACCESS_KEY`, `AWS_SECRET_ACCESS_KEY`)

## 🔍 Security Best Practices

1. **Rotate Secrets Regularly**: Update API keys and tokens periodically
2. **Use Environment Separation**: Different secrets for dev/staging/prod
3. **Minimal Permissions**: Grant only necessary permissions to each secret
4. **Monitor Usage**: Review secret usage in workflow logs
5. **Never Log Secrets**: Ensure secrets are not printed in workflow outputs

## 🛠️ Local Development

For local development, the provided Docker Compose setup uses safe defaults that work out of the box:

```bash
# Use the automated setup script
./local-dev-setup.sh
```

For production-like local testing, you can create a local `.env` file with actual values, but ensure it's never committed to version control.

## 📞 References

For additional information:
1. **Application Properties**: Updated `application-stage.properties` files in each service
2. **Docker Compose**: Local development environment variable mappings
3. **Workflows**: GitHub Actions deployment configurations
4. **Migration Guide**: `STAGE_PROPERTIES_MIGRATION_UPDATE.md` for complete migration details

---

**Status**: ✅ All 38 secrets configured
**Environment**: Stage/Production deployment ready
**Services**: Auth, Admin Core, Community, Assessment, Media, Notification 