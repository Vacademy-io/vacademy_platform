# Vacademy Platform

[![Ask DeepWiki](https://deepwiki.com/badge.svg)](https://deepwiki.com/Vacademy-io/vacademy_platform)

## About

Vacademy is an AI-enabled, open-source Learning Management System (LMS) built with a microservices architecture. It provides comprehensive tools for educational institutions, instructors, and learners, including course management, assessment creation, study libraries, and learner tracking.

The platform features a robust backend powered by Spring Boot microservices and modern frontend applications built with React, ensuring scalability, flexibility, and maintainability while delivering a powerful educational experience.

## Features in Depth

### Course Management
- **Course Creation and Organization**: Create and organize courses with levels, subjects, modules, chapters, and slides.
- **Study Library**: Centralized repository for all educational content.
- **Document Management**: Upload, organize, and share educational documents in folder structures.

### User Management
- **Institute Management**: Create and manage educational institutions.
- **Batch Management**: Organize learners into batches for effective administration.
- **Faculty Management**: Manage faculty members and teaching staff.
- **Student Management**: Comprehensive tools for student enrollment, tracking, and management.
- **CSV Bulk Import**: Import students in bulk using CSV files.

### Assessment System
- **Assessment Creation**: Create various types of assessments and examinations.
- **Question Paper Management**: Design and manage question papers.
- **Live Testing**: Support for real-time examinations.
- **Homework Management**: Create and assign homework to learners.
- **AI-Powered Evaluation**: Automated assessment grading using AI.

### Learner Experience
- **Learner Dashboard**: Personalized dashboard for learners to access courses and track progress.
- **Study Materials**: Access to course materials, presentations, and documents.
- **Assessment Participation**: Take tests, exams, and complete homework assignments.
- **Progress Tracking**: Detailed progress reports and performance analytics.

### AI Features
- **VSmart Audio**: AI-powered audio processing tools.
- **VSmart Chat**: Intelligent chatbot assistance.
- **VSmart Extract**: Automatic extraction of information from documents.
- **VSmart Feedback**: AI-generated feedback on assessments.

### Presentation Mode
- **Interactive Presentations**: Create and deliver interactive course presentations.
- **Presenter Controls**: Advanced controls for presenters during live sessions.
- **Learner Participation**: Interactive features for learners during presentations.

### Reporting and Analytics
- **Learner Reports**: Comprehensive reports on learner performance.
- **Batch Reports**: Aggregate reports for batches of students.
- **Export Functionality**: Export reports in various formats.
- **Notification Settings**: Configure report notification preferences.

### Learner Tracking
- **Activity Logging**: Detailed tracking of learner activities.
- **Progress Monitoring**: Monitor individual and group progress through courses.
- **Engagement Metrics**: Measure student engagement with various course materials.

## Tech Stack

### Backend
- **Java 17**: Primary programming language.
- **Spring Boot**: Framework for building microservices.
- **Maven**: Dependency management and build tool.
- **PostgreSQL**: Primary database system.
- **AWS S3**: Cloud storage for media files.
- **Kubernetes**: Container orchestration for deployment.

### Frontend
- **React 18+**: JavaScript library for building user interfaces.
- **TypeScript**: Type-safe JavaScript.
- **Vite**: Next-generation frontend tooling.
- **TanStack Router**: Modern routing library.
- **TanStack Query**: Data fetching and state management.
- **TanStack Table**: Table UI components.
- **Radix UI**: Unstyled, accessible UI components.
- **Tailwind CSS**: Utility-first CSS framework.
- **Capacitor**: For mobile app development (learner dashboard).

### Tools & Utilities
- **Docker**: Containerization platform.
- **Swagger UI**: API documentation.
- **GitHub Actions**: CI/CD automation.
- **Storybook**: UI component development environment (admin dashboard).

## Backend and Its Services

The Vacademy platform uses a microservices architecture with the following specialized services:

### Common Service
Core utilities, models, and configurations shared across other services.

### Auth Service
Handles authentication and authorization, including user login, registration, and access control.

### Admin Core Service
Provides administrative functionalities for managing courses, users, and institutional operations, including:
- Course, module, subject, and chapter management.
- Slide creation and management.
- Learner invitation and enrollment.
- Institute and faculty management.
- Study library organization.
- Session management.

### Media Service
Handles media file uploading, processing, storage, and retrieval.

### Community Service
Manages community features and interactions between users.

### Assessment Service
Comprehensive assessment creation, management, and evaluation system, including:
- Assessment creation and scheduling.
- Question paper management.
- Automated evaluation.
- Reports and analytics.
- Participant management.

### Notification Service
Manages system notifications and communication to users.

## Installation Guidelines

### Prerequisites
Before installing Vacademy, ensure you have:
- **Java 17**
- **Maven 3.8+**
- **Docker** and **Docker Compose**
- **PostgreSQL**
- **AWS account** with S3 access
- **GitHub Personal Access Token** for accessing GitHub packages

### Backend Setup

1. **Clone the Repository**
   ```bash
   git clone https://github.com/Vacademy-io/services.git
   cd services
   ```

2. **Configure GitHub Packages Authentication**
   ```bash
   export JAVA_TOKEN=your_github_token
   ```

3. **Build the Project**
   ```bash
   mvn clean install -DskipTests
   ```

4. **Database Configuration**
   Create an `application.properties` or `application.yml` file in each service's `src/main/resources` directory:
   ```properties
   # Database Configuration
   spring.datasource.url=jdbc:postgresql://localhost:5432/vacademy_[service_name]
   spring.datasource.username=postgres
   spring.datasource.password=your_password
   spring.jpa.hibernate.ddl-auto=update
   spring.jpa.properties.hibernate.dialect=org.hibernate.dialect.PostgreSQLDialect
   ```

5. **AWS S3 Configuration**
   ```properties
   # AWS Configuration
   aws.accessKey=your_aws_access_key
   aws.secretKey=your_aws_secret_key
   aws.region=your_aws_region
   aws.s3.bucket=your_s3_bucket_name
   ```

6. **Service Port Configuration**
   ```properties
   # Server configuration
   server.port=8080  # Change for each service
   ```

### Running Services Locally

#### Option 1: Run with Maven
```bash
cd [service_name]
mvn spring-boot:run
```

#### Option 2: Run with Docker
```bash
cd [service_name]
docker build -t vacademy/[service_name] .
docker run -p 8080:8080 vacademy/[service_name]
```

### Frontend Setup

#### Learner Dashboard
1. Navigate to the learner dashboard directory:
   ```bash
   cd frontend-learner-dashboard
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Run the development server:
   ```bash
   npm run dev
   ```

#### Admin Dashboard
1. Navigate to the admin dashboard directory:
   ```bash
   cd frontend-admin-dashboard
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Run the development server:
   ```bash
   npm run dev
   ```

## Frontend

The Vacademy platform features two distinct frontend applications:

### Learner Dashboard
A responsive, mobile-first application designed for learners to access educational content and participate in assessments.

**Key Features:**
- Responsive design with Capacitor for mobile app capabilities.
- Course library access and navigation.
- Assessment participation.
- Progress tracking.
- Notification system.
- Multi-language support.

**Tech Stack:**
- React with TypeScript
- Vite for building and bundling
- TanStack Router for navigation
- TanStack Query for data fetching
- Capacitor for cross-platform mobile capabilities
- Tailwind CSS for styling

### Admin Dashboard
A comprehensive administration interface for educational institutions and instructors.

**Key Features:**
- Course creation and management.
- Assessment design and evaluation.
- Student management.
- Reports and analytics.
- AI-powered tools for content creation and evaluation.
- Presentation mode for interactive teaching.

**Tech Stack:**
- React with TypeScript
- Vite for building and bundling
- TanStack Router for navigation
- TanStack Query for data fetching
- Storybook for component development
- Tailwind CSS for styling

## Routes

### Learner Dashboard Routes
- **Authentication**
  - `/login`: User login
  - `/register`: New user registration
  - `/login/forgot-password`: Password recovery
  - `/logout`: User logout
- **Dashboard**
  - `/dashboard`: Main user dashboard
  - `/dashboard/notifications`: User notifications
- **Study Library**
  - `/study-library`: Main study library
  - `/study-library/courses`: Course listing
  - `/study-library/courses/levels`: Level selection
  - `/study-library/courses/levels/subjects`: Subject selection
  - `/study-library/courses/levels/subjects/modules`: Module selection
  - `/study-library/courses/levels/subjects/modules/chapters`: Chapter selection
  - `/study-library/courses/levels/subjects/modules/chapters/slides`: Slide viewer
- **Assessment**
  - `/assessment/examination`: Available examinations
  - `/assessment/examination/$assessmentId`: Assessment details
  - `/assessment/examination/$assessmentId/LearnerLiveTest`: Take live assessment
  - `/assessment/examination/$assessmentId/assessmentPreview`: Preview assessment
  - `/assessment/reports/student-report`: Student assessment reports
- **User Management**
  - `/user-profile`: User profile view
  - `/user-profile/edit`: Edit user profile
  - `/delete-user`: Delete user account
  - `/institute-selection`: Select learning institute
  - `/learner-invitation-response`: Respond to institute invitations

### Admin Dashboard Routes
- **Authentication**
  - `/login`: Admin login
  - `/signup`: New admin registration
  - `/login/forgot-password`: Password recovery
- **Dashboard**
  - `/dashboard`: Main admin dashboard
- **Study Library Management**
  - `/study-library`: Main study library management
  - `/study-library/courses`: Course management
  - `/study-library/present`: Presentation mode
  - `/study-library/reports`: Study library reports
- **Assessment Management**
  - `/assessment/assessment-list`: List of assessments
  - `/assessment/question-papers`: Question paper management
- **Evaluation Tools**
  - `/evaluation/evaluation-tool`: Evaluation tools
  - `/evaluation/evaluations`: Evaluation management
- **AI Center**
  - `/ai-center/ai-tools`: AI tool selection
  - `/ai-center/ai-tools/vsmart-audio`: AI audio processing
  - `/ai-center/ai-tools/vsmart-chat`: AI chatbot interface
  - `/ai-center/ai-tools/vsmart-extract`: AI content extraction
  - `/ai-center/ai-tools/vsmart-feedback`: AI assessment feedback
- **Institute Management**
  - `/manage-institute/batches`: Batch management
  - `/manage-institute/sessions`: Session management
  - `/manage-institute/teams`: Team management
- **Student Management**
  - `/manage-students/students-list`: Student listing
  - `/manage-students/invite`: Invite students
  - `/manage-students/enroll-requests`: Manage enrollment requests

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
- This README is based on the exploration of the Vacademy platform codebase.
- The platform consists of multiple microservices for different functionalities, along with two frontend applications (admin and learner dashboards).
- The tech stack includes Spring Boot for the backend and React for the frontend, with various supporting libraries and tools.
- For complete setup, all microservices need to be configured properly with database connections and AWS credentials.
- The platform supports features like course management, assessments, student tracking, and AI-powered educational tools.
