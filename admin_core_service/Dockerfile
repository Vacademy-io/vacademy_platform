# Stage 1: Build the application
FROM maven:3.8.5-openjdk-17-slim AS build
WORKDIR /build

# Declare the build arguments
ARG GITHUB_TOKEN
ARG JAVA_TOKEN

# Set environment variables
ENV JAVA_TOKEN=$JAVA_TOKEN

# Copy the Maven settings file
COPY settings.xml ./

# Copy the project files
COPY . .

RUN mvn -s settings.xml clean package -DskipTests


# Stage 2: Package the application into the final image
FROM amazoncorretto:17-alpine
WORKDIR /app

COPY --from=build /build/target/admin_core_service.jar admin_core_service.jar
EXPOSE 8072

CMD ["java", "-jar", "-Dspring.profiles.active=stage", "admin_core_service.jar"]