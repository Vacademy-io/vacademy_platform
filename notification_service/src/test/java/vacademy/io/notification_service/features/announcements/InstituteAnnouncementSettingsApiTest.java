package vacademy.io.notification_service.features.announcements;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

import java.util.Map;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class InstituteAnnouncementSettingsApiTest {

    @Autowired private MockMvc mockMvc;
    @Autowired private ObjectMapper objectMapper;

    @Test
    @DisplayName("Create, get, validate, permissions, and delete settings")
    void settingsCrudAndPermissions() throws Exception {
        String instituteId = "INST_SETTINGS";

        // Create/Update
        var request = Map.of(
                "instituteId", instituteId,
                "settings", Map.of(
                        "community", Map.of("students_can_send", true),
                        "dashboard_pins", Map.of("students_can_create", false, "max_duration_hours", 24)
                )
        );

        mockMvc.perform(post("/notification-service/v1/institute-settings")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.instituteId").value(instituteId));

        // Get by institute
        mockMvc.perform(get("/notification-service/v1/institute-settings/institute/" + instituteId))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.instituteId").value(instituteId));

        // Validate
        mockMvc.perform(post("/notification-service/v1/institute-settings/validate")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.valid").value(true));

        // Permissions check
        mockMvc.perform(get("/notification-service/v1/institute-settings/institute/" + instituteId + "/permissions")
                        .param("userRole", "STUDENT")
                        .param("action", "send")
                        .param("modeType", "COMMUNITY"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.canPerform").exists());

        // Delete
        mockMvc.perform(delete("/notification-service/v1/institute-settings/institute/" + instituteId))
                .andExpect(status().isNoContent());
    }
}
