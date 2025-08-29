package vacademy.io.admin_core_service.features.workflow.actions;

import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class DbClientImpl implements DbClient {

    private final JdbcTemplate jdbcTemplate;

    @Override
    public boolean updateRemainingDaysForMapping(String mappingId, int newRemainingDays) {
        // Try common shapes; adapt to your exact schema if different
        int updated = 0;
        // Option A: field keyed by field_key = 'remaining_days'
        updated += jdbcTemplate.update(
                "UPDATE custom_field_values SET value = ? WHERE entity_type = ? AND entity_id = ? AND field_key = ?",
                String.valueOf(newRemainingDays),
                "STUDENT_SESSION_INSTITUTE_GROUP_MAPPING",
                mappingId,
                "remaining_days");
        // Option B: entity_type shorthand
        if (updated == 0) {
            updated += jdbcTemplate.update(
                    "UPDATE custom_field_values SET value = ? WHERE entity_type = ? AND entity_id = ? AND field_key = ?",
                    String.valueOf(newRemainingDays),
                    "SSIGM",
                    mappingId,
                    "remaining_days");
        }
        return updated > 0;
    }
}