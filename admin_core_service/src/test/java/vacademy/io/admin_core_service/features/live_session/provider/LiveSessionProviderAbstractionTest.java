package vacademy.io.admin_core_service.features.live_session.provider;

import org.junit.jupiter.api.Test;
import vacademy.io.admin_core_service.features.live_session.provider.manager.ZoomMeetingManager;
import vacademy.io.common.exceptions.VacademyException;
import vacademy.io.common.meeting.enums.MeetingProvider;

import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

/**
 * Verifies the vendor-abstraction refactor: factory auto-discovery from injected
 * strategy beans, capability-flag defaults, and the default-throw join link.
 */
class LiveSessionProviderAbstractionTest {

    private LiveSessionProviderStrategy strategyNamed(String providerName) {
        LiveSessionProviderStrategy s = mock(LiveSessionProviderStrategy.class);
        when(s.getProviderName()).thenReturn(providerName);
        return s;
    }

    @Test
    void factoryAutoDiscoversStrategiesByProviderName() {
        LiveSessionProviderStrategy zoom = strategyNamed("ZOOM_MEETING");
        LiveSessionProviderStrategy bbb = strategyNamed("BBB_MEETING");

        LiveSessionProviderFactory factory = new LiveSessionProviderFactory(List.of(zoom, bbb));

        assertSame(zoom, factory.getStrategy(MeetingProvider.ZOOM_MEETING));
        assertSame(zoom, factory.getStrategy("ZOOM"));        // fromString shortcut
        assertSame(bbb, factory.getStrategy(MeetingProvider.BBB_MEETING));
    }

    @Test
    void factoryThrowsForUnregisteredProvider() {
        LiveSessionProviderFactory factory =
                new LiveSessionProviderFactory(List.of(strategyNamed("ZOOM_MEETING")));
        // Zoho is a valid enum but no bean registered → resolved-but-missing.
        assertThrows(VacademyException.class, () -> factory.getStrategy(MeetingProvider.ZOHO_MEETING));
    }

    @Test
    void capabilityFlagsDefaultFalseAndJoinLinkThrows() {
        LiveSessionProviderStrategy plain = mock(LiveSessionProviderStrategy.class, CALLS_REAL_METHODS);
        assertFalse(plain.supportsSdkJoin());
        assertFalse(plain.supportsMultiAccount());
        assertFalse(plain.supportsWebhooks());
        assertThrows(VacademyException.class,
                () -> plain.getParticipantJoinLink("m", "n", "e", "inst"));
    }

    @Test
    void zoomDeclaresSdkMultiAccountAndWebhookCapabilities() {
        ZoomMeetingManager zoom = new ZoomMeetingManager(null, null, null, null);
        assertTrue(zoom.supportsSdkJoin());
        assertTrue(zoom.supportsMultiAccount());
        assertTrue(zoom.supportsWebhooks());
        assertEquals(MeetingProvider.ZOOM_MEETING.name(), zoom.getProviderName());
    }
}
