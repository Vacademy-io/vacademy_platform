package vacademy.io.media_service.service;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import vacademy.io.common.exceptions.VacademyException;
import vacademy.io.media_service.entity.ShortLink;
import vacademy.io.media_service.repository.ShortLinkRepository;

import java.time.LocalDateTime;
import java.util.Optional;
import java.util.UUID;

@Service
public class ShortLinkService {

    @Autowired
    private ShortLinkRepository shortLinkRepository;

    @Transactional
    public ShortLink createShortLink(String shortCode, String destinationUrl, String source, String sourceId) {
        if (shortLinkRepository.findByShortName(shortCode).isPresent()) {
            throw new VacademyException("Short code already exists: " + shortCode);
        }

        ShortLink shortLink = ShortLink.builder()
                .id(UUID.randomUUID().toString())
                .shortName(shortCode)
                .destinationUrl(destinationUrl)
                .status("ACTIVE")
                .source(source)
                .sourceId(sourceId)
                .build();

        return shortLinkRepository.save(shortLink);
    }

    @Transactional
    public String getDestinationUrlAndLogAccess(String shortCode) {
        Optional<ShortLink> shortLinkOpt = shortLinkRepository.findByShortName(shortCode);
        if (shortLinkOpt.isEmpty()) {
            throw new VacademyException("Short link not found: " + shortCode);
        }

        ShortLink shortLink = shortLinkOpt.get();
        if (!"ACTIVE".equals(shortLink.getStatus())) {
            throw new VacademyException("Short link is not active: " + shortCode);
        }

        // Log access timestamp (async logging would be better but this is simpler)
        shortLink.setLastQueriedAt(LocalDateTime.now());
        shortLinkRepository.save(shortLink);

        return shortLink.getDestinationUrl();
    }

    @Transactional
    public ShortLink updateShortLink(String source, String sourceId, String newDestinationUrl) {
        Optional<ShortLink> shortLinkOpt = shortLinkRepository.findBySourceAndSourceId(source, sourceId);
        if (shortLinkOpt.isEmpty()) {
            throw new VacademyException("Short link not found for source: " + source + ", sourceId: " + sourceId);
        }

        ShortLink shortLink = shortLinkOpt.get();
        shortLink.setDestinationUrl(newDestinationUrl);
        return shortLinkRepository.save(shortLink);
    }

    @Transactional
    public void deleteShortLink(String source, String sourceId) {
        Optional<ShortLink> shortLinkOpt = shortLinkRepository.findBySourceAndSourceId(source, sourceId);
        if (shortLinkOpt.isPresent()) {
            ShortLink shortLink = shortLinkOpt.get();
            shortLink.setStatus("DELETED");
            shortLinkRepository.save(shortLink);
        }
    }
}
