package vacademy.io.admin_core_service.features.telephony.core;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import vacademy.io.admin_core_service.features.institute.dto.settings.GenericSettingRequest;
import vacademy.io.admin_core_service.features.institute.enums.SettingKeyEnums;
import vacademy.io.admin_core_service.features.institute.repository.InstituteRepository;
import vacademy.io.admin_core_service.features.institute.service.setting.InstituteSettingService;
import vacademy.io.admin_core_service.features.telephony.core.dto.AiAgentDTO;
import vacademy.io.admin_core_service.features.telephony.enums.ProviderType;
import vacademy.io.admin_core_service.features.telephony.persistence.entity.AiAgent;
import vacademy.io.admin_core_service.features.telephony.persistence.repository.AiAgentRepository;
import vacademy.io.common.exceptions.VacademyException;
import vacademy.io.common.institute.entity.Institute;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

/**
 * CRUD for the AI-agent registry + the settings bridge: every save/delete
 * mirrors the agent into {@code AI_CALLING_SETTING.campaigns} as
 * {@code {name, campaignId = agent.id, direction, provider = VACADEMY_AI}} —
 * so the CALL_AI node's name-based {@code resolveCampaignId}, the inbound
 * campaign classifier and the Aavtaar coexistence all keep working unchanged.
 *
 * <p>The bridge mutates the RAW settings map (not the server pojo): the frontend
 * stores fields the pojo doesn't model, and a pojo round-trip would silently
 * drop them.
 */
@Service
@RequiredArgsConstructor
public class AiAgentService {

    private static final Logger log = LoggerFactory.getLogger(AiAgentService.class);

    private final AiAgentRepository repo;
    private final InstituteRepository instituteRepository;
    private final InstituteSettingService instituteSettingService;

    private final ObjectMapper mapper = new ObjectMapper();

    public List<AiAgentDTO> list(String instituteId) {
        return repo.findByInstituteIdOrderByCreatedAtDesc(instituteId).stream()
                .map(this::toDto)
                .toList();
    }

    public Optional<AiAgent> find(String agentId, String instituteId) {
        return repo.findByIdAndInstituteId(agentId, instituteId);
    }

    @Transactional
    public AiAgentDTO save(AiAgentDTO dto) {
        if (dto.getInstituteId() == null || dto.getInstituteId().isBlank()) {
            throw new VacademyException("instituteId is required");
        }
        if (dto.getName() == null || dto.getName().isBlank()) {
            throw new VacademyException("Agent name is required");
        }

        AiAgent agent = (dto.getId() != null && !dto.getId().isBlank())
                ? repo.findByIdAndInstituteId(dto.getId(), dto.getInstituteId())
                        .orElseThrow(() -> new VacademyException("Agent not found"))
                : new AiAgent();
        agent.setInstituteId(dto.getInstituteId());
        agent.setName(dto.getName().trim());
        agent.setEnabled(dto.getEnabled() == null ? Boolean.TRUE : dto.getEnabled());
        agent.setDirection(normalizeDirection(dto.getDirection()));
        agent.setLanguage(blankToNull(dto.getLanguage()));
        agent.setVoice(blankToNull(dto.getVoice()));
        agent.setOpeningLine(blankToNull(dto.getOpeningLine()));
        agent.setSystemPrompt(blankToNull(dto.getSystemPrompt()));
        agent.setExtractionQuestions(writeJson(dto.getExtractionQuestions()));
        agent.setDispositions(writeJson(dto.getDispositions()));
        agent.setHandoffNumbers(writeJson(dto.getHandoffNumbers()));
        agent.setMaxCallMinutes(dto.getMaxCallMinutes());
        // Voice tuning — clamp to Bulbul v3's documented ranges so a typo can't send
        // an out-of-range value to the TTS (pace 0.5–2.0, temperature 0.01–2.0).
        agent.setPace(clamp(dto.getPace(), 0.5, 2.0));
        agent.setTemperature(clamp(dto.getTemperature(), 0.01, 2.0));
        agent.setBookingPageId(blankToNull(dto.getBookingPageId()));
        AiAgent saved = repo.save(agent);

        bridgeIntoSettings(saved, /* remove= */ !Boolean.TRUE.equals(saved.getEnabled()));
        return toDto(saved);
    }

    @Transactional
    public void delete(String agentId, String instituteId) {
        AiAgent agent = repo.findByIdAndInstituteId(agentId, instituteId)
                .orElseThrow(() -> new VacademyException("Agent not found"));
        repo.delete(agent);
        bridgeIntoSettings(agent, /* remove= */ true);
    }

    /**
     * Upsert/remove the agent's campaign entry inside the raw AI_CALLING_SETTING
     * data map. Best-effort: a bridge failure must not roll back the agent save —
     * the registry row is the source of truth and the bridge can be re-run.
     */
    @SuppressWarnings("unchecked")
    private void bridgeIntoSettings(AiAgent agent, boolean remove) {
        try {
            Institute institute = instituteRepository.findById(agent.getInstituteId())
                    .orElseThrow(() -> new VacademyException("Institute not found"));
            Object raw = instituteSettingService.getSettingData(
                    institute, SettingKeyEnums.AI_CALLING_SETTING.name());

            Map<String, Object> data = raw instanceof Map
                    ? new LinkedHashMap<>((Map<String, Object>) raw)
                    : new LinkedHashMap<>();
            List<Map<String, Object>> campaigns = new ArrayList<>();
            Object rawCampaigns = data.get("campaigns");
            if (rawCampaigns instanceof List) {
                for (Object c : (List<Object>) rawCampaigns) {
                    if (c instanceof Map) campaigns.add(new LinkedHashMap<>((Map<String, Object>) c));
                }
            }

            campaigns.removeIf(c -> agent.getId().equals(String.valueOf(c.get("campaignId"))));
            if (!remove) {
                // "BOTH" registers as OUTBOUND for the campaigns registry (its
                // direction field is binary); inbound detection for BOTH agents
                // comes via the IVR path, which stamps direction itself.
                String direction = "INBOUND".equals(agent.getDirection()) ? "INBOUND" : "OUTBOUND";
                Map<String, Object> entry = new LinkedHashMap<>();
                entry.put("campaignId", agent.getId());
                entry.put("name", agent.getName());
                entry.put("direction", direction);
                entry.put("provider", ProviderType.VACADEMY_AI);
                campaigns.add(entry);
            }
            data.put("campaigns", campaigns);

            instituteSettingService.saveGenericSetting(
                    institute, SettingKeyEnums.AI_CALLING_SETTING.name(),
                    GenericSettingRequest.builder()
                            .settingName("AI Calling Settings")
                            .settingData(data)
                            .build());
        } catch (Exception e) {
            log.error("ai-agent: settings bridge failed for agent {} (institute {})",
                    agent.getId(), agent.getInstituteId(), e);
        }
    }

    public List<String> parseList(String json) {
        if (json == null || json.isBlank()) return List.of();
        try {
            List<String> l = mapper.readValue(json, new TypeReference<>() {});
            return l == null ? List.of() : l;
        } catch (Exception e) {
            return List.of();
        }
    }

    private AiAgentDTO toDto(AiAgent a) {
        return AiAgentDTO.builder()
                .id(a.getId())
                .instituteId(a.getInstituteId())
                .name(a.getName())
                .enabled(a.getEnabled())
                .direction(a.getDirection())
                .language(a.getLanguage())
                .voice(a.getVoice())
                .openingLine(a.getOpeningLine())
                .systemPrompt(a.getSystemPrompt())
                .extractionQuestions(parseList(a.getExtractionQuestions()))
                .dispositions(parseList(a.getDispositions()))
                .handoffNumbers(parseList(a.getHandoffNumbers()))
                .maxCallMinutes(a.getMaxCallMinutes())
                .pace(a.getPace())
                .temperature(a.getTemperature())
                .bookingPageId(a.getBookingPageId())
                .build();
    }

    private String writeJson(List<String> list) {
        if (list == null) return null;
        List<String> cleaned = list.stream()
                .filter(s -> s != null && !s.isBlank())
                .map(String::trim)
                .toList();
        if (cleaned.isEmpty()) return null;
        try {
            return mapper.writeValueAsString(cleaned);
        } catch (Exception e) {
            return null;
        }
    }

    private static String normalizeDirection(String d) {
        if (d == null) return "OUTBOUND";
        String up = d.trim().toUpperCase();
        return switch (up) {
            case "INBOUND", "BOTH" -> up;
            default -> "OUTBOUND";
        };
    }

    /** Null passes through (= "use default"); non-null is clamped into [lo, hi]. */
    private static Double clamp(Double v, double lo, double hi) {
        if (v == null) return null;
        return Math.max(lo, Math.min(hi, v));
    }

    private static String blankToNull(String s) {
        return (s == null || s.isBlank()) ? null : s.trim();
    }
}
