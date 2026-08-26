package vacademy.io.admin_core_service.features.telephony.queue;

import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import vacademy.io.admin_core_service.features.institute.repository.InstituteRepository;
import vacademy.io.admin_core_service.features.telephony.core.AiCallingSettingsService;
import vacademy.io.admin_core_service.features.telephony.core.dto.AiCallingSettingsPojo;
import vacademy.io.admin_core_service.features.telephony.enums.CallStatus;
import vacademy.io.admin_core_service.features.telephony.persistence.repository.AiAgentRepository;
import vacademy.io.admin_core_service.features.telephony.persistence.repository.TelephonyCallLogRepository;
import vacademy.io.admin_core_service.features.telephony.queue.entity.AiCallQueueItem;

import java.util.Collection;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * Turns the ids on a queue row into the names a person reading a dashboard needs:
 * which institute, and which AI agent.
 *
 * <p>Resolved in BULK for a whole page rather than per row. A queue listing is polled
 * every few seconds by an ops screen, and a per-row institute lookup would turn one
 * page into fifty queries against a table whose rows carry a large settings blob.
 *
 * <p>Agent naming is not a single lookup because the two providers register campaigns
 * differently. Saving a {@code VACADEMY_AI} agent auto-registers it as a campaign whose
 * id IS the agent id, so {@code ai_agent} answers directly. An {@code AAVTAAR} campaign
 * id is the vendor's own, and its human name lives in the institute's AI_CALLING_SETTING
 * campaigns registry. Both are tried, and the raw id is the last resort — a dashboard
 * showing an opaque id is worse than one showing a name, but far better than one showing
 * a blank.
 */
@Service
@RequiredArgsConstructor
public class AiCallQueueDirectory {

    private static final Logger log = LoggerFactory.getLogger(AiCallQueueDirectory.class);

    private final InstituteRepository instituteRepository;
    private final AiAgentRepository aiAgentRepository;
    private final TelephonyCallLogRepository callLogRepository;
    private final AiCallingSettingsService settingsService;

    /**
     * Live call state for a page of already-dialled rows: is this call still on a line,
     * and for how long?
     *
     * <p>Needed because a queue row's own status stops at DIALED. Without this, a queue
     * screen cannot distinguish a call in progress from one that finished this morning —
     * which is precisely the question someone opens a queue screen to answer.
     */
    public Map<String, CallState> callStates(Collection<String> callLogIds) {
        Map<String, CallState> out = new HashMap<>();
        if (callLogIds == null || callLogIds.isEmpty()) return out;
        for (Object[] row : callLogRepository.findStatusByIds(callLogIds)) {
            String status = (String) row[1];
            Integer duration = row[2] == null ? null : ((Number) row[2]).intValue();
            out.put((String) row[0],
                    new CallState(status, duration, !CallStatus.parseOrDefault(status).isTerminal()));
        }
        return out;
    }

    /** What a dialled call is doing right now. */
    public record CallState(String status, Integer durationSeconds, boolean live) {}

    /** Names for one page of rows, resolved in as few queries as the page allows. */
    public Names forItems(Collection<AiCallQueueItem> items) {
        Set<String> instituteIds = new HashSet<>();
        Set<String> campaignIds = new HashSet<>();
        for (AiCallQueueItem item : items) {
            if (notBlank(item.getInstituteId())) instituteIds.add(item.getInstituteId());
            if (notBlank(item.getCampaignId())) campaignIds.add(item.getCampaignId());
        }
        Map<String, String> institutes = instituteNames(instituteIds);
        Map<String, String> agents = agentNames(campaignIds);

        // Only reach for an institute's settings when a campaign id is STILL unnamed
        // after ai_agent — i.e. an Aavtaar campaign. Most deployments never pay for this.
        Set<String> unresolvedInstitutes = new HashSet<>();
        for (AiCallQueueItem item : items) {
            String campaignId = item.getCampaignId();
            if (notBlank(campaignId) && !agents.containsKey(campaignId)
                    && !notBlank(item.getCampaignName()) && notBlank(item.getInstituteId())) {
                unresolvedInstitutes.add(item.getInstituteId());
            }
        }
        for (String instituteId : unresolvedInstitutes) {
            try {
                AiCallingSettingsPojo settings = settingsService.get(instituteId);
                if (settings.getCampaigns() == null) continue;
                for (AiCallingSettingsPojo.CampaignConfig campaign : settings.getCampaigns()) {
                    if (notBlank(campaign.getCampaignId()) && notBlank(campaign.getName())) {
                        agents.putIfAbsent(campaign.getCampaignId(), campaign.getName());
                    }
                }
            } catch (Exception e) {
                // One institute with an unparseable setting_json must not blank out the
                // names on every other row of the page.
                log.debug("ai-call queue: could not read AI settings for institute {} while "
                        + "naming agents: {}", instituteId, e.getMessage());
            }
        }
        return new Names(institutes, agents);
    }

    public Map<String, String> instituteNames(Collection<String> instituteIds) {
        Map<String, String> out = new HashMap<>();
        if (instituteIds == null || instituteIds.isEmpty()) return out;
        for (Object[] row : instituteRepository.findIdAndNameByIds(instituteIds)) {
            if (row[0] != null) out.put((String) row[0], (String) row[1]);
        }
        return out;
    }

    private Map<String, String> agentNames(Collection<String> campaignIds) {
        Map<String, String> out = new HashMap<>();
        if (campaignIds == null || campaignIds.isEmpty()) return out;
        List<Object[]> rows = aiAgentRepository.findIdAndNameByIds(campaignIds);
        for (Object[] row : rows) {
            if (row[0] != null && row[1] != null) out.put((String) row[0], (String) row[1]);
        }
        return out;
    }

    /** Resolved names for one page. */
    public static final class Names {
        private final Map<String, String> institutes;
        private final Map<String, String> agents;

        Names(Map<String, String> institutes, Map<String, String> agents) {
            this.institutes = institutes;
            this.agents = agents;
        }

        public String instituteName(String instituteId) {
            return institutes.get(instituteId);
        }

        /**
         * The agent as a person would name it: the name the caller already carried, else
         * the registered agent/campaign name, else the raw campaign id so the row is
         * still identifiable.
         */
        public String agentName(String campaignName, String campaignId) {
            if (notBlank(campaignName)) return campaignName;
            if (notBlank(campaignId)) {
                String resolved = agents.get(campaignId);
                return notBlank(resolved) ? resolved : campaignId;
            }
            return null;
        }
    }

    private static boolean notBlank(String s) {
        return s != null && !s.isBlank();
    }
}
