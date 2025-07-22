package vacademy.io.admin_core_service.features.user_subscription.service;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import vacademy.io.admin_core_service.features.common.enums.StatusEnum;
import vacademy.io.admin_core_service.features.user_subscription.dto.ReferralOptionDTO;
import vacademy.io.admin_core_service.features.user_subscription.entity.ReferralOption;
import vacademy.io.admin_core_service.features.user_subscription.repository.ReferralOptionRepository;

import java.util.List;
import java.util.Optional;

@Service
public class ReferralOptionService {
    @Autowired
    private ReferralOptionRepository referralOptionRepository;

    public String addReferralOption(ReferralOptionDTO referralOptionDTO) {
        ReferralOption referralOption = new ReferralOption(referralOptionDTO);
        referralOptionRepository.save(referralOption);
        return "Referral option added successfully";
    }
    public String deleteReferralOptions(List<String> referralOptionIds) {
        List<ReferralOption>referralOptions = referralOptionRepository.findAllById(referralOptionIds);
        for (ReferralOption referralOption : referralOptions) {
            referralOption.setStatus(StatusEnum.DELETED.name());
        }
        referralOptionRepository.saveAll(referralOptions);
        return "Referral options deleted successfully";
    }

    public List<ReferralOptionDTO> getReferralOptions(String source, String sourceId) {
        List<ReferralOption>referralOptions = referralOptionRepository.findBySourceAndSourceIdAndStatusIn(source,sourceId,List.of(StatusEnum.ACTIVE.name()));
        return referralOptions.stream().map(ReferralOption::toReferralOptionDTO).toList();
    }

    public Optional<ReferralOption> getReferralOption(String id) {
        return referralOptionRepository.findById(id);
    }

    public Optional<ReferralOption> getReferralOptionBySourceAndSourceIdAndTag(String source, String sourceId, String tag) {
        return referralOptionRepository.findFirstBySourceAndSourceIdAndTagAndStatusInOrderByCreatedAtDesc(source, sourceId, tag,List.of(StatusEnum.ACTIVE.name()));
    }
}
