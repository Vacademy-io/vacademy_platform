package vacademy.io.admin_core_service.features.course_settings.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;
import vacademy.io.admin_core_service.features.course_settings.dto.DripConditionSettingsDTO;
import vacademy.io.admin_core_service.features.institute.dto.settings.GenericSettingRequest;
import vacademy.io.admin_core_service.features.learner_offline.service.OfflineManifestVersionService;
import vacademy.io.admin_core_service.features.packages.repository.PackageRepository;
import vacademy.io.admin_core_service.features.packages.repository.PackageSessionRepository;
import vacademy.io.common.exceptions.VacademyException;
import vacademy.io.common.institute.entity.PackageEntity;
import vacademy.io.common.institute.entity.session.PackageSession;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.stream.Collectors;

/**
 * Read/write helper for the per-package {@code course_setting} JSON column.
 *
 * <p>The column holds the same generic envelope as institute settings:
 * <pre>{ "setting": { "&lt;KEY&gt;": { "key", "name", "data" } } }</pre>
 * Workflows read arbitrary keys out of it via {@code fetchPackageLMSSetting}
 * (path {@code setting.&lt;KEY&gt;.data.data}) and other consumers read
 * {@code MOODLE_SETTING}, {@code LMS_SETTING}, {@code COURSE_COMPLETION_SETTING},
 * etc. We therefore treat the column as open-ended JSON and only ever
 * upsert/replace — never assume a fixed schema.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class PackageSettingService {

    private static final String COURSE_SETTING_KEY = "COURSE_SETTING";

    private final PackageRepository packageRepository;
    private final DripConditionService dripConditionService;
    private final ObjectMapper objectMapper;
    private final PackageSessionRepository packageSessionRepository;
    private final OfflineManifestVersionService offlineManifestVersionService;

    private PackageEntity getPackageOrThrow(String packageId) {
        if (!StringUtils.hasText(packageId)) {
            throw new VacademyException("packageId is required");
        }
        return packageRepository.findById(packageId)
                .orElseThrow(() -> new VacademyException("Course/Package not found with id: " + packageId));
    }

    /** Raw JSON string of the package's course_setting; defaults to an empty envelope. */
    public String getRaw(String packageId) {
        String json = getPackageOrThrow(packageId).getCourseSetting();
        return StringUtils.hasText(json) ? json : "{\"setting\":{}}";
    }

    /** Whole envelope parsed into a Map (e.g. {@code { setting: { ... } }}). */
    public Map<String, Object> getAll(String packageId) {
        String json = getPackageOrThrow(packageId).getCourseSetting();
        if (!StringUtils.hasText(json)) {
            return Map.of("setting", new HashMap<>());
        }
        try {
            return objectMapper.readValue(json, Map.class);
        } catch (Exception e) {
            throw new VacademyException("Stored course_setting is not valid JSON: " + e.getMessage());
        }
    }

    /** The {@code { key, name, data }} node for a single setting key, or null. */
    public Object getSpecificSetting(String packageId, String settingKey) {
        JsonNode node = readRoot(getPackageOrThrow(packageId)).path("setting").path(settingKey);
        if (node.isMissingNode() || node.isNull()) {
            return null;
        }
        return objectMapper.convertValue(node, Object.class);
    }

    /** Only the {@code data} part of a single setting key, or null. */
    public Object getSettingData(String packageId, String settingKey) {
        JsonNode dataNode = readRoot(getPackageOrThrow(packageId))
                .path("setting").path(settingKey).path("data");
        if (dataNode.isMissingNode() || dataNode.isNull()) {
            return null;
        }
        return objectMapper.convertValue(dataNode, Object.class);
    }

    /**
     * Upsert a single setting key into the envelope, preserving every other key.
     * The stored shape is {@code setting.<KEY> = { key, name, data: <settingData> }}.
     */
    @Transactional
    public void saveGenericSetting(String packageId, String settingKey, GenericSettingRequest request) {
        if (!StringUtils.hasText(settingKey)) {
            throw new VacademyException("settingKey is required");
        }
        PackageEntity pkg = getPackageOrThrow(packageId);
        ObjectNode root = readRoot(pkg);

        boolean offlineDefaultBefore = COURSE_SETTING_KEY.equals(settingKey)
                ? readOfflineDefaultEnabled(root) : false;

        ObjectNode settingMap = root.has("setting") && root.get("setting").isObject()
                ? (ObjectNode) root.get("setting")
                : objectMapper.createObjectNode();

        ObjectNode entry = objectMapper.createObjectNode();
        entry.put("key", settingKey);
        entry.put("name", request != null && StringUtils.hasText(request.getSettingName())
                ? request.getSettingName()
                : settingKey.replace("_", " "));
        Object data = request != null ? request.getSettingData() : null;
        entry.set("data", objectMapper.valueToTree(data));

        settingMap.set(settingKey, entry);
        root.set("setting", settingMap);

        pkg.setCourseSetting(serialize(root));
        packageRepository.save(pkg);

        // Parity with institute COURSE_SETTING: extract drip conditions and persist
        // them onto package/chapter/slide. Best-effort — never fail the save.
        if (COURSE_SETTING_KEY.equals(settingKey)) {
            processDripConditions(data);
            bumpOfflineManifestIfDefaultChanged(packageId, offlineDefaultBefore, readOfflineDefaultEnabled(root));
        }
    }

    /** {@code setting.COURSE_SETTING.data.offlineDefaultEnabled} out of the envelope root, default false. */
    @SuppressWarnings("unchecked")
    private boolean readOfflineDefaultEnabled(JsonNode root) {
        JsonNode dataNode = root.path("setting").path(COURSE_SETTING_KEY).path("data");
        if (dataNode.isMissingNode() || dataNode.isNull()) {
            return false;
        }
        try {
            Map<String, Object> map = objectMapper.convertValue(dataNode, Map.class);
            Object flag = map.get("offlineDefaultEnabled");
            return Objects.equals(Boolean.TRUE, flag) || "true".equals(String.valueOf(flag));
        } catch (Exception e) {
            return false;
        }
    }

    /**
     * Offline plan Part A2 bump hook: offlineDefaultEnabled feeds the resolver's
     * step 3 (course default) for every session of this package, so a flip must
     * bump every one of their manifest versions.
     */
    private void bumpOfflineManifestIfDefaultChanged(String packageId, boolean before, boolean after) {
        if (before == after) {
            return;
        }
        List<String> packageSessionIds = packageSessionRepository.findByPackageEntityId(packageId).stream()
                .map(PackageSession::getId)
                .collect(Collectors.toList());
        offlineManifestVersionService.bumpAll(packageSessionIds, "OFFLINE_DEFAULT_CHANGED");
    }

    /** Remove a single setting key from the envelope (no-op if absent), preserving the others. */
    @Transactional
    public void removeSetting(String packageId, String settingKey) {
        if (!StringUtils.hasText(settingKey)) {
            return;
        }
        PackageEntity pkg = getPackageOrThrow(packageId);
        ObjectNode root = readRoot(pkg);
        if (root.has("setting") && root.get("setting").isObject()) {
            ObjectNode settingMap = (ObjectNode) root.get("setting");
            if (settingMap.has(settingKey)) {
                settingMap.remove(settingKey);
                root.set("setting", settingMap);
                pkg.setCourseSetting(serialize(root));
                packageRepository.save(pkg);
            }
        }
    }

    /**
     * Replace the whole {@code course_setting} column with admin-supplied JSON.
     * Validates that it parses and is wrapped in a {@code { "setting": { ... } }}
     * envelope so workflow consumers keep resolving their keys.
     */
    @Transactional
    public void saveRaw(String packageId, String rawJson) {
        PackageEntity pkg = getPackageOrThrow(packageId);
        if (!StringUtils.hasText(rawJson)) {
            throw new VacademyException("Empty JSON body");
        }
        JsonNode parsed;
        try {
            parsed = objectMapper.readTree(rawJson);
        } catch (Exception e) {
            throw new VacademyException("Invalid JSON: " + e.getMessage());
        }
        if (!parsed.isObject() || !parsed.path("setting").isObject()) {
            throw new VacademyException(
                    "JSON must be an object wrapped in a \"setting\" envelope, e.g. {\"setting\":{...}}");
        }
        boolean offlineDefaultBefore = readOfflineDefaultEnabled(readRoot(pkg));

        pkg.setCourseSetting(serialize(parsed));
        packageRepository.save(pkg);

        JsonNode courseSettingData = parsed.path("setting").path(COURSE_SETTING_KEY).path("data");
        if (!courseSettingData.isMissingNode() && !courseSettingData.isNull()) {
            processDripConditions(objectMapper.convertValue(courseSettingData, Object.class));
        }
        bumpOfflineManifestIfDefaultChanged(packageId, offlineDefaultBefore, readOfflineDefaultEnabled(parsed));
    }

    private ObjectNode readRoot(PackageEntity pkg) {
        String json = pkg.getCourseSetting();
        if (!StringUtils.hasText(json)) {
            return objectMapper.createObjectNode();
        }
        try {
            JsonNode node = objectMapper.readTree(json);
            return node.isObject() ? (ObjectNode) node : objectMapper.createObjectNode();
        } catch (Exception e) {
            log.warn("Existing course_setting for package {} is unparseable, starting fresh: {}",
                    pkg.getId(), e.getMessage());
            return objectMapper.createObjectNode();
        }
    }

    private String serialize(JsonNode node) {
        try {
            return objectMapper.writeValueAsString(node);
        } catch (Exception e) {
            throw new VacademyException("Failed to serialize course_setting: " + e.getMessage());
        }
    }

    @SuppressWarnings("unchecked")
    private void processDripConditions(Object settingData) {
        if (settingData == null) {
            return;
        }
        try {
            Map<String, Object> dataMap = objectMapper.convertValue(settingData, Map.class);
            if (dataMap == null || !dataMap.containsKey("dripConditions")) {
                return;
            }
            DripConditionSettingsDTO dripSettings = objectMapper.convertValue(
                    dataMap.get("dripConditions"), DripConditionSettingsDTO.class);
            if (dripSettings != null && dripSettings.getConditions() != null) {
                dripConditionService.saveDripConditionSettings(dripSettings);
            }
        } catch (Exception e) {
            log.error("Failed to process drip conditions from package COURSE_SETTING: {}", e.getMessage());
        }
    }
}
