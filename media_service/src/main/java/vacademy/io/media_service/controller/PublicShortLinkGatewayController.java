package vacademy.io.media_service.controller;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import vacademy.io.media_service.dto.CreateShortLinkRequest;
import vacademy.io.media_service.entity.ShortLink;
import vacademy.io.media_service.service.ShortLinkService;

import java.util.HashMap;
import java.util.Map;

/**
 * Gateway-accessible short link endpoints.
 * Path prefix /media-service/public/ ensures nginx routes these to media_service.
 * (The /s/ controller handles redirects on the short-link domain only.)
 */
@RestController
@RequestMapping("/media-service/public/v1/short-link")
public class PublicShortLinkGatewayController {

    @Autowired
    private ShortLinkService shortLinkService;

    /**
     * Get-or-create a short link for a source entity.
     * Called by the learner frontend via the nginx gateway.
     * Body: { source, sourceId, destinationUrl, instituteId, shortCode (hint) }
     * Returns: { shortName, absoluteUrl }
     */
    @PostMapping("/get-or-create")
    public ResponseEntity<Map<String, String>> getOrCreateShortLink(@RequestBody CreateShortLinkRequest request) {
        ShortLink shortLink = shortLinkService.getOrCreateShortLink(
                request.getSource(),
                request.getSourceId(),
                request.getDestinationUrl(),
                request.getInstituteId(),
                request.getShortCode()
        );

        Map<String, String> response = new HashMap<>();
        response.put("shortName", shortLink.getShortName());
        response.put("absoluteUrl", shortLink.getAbsoluteUrl());

        return ResponseEntity.ok(response);
    }
}
