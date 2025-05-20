# AI enabled Open-Source LMS

[![Ask DeepWiki](https://deepwiki.com/badge.svg)](https://deepwiki.com/Vacademy-io/vacademy_platform)

# Frontend Code Deployment Instructions

This document provides detailed instructions for deploying the frontend applications of the Vacademy platform. These instructions should be included in the project's `README.md` file.

## Frontend Applications Overview

The Vacademy platform includes two frontend applications:

1. **Learner Dashboard** (`frontend-learner-dashboard`): A mobile-focused application built with Ionic/Capacitor.
2. **Admin Dashboard** (`frontend-admin-dashboard`): A web-based administrative dashboard built with React and Vite.

## Deploying the Admin Dashboard

### Prerequisites

- **Node.js**: Version 21.0.0 or compatible
- **pnpm**: Package manager

### Building for Production

1. **Navigate to the admin dashboard directory**:
   ```bash
   cd frontend-admin-dashboard
   ```

2. **Install dependencies**:
   ```bash
   pnpm install
   ```

3. **Build the application**:
   ```bash
   pnpm run build
   ```
   This command runs the TypeScript compiler and builds the application for production.

4. **Preview the production build locally** (optional):
   ```bash
   pnpm run serve
   ```
   This uses Vite's preview functionality to serve the production build locally.

### Deployment Options

#### Static Hosting Deployment

The built application can be deployed to any static hosting service:

1. The production build will be available in the `dist/` directory after running the build command.
2. Deploy to services such as:
   - AWS S3 + CloudFront
   - Netlify
   - Vercel
   - GitHub Pages
   - Firebase Hosting

#### Docker Deployment

For containerized deployment:

1. **Create a Dockerfile** in the `frontend-admin-dashboard` directory:
   ```dockerfile
   FROM node:21-alpine AS build
   WORKDIR /app
   RUN npm install -g pnpm
   COPY package.json pnpm-lock.yaml ./
   RUN pnpm install
   COPY . .
   RUN pnpm run build

   FROM nginx:alpine
   COPY --from=build /app/dist /usr/share/nginx/html
   COPY nginx.conf /etc/nginx/conf.d/default.conf
   EXPOSE 80
   CMD ["nginx", "-g", "daemon off;"]
   ```

2. **Create a basic `nginx.conf`**:
   ```nginx
   server {
     listen 80;
     server_name _;
     root /usr/share/nginx/html;
     index index.html;
     
     location / {
       try_files $uri $uri/ /index.html;
     }
   }
   ```

3. **Build and run the Docker container**:
   ```bash
   docker build -t vacademy/admin-dashboard .
   docker run -p 8080:80 vacademy/admin-dashboard
   ```

### Environment Variables

For environment-specific configuration:

1. Create environment files for different environments:
   - `.env.development` - Development environment variables
   - `.env.production` - Production environment variables
   - `.env.staging` - Staging environment variables

2. Configure variables such as API endpoints, authentication URLs, etc.
3. Access variables in code using `import.meta.env.VITE_VARIABLE_NAME`.

## Deploying the Learner Dashboard

### Prerequisites

- **Node.js**: Version 21.0.0
- **pnpm**: Package manager
- **Java**: Version 21 (for Android builds)
- **Android Studio**: For Android builds
- **Xcode**: For iOS builds (macOS only)

### Web Deployment

1. **Navigate to the learner dashboard directory**:
   ```bash
   cd frontend-learner-dashboard
   ```

2. **Install dependencies**:
   ```bash
   pnpm install
   ```

3. **Build for web**:
   ```bash
   pnpm run build
   ```

4. The production build will be available in the `dist/` directory.

### Mobile App Deployment

#### Android

1. **Build the web assets**:
   ```bash
   pnpm run build
   ```

2. **Copy web assets to the Android project**:
   ```bash
   npx cap copy android
   ```

3. **Open in Android Studio**:
   ```bash
   npx cap open android
   ```

4. **Generate a signed APK/AAB** from Android Studio:
   - Go to **Build → Generate Signed Bundle/APK**
   - Follow the prompts to create or use an existing keystore
   - Choose between APK (for direct installation) or AAB (for Play Store)

5. **For Google Play Store deployment**:
   - Create a developer account if you don't have one
   - Create a new application in the Play Console
   - Upload the AAB file in the Production, Beta, or Alpha track
   - Complete the store listing, content rating, and pricing details
   - Submit for review

#### iOS (macOS only)

1. **Build the web assets**:
   ```bash
   pnpm run build
   ```

2. **Copy web assets to the iOS project**:
   ```bash
   npx cap copy ios
   ```

3. **Open in Xcode**:
   ```bash
   npx cap open ios
   ```

4. **Configure signing in Xcode**:
   - Select the project in the Project Navigator
   - Go to the **Signing & Capabilities** tab
   - Sign in with your Apple Developer account
   - Select a team and provisioning profile

5. **Archive for App Store**:
   - Set the device target to **Any iOS Device**
   - Select **Product → Archive**
   - In the Archives window, click **Distribute App**
   - Follow the prompts for App Store distribution

## CI/CD Integration

For automated deployments, create GitHub Actions workflow files in the `.github/workflows/` directory.

### For Admin Dashboard

```yaml
name: Deploy Admin Dashboard

on:
  push:
    branches: [main]
    paths:
      - 'frontend-admin-dashboard/**'

jobs:
  build-and-deploy:
    runs-on: ubuntu-latest
    
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '21'
      
      - name: Install pnpm
        run: npm install -g pnpm
      
      - name: Install dependencies
        run: |
          cd frontend-admin-dashboard
          pnpm install
      
      - name: Build
        run: |
          cd frontend-admin-dashboard
          pnpm run build
        
      # Add deployment steps based on your hosting solution
      # Example for AWS S3:
      # - name: Deploy to S3
      #   uses: jakejarvis/s3-sync-action@master
      #   with:
      #     args: --acl public-read --follow-symlinks --delete
      #   env:
      #     AWS_S3_BUCKET: ${{ secrets.AWS_S3_BUCKET }}
      #     AWS_ACCESS_KEY_ID: ${{ secrets.AWS_ACCESS_KEY_ID }}
      #     AWS_SECRET_ACCESS_KEY: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
      #     SOURCE_DIR: 'frontend-admin-dashboard/dist'
```

### For Learner Dashboard Web Version

```yaml
name: Deploy Learner Dashboard Web

on:
  push:
    branches: [main]
    paths:
      - 'frontend-learner-dashboard/**'

jobs:
  build-and-deploy:
    runs-on: ubuntu-latest
    
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '21'
      
      - name: Install pnpm
        run: npm install -g pnpm
      
      - name: Install dependencies
        run: |
          cd frontend-learner-dashboard
          pnpm install
      
      - name: Build
        run: |
          cd frontend-learner-dashboard
          pnpm run build
        
      # Add deployment steps based on your hosting solution
```

## Best Practices

1. **Environment Configuration**:
   - Use `.env` files for environment-specific variables
   - Never commit sensitive information to the repository
   - Use CI/CD secrets for sensitive data

2. **Performance Optimization**:
   - Enable gzip/Brotli compression on your web server
   - Implement proper cache headers
   - Use a CDN for static assets

3. **Security**:
   - Implement CSP (Content Security Policy)
   - Configure proper CORS headers
   - Use HTTPS for all environments, including development

4. **Monitoring and Analytics**:
   - Implement error tracking (e.g., Sentry)
   - Set up usage analytics
   - Configure uptime monitoring

## Notes

- These deployment instructions assume you have appropriate access to deployment infrastructure.
- Mobile app deployments require developer accounts for the respective app stores.
- The CI/CD examples need to be adapted to your specific hosting solution.
- For containerized deployments, ensure your container orchestration system is properly configured to handle frontend services.
- For development setup, refer to the individual README files in each frontend directory.

# Vacademy.io Microservices

This repository contains the backend microservices architecture for [Vacademy.io](https://vacademy.io), built with **Spring Boot** and deployed on **Kubernetes**.

## Project Overview

Vacademy.io services is a microservices-based backend system powering the Vacademy platform. The repository is structured as a Maven monorepo containing multiple independent but interconnected services.

## Architecture

The system consists of the following microservices:

- **Common Service**: Shared utilities, models, and configurations (`pom.xml:12`)
- **Admin Core Service**: Administrative functionalities (`pom.xml:12-15`)
- **Auth Service**: Authentication and authorization (`pom.xml:14`)
- **Media Service**: Media file handling and storage (`pom.xml:13`)
- **Community Service**: Community features and interactions (`pom.xml:16`)
- **Assessment Service**: Assessment and evaluation features
- **Notification Service**: Notification management (`pom.xml:17`)

## Prerequisites

To run this project, you'll need:

- **Java 17** (`pom.xml:17`)
- **Maven 3.8+** (`Dockerfile:2`)
- **Docker** and **Docker Compose** (for containerization)
- **PostgreSQL** (`pom.xml:30-33`)
- **AWS account** with S3 access (`pom.xml:58-60`)
- **GitHub Personal Access Token** (for accessing GitHub packages) (`settings.xml:30-43`)

## Installation

### 1. Clone the Repository

```bash
git clone https://github.com/Vacademy-io/services.git
cd services
```

### 2. Configure GitHub Packages Authentication

Create a GitHub Personal Access Token with `read:packages` scope and set it as an environment variable:

```bash
export JAVA_TOKEN=your_github_token
```

The Maven settings file is already configured to use this token (`settings.xml:30-43`).

### 3. Build the Project

```bash
mvn clean install -DskipTests
```

## Configuration Changes for Independent Deployment

To run the services independently, make the following changes:

### 1. Database Configuration

For each service, create an `application.properties` or `application.yml` file in the `src/main/resources` directory with the following PostgreSQL configuration:

```properties
# Database Configuration
spring.datasource.url=jdbc:postgresql://localhost:5432/vacademy_[service_name]
spring.datasource.username=postgres
spring.datasource.password=your_password
spring.jpa.hibernate.ddl-auto=update
spring.jpa.properties.hibernate.dialect=org.hibernate.dialect.PostgreSQLDialect
```

### 2. AWS S3 Configuration

For services that utilize S3 (e.g., `media_service`), add the following to your configuration file:

```properties
# AWS Configuration
aws.accessKey=your_aws_access_key
aws.secretKey=your_aws_secret_key
aws.region=your_aws_region
aws.s3.bucket=your_s3_bucket_name
```

### 3. Service Port Configuration

Configure unique ports for each service to avoid conflicts:

```properties
# Server configuration
server.port=8080  # Change for each service
```

## Running Services Locally

### Option 1: Run with Maven

Navigate to the specific service directory and run:

```bash
cd [service_name]
mvn spring-boot:run
```

### Option 2: Run with Docker

Build and run Docker containers for each service:

```bash
cd [service_name]
docker build -t vacademy/[service_name] .
docker run -p 8080:8080 vacademy/[service_name]
```

For example, for the `assessment_service` (`Dockerfile:1-39`).

## Deployment

The repository is configured for deployment to a **Kubernetes cluster** (Linode Kubernetes Engine). The deployment is automated through **GitHub Actions** workflows (`lke-deployment.yml:1-70`).

To deploy to your own Kubernetes cluster:

1. Set up a Kubernetes cluster.
2. Configure the necessary secrets for AWS and Kubernetes access.
3. Update the deployment YAML files with your image repositories and configuration.
4. Apply the Kubernetes manifests.

## API Documentation

Each service exposes **Swagger UI** for API documentation at the `/swagger-ui.html` endpoint (`pom.xml:47-51`).

## Contributing

1. Fork the repository.
2. Create a feature branch.
3. Commit your changes.
4. Push to the branch.
5. Create a new Pull Request.

## Notes

- This is an **open-source project**, and contributions are welcome.
- The services require a valid **GitHub token** to access shared dependencies from GitHub packages.
- Some services may require additional configuration for specific features like PDF generation, email notifications, etc.
- Database schema initialization and migration scripts are not included in this README but may be necessary for a complete setup.
