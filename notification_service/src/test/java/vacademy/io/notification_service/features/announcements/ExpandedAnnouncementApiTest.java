package vacademy.io.notification_service.features.announcements;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import vacademy.io.notification_service.features.announcements.dto.CreateAnnouncementRequest;
import vacademy.io.notification_service.features.announcements.service.AnnouncementDeliveryService;
import vacademy.io.notification_service.features.announcements.service.RecipientResolutionService;

import java.util.List;
import java.util.Map;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class ExpandedAnnouncementApiTest {

    @Autowired private MockMvc mockMvc;
    @Autowired private ObjectMapper objectMapper;

    @MockBean private RecipientResolutionService recipientResolutionService;
    @MockBean private AnnouncementDeliveryService announcementDeliveryService;

    private String createAnnouncement() throws Exception {
        CreateAnnouncementRequest req = new CreateAnnouncementRequest();
        req.setTitle("AnnX");
        var content = new CreateAnnouncementRequest.RichTextDataRequest();
        content.setType("text");
        content.setContent("hello");
        req.setContent(content);
        req.setInstituteId("INST_X");
        req.setCreatedBy("CREATOR_X");
        req.setCreatedByRole("ADMIN");
        req.setTimezone("UTC");
        req.setRecipients(List.of(new CreateAnnouncementRequest.RecipientRequest("ROLE","STUDENT",null)));
        req.setModes(List.of(new CreateAnnouncementRequest.ModeRequest("SYSTEM_ALERT", Map.of("priority","MEDIUM"))));
        var medium = new CreateAnnouncementRequest.MediumRequest();
        medium.setMediumType("PUSH_NOTIFICATION");
        medium.setConfig(Map.of("title","t","body","b"));
        req.setMediums(List.of(medium));

        var res = mockMvc.perform(post("/notification-service/v1/announcements")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(req)))
                .andExpect(status().isOk())
                .andReturn();
        JsonNode json = objectMapper.readTree(res.getResponse().getContentAsString());
        return json.get("id").asText();
    }

    @Test
    @DisplayName("List, update status, stats, deliver, delete")
    void fullAnnouncementFlow() throws Exception {
        String id = createAnnouncement();

        // List by institute
        mockMvc.perform(get("/notification-service/v1/announcements/institute/INST_X"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content").exists());

        // Update status
        mockMvc.perform(put("/notification-service/v1/announcements/" + id + "/status")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("status","ACTIVE"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("ACTIVE"));

        // Stats
        mockMvc.perform(get("/notification-service/v1/announcements/" + id + "/stats"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalRecipients").exists());

        // Deliver (mock recipient resolution + delivery)
        Mockito.when(recipientResolutionService.resolveRecipientsToUsers(id))
                .thenReturn(List.of("USER_X"));
        Mockito.doNothing().when(announcementDeliveryService).deliverAnnouncement(id);

        mockMvc.perform(post("/notification-service/v1/announcements/" + id + "/deliver"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.message").value("Announcement delivery initiated"));

        // Delete
        mockMvc.perform(delete("/notification-service/v1/announcements/" + id))
                .andExpect(status().isNoContent());
    }
}
