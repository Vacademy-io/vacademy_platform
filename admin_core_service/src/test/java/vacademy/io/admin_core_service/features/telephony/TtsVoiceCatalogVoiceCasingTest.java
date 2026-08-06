package vacademy.io.admin_core_service.features.telephony;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import vacademy.io.admin_core_service.features.telephony.core.TtsVoiceCatalog;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * Google voice ids are case-sensitive at the vendor; everything on our side is
 * case-insensitive. That mismatch cost a whole afternoon on 2026-08-06 — the
 * founder chose a FEMALE Chirp3-HD voice, we stored it lowercased, Google
 * rejected it, the bot fell back to Sarvam, and every call came out MALE with
 * nothing in any log or panel explaining it.
 */
class TtsVoiceCatalogVoiceCasingTest {

    @Test
    @DisplayName("any casing a client sends resolves to the catalog's own spelling")
    void canonicalises_whatever_the_client_sends() {
        String want = "hi-IN-Chirp3-HD-Achernar";
        for (String sent : new String[]{
                want,                              // already correct
                "hi-in-chirp3-hd-achernar",        // what we used to STORE
                "Hi-IN-Chirp3-HD-Achernar",        // what the picker displays
                "  HI-IN-CHIRP3-HD-ACHERNAR  "}) { // shouting, padded
            assertEquals(want, TtsVoiceCatalog.canonicalVoice("google", sent),
                    "did not canonicalise: " + sent);
        }
    }

    @Test
    @DisplayName("a cross-vendor or unknown voice canonicalises to null, not a guess")
    void rejects_what_is_not_in_the_palette() {
        assertNull(TtsVoiceCatalog.canonicalVoice("google", "priya"));   // Sarvam's
        assertNull(TtsVoiceCatalog.canonicalVoice("google", "ira"));     // Rumik's
        assertNull(TtsVoiceCatalog.canonicalVoice("google", "hi-IN-Chirp3-HD-Nope"));
        assertNull(TtsVoiceCatalog.canonicalVoice("google", "   "));
        assertNull(TtsVoiceCatalog.canonicalVoice("google", null));
    }

    @Test
    @DisplayName("the female voices survive canonicalisation with their case intact")
    void female_voices_keep_their_casing() {
        for (String id : new String[]{"hi-IN-Chirp3-HD-Achernar", "hi-IN-Chirp3-HD-Aoede",
                "hi-IN-Chirp3-HD-Kore", "hi-IN-Chirp3-HD-Leda",
                "hi-IN-Chirp3-HD-Zephyr", "hi-IN-Chirp3-HD-Sulafat"}) {
            assertEquals(id, TtsVoiceCatalog.canonicalVoice("google", id.toLowerCase()));
            assertTrue(TtsVoiceCatalog.isVoiceOf("google", id.toLowerCase()));
        }
    }

    @Test
    @DisplayName("lowercase engines are unaffected — their names really are lowercase")
    void other_engines_unchanged() {
        assertEquals("priya", TtsVoiceCatalog.canonicalVoice("sarvam", "PRIYA"));
        assertEquals("ira", TtsVoiceCatalog.canonicalVoice("rumik", "Ira"));
    }
}
