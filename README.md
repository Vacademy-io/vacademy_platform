# AI enabled Open-Source LMS

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
