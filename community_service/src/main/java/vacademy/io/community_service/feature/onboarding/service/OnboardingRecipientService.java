package vacademy.io.community_service.feature.onboarding.service;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import vacademy.io.common.exceptions.VacademyException;
import vacademy.io.community_service.feature.onboarding.dto.RecipientDto;
import vacademy.io.community_service.feature.onboarding.dto.UpsertRecipientRequest;
import vacademy.io.community_service.feature.onboarding.entity.OnboardingNotificationRecipient;
import vacademy.io.community_service.feature.onboarding.repository.OnboardingNotificationRecipientRepository;

import java.util.List;
import java.util.stream.Collectors;

/** Manages the editable list of super-admins emailed on each new submission. */
@Service
public class OnboardingRecipientService {

    @Autowired
    private OnboardingNotificationRecipientRepository repository;

    public List<RecipientDto> listAll() {
        return repository.findAllByOrderByCreatedAtAsc().stream().map(this::toDto).collect(Collectors.toList());
    }

    public List<String> activeEmails() {
        return repository.findByActiveTrue().stream()
                .map(OnboardingNotificationRecipient::getEmail)
                .filter(StringUtils::hasText)
                .collect(Collectors.toList());
    }

    public RecipientDto create(UpsertRecipientRequest req) {
        if (!StringUtils.hasText(req.getEmail())) {
            throw new VacademyException(HttpStatus.BAD_REQUEST, "Email is required");
        }
        OnboardingNotificationRecipient r = OnboardingNotificationRecipient.builder()
                .email(req.getEmail().trim())
                .name(req.getName())
                .active(req.getActive() == null || req.getActive())
                .build();
        return toDto(repository.save(r));
    }

    public RecipientDto update(String id, UpsertRecipientRequest req) {
        OnboardingNotificationRecipient r = repository.findById(id)
                .orElseThrow(() -> new VacademyException(HttpStatus.NOT_FOUND, "Recipient not found"));
        if (req.getEmail() != null && !req.getEmail().isBlank()) r.setEmail(req.getEmail().trim());
        if (req.getName() != null) r.setName(req.getName());
        if (req.getActive() != null) r.setActive(req.getActive());
        return toDto(repository.save(r));
    }

    public void delete(String id) {
        repository.deleteById(id);
    }

    private RecipientDto toDto(OnboardingNotificationRecipient r) {
        return RecipientDto.builder()
                .id(r.getId())
                .email(r.getEmail())
                .name(r.getName())
                .active(r.isActive())
                .createdAt(r.getCreatedAt())
                .build();
    }
}
