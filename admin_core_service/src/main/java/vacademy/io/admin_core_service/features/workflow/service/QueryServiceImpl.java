package vacademy.io.admin_core_service.features.workflow.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import vacademy.io.admin_core_service.features.institute_learner.repository.StudentSessionInstituteGroupMappingRepository;
import vacademy.io.admin_core_service.features.workflow.engine.QueryNodeHandler;
import vacademy.io.admin_core_service.features.common.repository.CustomFieldValuesRepository;
import vacademy.io.admin_core_service.features.common.entity.CustomFieldValues;

import java.sql.Timestamp;
import java.util.*;

@Slf4j
@Service
@RequiredArgsConstructor
public class QueryServiceImpl implements QueryNodeHandler.QueryService {

    private final StudentSessionInstituteGroupMappingRepository ssigmRepo;
    private final CustomFieldValuesRepository customFieldValuesRepository;

    @Override
    public Map<String, Object> execute(String prebuiltKey, Map<String, Object> params) {
        log.info("Executing query with key: {}, params: {}", prebuiltKey, params);

        switch (prebuiltKey) {
            case "fetch_ssigm_by_package":
                return fetchSSIGMByPackage(params);
            case "getSSIGMByStatusAndPackageSessionIds":
                return getSSIGMByStatusAndSessions(params);
            case "updateSSIGMRemaingDaysByOne":
                return updateSSIGMRemainingDaysByOne(params);
            default:
                log.warn("Unknown prebuilt query key: {}", prebuiltKey);
                return Map.of("error", "Unknown query key: " + prebuiltKey);
        }
    }

    private Map<String, Object> fetchSSIGMByPackage(Map<String, Object> params) {
        try {
            List<String> packageSessionIds = (List<String>) params.get("package_session_ids");
            List<String> statusList = (List<String>) params.get("status_list");

            if (packageSessionIds == null || statusList == null) {
                return Map.of("error", "Missing required parameters");
            }

            List<Object[]> rows = ssigmRepo.findMappingsWithStudentContacts(packageSessionIds, statusList);
            List<Map<String, Object>> ssigmList = new ArrayList<>();

            for (Object[] row : rows) {
                Map<String, Object> mapping = new HashMap<>();
                mapping.put("mapping_id", String.valueOf(row[0]));
                mapping.put("user_id", String.valueOf(row[1]));
                mapping.put("expiry_date", (row[2] instanceof Timestamp ts) ? new Date(ts.getTime()) : row[2]);
                mapping.put("full_name", String.valueOf(row[3]));
                mapping.put("mobile_number", String.valueOf(row[4]));
                mapping.put("email", String.valueOf(row[5]));
                mapping.put("package_session_id", String.valueOf(row[6]));
                ssigmList.add(mapping);
            }

            return Map.of(
                    "ssigm_list", ssigmList,
                    "mapping_count", ssigmList.size());

        } catch (Exception e) {
            log.error("Error executing fetch_ssigm_by_package query", e);
            return Map.of("error", e.getMessage());
        }
    }

    private Map<String, Object> getSSIGMByStatusAndSessions(Map<String, Object> params) {
        try {
            List<String> packageSessionIds = (List<String>) params.get("packageSessionIds");
            List<String> statusList = (List<String>) params.get("statusList");

            if (packageSessionIds == null || statusList == null) {
                return Map.of("error", "Missing required parameters");
            }

            List<Object[]> rows = ssigmRepo.findMappingsWithStudentContacts(packageSessionIds, statusList);
            List<Map<String, Object>> ssigmList = new ArrayList<>();

            for (Object[] row : rows) {
                Map<String, Object> mapping = new HashMap<>();
                mapping.put("ssigmId", String.valueOf(row[0]));
                mapping.put("userId", String.valueOf(row[1]));
                Date startDate = new Date();
                Date endDate = (row[2] instanceof Timestamp ts) ? new Date(ts.getTime()) : null;
                mapping.put("expiryDate", endDate);
                mapping.put("name", String.valueOf(row[3]));
                mapping.put("mobileNumber", String.valueOf(row[4]));
                mapping.put("email", String.valueOf(row[5]));
                mapping.put("packageSessionId", String.valueOf(row[6]));

                // ✅ calculate remaining days - prioritize custom field value, fallback to date
                // calculation
                long remainingDays = calculateRemainingDays(String.valueOf(row[0]), endDate);
                mapping.put("remainingDays", remainingDays);

                ssigmList.add(mapping);
            }

            return Map.of(
                    "ssigmList", ssigmList,
                    "ssigmListCount", ssigmList.size());

        } catch (Exception e) {
            log.error("Error executing get_ssigm_by_status_and_sessions query", e);
            return Map.of("error", e.getMessage());
        }
    }

    /**
     * Calculate remaining days prioritizing custom field value, with date-based
     * fallback
     */
    private long calculateRemainingDays(String ssigmId, Date endDate) {
        try {
            // First, try to get remaining days from custom field values
            Optional<CustomFieldValues> customFieldValue = customFieldValuesRepository
                    .findBySourceIdAndFieldKeyAndSourceType(ssigmId, "remaining_days", "STUDENT_SESSION_INSTITUTE_GROUP_MAPPING");

            if (customFieldValue.isPresent()) {
                try {
                    String value = customFieldValue.get().getValue();
                    if (value != null && !value.trim().isEmpty()) {
                        long remainingDays = Long.parseLong(value.trim());
                        log.debug("Found remaining_days in custom field for SSIGM {}: {}", ssigmId, remainingDays);
                        return remainingDays;
                    }
                } catch (NumberFormatException e) {
                    log.warn("Invalid remaining_days value in custom field for SSIGM {}: {}", ssigmId,
                            customFieldValue.get().getValue());
                }
            }

            // Fallback to date-based calculation
            log.debug("No valid custom field value found for SSIGM {}, using date-based calculation", ssigmId);
            Date startDate = new Date();

            if (endDate == null) {
                return 9999; // No expiry date set
            } else if (startDate == null) {
                return 0; // Fallback if startDate missing
            } else {
                long diffMillis = endDate.getTime() - startDate.getTime();
                long remainingDays = diffMillis / (1000 * 60 * 60 * 24); // convert ms → days
                return Math.max(remainingDays, 0); // Ensure non-negative
            }

        } catch (Exception e) {
            log.error("Error calculating remaining days for SSIGM: {}", ssigmId, e);
            // Ultimate fallback
            return endDate != null ? 0 : 9999;
        }
    }

    private Map<String, Object> updateSSIGMRemainingDaysByOne(Map<String, Object> params) {
        try {
            Map<String, Object> mappingData = (Map<String, Object>) params.get("ssigm");
            if (mappingData == null) {
                return Map.of("error", "Missing ssigm data");
            }

            String ssigmId = String.valueOf(mappingData.get("ssigmId"));
            Object remainingObj = mappingData.getOrDefault("remainingDays", 9999);
            long remainingDays;

            if (remainingObj instanceof Number num) {
                remainingDays = num.longValue() - 1;
            } else {
                remainingDays = 9999;
            }

            if (remainingDays < 0) {
                remainingDays = -1; // prevent negatives
            }

            // Update the mapping data
            mappingData.put("remainingDays", remainingDays);

            // Try to update custom field value if it exists
            try {
                Optional<CustomFieldValues> customFieldValue = customFieldValuesRepository
                        .findBySourceIdAndFieldKeyAndSourceType(ssigmId, "remaining_days", "SSIGM");

                if (customFieldValue.isPresent()) {
                    CustomFieldValues cfv = customFieldValue.get();
                    cfv.setValue(String.valueOf(remainingDays));
                    customFieldValuesRepository.save(cfv);
                    log.debug("Updated remaining_days custom field value for SSIGM {} to {}", ssigmId, remainingDays);
                } else {
                    log.debug("No custom field found for remaining_days on SSIGM {}, skipping custom field update",
                            ssigmId);
                }
            } catch (Exception e) {
                log.warn("Failed to update custom field value for SSIGM {}: {}", ssigmId, e.getMessage());
                // Continue with the workflow even if custom field update fails
            }

            return Map.of("ssigm", mappingData);
        } catch (Exception e) {
            log.error("Error in updateSSIGMRemainingDaysByOne", e);
            return Map.of("error", e.getMessage());
        }
    }

}