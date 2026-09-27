package vacademy.io.notification_service.features.firebase_notifications;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import vacademy.io.notification_service.features.announcements.entity.InstituteAnnouncementSettings;
import vacademy.io.notification_service.features.announcements.repository.InstituteAnnouncementSettingsRepository;
import vacademy.io.notification_service.features.firebase_notifications.service.MultiTenantFirebaseManager;

import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.*;

class MultiTenantFirebaseManagerCacheTest {

    @Test
    @DisplayName("an explicit firebase.enabled=false switches push off even with a key stored")
    void disabledKeyIsNotUsed() {
        InstituteAnnouncementSettingsRepository repo = mock(InstituteAnnouncementSettingsRepository.class);
        InstituteAnnouncementSettings row = new InstituteAnnouncementSettings();
        row.setInstituteId("inst-1");
        row.setSettings(Map.of("firebase", Map.of("enabled", false,
                "serviceAccountJson", "{\"type\":\"service_account\",\"client_email\":\"a@b\",\"private_key\":\"x\"}")));
        when(repo.findByInstituteId("inst-1")).thenReturn(Optional.of(row));

        assertThat(new MultiTenantFirebaseManager(repo).getMessagingForInstitute("inst-1")).isEmpty();
    }

    @Test
    @DisplayName("an institute without a key is cached, not re-queried on every send")
    void missingKeyIsCached() {
        InstituteAnnouncementSettingsRepository repo = mock(InstituteAnnouncementSettingsRepository.class);
        when(repo.findByInstituteId("inst-2")).thenReturn(Optional.empty());
        MultiTenantFirebaseManager manager = new MultiTenantFirebaseManager(repo);

        for (int i = 0; i < 5; i++) {
            assertThat(manager.getMessagingForInstitute("inst-2")).isEmpty();
        }
        verify(repo, times(1)).findByInstituteId("inst-2");
    }

    @Test
    @DisplayName("a null institute id is simply 'no Firebase', not an exception")
    void nullInstitute() {
        assertThat(new MultiTenantFirebaseManager(mock(InstituteAnnouncementSettingsRepository.class))
                .getMessagingForInstitute(null)).isEmpty();
    }
}
