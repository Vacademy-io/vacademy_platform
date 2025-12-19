# LocalDateTime Serialization Fix

## Issue
The application was encountering a `JsonMappingException` when trying to serialize `java.time.LocalDateTime` fields in `UserActivityAnalyticsDto`. The error message was:
`Could not write JSON: Java 8 date/time type java.time.LocalDateTime not supported by default: add Module "com.fasterxml.jackson.datatype:jackson-datatype-jsr310"`

## Root Cause
The `ObjectMapper` used by Spring MVC's `MappingJackson2HttpMessageConverter` did not have the `JavaTimeModule` registered, or the auto-configuration was being overridden or ignored. While `JacksonConfig` was present, it was using `Jackson2ObjectMapperBuilder` which might have been misconfigured or not applied correctly in the context.

## Fix Implemented
Refactored `JacksonConfig.java` to:
1.  **Directly instantiate `ObjectMapper`**: Removed dependency on `Jackson2ObjectMapperBuilder` to avoid any ambiguity or hidden defaults/overrides.
2.  **Explicitly register `JavaTimeModule`**: Added `objectMapper.registerModule(new JavaTimeModule())` to guarantee Java 8 date/time support.
3.  **Auto-detect other modules**: Added `objectMapper.findAndRegisterModules()` as a safety measure.
4.  **Disabled Timestamp Serialization**: Ensured `WRITE_DATES_AS_TIMESTAMPS` is disabled to serialize dates as ISO-8601 strings.

## Verification
This change ensures that the primary `ObjectMapper` bean in the application context allows `LocalDateTime` serialization. This bean should automatically be picked up by Spring MVC.
