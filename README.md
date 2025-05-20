# AI enabled Open-Source LMS

[![Ask DeepWiki](https://deepwiki.com/badge.svg)](https://deepwiki.com/Vacademy-io/vacademy_platform)




# Vacademy Platform

## About

Vacademy is an AI-enabled Open-Source Learning Management System (LMS) built with a microservices architecture. The platform provides comprehensive tools for educational institutions, instructors, and learners with features like course management, assessment creation, study libraries, and learner tracking. [1](#0-0) 

The platform consists of a robust backend powered by Spring Boot microservices and modern frontend applications using React. This architecture enables scalability, flexibility, and maintainability while delivering a powerful educational experience. [2](#0-1) 

## Features in Depth

### Course Management
- **Course Creation and Organization**: Create and organize courses with levels, subjects, modules, chapters, and slides
- **Study Library**: Centralized repository for all educational content
- **Document Management**: Upload, organize, and share educational documents in folder structures

### User Management
- **Institute Management**: Create and manage educational institutions
- **Batch Management**: Organize learners into batches for effective administration
- **Faculty Management**: Manage faculty members and teaching staff
- **Student Management**: Comprehensive tools for student enrollment, tracking, and management
- **CSV Bulk Import**: Import students in bulk using CSV files [3](#0-2) 

### Assessment System
- **Assessment Creation**: Create various types of assessments and examinations
- **Question Paper Management**: Design and manage question papers
- **Live Testing**: Support for real-time examinations
- **Homework Management**: Create and assign homework to learners
- **AI-Powered Evaluation**: Automated assessment grading using AI [4](#0-3) 

### Learner Experience
- **Learner Dashboard**: Personalized dashboard for learners to access courses and track progress
- **Study Materials**: Access to course materials, presentations, and documents
- **Assessment Participation**: Take tests, exams, and complete homework assignments
- **Progress Tracking**: Detailed progress reports and performance analytics [5](#0-4) 

### AI Features
- **VSmart Audio**: AI-powered audio processing tools
- **VSmart Chat**: Intelligent chatbot assistance
- **VSmart Extract**: Automatic extraction of information from documents
- **VSmart Feedback**: AI-generated feedback on assessments [6](#0-5) 

### Presentation Mode
- **Interactive Presentations**: Create and deliver interactive course presentations
- **Presenter Controls**: Advanced controls for presenters during live sessions
- **Learner Participation**: Interactive features for learners during presentations [7](#0-6) 

### Reporting and Analytics
- **Learner Reports**: Comprehensive reports on learner performance
- **Batch Reports**: Aggregate reports for batches of students
- **Export Functionality**: Export reports in various formats
- **Notification Settings**: Configure report notification preferences [8](#0-7) 

### Learner Tracking
- **Activity Logging**: Detailed tracking of learner activities
- **Progress Monitoring**: Monitor individual and group progress through courses
- **Engagement Metrics**: Measure student engagement with various course materials [9](#0-8) 

## Tech Stack

### Backend
- **Java 17**: Primary programming language [10](#0-9) 
- **Spring Boot**: Framework for building microservices [11](#0-10) 
- **Maven**: Dependency management and build tool [12](#0-11) 
- **PostgreSQL**: Primary database system [13](#0-12) 
- **AWS S3**: Cloud storage for media files [14](#0-13) 
- **Kubernetes**: Container orchestration for deployment [11](#0-10) 

### Frontend
- **React 18+**: JavaScript library for building user interfaces [15](#0-14) 
- **TypeScript**: Type-safe JavaScript [16](#0-15) 
- **Vite**: Next-generation frontend tooling [17](#0-16) 
- **TanStack Router**: Modern routing library [18](#0-17) 
- **TanStack Query**: Data fetching and state management [19](#0-18) 
- **TanStack Table**: Table UI components [20](#0-19) 
- **Radix UI**: Unstyled, accessible UI components [21](#0-20) 
- **Tailwind CSS**: Utility-first CSS framework [22](#0-21) 
- **Capacitor**: For mobile app development (learner dashboard) [23](#0-22) 

### Tools & Utilities
- **Docker**: Containerization platform [24](#0-23) 
- **Swagger UI**: API documentation [25](#0-24) 
- **GitHub Actions**: CI/CD automation [26](#0-25) 
- **Storybook**: UI component development environment (admin dashboard) [27](#0-26) 

## Backend and Its Services

The Vacademy platform uses a microservices architecture consisting of several specialized services: [28](#0-27) 

### Common Service
Core utilities, models, and configurations shared across other services. [29](#0-28) 

### Auth Service
Handles authentication and authorization, including user login, registration, and access control. [30](#0-29) 

### Admin Core Service
Provides administrative functionalities for managing courses, users, and institutional operations. [31](#0-30) 

Features include:
- Course, module, subject, and chapter management
- Slide creation and management
- Learner invitation and enrollment
- Institute and faculty management
- Study library organization
- Session management

### Media Service
Handles media file uploading, processing, storage, and retrieval. [32](#0-31) 

### Community Service
Manages community features and interactions between users. [33](#0-32) 

### Assessment Service
Comprehensive assessment creation, management, and evaluation system. [34](#0-33) 

Features include:
- Assessment creation and scheduling
- Question paper management
- Automated evaluation
- Reports and analytics
- Participant management

### Notification Service
Manages system notifications and communication to users. [35](#0-34) 

## Installation Guidelines

### Prerequisites

Before installing Vacademy, ensure you have the following: [36](#0-35) 

- **Java 17**
- **Maven 3.8+**
- **Docker** and **Docker Compose**
- **PostgreSQL**
- **AWS account** with S3 access
- **GitHub Personal Access Token** for accessing GitHub packages [37](#0-36) 

### Backend Setup

1. **Clone the Repository**
```bash
git clone https://github.com/Vacademy-io/services.git
cd services
``` [38](#0-37) 

2. **Configure GitHub Packages Authentication**
```bash
export JAVA_TOKEN=your_github_token
``` [39](#0-38) 

3. **Build the Project**
```bash
mvn clean install -DskipTests
``` [40](#0-39) 

4. **Database Configuration**

Create an `application.properties` or `application.yml` file in each service's `src/main/resources` directory:
```properties
# Database Configuration
spring.datasource.url=jdbc:postgresql://localhost:5432/vacademy_[service_name]
spring.datasource.username=postgres
spring.datasource.password=your_password
spring.jpa.hibernate.ddl-auto=update
spring.jpa.properties.hibernate.dialect=org.hibernate.dialect.PostgreSQLDialect
``` [41](#0-40) 

5. **AWS S3 Configuration**
```properties
# AWS Configuration
aws.accessKey=your_aws_access_key
aws.secretKey=your_aws_secret_key
aws.region=your_aws_region
aws.s3.bucket=your_s3_bucket_name
``` [42](#0-41) 

6. **Service Port Configuration**
```properties
# Server configuration
server.port=8080  # Change for each service
``` [43](#0-42) 

### Running Services Locally

#### Option 1: Run with Maven
```bash
cd [service_name]
mvn spring-boot:run
``` [44](#0-43) 

#### Option 2: Run with Docker
```bash
cd [service_name]
docker build -t vacademy/[service_name] .
docker run -p 8080:8080 vacademy/[service_name]
``` [45](#0-44) 

### Frontend Setup

#### Learner Dashboard
1. **Navigate to the learner dashboard directory**
```bash
cd frontend-learner-dashboard
```

2. **Install dependencies**
```bash
npm install
```

3. **Run the development server**
```bash
npm run dev
``` [46](#0-45) 

#### Admin Dashboard
1. **Navigate to the admin dashboard directory**
```bash
cd frontend-admin-dashboard
```

2. **Install dependencies**
```bash
npm install
```

3. **Run the development server**
```bash
npm run dev
``` [47](#0-46) 

## Frontend

The Vacademy platform features two distinct frontend applications:

### Learner Dashboard
A responsive mobile-first application designed for learners to access educational content and participate in assessments.

**Key Features:**
- Responsive design with Capacitor for mobile app capabilities
- Course library access and navigation
- Assessment participation
- Progress tracking
- Notification system
- Multi-language support

**Tech Stack:**
- React with TypeScript
- Vite for building and bundling
- TanStack Router for navigation
- TanStack Query for data fetching
- Capacitor for cross-platform mobile capabilities
- Tailwind CSS for styling [48](#0-47) 

### Admin Dashboard
A comprehensive administration interface for educational institutions and instructors.

**Key Features:**
- Course creation and management
- Assessment design and evaluation
- Student management
- Reports and analytics
- AI-powered tools for content creation and evaluation
- Presentation mode for interactive teaching

**Tech Stack:**
- React with TypeScript
- Vite for building and bundling
- TanStack Router for navigation
- TanStack Query for data fetching
- Storybook for component development
- Tailwind CSS for styling [49](#0-48) 

## Routes

### Learner Dashboard Routes

The learner dashboard provides the following key routes: [50](#0-49) 

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

The admin dashboard provides the following key routes: [51](#0-50) 

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

## Notes

- This README is based on the exploration of the Vacademy platform codebase.
- The platform consists of multiple microservices for different functionalities, along with two frontend applications (admin and learner dashboards).
- The tech stack includes Spring Boot for the backend and React for the frontend, with various supporting libraries and tools.
- For complete setup, all microservices need to be configured properly with database connections and AWS credentials.
- The platform supports features like course management, assessments, student tracking, and AI-powered educational tools.
- The README covers the major aspects of the system but doesn't include every detail of the implementation.


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
