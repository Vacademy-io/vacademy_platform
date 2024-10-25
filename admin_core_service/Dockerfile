# Stage 1: Build the application
FROM maven:3.8.5-openjdk-17-slim AS build

# Set the working directory
WORKDIR /build

# Copy the Maven settings file
COPY settings.xml ./

# Copy the project files
COPY . .

# Build the project
RUN mvn -s settings.xml clean install -DskipTests

# Stage 2: Package the application into the final image
FROM eclipse-temurin:17-jdk-alpine

# Set the working directory
WORKDIR /app

# Copy the built jar file from the previous stage
COPY --from=build /build/target/admin_core_service.jar admin_core_service.jar

# Expose the port the application runs on
EXPOSE 8072

# Define the command to run the application
CMD ["java", "-jar", "-Dspring.profiles.active=stage", "admin_core_service.jar"]