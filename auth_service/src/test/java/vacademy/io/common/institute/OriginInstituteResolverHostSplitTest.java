package vacademy.io.common.institute;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertArrayEquals;
import static org.junit.jupiter.api.Assertions.assertNull;

/**
 * Covers the host → {@code {domain, subdomain}} split that decides whether the Origin fallback
 * can find an institute at all.
 *
 * <p>Worth pinning down because every failure here is silent: a wrong split just misses the
 * {@code institute_domain_routing} row, the resolver returns null exactly as it does when the
 * feature is off, and the OTP goes out from {@code support@vacademy.io} with Vacademy branding —
 * the very bug this class exists to prevent, with no error anywhere to show for it.
 *
 * <p>Lives in auth_service's test tree (and in the class's own package, to reach the
 * package-private method) because common_service has no test infrastructure of its own.
 */
class OriginInstituteResolverHostSplitTest {

    @Test
    void splitsWhiteLabelledCustomDomain() {
        // The case from the bug report: a Shiksha Nation admin logging in on their own domain.
        assertArrayEquals(new String[] { "shikshanation.com", "admin" },
                OriginInstituteResolver.splitHost("admin.shikshanation.com"));
    }

    @Test
    void splitsVacademySubdomain() {
        assertArrayEquals(new String[] { "vacademy.io", "learner" },
                OriginInstituteResolver.splitHost("learner.vacademy.io"));
        // Hyphenated institute subdomains are real rows in institute_domain_routing.
        assertArrayEquals(new String[] { "vacademy.io", "shiksha-nation" },
                OriginInstituteResolver.splitHost("shiksha-nation.vacademy.io"));
    }

    @Test
    void keepsMultiLabelDomainIntact() {
        // Everything after the first label is the domain — not just the last two labels.
        assertArrayEquals(new String[] { "co.uk", "admin" },
                OriginInstituteResolver.splitHost("admin.co.uk"));
        assertArrayEquals(new String[] { "portal.shikshanation.com", "admin" },
                OriginInstituteResolver.splitHost("admin.portal.shikshanation.com"));
    }

    @Test
    void skipsLeadingWww() {
        assertArrayEquals(new String[] { "shikshanation.com", "admin" },
                OriginInstituteResolver.splitHost("www.admin.shikshanation.com"));
    }

    @Test
    void returnsNullWhenThereIsNoSubdomain() {
        // A bare apex maps to no portal row, so there is nothing to look up.
        assertNull(OriginInstituteResolver.splitHost("shikshanation.com"));
        assertNull(OriginInstituteResolver.splitHost("localhost"));
        // "www" alone is stripped, leaving an apex — still nothing to look up.
        assertNull(OriginInstituteResolver.splitHost("www.shikshanation.com"));
    }
}
