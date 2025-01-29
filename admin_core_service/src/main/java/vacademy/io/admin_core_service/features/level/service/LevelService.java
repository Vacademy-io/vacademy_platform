package vacademy.io.admin_core_service.features.level.service;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import vacademy.io.admin_core_service.features.level.dto.AddLevelDTO;
import vacademy.io.admin_core_service.features.level.enums.LevelStatusEnum;
import vacademy.io.admin_core_service.features.level.repository.LevelRepository;
import vacademy.io.common.exceptions.VacademyException;
import vacademy.io.common.institute.entity.Level;

@Service
@RequiredArgsConstructor
public class LevelService {
    private final LevelRepository levelRepository;

    public Level addLevel(AddLevelDTO addLevelDTO) {
        Level level = getLevel(addLevelDTO);
        return levelRepository.save(level);
    }

    private Level getLevel(AddLevelDTO addLevelDTO) {
        Level level = new Level();
        level.setLevelName(addLevelDTO.getLevelName());
        level.setDurationInDays(addLevelDTO.getDurationInDays());
        level.setStatus(LevelStatusEnum.ACTIVE.name());
        return levelRepository.save(level);
    }

    public Level getLevelById(String levelId) {
        return levelRepository.findById(levelId).orElseThrow(() -> new VacademyException("Level not found"));
    }
}
