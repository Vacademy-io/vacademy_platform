package vacademy.io.admin_core_service.features.utm_attribution.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import vacademy.io.admin_core_service.features.institute.dto.settings.GenericSettingRequest;
import vacademy.io.admin_core_service.features.institute.repository.InstituteRepository;
import vacademy.io.admin_core_service.features.institute.service.setting.InstituteSettingService;
import vacademy.io.admin_core_service.features.utm_attribution.dto.UtmCampaignRowResponse;
import vacademy.io.admin_core_service.features.utm_attribution.repository.UtmAttributionRepository;
import vacademy.io.common.exceptions.VacademyException;
import vacademy.io.common.institute.entity.Institute;

import java.sql.Timestamp;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.TreeMap;

/**
 * Human names for utm_campaign values.
 *
 * WHY: an ad platform's lead form can sit in several campaigns, and Google's
 * webhook names the campaign only by its numeric id ("22173284076"). The
 * campaign filter and the leads table work on that id, but nobody can read it.
 * The admin names each id once; every surface shows the name, while filters
 * and stored rows keep the id — so a rename applies to old leads too and
 * nothing has to be rewritten.
 *
 * Stored as its own institute setting (UTM_CAMPAIGN_LABELS → {"labels": {id: name}}),
 * NOT inside UTM_SETTING: the Campaign Links settings page saves UTM_SETTING
 * from its own fields only, so names kept there would vanish on its next save.
 */
@Service
public class UtmCampaignLabelService {

    private static final Logger logger = LoggerFactory.getLogger(UtmCampaignLabelService.class);

    public static final String SETTING_KEY = "UTM_CAMPAIGN_LABELS";
    static final int MAX_NAME_LENGTH = 120;
    /** utm_attribution.utm_campaign is VARCHAR(191). */
    static final int MAX_CAMPAIGN_LENGTH = 191;
    static final int MAX_LABELS = 2000;

    @Autowired
    private InstituteRepository instituteRepository;

    @Autowired
    private InstituteSettingService instituteSettingService;

    @Autowired
    private UtmAttributionRepository repository;

    /**
     * campaign value → name for the institute. Empty when none are set or the
     * setting can't be read: names are decoration, so the lists must never fail
     * for them.
     */
    public Map<String, String> labels(String instituteId) {
        try {
            return instituteRepository.findById(instituteId).map(this::labels).orElse(Map.of());
        } catch (Exception e) {
            logger.warn("[utm-labels] could not read campaign names for {}: {}", instituteId, e.getMessage());
            return Map.of();
        }
    }

    private Map<String, String> labels(Institute institute) {
        Object data = instituteSettingService.getSettingData(institute, SETTING_KEY);
        Map<String, String> out = new TreeMap<>();
        if (data instanceof Map<?, ?> map && map.get("labels") instanceof Map<?, ?> stored) {
            stored.forEach((k, v) -> {
                if (k != null && v != null && !v.toString().isBlank()) out.put(k.toString(), v.toString());
            });
        }
        return out;
    }

    /**
     * Merge {@code updates} into the stored names: a non-blank name sets or
     * renames, a blank one removes. Returns the full map after the save.
     */
    @Transactional
    public Map<String, String> saveLabels(String instituteId, Map<String, String> updates) {
        Institute institute = instituteRepository.findById(instituteId)
                .orElseThrow(() -> new VacademyException("Institute not found"));
        Map<String, String> merged = new TreeMap<>(labels(institute));
        if (updates != null) {
            updates.forEach((campaign, name) -> {
                if (campaign == null || campaign.isBlank()) return;
                String key = clip(campaign.trim(), MAX_CAMPAIGN_LENGTH);
                String value = name == null ? "" : clip(name.trim(), MAX_NAME_LENGTH);
                if (value.isEmpty()) merged.remove(key);
                else merged.put(key, value);
            });
        }
        if (merged.size() > MAX_LABELS) {
            throw new VacademyException("Too many campaign names (max " + MAX_LABELS + ")");
        }
        Map<String, Object> data = new LinkedHashMap<>();
        data.put("labels", merged);
        instituteSettingService.saveGenericSetting(institute, SETTING_KEY,
                new GenericSettingRequest("UTM Campaign Labels", data));
        return merged;
    }

    /**
     * Every campaign an ad platform has sent leads from (e.g. source "google",
     * medium "lead_form"), newest activity first, with its name if one is set —
     * the list the admin names campaigns from.
     */
    public List<UtmCampaignRowResponse> campaigns(String instituteId, String source, String medium) {
        Map<String, String> names = labels(instituteId);
        List<UtmCampaignRowResponse> rows = new ArrayList<>();
        for (Object[] r : repository.campaignsFor(instituteId, source, medium)) {
            String campaign = (String) r[0];
            rows.add(UtmCampaignRowResponse.builder()
                    .campaign(campaign)
                    .people(((Number) r[1]).longValue())
                    .firstSeen(toTimestamp(r[2]))
                    .lastSeen(toTimestamp(r[3]))
                    .name(names.get(campaign))
                    .build());
        }
        return rows;
    }

    /** Native-query timestamps arrive as Timestamp or LocalDateTime depending on the driver path. */
    static Timestamp toTimestamp(Object value) {
        if (value instanceof Timestamp ts) return ts;
        if (value instanceof java.time.LocalDateTime ldt) return Timestamp.valueOf(ldt);
        if (value instanceof java.time.Instant instant) return Timestamp.from(instant);
        if (value instanceof java.time.OffsetDateTime odt) return Timestamp.from(odt.toInstant());
        return null;
    }

    private static String clip(String value, int max) {
        return value.length() > max ? value.substring(0, max) : value;
    }
}
