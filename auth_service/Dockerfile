# Stage 1: Build the application
FROM maven:3.8.5-openjdk-17-slim AS build

# Set the working directory
WORKDIR /build

# Create the Maven settings file
ARG GITHUB_TOKEN
RUN echo "<settings><servers><server><id>github</id><username>shreyash-jain</username><password>${GITHUB_TOKEN}</password></server></servers></settings>" > settings.xml

# Copy the project files
COPY . .

# Build the project
RUN mvn -s settings.xml clean install -DskipTests

# Stage 2: Package the application into the final image
FROM amazoncorretto:17-alpine

# Set the working directory
WORKDIR /app

# Copy the built jar file from the previous stage
COPY --from=build /build/target/auth_service.jar auth_service.jar

# Expose the port the application runs on
EXPOSE 8071

# Define the command to run the application
CMD ["java", "-jar", "-Dspring.profiles.active=stage", "auth_service.jar"]