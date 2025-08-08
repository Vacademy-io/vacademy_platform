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
import vacademy.io.notification_service.features.announcements.dto.CreateAnnouncementRequest;

import java.util.List;
import java.util.Map;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class AnnouncementApiTest {

    @Autowired private MockMvc mockMvc;
    @Autowired private ObjectMapper objectMapper;

    private CreateAnnouncementRequest sampleRequest() {
        CreateAnnouncementRequest req = new CreateAnnouncementRequest();
        req.setTitle("Test Announcement");
        var content = new CreateAnnouncementRequest.RichTextDataRequest();
        content.setType("text");
        content.setContent("Hello world");
        req.setContent(content);
        req.setInstituteId("INST_TEST");
        req.setCreatedBy("USER_TEST");
        req.setCreatedByRole("ADMIN");
        req.setTimezone("UTC");

        var recipient = new CreateAnnouncementRequest.RecipientRequest();
        recipient.setRecipientType("ROLE");
        recipient.setRecipientId("STUDENT");
        req.setRecipients(List.of(recipient));

        var mode = new CreateAnnouncementRequest.ModeRequest();
        mode.setModeType("SYSTEM_ALERT");
        mode.setSettings(Map.of("priority", "HIGH"));
        req.setModes(List.of(mode));

        var medium = new CreateAnnouncementRequest.MediumRequest();
        medium.setMediumType("PUSH_NOTIFICATION");
        medium.setConfig(Map.of("title", "Hello", "body", "World"));
        req.setMediums(List.of(medium));

        return req;
    }

    @Test
    @DisplayName("Create and fetch announcement")
    void createAndFetchAnnouncement() throws Exception {
        var body = objectMapper.writeValueAsString(sampleRequest());

        var postResult = mockMvc.perform(post("/notification-service/v1/announcements")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").exists())
                .andReturn();

        String id = objectMapper.readTree(postResult.getResponse().getContentAsString()).get("id").asText();

        mockMvc.perform(get("/notification-service/v1/announcements/" + id))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.title").value("Test Announcement"));
    }
}


