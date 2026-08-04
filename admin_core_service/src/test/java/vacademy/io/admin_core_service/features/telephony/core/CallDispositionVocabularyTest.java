package vacademy.io.admin_core_service.features.telephony.core;

import com.fasterxml.jackson.databind.DeserializationFeature;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import vacademy.io.admin_core_service.features.telephony.core.dto.AiCallingSettingsPojo;

import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

/**
 * The Call Log's disposition vocabulary — the two halves that decide whether a
 * filter selection can ever match a call.
 *
 * <p>No Spring context: {@code configuredDispositions()} is pure, and
 * {@code normalizeKey} is the static join key the search SQL applies to
 * {@code COALESCE(disposition_key, ai_disposition)}.
 */
class CallDispositionVocabularyTest {

    /** Same deserialisation AiCallingSettingsService performs on AI_CALLING_SETTING. */
    private final ObjectMapper mapper = new ObjectMapper()
            .configure(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES, false);

    // ── The custom-outcome path: Settings → AI Calling ➜ filter dropdown ──────

    @Test
    void customDisposition_savedInSettings_survivesDeserialisationAndIsOffered() {
        // Exactly what the settings tab persists after "Add custom outcome".
        Map<String, Object> saved = Map.of(
                "enabled", true,
                "customDispositions", List.of("Demo_Book", "Fee Discussed"),
                "assignOnDispositions", List.of("Interested"),
                "stopOnDispositions", List.of("Not_Interested"));

        AiCallingSettingsPojo pojo = mapper.convertValue(saved, AiCallingSettingsPojo.class);

        // Regression guard: the pojo used to ignore this key entirely (unknown
        // property), so a custom outcome could never reach the filter.
        assertEquals(List.of("Demo_Book", "Fee Discussed"), pojo.getCustomDispositions());
        assertTrue(pojo.configuredDispositions().contains("Demo_Book"));
        assertTrue(pojo.configuredDispositions().contains("Fee Discussed"));
    }

    @Test
    void configuredDispositions_coversBuiltInsCustomAndAssignStopLists() {
        AiCallingSettingsPojo s = new AiCallingSettingsPojo();
        s.setCustomDispositions(List.of("Demo_Book"));
        s.setAssignOnDispositions(List.of("Interested", "Wants_Brochure"));
        s.setStopOnDispositions(List.of("Not_Interested"));

        List<String> all = s.configuredDispositions();

        assertTrue(all.containsAll(AiCallingSettingsPojo.BUILT_IN_DISPOSITIONS),
                "built-in vocabulary must always be offered");
        assertTrue(all.contains("Demo_Book"), "custom outcome must be offered");
        assertTrue(all.contains("Wants_Brochure"),
                "an outcome referenced only by the assign list must still be offered");
    }

    @Test
    void configuredDispositions_deDuplicatesCaseInsensitivelyKeepingFirstSpelling() {
        AiCallingSettingsPojo s = new AiCallingSettingsPojo();
        // "Interested" is a built-in; the assign list repeats it in another case.
        s.setAssignOnDispositions(List.of("INTERESTED"));
        s.setStopOnDispositions(List.of());
        s.setCustomDispositions(List.of());

        List<String> all = s.configuredDispositions();

        assertEquals(1, all.stream().filter(d -> d.equalsIgnoreCase("Interested")).count(),
                "one outcome must not appear twice in the dropdown");
        assertTrue(all.contains("Interested"), "the built-in spelling wins");
    }

    @Test
    void configuredDispositions_toleratesNullAndBlankEntries() {
        AiCallingSettingsPojo s = new AiCallingSettingsPojo();
        s.setCustomDispositions(java.util.Arrays.asList(null, "  ", "Fee_Discussed"));
        s.setAssignOnDispositions(null);
        s.setStopOnDispositions(null);

        List<String> all = s.configuredDispositions();

        assertTrue(all.contains("Fee_Discussed"));
        assertTrue(all.stream().noneMatch(d -> d == null || d.isBlank()));
    }

    // ── The match key: one outcome, however it is spelled ─────────────────────

    @Test
    void normalizeKey_collapsesEverySpellingOfOneOutcome() {
        // catalog code / AI-settings value / a hand-typed agent value.
        String catalog = CallDispositionOptionsService.normalizeKey("NOT_INTERESTED");
        assertEquals("NOTINTERESTED", catalog);
        assertEquals(catalog, CallDispositionOptionsService.normalizeKey("Not_Interested"));
        assertEquals(catalog, CallDispositionOptionsService.normalizeKey("Not Interested"));
        assertEquals(catalog, CallDispositionOptionsService.normalizeKey("not-interested"));
    }

    @Test
    void normalizeKey_keepsDistinctOutcomesDistinct() {
        assertNotEquals(CallDispositionOptionsService.normalizeKey("Demo_Book"),
                CallDispositionOptionsService.normalizeKey("Demo_Booked"));
        assertNotEquals(CallDispositionOptionsService.normalizeKey("Callback"),
                CallDispositionOptionsService.normalizeKey("Callback_Requested"));
    }

    @Test
    void normalizeKey_blankAndNullYieldEmpty_soTheyAreNeverFilteredOn() {
        assertEquals("", CallDispositionOptionsService.normalizeKey(null));
        assertEquals("", CallDispositionOptionsService.normalizeKey(""));
        assertEquals("", CallDispositionOptionsService.normalizeKey("  _- "));
    }
}
