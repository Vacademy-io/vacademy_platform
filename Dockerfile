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
FROM maven:3.8.5-openjdk-17-slim

# Set the working directory
WORKDIR /app

# Copy the built jar file from the previous stage
COPY --from=build /build/target/vacademy_services.jar vacademy_services.jar

# Expose the ports
EXPOSE 8071 8072 8073 8075

CMD ["java", "-jar", "-Dspring.profiles.active=stage", "vacademy_services.jar"]
