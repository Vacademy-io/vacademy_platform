package vacademy.io.admin_core_service.features.telephony.core;

import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * AAIBUZZ/IRPL calls c43e9ce7, e6cb5f47 (2026-10-16): a thin non-education script that never
 * said what it sells or why it calls; the bot invented an edtech product and booked a demo.
 * The assistant now warns about such a script (advisory only), and only for non-education
 * agents. All agents here are synthetic.
 */
class AiAgentAssistGroundingTest {

    private static final String THIN_GENERAL = "You are a friendly, professional calling assistant for "
            + "Acme. Confirm you are speaking with the right person, briefly explain why you are calling, "
            + "answer their questions politely and concisely, and capture their interest level. Never "
            + "invent prices, dates or facts; if unsure, say a team member will follow up. If the person "
            + "is busy, ask for a convenient callback time. End the call politely.";
    private static final String OPENING = "Hello, is this {{name}}? I am calling from Acme.";

    private static AiAgentAssistService.AgentContext agent(String name, List<String> questions,
                                                           List<String> outcomes) {
        return new AiAgentAssistService.AgentContext(name, "hinglish", OPENING, null, questions, outcomes);
    }

    private static final AiAgentAssistService.AgentContext ACME = agent("Acme Caller",
            List.of("Is the person interested?"), List.of("Interested", "Callback", "Not_Interested"));

    private static boolean hasGrounding(List<String> issues) {
        return issues.stream().anyMatch(i -> i.startsWith(AiAgentAssistService.GROUNDING_LINT_PREFIX));
    }

    @Test
    void thinNonEducationScriptIsWarnedAboutBothGaps() {
        List<String> issues = AiAgentAssistService.lint(THIN_GENERAL, OPENING, "hinglish", ACME);
        assertTrue(hasGrounding(issues), issues.toString());
        assertTrue(issues.stream().anyMatch(i -> i.contains("what you offer or why you are calling")),
                issues.toString());
    }

    @Test
    void namesOnlyTheGapThatIsThere() {
        String offerOnly = THIN_GENERAL + " Acme is a home-solar installation company; we install rooftop panels.";
        String f = AiAgentAssistService.groundingFinding(offerOnly, OPENING, ACME);
        assertTrue(f != null && f.contains("why you are calling this person") && !f.contains("what you offer"), f);

        String reasonOnly = THIN_GENERAL + " They enquired on our website yesterday.";
        String g = AiAgentAssistService.groundingFinding(reasonOnly, OPENING, ACME);
        assertTrue(g != null && g.contains("what you offer") && !g.contains("why you are calling"), g);

        String both = THIN_GENERAL + " We install rooftop solar panels. They enquired on our website.";
        assertNull(AiAgentAssistService.groundingFinding(both, OPENING, ACME));
        String hindi = "आप Acme से हैं। हम rooftop solar panel लगाते हैं — हम installation करते हैं। "
                + "आपने website पर enquiry की थी, उसी के बारे में call है।";
        assertNull(AiAgentAssistService.groundingFinding(hindi, OPENING, ACME));
    }

    @Test
    void educationScriptsAreNeverWarnedAndTheirLintIsUnchanged() {
        // Thin, no offer, no reason — but education: today's findings exactly.
        String prompt = "Step 1: पूछिए \"आपका बच्चा किस क्लास में है?\" फिर step 2 पर जाइए।";
        assertEquals(AiAgentAssistService.lint(prompt, OPENING, "hinglish"),
                AiAgentAssistService.lint(prompt, OPENING, "hinglish", ACME));
        assertFalse(hasGrounding(AiAgentAssistService.lint(prompt, OPENING, "hinglish", ACME)));
        // The signal may sit in the agent's other fields only.
        AiAgentAssistService.AgentContext admissions = agent("Admissions Desk", List.of(), List.of());
        assertNull(AiAgentAssistService.groundingFinding(THIN_GENERAL, OPENING, admissions));
        AiAgentAssistService.AgentContext demoClass = agent("Acme", List.of(), List.of("Demo_Class_Booked"));
        assertNull(AiAgentAssistService.groundingFinding(THIN_GENERAL, OPENING, demoClass));
        // Blank script = legacy.
        assertNull(AiAgentAssistService.groundingFinding("  ", OPENING, ACME));
    }

    @Test
    void theAdvisoryNeverTriggersTheRepairPass() {
        // A "fix" would have to invent the offer and the reason.
        assertEquals(List.of(), AiAgentAssistService.fixable(
                Map.of("prompt", THIN_GENERAL, "opening_line", OPENING), ACME));
    }

    @Test
    void domainClassifierMatchesTheVoiceBot() {
        assertTrue(AiAgentDomain.hasEducationSignal("आपके बच्चे की पढ़ाई"));
        assertTrue(AiAgentDomain.hasEducationSignal("Aap bachche ki padhai ke baare mein"));
        assertTrue(AiAgentDomain.hasEducationSignal("Demo_Class_Booked"));
        assertTrue(AiAgentDomain.hasEducationSignal("We sell an LMS to coaching institutes"));
        assertFalse(AiAgentDomain.hasEducationSignal("Share a case study if they want to learn more."));
        assertFalse(AiAgentDomain.hasEducationSignal("We restore classic cars and upgrade trademarks."));
        assertFalse(AiAgentDomain.isGeneral(""));
        assertFalse(AiAgentDomain.isGeneral(null, "anything"));
        assertTrue(AiAgentDomain.isGeneral(THIN_GENERAL, OPENING, null));
    }
}
