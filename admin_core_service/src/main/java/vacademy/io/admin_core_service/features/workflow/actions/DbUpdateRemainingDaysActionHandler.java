package vacademy.io.admin_core_service.features.workflow.actions;

import com.fasterxml.jackson.databind.JsonNode;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.HashMap;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class DbUpdateRemainingDaysActionHandler implements ActionHandlerService {

    private final DbClient dbClient;

    @Override
    public String getType() {
        return "dbUpdateRemainingDays";
    }

    @Override
    public Map<String, Object> execute(Map<String, Object> item, JsonNode config, Map<String, Object> context) {
        Map<String, Object> result = new HashMap<>();
        Object weekend = item.get("is_weekend");
        boolean isWeekend = weekend instanceof Boolean b ? b : Boolean.parseBoolean(String.valueOf(weekend));
        int remaining = Integer.parseInt(String.valueOf(item.getOrDefault("remaining_days", 0)));
        if (isWeekend || remaining <= 0) {
            result.put("success", true);
            result.put("skipped", true);
            result.put("reason", isWeekend ? "WEEKEND" : "NO_REMAINING");
            return result;
        }
        String mappingId = String.valueOf(item.get("mapping_id"));
        int newRemaining = Math.max(remaining - 1, 0);
        boolean ok = dbClient.updateRemainingDaysForMapping(mappingId, newRemaining);
        result.put("success", ok);
        result.put("mapping_id", mappingId);
        result.put("new_remaining_days", newRemaining);
        return result;
    }
}