# 🛠️ Local Native Development Setup

This guide details how to run Vacademy Platform microservices natively on your machine (without Docker Compose for the apps themselves). This is ideal for active development where you want to use your IDE's debugger.

## Prerequisite Checklist
- [ ] **Java JDK 17** installed.
- [ ] **Maven 3.8+** installed.
- [ ] **Python 3.10+** (for AI service).
- [ ] **PostgreSQL** running locally OR access to the remote dev database.
- [ ] **VS Code** (Recommended) or IntelliJ IDEA.

---

## 🚀 Option 1: VS Code (Recommended)

The easiest way to run services is to use the pre-configured Launch setup.

1. Create a folder named `.vscode` in the root of the project (if it doesn't exist).
2. Create a file named `launch.json` inside it: `.vscode/launch.json`.
3. Paste the following configuration. 
   
   **⚠️ IMPORTANT:** You must replace the `<PLACEHOLDERS>` with your actual secrets. Do not commit your real secrets to Git!

```json
{
    "version": "0.2.0",
    "configurations": [
        {
            "type": "java",
            "name": "Auth Service - Dev",
            "request": "launch",
            "mainClass": "vacademy.io.auth_service.AuthServiceApplication",
            "projectName": "auth_service",
            "cwd": "${workspaceFolder}/auth_service",
            "vmArgs": "-Xmx2g -Xms1g -Dfile.encoding=UTF-8",
            "env": {
                "SPRING_PROFILES_ACTIVE": "dev",
                "DB_HOST": "localhost",
                "DB_PORT": "5432",
                "DB_PASSWORD": "<YOUR_DB_PASSWORD>",
                "DB_USERNAME": "postgres",
                "APP_USERNAME": "admin",
                "APP_PASSWORD": "<YOUR_ADMIN_PASSWORD>",
                "AUTH_SERVICE_DB_URL": "jdbc:postgresql://localhost:5432/auth_service",
                "GOOGLE_CLIENT_ID": "<YOUR_GOOGLE_CLIENT_ID>",
                "GOOGLE_CLIENT_SECRET": "<YOUR_GOOGLE_SECRET>",
                "SENTRY_DSN": "<YOUR_SENTRY_DSN>"
            }
        },
        {
            "type": "java",
            "name": "Media Service - Dev",
            "request": "launch",
            "mainClass": "vacademy.io.media_service.MediaServiceApplication",
            "projectName": "media_service",
            "cwd": "${workspaceFolder}/media_service",
            "vmArgs": "-Xmx2g -Xms1g -Dfile.encoding=UTF-8",
            "env": {
                "SPRING_PROFILES_ACTIVE": "dev",
                "DB_HOST": "localhost",
                "DB_PORT": "5432",
                "DB_PASSWORD": "<YOUR_DB_PASSWORD>",
                "DB_USERNAME": "postgres",
                "APP_USERNAME": "admin",
                "APP_PASSWORD": "<YOUR_ADMIN_PASSWORD>",
                "AUTH_SERVER_BASE_URL": "http://localhost:8071",
                "ASSESSMENT_SERVER_BASE_URL": "http://localhost:8074",
                "CLOUD_FRONT_URL": "<YOUR_CLOUDFRONT_URL>",
                "MEDIA_SERVICE_DB_URL": "jdbc:postgresql://localhost:5432/media_service",
                "S3_AWS_ACCESS_SECRET": "<YOUR_AWS_SECRET>",
                "S3_AWS_ACCESS_KEY": "<YOUR_AWS_KEY>",
                "S3_AWS_REGION": "ap-south-1",
                "AWS_BUCKET_NAME": "vacademy-media-bucket",
                "AWS_S3_PUBLIC_BUCKET": "vacademy-public-bucket",
                "OPENROUTER_API_KEY": "<YOUR_OPENROUTER_KEY>",
                "GEMINI_API_KEY": "<YOUR_GEMINI_KEY>",
                "YOUTUBE_API_KEY": "<YOUR_YOUTUBE_KEY>",
                "UNSPLASH_ACCESS_KEY": "<YOUR_UNSPLASH_KEY>",
                "DEEPSEEK_API_KEY": "<YOUR_DEEPSEEK_KEY>",
                "SENTRY_DSN": "<YOUR_SENTRY_DSN>"
            }
        },
        {
            "type": "java",
            "name": "Notification Service - Dev",
            "request": "launch",
            "mainClass": "vacademy.io.notification_service.NotificationServiceApplication",
            "projectName": "notification_service",
            "cwd": "${workspaceFolder}/notification_service",
            "vmArgs": "-Xmx2g -Xms1g -Dfile.encoding=UTF-8",
            "env": {
                "SPRING_PROFILES_ACTIVE": "dev",
                "DB_HOST": "localhost",
                "DB_PORT": "5432",
                "DB_PASSWORD": "<YOUR_DB_PASSWORD>",
                "DB_USERNAME": "postgres",
                "APP_USERNAME": "admin",
                "APP_PASSWORD": "<YOUR_ADMIN_PASSWORD>",
                "AUTH_SERVER_BASE_URL": "http://localhost:8071",
                "NOTIFICATION_SERVICE_DB_URL": "jdbc:postgresql://localhost:5432/notification_service",
                "MAIL_HOST": "email-smtp.ap-south-1.amazonaws.com",
                "MAIL_PORT": "587",
                "AWS_MAIL_PASSWORD": "<YOUR_SES_PASSWORD>",
                "AWS_MAIL_USERNAME": "<YOUR_SES_USERNAME>",
                "SES_SENDER_EMAIL": "support@vacademy.io",
                "WHATSAPP_ACCESS_TOKEN": "<YOUR_WHATSAPP_TOKEN>",
                "SQS_AWS_ACCESS_KEY": "<YOUR_SQS_KEY>",
                "SQS_AWS_SECRET_KEY": "<YOUR_SQS_SECRET>",
                "SQS_AWS_REGION": "ap-south-1",
                "SENTRY_DSN": "<YOUR_SENTRY_DSN>"
            }
        },
        {
            "type": "java",
            "name": "Admin Core Service - Dev",
            "request": "launch",
            "mainClass": "vacademy.io.admin_core_service.AdminCoreServiceApplication",
            "projectName": "admin_core_service",
            "cwd": "${workspaceFolder}/admin_core_service",
            "vmArgs": "-Xmx2g -Xms1g -Dfile.encoding=UTF-8",
            "env": {
                "SPRING_PROFILES_ACTIVE": "dev",
                "DB_HOST": "localhost",
                "DB_PORT": "5432",
                "DB_PASSWORD": "<YOUR_DB_PASSWORD>",
                "DB_USERNAME": "postgres",
                "APP_USERNAME": "admin",
                "APP_PASSWORD": "<YOUR_ADMIN_PASSWORD>",
                "AUTH_SERVER_BASE_URL": "http://localhost:8071",
                "NOTIFICATION_SERVER_BASE_URL": "http://localhost:8076",
                "ASSESSMENT_SERVER_BASE_URL": "http://localhost:8074",
                "ADMIN_CORE_SERVICE_DB_URL": "jdbc:postgresql://localhost:5432/admin_core_service",
                "GEMINI_API_KEY": "<YOUR_GEMINI_KEY>",
                "OPENROUTER_API_KEY": "<YOUR_OPENROUTER_KEY>",
                "SENTRY_DSN": "<YOUR_SENTRY_DSN>"
            }
        },
        {
            "type": "java",
            "name": "Assessment Service - Dev",
            "request": "launch",
            "mainClass": "vacademy.io.assessment_service.AssessmentServiceApplication",
            "projectName": "assessment_service",
            "cwd": "${workspaceFolder}/assessment_service",
            "vmArgs": "-Xmx2g -Xms1g -Dfile.encoding=UTF-8",
            "env": {
                "SPRING_PROFILES_ACTIVE": "dev",
                "DB_HOST": "localhost",
                "DB_PORT": "5432",
                "DB_PASSWORD": "<YOUR_DB_PASSWORD>",
                "DB_USERNAME": "postgres",
                "APP_USERNAME": "admin",
                "APP_PASSWORD": "<YOUR_ADMIN_PASSWORD>",
                "AUTH_SERVER_BASE_URL": "http://localhost:8071",
                "NOTIFICATION_SERVER_BASE_URL": "http://localhost:8076",
                "MEDIA_SERVICE_BASE_URL": "http://localhost:8075",
                "ASSESSMENT_SERVICE_DB_URL": "jdbc:postgresql://localhost:5432/assessment_service",
                "SCHEDULING_TIME_FRAME": "30",
                "SENTRY_DSN": "<YOUR_SENTRY_DSN>"
            }
        },
        {
            "type": "java",
            "name": "Community Service - Dev",
            "request": "launch",
            "mainClass": "vacademy.io.community_service.CommunityServiceApplication",
            "projectName": "community_service",
            "cwd": "${workspaceFolder}/community_service",
            "vmArgs": "-Xmx2g -Xms1g -Dfile.encoding=UTF-8",
            "env": {
                "SPRING_PROFILES_ACTIVE": "dev",
                "DB_HOST": "localhost",
                "DB_PORT": "5432",
                "DB_PASSWORD": "<YOUR_DB_PASSWORD>",
                "DB_USERNAME": "postgres",
                "APP_USERNAME": "admin",
                "APP_PASSWORD": "<YOUR_ADMIN_PASSWORD>",
                "AUTH_SERVER_BASE_URL": "http://localhost:8071",
                "NOTIFICATION_SERVER_BASE_URL": "http://localhost:8076",
                "ASSESSMENT_SERVICE_DB_URL": "jdbc:postgresql://localhost:5432/assessment_service",
                "SENTRY_DSN": "<YOUR_SENTRY_DSN>"
            }
        },
        {
            "type": "python",
            "name": "AI Service - Local",
            "request": "launch",
            "module": "uvicorn",
            "args": ["main:app", "--host", "0.0.0.0", "--port", "8077", "--reload"],
            "cwd": "${workspaceFolder}/ai_service",
            "python": "${workspaceFolder}/ai_service/.venv/bin/python"
        }
    ]
}
```

### How to Run in VS Code
1. Click the **Run and Debug** icon on the left sidebar (or press `Cmd+Shift+D`).
2. Select the service you want to run from the dropdown (e.g., "Auth Service - Dev").
3. Click the green ▶️ play button.

---

## 💻 Option 2: Command Line (Terminal)

If you aren't using VS Code, you can run services directly from the terminal. You will need to export the environment variables manually or pass them inline.

### Running Java Services
Run the following command in the respective service directory:

```bash
cd auth_service  # Example: Change to the service directory

# Example: Running Auth Service
SPRING_PROFILES_ACTIVE=dev \
DB_HOST=localhost \
DB_PORT=5432 \
DB_PASSWORD=<YOUR_PASSWORD> \
DB_USERNAME=postgres \
APP_USERNAME=admin \
APP_PASSWORD=<YOUR_ADMIN_PASSWORD> \
AUTH_SERVICE_DB_URL=jdbc:postgresql://localhost:5432/auth_service \
mvn spring-boot:run
```

*> **Tip**: You can create a `.env` file and use a tool like `dotenv` or export them in your shell profile to avoid typing them every time.*

### Running AI Service (Python)

```bash
cd ai_service

# 1. Create and activate virtual environment
python3 -m venv .venv
source .venv/bin/activate  # On Windows: .venv\Scripts\activate

# 2. Install dependencies
pip install -r requirements.txt

# 3. Run the application
uvicorn main:app --host 0.0.0.0 --port 8077 --reload
```
