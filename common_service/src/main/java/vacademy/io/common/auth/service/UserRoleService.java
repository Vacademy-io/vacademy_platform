package vacademy.io.common.auth.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import vacademy.io.common.auth.entity.UserAuthority;
import vacademy.io.common.auth.entity.UserRole;

import java.util.*;
import java.util.stream.Collectors;

public class UserRoleService {

    // Method to create the map
    public static Map<String, Object> createInstituteRoleMap(List<UserRole> userRoles) {
        // Create a map to hold the results
        Map<String, Object> instituteMap = new HashMap<>();

        // Group user roles by instituteId
        Map<String, List<UserRole>> rolesByInstitute = userRoles.stream()
                .collect(Collectors.groupingBy(UserRole::getInstituteId));

        // Iterate through each group and build the desired structure
        for (Map.Entry<String, List<UserRole>> entry : rolesByInstitute.entrySet()) {
            String instituteId = entry.getKey();
            List<UserRole> roles = entry.getValue();

            // Extract role names and permissions
            List<String> roleNames = roles.stream()
                    .map(userRole -> userRole.getRole().getName()) // Assuming getName() returns the role name
                    .distinct() // To avoid duplicates
                    .collect(Collectors.toList());

            List<String> permissions = roles.stream()
                    .flatMap(userRole -> userRole.getRole().getAuthorities().stream().map((UserAuthority::getName))) // Assuming getPermissions() returns a list of permissions
                    .distinct() // To avoid duplicates
                    .collect(Collectors.toList());

            // Todo: get other user permissions

            // Create the JSON structure
            Map<String, Object> jsonObject = new HashMap<>();
            jsonObject.put("roles", roleNames);
            jsonObject.put("permissions", permissions);

            // Put it into the main map
            instituteMap.put(instituteId, jsonObject);
        }

        return instituteMap;
    }
    
    // Example usage of ObjectMapper for JSON conversion (if needed)
    public String convertToJson(Map<String, Object> map) throws Exception {
        ObjectMapper objectMapper = new ObjectMapper();
        return objectMapper.writeValueAsString(map);
    }
}