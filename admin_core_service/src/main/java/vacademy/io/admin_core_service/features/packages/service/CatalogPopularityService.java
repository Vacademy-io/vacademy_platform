package vacademy.io.admin_core_service.features.packages.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import vacademy.io.admin_core_service.features.packages.dto.CatalogPopularityDTO;
import vacademy.io.admin_core_service.features.packages.dto.PackagePopularityProjection;
import vacademy.io.admin_core_service.features.packages.repository.PackageRepository;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * Institute-wide popularity RANKS of catalogue courses, for the public site's "Popular" sort and
 * its Bestseller / Popular badges. Served by {@code GET /open/packages/v1/popularity}.
 *
 * <p>Popularity = distinct learners actively enrolled across the course's ACTIVE and HIDDEN
 * batches (see {@link PackageRepository#countActiveLearnersPerCatalogPackage} for exactly who
 * counts). Only ranks leave this class -- never the counts.
 *
 * <p>Load safety, because this sits behind a public, unauthenticated URL:
 * <ul>
 *   <li>{@code @Cacheable(sync = true)} on the {@code catalogPopularityRanks} cache (10-minute TTL,
 *       registered in {@code CacheConfiguration}): at most one query per institute per pod per 10
 *       minutes, and concurrent misses for one institute wait for that single query instead of
 *       each running it. The browser/CDN cache on the endpoint (max-age=600) sits in front.</li>
 *   <li>Spring's {@code @Transactional(readOnly = true)} -- NOT jakarta.transaction.Transactional,
 *       which has no read-only flag -- so {@code ReplicationRoutingDataSource} sends the query to
 *       the read replica, never the primary.</li>
 *   <li>The query itself is scoped to one institute and uses the partial enrolment indexes.</li>
 * </ul>
 *
 * <p>Must stay a separate bean from its callers: {@code @Cacheable} only intercepts calls that
 * cross the Spring proxy. Replica lag is fine for ranks; do not reuse this read path for anything
 * that must read its own writes.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class CatalogPopularityService {

    /** Registered in CacheConfiguration; a @Cacheable naming an unregistered cache throws at call time. */
    public static final String CACHE_NAME = "catalogPopularityRanks";

    /** A cache miss slower than this is logged at WARN so a degrading plan is noticed. */
    private static final long SLOW_QUERY_MS = 1_000;

    private final PackageRepository packageRepository;

    /**
     * Ranks for one institute, cached per institute.
     *
     * @param instituteId the institute whose public catalogue is ranked; must not be null (it is
     *                    the cache key -- the controller rejects blank ids before calling)
     */
    @Cacheable(value = CACHE_NAME, key = "#instituteId", sync = true)
    @Transactional(readOnly = true)
    public CatalogPopularityDTO getPopularity(String instituteId) {
        long startedAt = System.nanoTime();
        List<CatalogPopularityDTO.PackageRank> ranks =
                rank(packageRepository.countActiveLearnersPerCatalogPackage(instituteId));
        long tookMs = (System.nanoTime() - startedAt) / 1_000_000;
        if (tookMs > SLOW_QUERY_MS) {
            log.warn("Catalogue popularity ranks for institute={} took {} ms ({} ranked courses)",
                    instituteId, tookMs, ranks.size());
        } else {
            log.debug("Catalogue popularity ranks for institute={} took {} ms ({} ranked courses)",
                    instituteId, tookMs, ranks.size());
        }
        return new CatalogPopularityDTO(instituteId, ranks);
    }

    /**
     * Learner counts to ranks: most learners first; equal counts are ordered by package id
     * (ascending), so the same data always yields the same ranks on every pod and every refresh.
     * Ranks are unique and consecutive from 1. Rows without an id or without a positive count are
     * dropped -- a course nobody is enrolled in has no rank.
     */
    static List<CatalogPopularityDTO.PackageRank> rank(List<PackagePopularityProjection> rows) {
        if (rows == null || rows.isEmpty()) {
            return List.of();
        }
        // The query groups by course, so ids are unique; merge defensively all the same, keeping
        // the larger count (adding two DISTINCT counts could count one learner twice).
        Map<String, Long> learnersByPackage = new HashMap<>();
        for (PackagePopularityProjection row : rows) {
            if (row == null) {
                continue;
            }
            String packageId = row.getPackageId();
            Long learners = row.getLearnerCount();
            if (packageId == null || packageId.isBlank() || learners == null || learners <= 0) {
                continue;
            }
            learnersByPackage.merge(packageId, learners, Math::max);
        }

        List<Map.Entry<String, Long>> ordered = new ArrayList<>(learnersByPackage.entrySet());
        ordered.sort(Map.Entry.<String, Long>comparingByValue(Comparator.reverseOrder())
                .thenComparing(Map.Entry.<String, Long>comparingByKey()));

        List<CatalogPopularityDTO.PackageRank> ranks = new ArrayList<>(ordered.size());
        for (int i = 0; i < ordered.size(); i++) {
            ranks.add(new CatalogPopularityDTO.PackageRank(ordered.get(i).getKey(), i + 1));
        }
        return List.copyOf(ranks);
    }
}
