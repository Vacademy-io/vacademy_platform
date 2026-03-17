package vacademy.io.media_service.controller;

import jakarta.servlet.http.HttpServletResponse;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import vacademy.io.media_service.service.ShortLinkService;

import java.io.IOException;
import java.util.HashMap;
import java.util.Map;

@RestController
@RequestMapping("/s")
public class PublicShortLinkController {

    @Autowired
    private ShortLinkService shortLinkService;

    /**
     * Redirects to the destination URL (HTTP 302 redirect)
     * Usage: GET /s/{shortCode}
     * Example: GET /s/AbCd12 -> redirects to destination URL
     */
    @GetMapping("/{shortCode}")
    public void redirectShortLink(@PathVariable String shortCode, HttpServletResponse response) throws IOException {
        String destinationUrl = shortLinkService.getDestinationUrlAndLogAccess(shortCode);
        response.sendRedirect(destinationUrl);
    }

    /**
     * Returns the destination URL as JSON without redirecting
     * Usage: GET /s/{shortCode}/info
     * Example: GET /s/AbCd12/info -> {"shortCode": "AbCd12", "destinationUrl":
     * "https://..."}
     */
    @GetMapping("/{shortCode}/info")
    public ResponseEntity<Map<String, String>> getShortLinkInfo(@PathVariable String shortCode) {
        String destinationUrl = shortLinkService.getDestinationUrlAndLogAccess(shortCode);

        Map<String, String> response = new HashMap<>();
        response.put("shortCode", shortCode);
        response.put("destinationUrl", destinationUrl);

        return ResponseEntity.ok(response);
    }
}
