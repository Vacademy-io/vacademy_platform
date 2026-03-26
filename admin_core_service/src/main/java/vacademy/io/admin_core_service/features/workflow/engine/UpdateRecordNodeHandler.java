package vacademy.io.admin_core_service.features.workflow.engine;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Component;
import vacademy.io.admin_core_service.features.workflow.entity.NodeTemplate;
import vacademy.io.admin_core_service.features.workflow.spel.SpelEvaluator;

import java.util.*;

@Slf4j
@Component
@RequiredArgsConstructor
public class UpdateRecordNodeHandler implements NodeHandler {

    private final ObjectMapper objectMapper;
    private final SpelEvaluator spelEvaluator;
    private final NamedParameterJdbcTemplate jdbcTemplate;

    // Security: only allow updates to these tables
    private static final Set<String> ALLOWED_TABLES = Set.of(
            "enrollment", "payment", "student_session", "learner",
            "batch_enrollment", "institute_learner", "sub_org_member"
    );

    @Override
    public boolean supports(String nodeType) {
        return "UPDATE_RECORD".equalsIgnoreCase(nodeType);
    }

    @Override
    public Map<String, Object> handle(Map<String, Object> context,
                                       String nodeConfigJson,
                                       Map<String, NodeTemplate> nodeTemplates,
                                       int countProcessed) {
        Map<String, Object> result = new HashMap<>();
        try {
            JsonNode config = objectMapper.readTree(nodeConfigJson);
            String table = config.path("table").asText("");
            String operation = config.path("operation").asText("UPDATE").toUpperCase();

            // Security check
            if (!ALLOWED_TABLES.contains(table.toLowerCase())) {
                log.warn("UPDATE_RECORD: table '{}' not in allowed list", table);
                result.put("error", "Table '" + table + "' is not allowed for updates. Allowed: " + ALLOWED_TABLES);
                return result;
            }

            if (!"UPDATE".equals(operation)) {
                result.put("error", "Only UPDATE operation is supported. Got: " + operation);
                return result;
            }

            // Dry-run check
            Boolean dryRun = (Boolean) context.getOrDefault("dryRun", false);
            if (Boolean.TRUE.equals(dryRun)) {
                log.info("[DRY RUN] UPDATE_RECORD: would update table '{}' with config: {}", table, nodeConfigJson);
                result.put("dryRun", true);
                result.put("skipped", "update_record");
                result.put("table", table);
                return result;
            }

            // Parse WHERE clause
            JsonNode whereNode = config.path("where");
            JsonNode setNode = config.path("set");

            if (!setNode.isObject() || setNode.isEmpty()) {
                result.put("error", "Missing or empty 'set' clause");
                return result;
            }

            if (!whereNode.isObject() || whereNode.isEmpty()) {
                result.put("error", "Missing or empty 'where' clause — refusing to update without conditions");
                return result;
            }

            // Build SET clause
            MapSqlParameterSource params = new MapSqlParameterSource();
            StringBuilder sql = new StringBuilder("UPDATE ").append(table).append(" SET ");

            List<String> setClauses = new ArrayList<>();
            Iterator<Map.Entry<String, JsonNode>> setFields = setNode.fields();
            int paramIdx = 0;
            while (setFields.hasNext()) {
                Map.Entry<String, JsonNode> field = setFields.next();
                String paramName = "set_" + paramIdx;
                setClauses.add(sanitizeColumnName(field.getKey()) + " = :" + paramName);

                // Evaluate SpEL if value starts with #
                String rawValue = field.getValue().asText();
                Object value = rawValue.startsWith("#") ? spelEvaluator.evaluate(rawValue, context) : rawValue;
                params.addValue(paramName, value);
                paramIdx++;
            }
            sql.append(String.join(", ", setClauses));

            // Build WHERE clause
            sql.append(" WHERE ");
            List<String> whereClauses = new ArrayList<>();
            Iterator<Map.Entry<String, JsonNode>> whereFields = whereNode.fields();
            int whereIdx = 0;
            while (whereFields.hasNext()) {
                Map.Entry<String, JsonNode> field = whereFields.next();
                String paramName = "where_" + whereIdx;
                whereClauses.add(sanitizeColumnName(field.getKey()) + " = :" + paramName);

                String rawValue = field.getValue().asText();
                Object value = rawValue.startsWith("#") ? spelEvaluator.evaluate(rawValue, context) : rawValue;
                params.addValue(paramName, value);
                whereIdx++;
            }
            sql.append(String.join(" AND ", whereClauses));

            log.info("UPDATE_RECORD: executing SQL: {}", sql);
            int rowsUpdated = jdbcTemplate.update(sql.toString(), params);

            result.put("table", table);
            result.put("rowsUpdated", rowsUpdated);
            result.put("sql", sql.toString());

            log.info("UPDATE_RECORD: updated {} rows in table '{}'", rowsUpdated, table);

        } catch (Exception e) {
            log.error("Error in UpdateRecordNodeHandler", e);
            result.put("error", "UpdateRecordNodeHandler error: " + e.getMessage());
        }
        return result;
    }

    // Sanitize column names to prevent SQL injection
    private String sanitizeColumnName(String name) {
        return name.replaceAll("[^a-zA-Z0-9_]", "");
    }
}
