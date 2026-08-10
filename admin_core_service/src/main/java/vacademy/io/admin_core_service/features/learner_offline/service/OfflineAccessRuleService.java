package vacademy.io.admin_core_service.features.learner_offline.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;
import vacademy.io.admin_core_service.features.course_settings.service.PackageSettingService;
import vacademy.io.admin_core_service.features.learner_offline.dto.OfflineRuleDTO;
import vacademy.io.admin_core_service.features.learner_offline.dto.OfflineRuleUpsertDTO;
import vacademy.io.admin_core_service.features.learner_offline.entity.OfflineAccessRule;
import vacademy.io.admin_core_service.features.learner_offline.enums.OfflineSourceType;
import vacademy.io.admin_core_service.features.learner_offline.repository.OfflineAccessRuleRepository;
import vacademy.io.admin_core_service.features.packages.repository.PackageSessionRepository;
import vacademy.io.common.exceptions.VacademyException;
import vacademy.io.common.institute.entity.session.PackageSession;

import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * CRUD over offline_access_rule (offline plan, Part A1) + the course-default
 * accessor used by the resolver's step 3. Every write bumps the affected
 * package session's manifest version so clients pick up the permission
 * change on their next check-in/manifest diff.
 */
@Service
@RequiredArgsConstructor
public class OfflineAccessRuleService {

    private final OfflineAccessRuleRepository offlineAccessRuleRepository;
    private final OfflineManifestVersionService offlineManifestVersionService;
    private final PackageSessionRepository packageSessionRepository;
    private final PackageSettingService packageSettingService;
    private final ObjectMapper objectMapper;

    /**
     * Bulk upsert/delete. {@code allow=null} deletes the rule (UI "Inherit").
     * Every non-PACKAGE rule must carry a packageSessionId (rules are batch
     * scoped at those levels — see V436 migration comment); PACKAGE rules must
     * NOT carry one (course-wide).
     */
    @Transactional
    public void bulkUpsert(String instituteId, List<OfflineRuleUpsertDTO> rules, String userId) {
        if (rules == null || rules.isEmpty()) {
            return;
        }
        Set<String> affectedPackageSessionIds = new java.util.HashSet<>();

        for (OfflineRuleUpsertDTO dto : rules) {
            validate(dto);
            String psScope = dto.getSourceType() == OfflineSourceType.PACKAGE ? null : dto.getPackageSessionId();

            if (dto.getAllow() == null) {
                if (psScope == null) {
                    offlineAccessRuleRepository.deleteBySourceTypeAndSourceIdAndPackageSessionIdIsNull(
                            dto.getSourceType(), dto.getSourceId());
                } else {
                    offlineAccessRuleRepository.deleteBySourceTypeAndSourceIdAndPackageSessionId(
                            dto.getSourceType(), dto.getSourceId(), psScope);
                }
            } else {
                OfflineAccessRule rule = (psScope == null
                        ? offlineAccessRuleRepository.findBySourceTypeAndSourceIdAndPackageSessionIdIsNull(
                                dto.getSourceType(), dto.getSourceId())
                        : offlineAccessRuleRepository.findBySourceTypeAndSourceIdAndPackageSessionId(
                                dto.getSourceType(), dto.getSourceId(), psScope))
                        .orElseGet(OfflineAccessRule::new);
                rule.setInstituteId(instituteId);
                rule.setSourceType(dto.getSourceType());
                rule.setSourceId(dto.getSourceId());
                rule.setPackageSessionId(psScope);
                rule.setAllow(dto.getAllow());
                rule.setCreatedByUserId(userId);
                offlineAccessRuleRepository.save(rule);
            }

            affectedPackageSessionIds.addAll(resolveAffectedPackageSessionIds(dto));
        }

        offlineManifestVersionService.bumpAll(affectedPackageSessionIds, "OFFLINE_RULE_CHANGED");
    }

    private void validate(OfflineRuleUpsertDTO dto) {
        if (dto.getSourceType() == null || !StringUtils.hasText(dto.getSourceId())) {
            throw new VacademyException("sourceType and sourceId are required for every offline rule");
        }
        if (dto.getSourceType() != OfflineSourceType.PACKAGE && !StringUtils.hasText(dto.getPackageSessionId())) {
            throw new VacademyException("packageSessionId is required for " + dto.getSourceType() + " rules");
        }
    }

    /** Which package sessions' manifests need a version bump for this rule write. */
    private Set<String> resolveAffectedPackageSessionIds(OfflineRuleUpsertDTO dto) {
        if (dto.getSourceType() != OfflineSourceType.PACKAGE) {
            return dto.getPackageSessionId() == null ? Set.of() : Set.of(dto.getPackageSessionId());
        }
        // PACKAGE-level rule affects every session of that package.
        return packageSessionRepository.findByPackageEntityId(dto.getSourceId()).stream()
                .map(PackageSession::getId)
                .collect(Collectors.toSet());
    }

    /** All rules relevant to a batch (this package session + the course-wide PACKAGE rule). */
    public List<OfflineRuleDTO> getRules(String packageSessionId) {
        PackageSession packageSession = packageSessionRepository.findById(packageSessionId)
                .orElseThrow(() -> new VacademyException("Package session not found: " + packageSessionId));
        String packageId = packageSession.getPackageEntity() != null ? packageSession.getPackageEntity().getId() : null;
        return offlineAccessRuleRepository.findAllForPackageSession(packageSessionId, packageId)
                .stream().map(OfflineRuleDTO::from).collect(Collectors.toList());
    }

    /** {@code package.course_setting.data.offlineDefaultEnabled}, default false. */
    @SuppressWarnings("unchecked")
    public boolean getCourseDefault(String packageId) {
        if (!StringUtils.hasText(packageId)) {
            return false;
        }
        Object data = packageSettingService.getSettingData(packageId, "COURSE_SETTING");
        if (data == null) {
            return false;
        }
        try {
            Map<String, Object> map = objectMapper.convertValue(data, Map.class);
            Object flag = map.get("offlineDefaultEnabled");
            return Objects.equals(Boolean.TRUE, flag) || "true".equals(String.valueOf(flag));
        } catch (Exception e) {
            return false;
        }
    }
}
