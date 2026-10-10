package vacademy.io.admin_core_service.features.utm_attribution;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.test.util.ReflectionTestUtils;
import vacademy.io.admin_core_service.features.institute.dto.settings.GenericSettingRequest;
import vacademy.io.admin_core_service.features.institute.repository.InstituteRepository;
import vacademy.io.admin_core_service.features.institute.service.setting.InstituteSettingService;
import vacademy.io.admin_core_service.features.utm_attribution.dto.UtmCampaignRowResponse;
import vacademy.io.admin_core_service.features.utm_attribution.repository.UtmAttributionRepository;
import vacademy.io.admin_core_service.features.utm_attribution.service.UtmCampaignLabelService;
import vacademy.io.common.institute.entity.Institute;

import java.sql.Timestamp;
import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/**
 * Campaign names: an admin names a Google campaign id once and every surface
 * shows the name. Names live in their own institute setting so the Campaign
 * Links settings page (which rewrites UTM_SETTING from its own fields) can't
 * wipe them.
 */
class UtmCampaignLabelServiceTest {

    private UtmCampaignLabelService service;
    private InstituteSettingService settings;
    private UtmAttributionRepository repository;
    private final Institute institute = new Institute();

    @BeforeEach
    void setUp() {
        service = new UtmCampaignLabelService();
        settings = mock(InstituteSettingService.class);
        repository = mock(UtmAttributionRepository.class);
        InstituteRepository institutes = mock(InstituteRepository.class);
        institute.setId("inst-1");
        when(institutes.findById("inst-1")).thenReturn(Optional.of(institute));
        ReflectionTestUtils.setField(service, "instituteRepository", institutes);
        ReflectionTestUtils.setField(service, "instituteSettingService", settings);
        ReflectionTestUtils.setField(service, "repository", repository);
    }

    private void stored(Map<String, String> labels) {
        when(settings.getSettingData(institute, UtmCampaignLabelService.SETTING_KEY))
                .thenReturn(new HashMap<>(Map.of("labels", labels)));
    }

    @SuppressWarnings("unchecked")
    private Map<String, String> savedLabels() {
        ArgumentCaptor<Object> req = ArgumentCaptor.forClass(Object.class);
        verify(settings).saveGenericSetting(eq(institute), eq("UTM_CAMPAIGN_LABELS"), req.capture());
        Map<String, Object> data = (Map<String, Object>) ((GenericSettingRequest) req.getValue()).getSettingData();
        return (Map<String, String>) data.get("labels");
    }

    @Test
    void readsNamesAndToleratesNoSetting() {
        stored(Map.of("22173284076", "Pune MBBS Search"));
        assertEquals(Map.of("22173284076", "Pune MBBS Search"), service.labels("inst-1"));

        when(settings.getSettingData(institute, UtmCampaignLabelService.SETTING_KEY)).thenReturn(null);
        assertTrue(service.labels("inst-1").isEmpty());
        assertTrue(service.labels("no-such-institute").isEmpty());
    }

    @Test
    void savingMergesRenamesAndBlankRemoves() {
        stored(Map.of("111", "Old name", "222", "Keep me", "333", "Remove me"));

        Map<String, String> updates = new HashMap<>();
        updates.put("111", "  New name  ");
        updates.put("333", "   ");
        updates.put("444", "Brand new");
        Map<String, String> result = service.saveLabels("inst-1", updates);

        Map<String, String> expected = Map.of("111", "New name", "222", "Keep me", "444", "Brand new");
        assertEquals(expected, result);
        assertEquals(expected, savedLabels());
    }

    @Test
    void namesAreClippedToAReadableLength() {
        stored(Map.of());
        service.saveLabels("inst-1", Map.of("111", "x".repeat(500)));
        assertEquals(120, savedLabels().get("111").length());
    }

    @Test
    void campaignListCarriesCountsDatesAndNames() {
        stored(Map.of("22173284076", "Pune MBBS Search"));
        LocalDateTime first = LocalDateTime.of(2026, 10, 9, 15, 52, 5);
        when(repository.campaignsFor("inst-1", "google", "lead_form")).thenReturn(List.of(
                new Object[] {"22173284076", 4L, Timestamp.valueOf(first), first.plusHours(14)},
                new Object[] {"22206499349", 1L, null, null}));

        List<UtmCampaignRowResponse> rows = service.campaigns("inst-1", "google", "lead_form");

        assertEquals(2, rows.size());
        assertEquals("Pune MBBS Search", rows.get(0).getName());
        assertEquals(4L, rows.get(0).getPeople());
        assertEquals(Timestamp.valueOf(first), rows.get(0).getFirstSeen());
        // A LocalDateTime from the native query is converted, not dropped.
        assertEquals(Timestamp.valueOf(first.plusHours(14)), rows.get(0).getLastSeen());
        assertNull(rows.get(1).getName(), "an unnamed campaign stays unnamed");
    }
}
