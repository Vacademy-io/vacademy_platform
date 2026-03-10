package vacademy.io.media_service.controller;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import vacademy.io.media_service.dto.CreateShortLinkRequest;
import vacademy.io.media_service.entity.InstituteShortLinkDomain;
import vacademy.io.media_service.entity.ShortLink;
import vacademy.io.media_service.repository.InstituteShortLinkDomainRepository;
import vacademy.io.media_service.service.ShortLinkService;

import java.util.Optional;

@RestController
@RequestMapping("/media-service/internal/v1/short-link")
public class InternalShortLinkController {

    @Autowired
    private ShortLinkService shortLinkService;

    @Autowired
    private InstituteShortLinkDomainRepository shortLinkDomainRepository;

    @Value("${short.link.base.url:https://u.vacademy.io}")
    private String defaultShortLinkBaseUrl;

    @PostMapping("/create")
    public ResponseEntity<ShortLink> createShortLink(@RequestBody CreateShortLinkRequest request) {
        ShortLink shortLink = shortLinkService.createShortLink(
                request.getShortCode(),
                request.getDestinationUrl(),
                request.getSource(),
                request.getSourceId(),
                request.getInstituteId());
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

    @GetMapping("/base-url")
    public ResponseEntity<String> getBaseUrl(@RequestParam(required = false) String instituteId) {
        String host = defaultShortLinkBaseUrl;
        if (instituteId != null && !instituteId.isBlank()) {
            Optional<InstituteShortLinkDomain> domainOpt = shortLinkDomainRepository.findByInstituteId(instituteId);
            if (domainOpt.isPresent() && domainOpt.get().getBaseUrl() != null
                    && !domainOpt.get().getBaseUrl().isBlank()) {
                String domain = domainOpt.get().getBaseUrl().trim();

                // If the user just specified the domain (e.g. aanandham.uk or vacademy.io)
                // Add the fixed u. subdomain and scheme.
                if (!domain.startsWith("http")) {
                    host = "https://u." + domain;
                } else {
                    host = domain;
                }
            }
        }
        if (host.endsWith("/")) {
            host = host.substring(0, host.length() - 1);
        }
        return ResponseEntity.ok(host);
    }
}
