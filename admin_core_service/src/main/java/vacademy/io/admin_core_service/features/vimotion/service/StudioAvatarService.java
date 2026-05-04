package vacademy.io.admin_core_service.features.vimotion.service;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;
import vacademy.io.admin_core_service.features.vimotion.dto.StudioAvatarDTO;
import vacademy.io.admin_core_service.features.vimotion.entity.StudioAvatar;
import vacademy.io.admin_core_service.features.vimotion.repository.StudioAvatarRepository;
import vacademy.io.common.exceptions.VacademyException;

import java.util.List;
import java.util.stream.Collectors;

@Service
public class StudioAvatarService {

    @Autowired
    private StudioAvatarRepository repository;

    public List<StudioAvatarDTO> list(String instituteId) {
        return repository.findByInstituteIdOrderByCreatedAtDesc(instituteId).stream()
                .map(StudioAvatarService::toDto)
                .collect(Collectors.toList());
    }

    public StudioAvatarDTO get(String id, String instituteId) {
        return toDto(loadOrThrow(id, instituteId));
    }

    @Transactional
    public StudioAvatarDTO create(String instituteId, StudioAvatarDTO dto, String userId) {
        if (dto == null) throw new VacademyException("Invalid request");
        if (!StringUtils.hasText(dto.getName())) throw new VacademyException("Avatar name is required");
        if (!StringUtils.hasText(dto.getFaceImageUrl())) throw new VacademyException("Face image is required");

        StudioAvatar avatar = StudioAvatar.builder()
                .instituteId(instituteId)
                .name(dto.getName())
                .faceImageUrl(dto.getFaceImageUrl())
                .description(dto.getDescription())
                .voiceId(dto.getVoiceId())
                .voiceProvider(dto.getVoiceProvider())
                .voiceLanguage(dto.getVoiceLanguage())
                .voiceGender(dto.getVoiceGender())
                .createdBy(userId)
                .build();

        return toDto(repository.save(avatar));
    }

    @Transactional
    public StudioAvatarDTO update(String id, String instituteId, StudioAvatarDTO dto, String userId) {
        StudioAvatar avatar = loadOrThrow(id, instituteId);

        if (StringUtils.hasText(dto.getName())) avatar.setName(dto.getName());
        if (StringUtils.hasText(dto.getFaceImageUrl())) avatar.setFaceImageUrl(dto.getFaceImageUrl());
        if (dto.getDescription() != null) avatar.setDescription(dto.getDescription());
        if (dto.getVoiceId() != null) avatar.setVoiceId(dto.getVoiceId());
        if (dto.getVoiceProvider() != null) avatar.setVoiceProvider(dto.getVoiceProvider());
        if (dto.getVoiceLanguage() != null) avatar.setVoiceLanguage(dto.getVoiceLanguage());
        if (dto.getVoiceGender() != null) avatar.setVoiceGender(dto.getVoiceGender());

        return toDto(repository.save(avatar));
    }

    @Transactional
    public void delete(String id, String instituteId) {
        StudioAvatar avatar = loadOrThrow(id, instituteId);
        repository.delete(avatar);
    }

    private StudioAvatar loadOrThrow(String id, String instituteId) {
        return repository.findByIdAndInstituteId(id, instituteId)
                .orElseThrow(() -> new VacademyException(HttpStatus.NOT_FOUND, "Avatar not found"));
    }

    private static StudioAvatarDTO toDto(StudioAvatar a) {
        return StudioAvatarDTO.builder()
                .id(a.getId())
                .name(a.getName())
                .faceImageUrl(a.getFaceImageUrl())
                .description(a.getDescription())
                .voiceId(a.getVoiceId())
                .voiceProvider(a.getVoiceProvider())
                .voiceLanguage(a.getVoiceLanguage())
                .voiceGender(a.getVoiceGender())
                .createdAt(a.getCreatedAt() == null ? null : a.getCreatedAt().getTime())
                .updatedAt(a.getUpdatedAt() == null ? null : a.getUpdatedAt().getTime())
                .build();
    }
}
