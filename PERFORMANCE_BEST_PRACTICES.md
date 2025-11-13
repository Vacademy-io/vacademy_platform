# Performance Best Practices for Vacademy Platform

This document outlines performance optimization guidelines and best practices for the Vacademy Platform codebase.

## Database Performance

### 1. Use LAZY Fetching by Default

**Problem:** EAGER fetching loads related entities immediately, causing N+1 query problems and unnecessary data loading.

**Solution:** Use `FetchType.LAZY` by default and use JOIN FETCH when you actually need the related data.

```java
// ❌ Bad - EAGER fetching
@OneToMany(mappedBy = "assessment", fetch = FetchType.EAGER)
private Set<AssessmentBatchRegistration> batchRegistrations;

// ✅ Good - LAZY fetching with explicit JOIN FETCH when needed
@OneToMany(mappedBy = "assessment", fetch = FetchType.LAZY)
private Set<AssessmentBatchRegistration> batchRegistrations;

// In repository, use JOIN FETCH when you need the data
@Query("SELECT a FROM Assessment a LEFT JOIN FETCH a.batchRegistrations WHERE a.id = :id")
Optional<Assessment> findByIdWithBatchRegistrations(@Param("id") String id);
```

### 2. Avoid findAll() Without Pagination

**Problem:** Loading all entities from the database can cause memory issues and slow queries.

**Solution:** Use specific queries or pagination.

```java
// ❌ Bad - Loads all records and filters in memory
return packageInstituteRepository.findAll()
        .stream()
        .filter(pi -> pi.getPackageEntity().getId().equals(packageId))
        .collect(Collectors.toList());

// ✅ Good - Database-level filtering
@Query("SELECT pi FROM PackageInstitute pi WHERE pi.packageEntity.id = :packageId")
List<PackageInstitute> findByPackageId(@Param("packageId") String packageId);
```

### 3. Add Indexes on Frequently Queried Columns

Ensure database indexes exist on:
- Foreign key columns
- Columns used in WHERE clauses
- Columns used in JOIN conditions
- Columns used for sorting (ORDER BY)

### 4. Use Batch Operations

When inserting/updating multiple records, use batch operations:

```java
// ✅ Good - Batch save
@Transactional
public void saveAll(List<Entity> entities) {
    int batchSize = 50;
    for (int i = 0; i < entities.size(); i++) {
        repository.save(entities.get(i));
        if (i > 0 && i % batchSize == 0) {
            entityManager.flush();
            entityManager.clear();
        }
    }
}
```

## Concurrency and Threading

### 5. Avoid Synchronized Methods for Database Operations

**Problem:** `synchronized` keyword creates a bottleneck, preventing concurrent execution.

**Solution:** Rely on database transactions and isolation levels.

```java
// ❌ Bad - Synchronized method blocks all threads
public synchronized boolean createEventAtomically(...) {
    // Database operation
}

// ✅ Good - Use transaction isolation
@Transactional(isolation = Isolation.REPEATABLE_READ)
public boolean createEventAtomically(...) {
    // Database handles concurrency
}
```

## Caching

### 6. Cache Read-Only Reference Data

**Problem:** Repeatedly querying database for data that rarely changes.

**Solution:** Use Spring Cache annotations.

```java
// ✅ Good - Cache dropdown options
@Cacheable(value = "dropdownOptions", key = "'all'")
public ResponseEntity<InitResponseDto> getDropdownOptions() {
    // This will only execute once, then cache the result
}

// Remember to invalidate cache when data changes
@CacheEvict(value = "dropdownOptions", key = "'all'")
public void updateLevel(Level level) {
    // Update operation
}
```

## Stream Operations

### 7. Use Collect Instead of forEach with Side Effects

**Problem:** `forEach` with side effects is harder to parallelize and reason about.

**Solution:** Use `map` and `collect` for transformations.

```java
// ❌ Bad - forEach with side effects
List<SectionDto> sectionDtos = new ArrayList<>();
sections.stream().forEach(section -> {
    SectionDto dto = new SectionDto(section);
    sectionDtos.add(dto);
});

// ✅ Good - Functional transformation
List<SectionDto> sectionDtos = sections.stream()
    .map(section -> new SectionDto(section))
    .collect(Collectors.toList());
```

## API Response Optimization

### 8. Return Only Required Fields

**Problem:** Sending entire entity graphs with unnecessary data.

**Solution:** Use DTOs with only required fields.

```java
// ✅ Good - Projection or DTO with specific fields
public interface UserProjection {
    String getId();
    String getName();
    String getEmail();
}

@Query("SELECT u.id as id, u.name as name, u.email as email FROM User u")
List<UserProjection> findAllUserSummaries();
```

### 9. Implement Pagination for List APIs

Always paginate list endpoints:

```java
// ✅ Good
@GetMapping("/users")
public Page<UserDTO> getUsers(Pageable pageable) {
    return userService.findAll(pageable);
}
```

## Monitoring and Profiling

### 10. Enable Query Logging in Development

Add to `application.properties`:
```properties
# Show SQL queries
spring.jpa.show-sql=true
spring.jpa.properties.hibernate.format_sql=true

# Show query execution time
logging.level.org.hibernate.stat=DEBUG
spring.jpa.properties.hibernate.generate_statistics=true
```

### 11. Monitor N+1 Query Problems

Look for repeated queries in logs with different parameters:
```
SELECT * FROM assessment WHERE id = ?
SELECT * FROM batch_registration WHERE assessment_id = ?  -- Repeated for each assessment
SELECT * FROM batch_registration WHERE assessment_id = ?
SELECT * FROM batch_registration WHERE assessment_id = ?
```

This indicates an N+1 problem that needs JOIN FETCH.

## Recent Optimizations Applied

The following optimizations have been implemented:

1. ✅ Changed EAGER to LAZY fetching in:
   - `Assessment.batchRegistrations`
   - `Role.authorities`
   - `Chapter.topics`
   - `Presentation.presentationSlides`

2. ✅ Removed synchronized keyword from `EmailEventService.createEventAtomically()`

3. ✅ Optimized `CourseApprovalService.findPackageInstituteLinkagesByPackageId()` to use direct query instead of findAll()

4. ✅ Added caching to `InitService.getDropdownOptions()`

5. ✅ Refactored `LearnerAssessmentAttemptStartManager.createSectionDtoList()` to use functional stream operations

## Additional Recommendations

- Consider implementing Redis for distributed caching in production
- Use connection pooling (HikariCP is default in Spring Boot)
- Enable database query caching for frequently executed queries
- Monitor slow queries using database tools (pg_stat_statements for PostgreSQL)
- Profile application under load to identify bottlenecks
- Consider implementing GraphQL for flexible API queries that only fetch required fields

## References

- [Spring Data JPA Best Practices](https://docs.spring.io/spring-data/jpa/docs/current/reference/html/)
- [Hibernate Performance Tuning](https://docs.jboss.org/hibernate/orm/current/userguide/html_single/Hibernate_User_Guide.html#performance)
- [Spring Cache Abstraction](https://docs.spring.io/spring-framework/docs/current/reference/html/integration.html#cache)
