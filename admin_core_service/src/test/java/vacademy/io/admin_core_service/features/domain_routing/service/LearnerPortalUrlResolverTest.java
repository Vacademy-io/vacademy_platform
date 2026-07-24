package vacademy.io.admin_core_service.features.domain_routing.service;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;
import org.springframework.test.util.ReflectionTestUtils;
import vacademy.io.admin_core_service.features.domain_routing.entity.InstituteDomainRouting;
import vacademy.io.admin_core_service.features.domain_routing.repository.InstituteDomainRoutingRepository;
import vacademy.io.common.institute.entity.Institute;

import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Pins the learner-portal link resolution used by outbound emails. The regression that motivated
 * this: the slide "New Study Material" email shipped a hardcoded {@code http://localhost:3000}
 * CTA to every learner in prod.
 *
 * <p>Chain under test: {@code learner_portal_base_url} → {@code institute_domain_routing}
 * (role=LEARNER) → {@code learner.vacademy.io}. Fixtures use real prod values, because the
 * ordering exists specifically to survive that data.
 */
class LearnerPortalUrlResolverTest {

    /**
     * Deliberately NOT the production literal: if this matched {@code learner.vacademy.io}, every
     * tier-3 assertion below would pass even with the {@code @Value} field deleted or its key
     * typo'd, since the hardcoded fallback returns the same string.
     */
    private static final String CONFIG_DEFAULT = "https://configured.example.com";
    private static final String LITERAL_FALLBACK = "https://learner.vacademy.io";
    private static final String INSTITUTE_ID = "inst-1";

    private InstituteDomainRoutingRepository routingRepository;
    private LearnerPortalUrlResolver resolver;

    @BeforeEach
    void setUp() {
        routingRepository = Mockito.mock(InstituteDomainRoutingRepository.class);
        when(routingRepository.findByInstituteIdAndRole(any(), any())).thenReturn(Optional.empty());
        resolver = new LearnerPortalUrlResolver(routingRepository);
        ReflectionTestUtils.setField(resolver, "defaultLearnerPortalUrl", CONFIG_DEFAULT);
    }

    private static Institute institute(String learnerPortalBaseUrl) {
        Institute institute = new Institute();
        institute.setId(INSTITUTE_ID);
        institute.setLearnerPortalBaseUrl(learnerPortalBaseUrl);
        return institute;
    }

    private void givenRoutingRow(String subdomain, String domain) {
        InstituteDomainRouting routing = new InstituteDomainRouting();
        routing.setSubdomain(subdomain);
        routing.setDomain(domain);
        routing.setRole("LEARNER");
        routing.setInstituteId(INSTITUTE_ID);
        when(routingRepository.findByInstituteIdAndRole(INSTITUTE_ID, "LEARNER"))
                .thenReturn(Optional.of(routing));
    }

    private String resolve(String learnerPortalBaseUrl) {
        return resolver.resolveBaseUrl(INSTITUTE_ID, institute(learnerPortalBaseUrl));
    }

    @Nested
    @DisplayName("Tier 1 — the institute's curated column wins")
    class ColumnWins {

        @Test
        @DisplayName("Schemeless host (the DB default shape) gets https://")
        void schemelessHostGetsScheme() {
            // institutes.learner_portal_base_url is stored host-only, e.g. 'learner.vacademy.io'
            assertEquals("https://student.chanakyaias.in", resolve("student.chanakyaias.in"));
        }

        @Test
        @DisplayName("Existing scheme is preserved, not doubled")
        void existingSchemePreserved() {
            assertEquals("https://training.enarkuplift.in", resolve("https://training.enarkuplift.in"));
        }

        @Test
        @DisplayName("Trailing slash is stripped so a path can be appended")
        void trailingSlashStripped() {
            // iThinkers Olympiad stores exactly this shape in prod.
            assertEquals("https://practice.ithinkersolympiad.com", resolve("practice.ithinkersolympiad.com/"));
        }

        @Test
        @DisplayName("Surrounding whitespace is tolerated")
        void whitespaceTolerated() {
            assertEquals("https://ssdc.vacademy.io", resolve("  ssdc.vacademy.io  "));
        }

        @Test
        @DisplayName("Polluted routing rows are never even read when the column is set")
        void routingNotConsultedWhenColumnPresent() {
            // Shiksha Nation has a 'sn.localhost' LEARNER row; Enark has 16 'admin-*' LEARNER rows.
            // The column must short-circuit before either can be picked.
            givenRoutingRow("sn", "localhost");
            assertEquals("https://learner.shikshanation.com", resolve("learner.shikshanation.com"));
            verify(routingRepository, never()).findByInstituteIdAndRole(any(), any());
        }
    }

    @Nested
    @DisplayName("Tier 2 — domain routing rescues institutes with no column")
    class RoutingFallback {

        @Test
        @DisplayName("Null column falls through to the institute's branded routing host")
        void nullColumnUsesRouting() {
            // IDEED in prod: learner_portal_base_url IS NULL, one LEARNER row.
            givenRoutingRow("learner", "ideedonline.org");
            assertEquals("https://learner.ideedonline.org", resolve(null));
        }

        @Test
        @DisplayName("Blank column falls through to routing")
        void blankColumnUsesRouting() {
            // Vet Education in prod: column is empty string, one LEARNER row.
            givenRoutingRow("vet", "vacademy.io");
            assertEquals("https://vet.vacademy.io", resolve("   "));
        }

        @Test
        @DisplayName("Wildcard subdomain is a catch-all marker, not a label to prepend")
        void wildcardSubdomainNotPrepended() {
            givenRoutingRow("*", "readonrent.vacademy.io");
            assertEquals("https://readonrent.vacademy.io", resolve(null));
        }

        @Test
        @DisplayName("Scheme already on the routing domain is not doubled")
        void routingDomainSchemeStripped() {
            givenRoutingRow("learner", "https://ideedonline.org");
            assertEquals("https://learner.ideedonline.org", resolve(null));
        }

        @Test
        @DisplayName("A dev localhost routing row is skipped rather than emailed")
        void localhostRoutingRowSkipped() {
            givenRoutingRow("sn", "localhost");
            assertEquals(CONFIG_DEFAULT, resolve(null));
        }

        @Test
        @DisplayName("Routing is queried with the LEARNER role")
        void queriesLearnerRole() {
            resolve(null);
            verify(routingRepository).findByInstituteIdAndRole(INSTITUTE_ID, "LEARNER");
        }
    }

    @Nested
    @DisplayName("Tier 3 — falls back to learner.vacademy.io")
    class DefaultFallback {

        @Test
        @DisplayName("No column and no routing row")
        void noColumnNoRouting() {
            assertEquals(CONFIG_DEFAULT, resolve(null));
        }

        @Test
        @DisplayName("Institute could not be loaded at all")
        void nullInstitute() {
            assertEquals(CONFIG_DEFAULT, resolver.resolveBaseUrl(INSTITUTE_ID, null));
        }

        @Test
        @DisplayName("No instituteId means routing cannot be consulted")
        void nullInstituteId() {
            assertEquals(CONFIG_DEFAULT, resolver.resolveBaseUrl(null, null));
            verify(routingRepository, never()).findByInstituteIdAndRole(any(), any());
        }

        @Test
        @DisplayName("A localhost column never reaches a learner's inbox")
        void localhostColumnIgnored() {
            assertEquals(CONFIG_DEFAULT, resolve("http://localhost:3000"));
            assertEquals(CONFIG_DEFAULT, resolve("ssdc.localhost"));
            assertEquals(CONFIG_DEFAULT, resolve("127.0.0.1:3000"));
        }

        @Test
        @DisplayName("A single-label host that cannot resolve publicly is ignored")
        void singleLabelHostIgnored() {
            assertEquals(CONFIG_DEFAULT, resolve("student"));
        }
    }

    @Nested
    @DisplayName("Degrades instead of propagating")
    class Degrades {

        @Test
        @DisplayName("A failing routing query does not propagate out of the resolver")
        void routingQueryFailureDoesNotPropagate() {
            // Scope note: this proves the RESOLVER does not propagate. It does NOT prove the
            // caller's transaction survives — the repository participates in that transaction, so
            // Spring flags it rollback-only before the catch runs. No unit test can assert
            // otherwise, and the javadoc no longer claims it.
            when(routingRepository.findByInstituteIdAndRole(any(), eq("LEARNER")))
                    .thenThrow(new RuntimeException("connection reset"));
            assertEquals(CONFIG_DEFAULT, resolve(null));
        }

        @Test
        @DisplayName("Unusable config falls back to the hardcoded literal, not an exception")
        void garbageConfigFallsBackToLiteral() {
            ReflectionTestUtils.setField(resolver, "defaultLearnerPortalUrl", "");
            assertEquals(LITERAL_FALLBACK, resolve(null));

            ReflectionTestUtils.setField(resolver, "defaultLearnerPortalUrl", "/");
            assertEquals(LITERAL_FALLBACK, resolve(null));

            ReflectionTestUtils.setField(resolver, "defaultLearnerPortalUrl", null);
            assertEquals(LITERAL_FALLBACK, resolve(null));
        }
    }
}
