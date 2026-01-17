package vacademy.io.admin_core_service.features.packages.service;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import vacademy.io.admin_core_service.features.packages.dto.AutocompleteResponseDTO;
import vacademy.io.admin_core_service.features.packages.dto.PackageAutocompleteProjection;
import vacademy.io.admin_core_service.features.packages.dto.PackageSuggestionDTO;
import vacademy.io.admin_core_service.features.packages.repository.PackageSessionRepository;

import java.util.List;
import java.util.stream.Collectors;

@Slf4j
@Service
public class PackageAutocompleteService {

        @Autowired
        private PackageSessionRepository packageSessionRepository;

        /**
         * Autocomplete search for packages with instant results
         * Optimized for 20,000+ packages with < 100ms response time
         *
         * @param query       Search query (minimum 1 characters)
         * @param instituteId Required institute filter
         * @param sessionId   Required session filter
         * @param levelId     Required level filter
         * @return Autocomplete response with top 10 suggestions
         */
        public AutocompleteResponseDTO autocomplete(
                        String query,
                        String instituteId,
                        String sessionId,
                        String levelId) {
                // Validate minimum query length
                if (query == null || query.trim().isEmpty()) {
                        log.debug("Query too short: {}", query);
                        return new AutocompleteResponseDTO(List.of(), 0, 0L);
                }

                long startTime = System.currentTimeMillis();
                String sanitizedQuery = query.trim();

                try {
                        // Execute optimized query with LIMIT 10
                        List<PackageAutocompleteProjection> results = packageSessionRepository.autocompletePackages(
                                        sanitizedQuery,
                                        instituteId,
                                        sessionId,
                                        levelId,
                                        10 // Always limit to 10 results
                        );

                        // Map projections to DTOs
                        List<PackageSuggestionDTO> suggestions = results.stream()
                                        .map(p -> new PackageSuggestionDTO(
                                                        p.getPackageId(),
                                                        p.getPackageName(),
                                                        p.getPackageSessionId(),
                                                        p.getLevelId(),
                                                        p.getLevelName(),
                                                        p.getSessionId(),
                                                        p.getSessionName()))
                                        .collect(Collectors.toList());

                        long queryTime = System.currentTimeMillis() - startTime;

                        log.info("Autocomplete query='{}' returned {} results in {}ms",
                                        sanitizedQuery, suggestions.size(), queryTime);

                        return new AutocompleteResponseDTO(suggestions, results.size(), queryTime);
                } catch (Exception e) {
                        log.error("Error during autocomplete for query: {}", sanitizedQuery, e);

                        // Capture error in Sentry with manual tags for easier debugging
                        io.sentry.Sentry.withScope(scope -> {
                                scope.setTag("feature", "package-autocomplete");
                                scope.setTag("institute_id", instituteId);
                                scope.setTag("query", sanitizedQuery);
                                scope.setExtra("session_id", sessionId);
                                scope.setExtra("level_id", levelId);
                                io.sentry.Sentry.captureException(e);
                        });

                        // Re-throw to allow global exception handler to return 500
                        throw e;
                }
        }
}
