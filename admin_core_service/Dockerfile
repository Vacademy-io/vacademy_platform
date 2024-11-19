# Stage 1: Build the application
FROM maven:3.8.5-openjdk-17-slim AS build
WORKDIR /build
COPY settings.xml ./
COPY . .

RUN mvn -s settings.xml clean package -DskipTests
VOLUME /root/.m2

# Stage 2: Package the application into the final image
FROM amazoncorretto:17-alpine
WORKDIR /app

COPY --from=build /build/target/${project.artifactId}.jar admin_core_service.jar
EXPOSE 8072

CMD ["java", "-Xmx512m", "-Xms256m", "-XX:+UseG1GC", "-jar", "-Dspring.profiles.active=stage", "admin_core_service.jar"]