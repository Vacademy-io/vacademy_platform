package vacademy.io.admin_core_service.features.packages.service;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import vacademy.io.admin_core_service.features.packages.dto.PackageFilterDetailsDTO;
import vacademy.io.admin_core_service.features.packages.repository.PackageRepository;
import vacademy.io.admin_core_service.features.packages.repository.PackageSessionRepository;
import vacademy.io.admin_core_service.features.slide.service.SlideService;
import vacademy.io.common.institute.dto.PackageSessionDTO;

import java.util.List;

@Service
public class PackageInitService {

    @Autowired
    private PackageRepository packageRepository;

    @Autowired
    private PackageSessionRepository packageSessionRepository;

    @Autowired
    private SlideService slideService;

    @Transactional(readOnly = true)
    public PackageFilterDetailsDTO getPackageFilterDetails(List<String> packageSessionIds) {
        PackageFilterDetailsDTO packageFilterDetailsDTO = new PackageFilterDetailsDTO();
        packageFilterDetailsDTO.setTags(packageRepository.findAllDistinctTagsByPackageSessionIds(packageSessionIds));
        packageFilterDetailsDTO.setLevels(packageRepository
                .findDistinctLevelsByPackageSessionIdsAndStatusIn(packageSessionIds, List.of("ACTIVE")));
        packageFilterDetailsDTO.setBatchesForSession(packageSessionRepository
                .findPackageSessionsByIds(packageSessionIds).stream()
                .map((obj) -> new PackageSessionDTO(obj, slideService.calculateTotalReadTimeInMinutes(obj.getId())))
                .toList());
        return packageFilterDetailsDTO;
    }

}
