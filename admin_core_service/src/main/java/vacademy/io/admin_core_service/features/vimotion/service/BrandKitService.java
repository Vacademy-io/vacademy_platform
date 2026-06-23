package vacademy.io.admin_core_service.features.vimotion.service;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;
import vacademy.io.admin_core_service.features.vimotion.dto.BrandKitDTO;
import vacademy.io.admin_core_service.features.vimotion.entity.BrandKit;
import vacademy.io.admin_core_service.features.vimotion.repository.BrandKitRepository;
import vacademy.io.common.exceptions.VacademyException;

import java.util.HashMap;
import java.util.List;
import java.util.Optional;
import java.util.stream.Collectors;

@Service
public class BrandKitService {

    @Autowired
    private BrandKitRepository repository;

    public List<BrandKitDTO> list(String instituteId) {
        return repository.findByInstituteIdOrderByIsDefaultDescCreatedAtDesc(instituteId).stream()
                .map(BrandKitService::toDto)
                .collect(Collectors.toList());
    }

    public BrandKitDTO get(String id, String instituteId) {
        return toDto(loadOrThrow(id, instituteId));
    }

    public Optional<BrandKitDTO> findDefault(String instituteId) {
        return repository.findFirstByInstituteIdAndIsDefaultTrue(instituteId).map(BrandKitService::toDto);
    }

    @Transactional
    public BrandKitDTO create(String instituteId, BrandKitDTO dto, String userId) {
        if (dto == null) throw new VacademyException("Invalid request");
        if (!StringUtils.hasText(dto.getName())) throw new VacademyException("Brand kit name is required");

        boolean explicitlyDefault = Boolean.TRUE.equals(dto.getIsDefault());
        boolean shouldBeDefault = explicitlyDefault || !repository.existsByInstituteId(instituteId);

        // Clear any existing default BEFORE inserting the new default-marked kit;
        // otherwise the partial unique index throws on INSERT when two rows have
        // is_default=true within the same transaction.
        if (shouldBeDefault) {
            repository.clearAllDefaults(instituteId);
        }

        BrandKit kit = BrandKit.builder()
                .instituteId(instituteId)
                .name(dto.getName())
                .isDefault(shouldBeDefault)
                .backgroundType(normalizeBackgroundType(dto.getBackgroundType()))
                .palette(dto.getPalette() == null ? new HashMap<>() : dto.getPalette())
                .headingFont(dto.getHeadingFont())
                .bodyFont(dto.getBodyFont())
                .layoutTheme(dto.getLayoutTheme())
                .logoFileId(dto.getLogoFileId())
                .intro(dto.getIntro() == null ? new HashMap<>() : dto.getIntro())
                .outro(dto.getOutro() == null ? new HashMap<>() : dto.getOutro())
                .watermark(dto.getWatermark() == null ? new HashMap<>() : dto.getWatermark())
                .systemPrompt(dto.getSystemPrompt())
                .createdBy(userId)
                .build();

        return toDto(repository.save(kit));
    }

    @Transactional
    public BrandKitDTO update(String id, String instituteId, BrandKitDTO dto, String userId) {
        BrandKit kit = loadOrThrow(id, instituteId);

        if (StringUtils.hasText(dto.getName())) kit.setName(dto.getName());
        if (StringUtils.hasText(dto.getBackgroundType()))
            kit.setBackgroundType(normalizeBackgroundType(dto.getBackgroundType()));
        if (dto.getPalette() != null) kit.setPalette(dto.getPalette());
        if (dto.getHeadingFont() != null) kit.setHeadingFont(dto.getHeadingFont());
        if (dto.getBodyFont() != null) kit.setBodyFont(dto.getBodyFont());
        if (dto.getLayoutTheme() != null) kit.setLayoutTheme(dto.getLayoutTheme());
        if (dto.getLogoFileId() != null) kit.setLogoFileId(dto.getLogoFileId());
        if (dto.getIntro() != null) kit.setIntro(dto.getIntro());
        if (dto.getOutro() != null) kit.setOutro(dto.getOutro());
        if (dto.getWatermark() != null) kit.setWatermark(dto.getWatermark());
        // Send "" to clear, omit to leave unchanged (matches the font/layout fields).
        if (dto.getSystemPrompt() != null) kit.setSystemPrompt(dto.getSystemPrompt());

        // Honor is_default toggle when explicitly set (null = leave unchanged).
        // Promotion clears the previous default first to respect the partial unique
        // index. Demotion just clears this kit; the institute is then defaultless
        // and the pipeline falls back to the legacy setting_json path.
        if (dto.getIsDefault() != null) {
            boolean wantDefault = dto.getIsDefault();
            if (wantDefault && !kit.isDefault()) {
                repository.clearOtherDefaults(instituteId, kit.getId());
                kit.setDefault(true);
            } else if (!wantDefault && kit.isDefault()) {
                kit.setDefault(false);
            }
        }

        return toDto(repository.save(kit));
    }

    @Transactional
    public BrandKitDTO setDefault(String id, String instituteId) {
        BrandKit kit = loadOrThrow(id, instituteId);
        if (!kit.isDefault()) {
            repository.clearOtherDefaults(instituteId, kit.getId());
            kit.setDefault(true);
            kit = repository.save(kit);
        }
        return toDto(kit);
    }

    @Transactional
    public void delete(String id, String instituteId) {
        BrandKit kit = loadOrThrow(id, instituteId);
        repository.delete(kit);
    }

    private BrandKit loadOrThrow(String id, String instituteId) {
        return repository.findByIdAndInstituteId(id, instituteId)
                .orElseThrow(() -> new VacademyException(HttpStatus.NOT_FOUND, "Brand kit not found"));
    }

    private static String normalizeBackgroundType(String value) {
        if (value == null) return "white";
        String v = value.trim().toLowerCase();
        if ("black".equals(v) || "dark".equals(v)) return "black";
        return "white";
    }

    private static BrandKitDTO toDto(BrandKit k) {
        return BrandKitDTO.builder()
                .id(k.getId())
                .name(k.getName())
                .isDefault(k.isDefault())
                .backgroundType(k.getBackgroundType())
                .palette(k.getPalette())
                .headingFont(k.getHeadingFont())
                .bodyFont(k.getBodyFont())
                .layoutTheme(k.getLayoutTheme())
                .logoFileId(k.getLogoFileId())
                .intro(k.getIntro())
                .outro(k.getOutro())
                .watermark(k.getWatermark())
                .systemPrompt(k.getSystemPrompt())
                .createdAt(k.getCreatedAt() == null ? null : k.getCreatedAt().getTime())
                .updatedAt(k.getUpdatedAt() == null ? null : k.getUpdatedAt().getTime())
                .build();
    }
}
