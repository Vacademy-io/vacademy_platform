package vacademy.io.admin_core_service.features.workflow.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import vacademy.io.admin_core_service.features.institute_learner.repository.StudentSessionInstituteGroupMappingRepository;
import vacademy.io.admin_core_service.features.workflow.engine.QueryNodeHandler;

import java.sql.Timestamp;
import java.util.*;

@Slf4j
@Service
@RequiredArgsConstructor
public class QueryServiceImpl implements QueryNodeHandler.QueryService {
    
    private final StudentSessionInstituteGroupMappingRepository ssigmRepo;

    @Override
    public Map<String, Object> execute(String prebuiltKey, Map<String, Object> params) {
        log.info("Executing query with key: {}, params: {}", prebuiltKey, params);
        
        switch (prebuiltKey) {
            case "fetch_ssigm_by_package":
                return fetchSSIGMByPackage(params);
            case "get_ssigm_by_status_and_sessions":
                return getSSIGMByStatusAndSessions(params);
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
                "mapping_count", ssigmList.size()
            );
            
        } catch (Exception e) {
            log.error("Error executing fetch_ssigm_by_package query", e);
            return Map.of("error", e.getMessage());
        }
    }
    
    private Map<String, Object> getSSIGMByStatusAndSessions(Map<String, Object> params) {
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
                "mapping_count", ssigmList.size()
            );
            
        } catch (Exception e) {
            log.error("Error executing get_ssigm_by_status_and_sessions query", e);
            return Map.of("error", e.getMessage());
        }
    }
}