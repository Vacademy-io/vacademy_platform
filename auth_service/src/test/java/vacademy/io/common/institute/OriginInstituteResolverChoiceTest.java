package vacademy.io.common.institute;

import org.junit.jupiter.api.Test;

import java.util.Arrays;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;

/**
 * Covers {@link OriginInstituteResolver#chooseInstituteIdFor}, which decides whose address a
 * credentials / invitation / welcome mail is sent from.
 *
 * <p>These run with no request context and no configured admin-core URL — deliberately, because
 * that is the degraded state (async threads, scheduled jobs, misconfiguration) and the rule that
 * matters most is that it stays as good as the behaviour it replaced. The single-institute case
 * must also answer without a lookup: that is ~98.8% of users, and making them pay for an HTTP
 * call to resolve something unambiguous would be a poor trade.
 */
class OriginInstituteResolverChoiceTest {

    private final OriginInstituteResolver resolver = new OriginInstituteResolver();

    private static final String SN = "35675130-7c65-41d6-a869-0811d2e1753e";
    private static final String OTHER = "aaaaaaaa-0000-0000-0000-000000000000";

    @Test
    void returnsNullWhenUserHasNoInstitute() {
        assertNull(resolver.chooseInstituteIdFor(null));
        assertNull(resolver.chooseInstituteIdFor(List.of()));
    }

    @Test
    void returnsNullWhenEveryCandidateIsBlank() {
        // A role row with a null institute_id must not become a blank "institute" downstream.
        assertNull(resolver.chooseInstituteIdFor(Arrays.asList(null, "", "   ")));
    }

    @Test
    void returnsTheOnlyInstituteWithoutConsultingTheHost() {
        // No request context here, so a host lookup could only have returned null — getting SN
        // back proves the single-candidate short circuit ran instead.
        assertEquals(SN, resolver.chooseInstituteIdFor(List.of(SN)));
        // Duplicates across several roles in the same institute still count as one candidate.
        assertEquals(SN, resolver.chooseInstituteIdFor(List.of(SN, SN, SN)));
        // Blanks are filtered before the count, so this is still unambiguous.
        assertEquals(SN, resolver.chooseInstituteIdFor(Arrays.asList(null, SN, "")));
    }

    @Test
    void fallsBackToTheFirstCandidateWhenTheHostCannotDisambiguate() {
        // The historical behaviour. Wrong-but-plausible beats sending nothing, because the caller
        // treats a null institute as "use the platform default", which is a white-label leak.
        assertEquals(SN, resolver.chooseInstituteIdFor(List.of(SN, OTHER)));
    }
}
