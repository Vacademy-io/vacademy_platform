package vacademy.io.admin_core_service.features.engagement.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import vacademy.io.admin_core_service.features.institute.dto.settings.InstituteSettingDto;
import vacademy.io.admin_core_service.features.institute.dto.settings.SettingDto;
import vacademy.io.admin_core_service.features.institute.repository.InstituteRepository;
import vacademy.io.common.institute.entity.Institute;

import java.util.Map;

/**
 * Institute-level knobs for daily engagement, stored under the ENGAGEMENT_SETTING
 * institute setting. Every value has a working default so the feature behaves
 * sensibly for an institute that never opens the settings screen.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class EngagementSettingsService {

    public static final String SETTING_KEY = "ENGAGEMENT_SETTING";

    /**
     * How many items a learner is shown per day ACROSS ALL their batches. A learner
     * in four batches would otherwise face a dozen tasks on a Monday and bounce.
     */
    public static final int DEFAULT_DAILY_ITEM_CAP = 5;

    /** Reading completion needs this much scroll depth to count. */
    public static final int DEFAULT_MIN_SCROLL_PERCENT = 80;

    /** Reading completion also needs this much dwell time. */
    public static final long DEFAULT_MIN_READ_MS = 15_000L;

    /**
     * A game pays out only after this much server-measured time since the learner
     * opened it. "Mark complete" used to pay the moment the dialog opened.
     */
    public static final long DEFAULT_MIN_GAME_MS = 20_000L;

    private final InstituteRepository instituteRepository;
    private final ObjectMapper objectMapper;

    public int getDailyItemCap(String instituteId) {
        return intSetting(instituteId, "dailyItemCap", DEFAULT_DAILY_ITEM_CAP, 1, 50);
    }

    public int getMinScrollPercent(String instituteId) {
        return intSetting(instituteId, "minScrollPercent", DEFAULT_MIN_SCROLL_PERCENT, 0, 100);
    }

    public long getMinReadMs(String instituteId) {
        return intSetting(instituteId, "minReadSeconds",
                (int) (DEFAULT_MIN_READ_MS / 1000), 0, 3600) * 1000L;
    }

    public long getMinGameMs(String instituteId) {
        return intSetting(instituteId, "minGameSeconds",
                (int) (DEFAULT_MIN_GAME_MS / 1000), 0, 3600) * 1000L;
    }

    /**
     * Whether a self-reported score may earn score-proportional points on top of
     * completion points. OFF by default: a teacher-uploaded game's score is whatever
     * the page chose to post, so letting it scale points hands the leaderboard to
     * anyone willing to open devtools.
     */
    public boolean isUnverifiedScoreBonusEnabled(String instituteId) {
        Map<?, ?> data = settingData(instituteId);
        return data != null && Boolean.TRUE.equals(data.get("allowUnverifiedScoreBonus"));
    }

    private int intSetting(String instituteId, String key, int fallback, int min, int max) {
        Map<?, ?> data = settingData(instituteId);
        if (data == null) return fallback;
        Object raw = data.get(key);
        if (raw == null) return fallback;
        try {
            int value = (raw instanceof Number n) ? n.intValue() : Integer.parseInt(raw.toString());
            return Math.max(min, Math.min(max, value));
        } catch (Exception e) {
            return fallback;
        }
    }

    private Map<?, ?> settingData(String instituteId) {
        try {
            Institute institute = instituteRepository.findById(instituteId).orElse(null);
            if (institute == null || institute.getSetting() == null) return null;
            InstituteSettingDto settingDto =
                    objectMapper.readValue(institute.getSetting(), InstituteSettingDto.class);
            Map<String, SettingDto> settings = settingDto.getSetting();
            if (settings == null) return null;
            SettingDto s = settings.get(SETTING_KEY);
            if (s == null || !(s.getData() instanceof Map)) return null;
            return (Map<?, ?>) s.getData();
        } catch (Exception e) {
            return null;
        }
    }
}
