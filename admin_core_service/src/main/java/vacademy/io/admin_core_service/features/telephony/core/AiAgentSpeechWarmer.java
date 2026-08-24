package vacademy.io.admin_core_service.features.telephony.core;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Component;
import vacademy.io.admin_core_service.features.telephony.core.dto.AiAgentDTO;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * Pre-renders an agent's FIXED lines into the voice bot's speech cache when the
 * agent is saved, so they are served from cache on call #1 rather than after the
 * cache has slowly learned them.
 *
 * <p>WHY ONLY THESE LINES. The bot's own utterances — the scripted opening, the
 * farewells, the nudge, the transfer-fail closing — never pass through the LLM,
 * are authored by an admin, and each is spoken as a standalone pipecat audio
 * context. That makes them the one class of sentence we can render ahead of time
 * without having to decide whether a caller really heard it. Everything the LLM
 * says has to earn its place in the cache the slow way, from calls that worked.
 *
 * <p>WHY IT CANNOT FAIL A SAVE. This spends money (each render is a vendor
 * synthesis) and crosses an ocean (admin core in Singapore, bot in Mumbai). An
 * admin pressing Save must never see either. Fire-and-forget, exactly like
 * {@link vacademy.io.admin_core_service.features.telephony.ivr.IvrPromptWarmer}:
 * a warm that fails simply means the first calls pay the vendor, as they do today.
 *
 * <p>The handbacks and fillers are deliberately NOT sent from here. They are
 * chosen inside the bot from the agent's language, so the bot warms them itself
 * on first use rather than having two places agree on the same literals.
 */
@Component
public class AiAgentSpeechWarmer {

    private static final Logger log = LoggerFactory.getLogger(AiAgentSpeechWarmer.class);

    /** Terminal punctuation, matching the bot's own completeness gate. A line
     *  without it is refused there, so there is no point paying to send it. */
    private static final String TERMINAL = ".!?।…";

    private final ObjectMapper mapper = new ObjectMapper();
    private final HttpClient http = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(5)).build();

    @Value("${telephony.vacademy-ai.bot-base-url:}")
    private String botBaseUrl;

    /** Same secret the bot mints its single-use /ws tokens from, so no new
     *  credential is introduced for this path. */
    @Value("${telephony.vacademy-ai.client-secret:${VOICE_BOT_CLIENT_SECRET:}}")
    private String clientSecret;

    @Async
    public void warm(AiAgentDTO agent) {
        if (agent == null) return;
        // NOTHING happens for an agent whose cache is OFF — which is every agent
        // until someone deliberately turns one on (V466 defaults the column to
        // OFF for every existing row). Warming regardless would spend a vendor
        // render, and disk, on every agent save across every institute for a
        // feature none of them are using.
        String mode = agent.getSpeechCacheMode() == null
                ? "OFF" : agent.getSpeechCacheMode().trim().toUpperCase();
        if (mode.equals("OFF")) return;
        if (botBaseUrl == null || botBaseUrl.isBlank()
                || clientSecret == null || clientSecret.isBlank()) {
            return;                                   // not wired on this deployment
        }
        List<String> texts = fixedLines(agent);
        if (texts.isEmpty()) return;
        try {
            Map<String, Object> body = new LinkedHashMap<>();
            body.put("engine", engineOf(agent));
            body.put("model", "");                    // the bot resolves its own default
            body.put("voice", agent.getVoice() == null ? "" : agent.getVoice());
            body.put("pace", agent.getPace());
            body.put("temperature", agent.getTemperature());
            body.put("texts", texts);

            String url = botBaseUrl.trim().replaceAll("/$", "")
                    + "/voice-bot-service/internal/tts-cache/warm";
            HttpRequest req = HttpRequest.newBuilder(URI.create(url))
                    .timeout(Duration.ofSeconds(90))  // N vendor renders, serially
                    .header("Content-Type", "application/json")
                    .header("X-Voice-Bot-Token", clientSecret)
                    .POST(HttpRequest.BodyPublishers.ofString(mapper.writeValueAsString(body)))
                    .build();
            HttpResponse<String> res = http.send(req, HttpResponse.BodyHandlers.ofString());
            log.info("ai agent speech warm ({}) agent={} lines={} -> {}",
                    res.statusCode(), agent.getId(), texts.size(),
                    res.body() == null ? "" : res.body().substring(0, Math.min(120, res.body().length())));
        } catch (Exception e) {
            log.warn("ai agent speech warm failed agent={}: {}", agent.getId(), e.getMessage());
        }
    }

    /**
     * The agent-specific fixed lines. A LinkedHashSet because the opening can
     * coincide with nothing else but duplicates cost a vendor render each.
     *
     * <p>Only the opening is agent-authored; the rest are the bot's own literals
     * and are warmed by the bot. What we can usefully pre-render from here is the
     * opening — the longest single utterance on the call, spoken on 100% of them,
     * and the one whose latency the runbook ties to the caller's "hello?"
     * cancelling it.
     */
    private List<String> fixedLines(AiAgentDTO agent) {
        Set<String> out = new LinkedHashSet<>();
        String opening = agent.getOpeningLine() == null ? "" : agent.getOpeningLine().trim();
        // A placeholder is filled per call, so the rendered audio would never be
        // reused. Those are left to the learn path, which picks them up once a
        // given name recurs.
        if (!opening.isEmpty() && !opening.contains("{{") && complete(opening)) {
            out.add(opening);
        }
        return new ArrayList<>(out);
    }

    private static boolean complete(String s) {
        String t = s.strip();
        while (!t.isEmpty() && "\"'’”)]".indexOf(t.charAt(t.length() - 1)) >= 0) {
            t = t.substring(0, t.length() - 1).strip();
        }
        return !t.isEmpty() && TERMINAL.indexOf(t.charAt(t.length() - 1)) >= 0;
    }

    /**
     * Must match what the BOT will actually construct, not merely what is stored.
     * An agent with no engine falls back to sarvam in both the bot and the billing
     * path, so it does here too — warming a google key for an agent that will
     * speak through Sarvam would just waste a render and never hit.
     */
    private static String engineOf(AiAgentDTO agent) {
        String m = agent.getTtsModel() == null ? "" : agent.getTtsModel().trim().toLowerCase();
        if (m.startsWith("google") || m.startsWith("chirp")) return "google";
        if (m.startsWith("edge")) return "edge";
        if (m.startsWith("smallest") || m.startsWith("lightning")) return "smallest";
        if (m.startsWith("rumik") || m.startsWith("silk")) return "rumik";
        if (m.startsWith("deepgram") || m.startsWith("aura")) return "deepgram";
        return "sarvam";
    }
}
