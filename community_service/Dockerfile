# Stage 1: Build the application
FROM maven:3.8.5-openjdk-17-slim AS build

# Set the working directory
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

# Build the project
RUN mvn -s settings.xml clean install -DskipTests

# Stage 2: Package the application into the final image
FROM amazoncorretto:17-alpine

# Set the working directory
WORKDIR /app

# Copy the built jar file from the previous stage
COPY --from=build /build/target/community_service.jar community_service.jar

# Expose the port the application runs on
EXPOSE 8073

# Define the command to run the application
CMD ["java", "-jar", "-Dspring.profiles.active=stage", "community_service.jar"]