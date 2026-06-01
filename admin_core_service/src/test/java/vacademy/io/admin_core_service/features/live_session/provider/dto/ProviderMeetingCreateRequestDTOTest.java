package vacademy.io.admin_core_service.features.live_session.provider.dto;

import org.junit.jupiter.api.Test;

import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Verifies the vendor-neutral resolvers prefer the generic fields and fall back to
 * the legacy per-vendor fields (Phase A of the abstraction refactor).
 */
class ProviderMeetingCreateRequestDTOTest {

    @Test
    void resolveProviderConfigPrefersGenericThenFallsBack() {
        Map<String, Object> generic = Map.of("waitingRoom", true);
        Map<String, Object> zoom = Map.of("muteUponEntry", true);
        Map<String, Object> bbb = Map.of("record", true);

        assertEquals(generic, ProviderMeetingCreateRequestDTO.builder()
                .providerConfig(generic).zoomConfig(zoom).bbbConfig(bbb).build().resolveProviderConfig());
        assertEquals(zoom, ProviderMeetingCreateRequestDTO.builder()
                .zoomConfig(zoom).bbbConfig(bbb).build().resolveProviderConfig());
        assertEquals(bbb, ProviderMeetingCreateRequestDTO.builder()
                .bbbConfig(bbb).build().resolveProviderConfig());
        // Empty generic map is treated as "not set" → falls back.
        assertEquals(zoom, ProviderMeetingCreateRequestDTO.builder()
                .providerConfig(Map.of()).zoomConfig(zoom).build().resolveProviderConfig());
        assertNull(ProviderMeetingCreateRequestDTO.builder().build().resolveProviderConfig());
    }

    @Test
    void resolveProviderAccountIdPrefersGenericThenLegacy() {
        assertEquals("acct-new", ProviderMeetingCreateRequestDTO.builder()
                .providerAccountId("acct-new").zoomAccountId("acct-old").build().resolveProviderAccountId());
        assertEquals("acct-old", ProviderMeetingCreateRequestDTO.builder()
                .zoomAccountId("acct-old").build().resolveProviderAccountId());
        assertNull(ProviderMeetingCreateRequestDTO.builder().build().resolveProviderAccountId());
    }
}
