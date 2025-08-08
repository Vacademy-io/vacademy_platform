package vacademy.io.notification_service.features.announcements;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class SSEControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Test
    @DisplayName("SSE health returns UP")
    void sseHealth() throws Exception {
        mockMvc.perform(get("/notification-service/v1/sse/health"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("UP"))
                .andExpect(jsonPath("$.service").exists());
    }

    @Test
    @DisplayName("SSE stats responds")
    void sseStats() throws Exception {
        mockMvc.perform(get("/notification-service/v1/sse/stats"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalConnections").exists())
                .andExpect(jsonPath("$.totalUsers").exists())
                .andExpect(jsonPath("$.totalInstitutes").exists());
    }
}
