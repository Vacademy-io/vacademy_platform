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
