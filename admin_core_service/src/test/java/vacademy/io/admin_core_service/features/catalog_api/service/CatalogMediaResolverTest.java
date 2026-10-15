package vacademy.io.admin_core_service.features.catalog_api.service;

import org.junit.jupiter.api.Test;
import vacademy.io.admin_core_service.features.media_service.service.MediaService;

import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

class CatalogMediaResolverTest {

    @Test
    void resolvesInOneBatchCachesAndPassesUrlsThrough() {
        MediaService media = mock(MediaService.class);
        when(media.getPublicUrlsWithoutExpiry(any())).thenReturn(Map.of("a", "https://cdn/a", "b", "https://cdn/b"));
        CatalogMediaResolver r = new CatalogMediaResolver(media);
        Map<String, String> out = r.resolve(List.of("a", "b", "https://x/y.png", "a"));
        assertEquals("https://cdn/a", out.get("a"));
        assertEquals("https://x/y.png", out.get("https://x/y.png"));
        r.resolve(List.of("a", "b"));
        verify(media, times(1)).getPublicUrlsWithoutExpiry(any()); // second call is all cache hits
        verify(media, never()).getFilePublicUrlByIdWithoutExpiry(any());
    }

    @Test
    void aFailedBatchFallsBackPerIdAndRemembersMisses() {
        MediaService media = mock(MediaService.class);
        when(media.getPublicUrlsWithoutExpiry(any())).thenThrow(new RuntimeException("File Not Found"));
        when(media.getFilePublicUrlByIdWithoutExpiry("good")).thenReturn("https://cdn/good");
        when(media.getFilePublicUrlByIdWithoutExpiry("gone")).thenThrow(new RuntimeException("404"));
        CatalogMediaResolver r = new CatalogMediaResolver(media);
        Map<String, String> out = r.resolve(List.of("good", "gone"));
        assertEquals(Map.of("good", "https://cdn/good"), out);
        r.resolve(List.of("good", "gone"));
        verify(media, times(1)).getPublicUrlsWithoutExpiry(any());
        verify(media, times(1)).getFilePublicUrlByIdWithoutExpiry("gone");
    }
}
