package vacademy.io.admin_core_service.features.telephony.core;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import vacademy.io.admin_core_service.features.audience.service.TokenEncryptionService;
import vacademy.io.admin_core_service.features.telephony.enums.ConfigRole;
import vacademy.io.admin_core_service.features.telephony.enums.ProviderType;
import vacademy.io.admin_core_service.features.telephony.persistence.entity.InstituteTelephonyConfig;
import vacademy.io.admin_core_service.features.telephony.persistence.repository.InstituteTelephonyConfigRepository;
import vacademy.io.admin_core_service.features.telephony.persistence.repository.TelephonyProviderNumberRepository;

import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.when;

/**
 * V448 split the AI calling carrier from the human telephony provider. The entire
 * safety argument for that change is these four properties, so they are asserted
 * rather than reasoned about:
 *
 * <ol>
 *   <li>An institute with no dedicated AI line resolves EXACTLY as before — that is
 *       what keeps the institutes already running Vacademy Voice untouched.</li>
 *   <li>A dedicated AI line never leaks into the human-calling path.</li>
 *   <li>A disabled AI line falls back instead of breaking every dial.</li>
 *   <li>A PRIMARY row never exposes an AI caller-ID, so existing caller-ID
 *       resolution is bit-for-bit unchanged.</li>
 * </ol>
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class AiVoiceCarrierResolutionTest {

    private static final String INSTITUTE = "inst-1";

    @Mock private InstituteTelephonyConfigRepository configRepo;
    @Mock private TelephonyProviderNumberRepository numberRepo;
    @Mock private TokenEncryptionService tokenEncryption;

    @InjectMocks private TelephonyConfigCache cache;

    private void stubCommon() {
        when(numberRepo.findEnabledByConfigId(any())).thenReturn(List.of());
        when(tokenEncryption.decrypt(anyString())).thenAnswer(inv -> inv.getArgument(0));
    }

    private static InstituteTelephonyConfig config(String role, String provider, boolean enabled,
                                                   String providerConfigJson) {
        return InstituteTelephonyConfig.builder()
                .id("cfg-" + role)
                .instituteId(INSTITUTE)
                .role(role)
                .providerType(provider)
                .enabled(enabled)
                .providerConfig(providerConfigJson)
                .build();
    }

    private void givenPrimary(InstituteTelephonyConfig cfg) {
        when(configRepo.findByInstituteIdAndRole(INSTITUTE, ConfigRole.PRIMARY))
                .thenReturn(Optional.ofNullable(cfg));
    }

    private void givenAiVoice(InstituteTelephonyConfig cfg) {
        when(configRepo.findByInstituteIdAndRole(INSTITUTE, ConfigRole.AI_VOICE))
                .thenReturn(Optional.ofNullable(cfg));
    }

    @Test
    @DisplayName("no dedicated line: AI calls resolve to the primary provider, exactly as pre-V448")
    void falls_back_to_primary_when_no_ai_line() {
        stubCommon();
        givenPrimary(config(ConfigRole.PRIMARY, ProviderType.PLIVO, true, "{\"authId\":\"SA_TEAM\"}"));
        givenAiVoice(null);

        var ai = cache.getForAi(INSTITUTE).orElseThrow();
        assertEquals("cfg-PRIMARY", ai.getConfig().getId());
        assertFalse(ai.isDedicatedAiCarrier());
        // and it is literally the same resolution the human path gets
        assertEquals(cache.get(INSTITUTE).orElseThrow().getConfig().getId(), ai.getConfig().getId());
    }

    @Test
    @DisplayName("dedicated line: AI uses Plivo while humans keep using Airtel")
    void dedicated_line_does_not_touch_human_calling() {
        stubCommon();
        givenPrimary(config(ConfigRole.PRIMARY, ProviderType.AIRTEL, true, "{\"accountId\":\"439357\"}"));
        givenAiVoice(config(ConfigRole.AI_VOICE, ProviderType.PLIVO, true,
                "{\"authId\":\"SA_AI\",\"callerId\":\"+918047283949\"}"));

        var human = cache.get(INSTITUTE).orElseThrow();
        assertEquals(ProviderType.AIRTEL, human.getConfig().getProviderType(),
                "human calling must stay on the primary provider");

        var ai = cache.getForAi(INSTITUTE).orElseThrow();
        assertEquals(ProviderType.PLIVO, ai.getConfig().getProviderType());
        assertTrue(ai.isDedicatedAiCarrier());
        assertEquals("+918047283949", ai.getAiCallerId());
    }

    @Test
    @DisplayName("a DISABLED AI line falls back to the primary instead of blocking every dial")
    void disabled_ai_line_falls_back() {
        stubCommon();
        givenPrimary(config(ConfigRole.PRIMARY, ProviderType.PLIVO, true, "{}"));
        givenAiVoice(config(ConfigRole.AI_VOICE, ProviderType.PLIVO, false, "{\"callerId\":\"+911111111111\"}"));

        var ai = cache.getForAi(INSTITUTE).orElseThrow();
        assertEquals("cfg-PRIMARY", ai.getConfig().getId());
    }

    @Test
    @DisplayName("forCallProvider routes only VACADEMY_AI rows to the AI line")
    void routes_by_the_calls_own_provider() {
        stubCommon();
        givenPrimary(config(ConfigRole.PRIMARY, ProviderType.AIRTEL, true, "{}"));
        givenAiVoice(config(ConfigRole.AI_VOICE, ProviderType.PLIVO, true, "{\"callerId\":\"+912222222222\"}"));

        assertEquals(ProviderType.PLIVO,
                cache.forCallProvider(INSTITUTE, ProviderType.VACADEMY_AI)
                        .orElseThrow().getConfig().getProviderType());
        for (String humanProvider : new String[]{ProviderType.AIRTEL, ProviderType.EXOTEL,
                ProviderType.PLIVO, ProviderType.AAVTAAR, null}) {
            assertEquals(ProviderType.AIRTEL,
                    cache.forCallProvider(INSTITUTE, humanProvider)
                            .orElseThrow().getConfig().getProviderType(),
                    "non-AI call wrongly routed to the AI line for provider " + humanProvider);
        }
    }

    @Test
    @DisplayName("a PRIMARY row never yields an AI caller-ID, even if the key is present")
    void primary_never_exposes_an_ai_caller_id() {
        stubCommon();
        // A callerId key on a PRIMARY row must stay inert: Vacademy Voice institutes
        // resolve their caller-ID from the number pool + voice settings, and quietly
        // preferring a config key would change which number their AI calls come from.
        givenPrimary(config(ConfigRole.PRIMARY, ProviderType.PLIVO, true,
                "{\"authId\":\"SA_TEAM\",\"callerId\":\"+919999999999\"}"));
        givenAiVoice(null);

        assertNull(cache.getForAi(INSTITUTE).orElseThrow().getAiCallerId());
    }

    @Test
    @DisplayName("evict clears both roles")
    void evict_clears_both_caches() {
        stubCommon();
        givenPrimary(config(ConfigRole.PRIMARY, ProviderType.AIRTEL, true, "{}"));
        givenAiVoice(null);
        cache.get(INSTITUTE);
        cache.getForAi(INSTITUTE);

        // The AI line is linked after both roles were already cached.
        givenAiVoice(config(ConfigRole.AI_VOICE, ProviderType.PLIVO, true, "{\"callerId\":\"+913333333333\"}"));
        assertFalse(cache.getForAi(INSTITUTE).orElseThrow().isDedicatedAiCarrier(),
                "precondition: the empty AI lookup is cached");

        cache.evict(INSTITUTE);
        assertTrue(cache.getForAi(INSTITUTE).orElseThrow().isDedicatedAiCarrier(),
                "evict must drop the AI-role entry too, or a freshly linked line is ignored for 5 minutes");
    }

    @Test
    @DisplayName("caller-ID is normalised to E.164 — Plivo bars a bare 10-digit number")
    void caller_id_normalisation() {
        assertEquals("+918047283949", AiVoiceCarrierService.normalizeCallerId("8047283949"));
        assertEquals("+918047283949", AiVoiceCarrierService.normalizeCallerId("08047283949"));
        assertEquals("+918047283949", AiVoiceCarrierService.normalizeCallerId("+91 80 4728 3949"));
        assertEquals("+918047283949", AiVoiceCarrierService.normalizeCallerId("918047283949"));
        assertEquals("", AiVoiceCarrierService.normalizeCallerId("   "));
        assertNull(AiVoiceCarrierService.normalizeCallerId(null));
    }
}
