package vacademy.io.admin_core_service.features.packages.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.context.annotation.AnnotationConfigApplicationContext;
import org.springframework.core.annotation.AnnotatedElementUtils;
import org.springframework.transaction.annotation.Transactional;
import vacademy.io.admin_core_service.config.CacheConfiguration;
import vacademy.io.admin_core_service.features.packages.dto.CatalogPopularityDTO;
import vacademy.io.admin_core_service.features.packages.dto.PackagePopularityProjection;
import vacademy.io.admin_core_service.features.packages.repository.PackageRepository;

import java.lang.reflect.Method;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collections;
import java.util.List;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class CatalogPopularityServiceTest {

    private final PackageRepository repository = mock(PackageRepository.class);
    private final CatalogPopularityService service = new CatalogPopularityService(repository);

    private static PackagePopularityProjection row(String packageId, Long learners) {
        return new PackagePopularityProjection() {
            @Override
            public String getPackageId() {
                return packageId;
            }

            @Override
            public Long getLearnerCount() {
                return learners;
            }
        };
    }

    private static List<String> idsInRankOrder(CatalogPopularityDTO dto) {
        return dto.getRanks().stream().map(CatalogPopularityDTO.PackageRank::getPackageId).toList();
    }

    @Test
    @DisplayName("Rank 1 is the course with the most learners; ranks are consecutive from 1")
    void mostLearnersRanksFirst() {
        when(repository.countActiveLearnersPerCatalogPackage("inst-1")).thenReturn(List.of(
                row("pkg-small", 2L), row("pkg-big", 120L), row("pkg-mid", 15L)));

        CatalogPopularityDTO dto = service.getPopularity("inst-1");

        assertThat(dto.getInstituteId()).isEqualTo("inst-1");
        assertThat(idsInRankOrder(dto)).containsExactly("pkg-big", "pkg-mid", "pkg-small");
        assertThat(dto.getRanks()).extracting(CatalogPopularityDTO.PackageRank::getRank).containsExactly(1, 2, 3);
        verify(repository, times(1)).countActiveLearnersPerCatalogPackage("inst-1");
    }

    @Test
    @DisplayName("Equal counts are ordered by package id, whatever order the rows arrive in")
    void tiesAreBrokenDeterministically() {
        List<PackagePopularityProjection> rows = new ArrayList<>(List.of(
                row("pkg-c", 7L), row("pkg-a", 7L), row("pkg-top", 9L), row("pkg-b", 7L), row("pkg-last", 1L)));

        List<String> first = null;
        for (int shuffle = 0; shuffle < 20; shuffle++) {
            Collections.shuffle(rows, new java.util.Random(shuffle));
            List<String> ranked = CatalogPopularityService.rank(rows).stream()
                    .map(CatalogPopularityDTO.PackageRank::getPackageId).toList();
            if (first == null) {
                first = ranked;
            }
            assertThat(ranked).isEqualTo(first);
        }
        assertThat(first).containsExactly("pkg-top", "pkg-a", "pkg-b", "pkg-c", "pkg-last");
        // ties do NOT share a rank: ranks stay unique so "top N" is always exactly N courses
        assertThat(CatalogPopularityService.rank(rows))
                .extracting(CatalogPopularityDTO.PackageRank::getRank).containsExactly(1, 2, 3, 4, 5);
    }

    @Test
    @DisplayName("Courses without learners, without an id, or with a null count get no rank")
    void unrankableRowsAreOmitted() {
        List<PackagePopularityProjection> rows = Arrays.asList(
                row("pkg-zero", 0L),
                row("pkg-null-count", null),
                row(null, 50L),
                row("  ", 40L),
                null,
                row("pkg-real", 3L));

        assertThat(CatalogPopularityService.rank(rows))
                .extracting(CatalogPopularityDTO.PackageRank::getPackageId).containsExactly("pkg-real");
        assertThat(CatalogPopularityService.rank(rows))
                .extracting(CatalogPopularityDTO.PackageRank::getRank).containsExactly(1);
    }

    @Test
    @DisplayName("An institute with no enrolments (or no rows at all) gets an empty list, not an error")
    void noRowsMeansNoRanks() {
        when(repository.countActiveLearnersPerCatalogPackage("inst-empty")).thenReturn(List.of());

        assertThat(service.getPopularity("inst-empty").getRanks()).isEmpty();
        assertThat(CatalogPopularityService.rank(null)).isEmpty();
    }

    @Test
    @DisplayName("A duplicated course id keeps the larger count instead of adding two distinct counts")
    void duplicateRowsAreMergedNotSummed() {
        List<PackagePopularityProjection> rows = List.of(
                row("pkg-dup", 4L), row("pkg-other", 6L), row("pkg-dup", 5L));

        // summing would give pkg-dup 9 and rank it first; max keeps it at 5, behind pkg-other
        assertThat(CatalogPopularityService.rank(rows))
                .extracting(CatalogPopularityDTO.PackageRank::getPackageId).containsExactly("pkg-other", "pkg-dup");
    }

    @Test
    @DisplayName("The JSON carries institute_id and package_id/rank only -- never a learner count")
    void wireShapeHasRanksButNoCounts() throws Exception {
        when(repository.countActiveLearnersPerCatalogPackage("inst-1")).thenReturn(List.of(
                row("pkg-a", 4321L), row("pkg-b", 987L)));

        ObjectMapper mapper = new ObjectMapper();
        String json = mapper.writeValueAsString(service.getPopularity("inst-1"));
        JsonNode body = mapper.readTree(json);

        assertThat(body.fieldNames()).toIterable().containsExactlyInAnyOrder("institute_id", "ranks");
        assertThat(body.get("institute_id").asText()).isEqualTo("inst-1");
        assertThat(body.get("ranks")).hasSize(2);
        for (JsonNode rank : body.get("ranks")) {
            assertThat(rank.fieldNames()).toIterable().containsExactlyInAnyOrder("package_id", "rank");
        }
        assertThat(body.get("ranks").get(0).get("package_id").asText()).isEqualTo("pkg-a");
        assertThat(body.get("ranks").get(0).get("rank").asInt()).isEqualTo(1);
        assertThat(json).doesNotContain("4321").doesNotContain("987");
    }

    @Test
    @DisplayName("The cached value is immutable (Caffeine hands the same instance to every caller)")
    void resultIsImmutable() {
        when(repository.countActiveLearnersPerCatalogPackage("inst-1")).thenReturn(List.of(row("pkg-a", 1L)));

        CatalogPopularityDTO dto = service.getPopularity("inst-1");

        assertThatThrownBy(() -> dto.getRanks().add(new CatalogPopularityDTO.PackageRank("pkg-x", 9)))
                .isInstanceOf(UnsupportedOperationException.class);
        assertThatThrownBy(() -> dto.getRanks().clear()).isInstanceOf(UnsupportedOperationException.class);

        List<CatalogPopularityDTO.PackageRank> source = new ArrayList<>();
        source.add(new CatalogPopularityDTO.PackageRank("pkg-a", 1));
        CatalogPopularityDTO copy = new CatalogPopularityDTO("inst-1", source);
        source.add(new CatalogPopularityDTO.PackageRank("pkg-b", 2));
        assertThat(copy.getRanks()).hasSize(1);
    }

    @Test
    @DisplayName("Cached per institute with sync=true, in a Spring read-only (replica) transaction")
    void cacheAndReplicaAnnotations() throws Exception {
        Method method = CatalogPopularityService.class.getMethod("getPopularity", String.class);

        Cacheable cacheable = AnnotatedElementUtils.findMergedAnnotation(method, Cacheable.class);
        assertThat(cacheable).isNotNull();
        assertThat(cacheable.cacheNames()).containsExactly(CatalogPopularityService.CACHE_NAME);
        assertThat(CatalogPopularityService.CACHE_NAME).isEqualTo("catalogPopularityRanks");
        assertThat(cacheable.key()).isEqualTo("#instituteId");
        assertThat(cacheable.sync()).isTrue();

        // Spring's annotation (has readOnly, which routes to the replica) -- not jakarta's
        Transactional transactional = AnnotatedElementUtils.findMergedAnnotation(method, Transactional.class);
        assertThat(transactional).isNotNull();
        assertThat(transactional.readOnly()).isTrue();
        assertThat(method.getAnnotation(jakarta.transaction.Transactional.class)).isNull();
    }

    @Test
    @DisplayName("Through the real cache manager: one query per institute, then served from the cache")
    void realCacheServesRepeatsWithoutQuerying() {
        when(repository.countActiveLearnersPerCatalogPackage("inst-1")).thenReturn(List.of(row("pkg-a", 3L)));
        when(repository.countActiveLearnersPerCatalogPackage("inst-2")).thenReturn(List.of(row("pkg-b", 8L)));

        try (AnnotationConfigApplicationContext context = new AnnotationConfigApplicationContext()) {
            context.register(CacheConfiguration.class);
            context.registerBean(PackageRepository.class, () -> repository);
            context.registerBean(CatalogPopularityService.class);
            context.refresh();
            CatalogPopularityService proxied = context.getBean(CatalogPopularityService.class);

            CatalogPopularityDTO first = proxied.getPopularity("inst-1");
            CatalogPopularityDTO again = proxied.getPopularity("inst-1");
            CatalogPopularityDTO other = proxied.getPopularity("inst-2");

            assertThat(again).isSameAs(first);
            assertThat(idsInRankOrder(other)).containsExactly("pkg-b");
            verify(repository, times(1)).countActiveLearnersPerCatalogPackage("inst-1");
            verify(repository, times(1)).countActiveLearnersPerCatalogPackage("inst-2");
            verify(repository, never()).countActiveLearnersPerCatalogPackage("inst-3");
        }
    }

    @Test
    @DisplayName("sync=true: concurrent misses for one institute run the query once, the rest wait for it")
    void concurrentMissesRunOneQuery() throws Exception {
        CountDownLatch release = new CountDownLatch(1);
        when(repository.countActiveLearnersPerCatalogPackage("inst-hot")).thenAnswer(invocation -> {
            release.await(5, TimeUnit.SECONDS); // hold the first load while the others pile up
            return List.of(row("pkg-a", 3L));
        });

        try (AnnotationConfigApplicationContext context = new AnnotationConfigApplicationContext()) {
            context.register(CacheConfiguration.class);
            context.registerBean(PackageRepository.class, () -> repository);
            context.registerBean(CatalogPopularityService.class);
            context.refresh();
            CatalogPopularityService proxied = context.getBean(CatalogPopularityService.class);

            int callers = 8;
            ExecutorService pool = Executors.newFixedThreadPool(callers);
            try {
                CountDownLatch started = new CountDownLatch(callers);
                List<Future<CatalogPopularityDTO>> results = new ArrayList<>();
                for (int i = 0; i < callers; i++) {
                    results.add(pool.submit(() -> {
                        started.countDown();
                        return proxied.getPopularity("inst-hot");
                    }));
                }
                assertThat(started.await(5, TimeUnit.SECONDS)).isTrue();
                Thread.sleep(200); // let every caller reach the cache before the load finishes
                release.countDown();
                for (Future<CatalogPopularityDTO> result : results) {
                    assertThat(idsInRankOrder(result.get(5, TimeUnit.SECONDS))).containsExactly("pkg-a");
                }
            } finally {
                pool.shutdownNow();
            }
            verify(repository, times(1)).countActiveLearnersPerCatalogPackage("inst-hot");
        }
    }
}
