package vacademy.io.community_service.feature.guide.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;
import org.springframework.web.server.ResponseStatusException;
import vacademy.io.community_service.feature.guide.dto.GuideDto;
import vacademy.io.community_service.feature.guide.dto.UpsertGuideRequest;
import vacademy.io.community_service.feature.guide.entity.PortalGuide;
import vacademy.io.community_service.feature.guide.repository.PortalGuideRepository;

import java.util.Collections;
import java.util.List;
import java.util.stream.Collectors;

@Service
public class PortalGuideService {

    private static final TypeReference<List<String>> STRING_LIST = new TypeReference<>() {
    };

    @Autowired
    private PortalGuideRepository repository;
    @Autowired
    private ObjectMapper objectMapper;

    @Transactional(readOnly = true)
    public List<GuideDto> listAll() {
        return repository.findAllByOrderByCreatedAtDesc().stream()
                .map(this::toDto)
                .collect(Collectors.toList());
    }

    @Transactional
    public GuideDto create(UpsertGuideRequest request) {
        validate(request);
        PortalGuide guide = PortalGuide.builder()
                .title(request.getTitle().trim())
                .fileId(request.getFileId())
                .fileUrl(request.getFileUrl().trim())
                .routes(writeRoutes(request.getRoutes()))
                .active(request.getActive() == null || request.getActive())
                .build();
        return toDto(repository.save(guide));
    }

    @Transactional
    public GuideDto update(String id, UpsertGuideRequest request) {
        PortalGuide guide = getOrThrow(id);
        if (StringUtils.hasText(request.getTitle())) {
            guide.setTitle(request.getTitle().trim());
        }
        if (StringUtils.hasText(request.getFileUrl())) {
            guide.setFileUrl(request.getFileUrl().trim());
            guide.setFileId(request.getFileId());
        }
        if (request.getRoutes() != null && !request.getRoutes().isEmpty()) {
            guide.setRoutes(writeRoutes(request.getRoutes()));
        }
        if (request.getActive() != null) {
            guide.setActive(request.getActive());
        }
        return toDto(repository.save(guide));
    }

    @Transactional
    public void delete(String id) {
        repository.deleteById(id);
    }

    private void validate(UpsertGuideRequest request) {
        if (request == null || !StringUtils.hasText(request.getTitle())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "title is required");
        }
        if (!StringUtils.hasText(request.getFileUrl())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "fileUrl is required");
        }
        if (request.getRoutes() == null || request.getRoutes().isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "at least one route is required");
        }
    }

    private PortalGuide getOrThrow(String id) {
        return repository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Guide not found: " + id));
    }

    private GuideDto toDto(PortalGuide g) {
        return GuideDto.builder()
                .id(g.getId())
                .title(g.getTitle())
                .fileId(g.getFileId())
                .fileUrl(g.getFileUrl())
                .routes(readRoutes(g.getRoutes()))
                .active(g.isActive())
                .createdAt(g.getCreatedAt())
                .updatedAt(g.getUpdatedAt())
                .build();
    }

    private String writeRoutes(List<String> routes) {
        try {
            return objectMapper.writeValueAsString(routes);
        } catch (Exception e) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid routes");
        }
    }

    private List<String> readRoutes(String json) {
        if (!StringUtils.hasText(json)) {
            return Collections.emptyList();
        }
        try {
            List<String> parsed = objectMapper.readValue(json, STRING_LIST);
            return parsed != null ? parsed : Collections.emptyList();
        } catch (Exception e) {
            return Collections.emptyList();
        }
    }
}
