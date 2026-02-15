package vacademy.io.media_service.controller;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import vacademy.io.media_service.dto.CreateShortLinkRequest;
import vacademy.io.media_service.entity.ShortLink;
import vacademy.io.media_service.service.ShortLinkService;

@RestController
@RequestMapping("/media-service/internal/v1/short-link")
public class InternalShortLinkController {

    @Autowired
    private ShortLinkService shortLinkService;

    @PostMapping("/create")
    public ResponseEntity<ShortLink> createShortLink(@RequestBody CreateShortLinkRequest request) {
        ShortLink shortLink = shortLinkService.createShortLink(
                request.getShortCode(),
                request.getDestinationUrl(),
                request.getSource(),
                request.getSourceId());
        return ResponseEntity.ok(shortLink);
    }

    @PutMapping("/update")
    public ResponseEntity<ShortLink> updateShortLink(
            @RequestParam String source,
            @RequestParam String sourceId,
            @RequestParam String newDestinationUrl) {
        ShortLink shortLink = shortLinkService.updateShortLink(source, sourceId, newDestinationUrl);
        return ResponseEntity.ok(shortLink);
    }

    @DeleteMapping("/delete")
    public ResponseEntity<Void> deleteShortLink(
            @RequestParam String source,
            @RequestParam String sourceId) {
        shortLinkService.deleteShortLink(source, sourceId);
        return ResponseEntity.ok().build();
    }
}
