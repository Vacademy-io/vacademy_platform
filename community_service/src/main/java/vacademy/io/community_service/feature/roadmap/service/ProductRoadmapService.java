package vacademy.io.community_service.feature.roadmap.service;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import vacademy.io.community_service.feature.roadmap.dto.RoadmapDto;
import vacademy.io.community_service.feature.roadmap.entity.ProductRoadmap;
import vacademy.io.community_service.feature.roadmap.repository.ProductRoadmapRepository;

@Service
public class ProductRoadmapService {

    @Autowired
    private ProductRoadmapRepository repository;

    /**
     * Timestamp only, for the dock's "new" dot. Deliberately does not reuse get():
     * the point is to avoid transferring the ~1MB htmlContent on every page load.
     * Returns a DTO with a null htmlContent so the shape stays familiar to callers.
     */
    @Transactional(readOnly = true)
    public RoadmapDto getMeta() {
        return RoadmapDto.builder()
                .updatedAt(repository.findUpdatedAtById(ProductRoadmap.SINGLETON_ID).orElse(null))
                .build();
    }

    @Transactional(readOnly = true)
    public RoadmapDto get() {
        return repository.findById(ProductRoadmap.SINGLETON_ID)
                .map(r -> RoadmapDto.builder().htmlContent(r.getHtmlContent()).updatedAt(r.getUpdatedAt()).build())
                .orElseGet(() -> RoadmapDto.builder().htmlContent("").updatedAt(null).build());
    }

    @Transactional
    public RoadmapDto update(String htmlContent) {
        ProductRoadmap roadmap = repository.findById(ProductRoadmap.SINGLETON_ID)
                .orElseGet(() -> ProductRoadmap.builder().id(ProductRoadmap.SINGLETON_ID).build());
        roadmap.setHtmlContent(htmlContent != null ? htmlContent : "");
        roadmap = repository.save(roadmap);
        return RoadmapDto.builder().htmlContent(roadmap.getHtmlContent()).updatedAt(roadmap.getUpdatedAt()).build();
    }
}
