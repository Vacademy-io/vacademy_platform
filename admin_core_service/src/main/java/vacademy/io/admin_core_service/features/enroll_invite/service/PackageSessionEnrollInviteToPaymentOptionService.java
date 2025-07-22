package vacademy.io.admin_core_service.features.enroll_invite.service;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import vacademy.io.admin_core_service.features.common.enums.StatusEnum;
import vacademy.io.admin_core_service.features.enroll_invite.dto.EnrollInviteDTO;
import vacademy.io.admin_core_service.features.enroll_invite.dto.PackageSessionToPaymentOptionDTO;
import vacademy.io.admin_core_service.features.enroll_invite.entity.EnrollInvite;
import vacademy.io.admin_core_service.features.enroll_invite.entity.PackageSessionLearnerInvitationToPaymentOption;
import vacademy.io.admin_core_service.features.enroll_invite.repository.PackageSessionLearnerInvitationToPaymentOptionRepository;

import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Service
public class PackageSessionEnrollInviteToPaymentOptionService {

    @Autowired
    private PackageSessionLearnerInvitationToPaymentOptionRepository packageSessionLearnerInvitationToPaymentOptionRepository;

    public PackageSessionLearnerInvitationToPaymentOption create(PackageSessionLearnerInvitationToPaymentOption packageSessionEnrollInviteToPaymentOption) {
        return packageSessionLearnerInvitationToPaymentOptionRepository.save(packageSessionEnrollInviteToPaymentOption);
    }

    public void createPackageSessionLearnerInvitationToPaymentOptions(List<PackageSessionLearnerInvitationToPaymentOption> packageSessionEnrollInviteToPaymentOptions) {
        packageSessionLearnerInvitationToPaymentOptionRepository.saveAll(packageSessionEnrollInviteToPaymentOptions);
    }

    public List<PackageSessionToPaymentOptionDTO>findByInvite(EnrollInvite enrollInvite) {
        List<PackageSessionLearnerInvitationToPaymentOption> packageSessionEnrollInviteToPaymentOptions = packageSessionLearnerInvitationToPaymentOptionRepository.findByEnrollInviteAndStatusIn(enrollInvite,List.of(StatusEnum.ACTIVE.name()));
        return packageSessionEnrollInviteToPaymentOptions.stream().map((packageSessionEnrollInviteToPaymentOption) -> packageSessionEnrollInviteToPaymentOption.mapToPackageSessionToPaymentOptionDTO()).toList();
    }

    public List<EnrollInviteDTO>findByPaymentOptionId(List<String> paymentOptionIds) {
        List<PackageSessionLearnerInvitationToPaymentOption>packageSessionLearnerInvitationToPaymentOptions = packageSessionLearnerInvitationToPaymentOptionRepository.findByCriteria(paymentOptionIds,List.of(StatusEnum.ACTIVE.name()),List.of(StatusEnum.ACTIVE.name()));
        Map<EnrollInvite, List<PackageSessionToPaymentOptionDTO>> groupedByEnrollInvite = packageSessionLearnerInvitationToPaymentOptions.stream()
                .collect(Collectors.groupingBy(
                        PackageSessionLearnerInvitationToPaymentOption::getEnrollInvite, // Group by the EnrollInvite object
                        Collectors.mapping(
                                p -> p.mapToPackageSessionToPaymentOptionDTO(), // Map each element in the group to its DTO
                                Collectors.toList() // Collect the mapped DTOs into a list
                        )
                ));

        // Step 3: Transform the grouped map into the final list of EnrollInviteDTOs.
        return groupedByEnrollInvite.entrySet().stream()
                .map(entry -> {
                    EnrollInvite enrollInviteEntity = entry.getKey();
                    List<PackageSessionToPaymentOptionDTO> paymentOptionDTOs = entry.getValue();

                    // Map the parent entity to its DTO
                    EnrollInviteDTO enrollInviteDTO = enrollInviteEntity.toEnrollInviteDTO();

                    // Set the grouped list of child DTOs
                    enrollInviteDTO.setPackageSessionToPaymentOptions(paymentOptionDTOs);

                    return enrollInviteDTO;
                })
                .collect(Collectors.toList());
    }

    public String deleteByEnrollInviteIds(List<String> enrollInviteIds) {
        List<PackageSessionLearnerInvitationToPaymentOption> packageSessionLearnerInvitationToPaymentOptions = packageSessionLearnerInvitationToPaymentOptionRepository.findByEnrollInvite_IdInAndStatusIn(enrollInviteIds,List.of(StatusEnum.ACTIVE.name()));
        for (PackageSessionLearnerInvitationToPaymentOption packageSessionLearnerInvitationToPaymentOption : packageSessionLearnerInvitationToPaymentOptions) {
            packageSessionLearnerInvitationToPaymentOption.setStatus(StatusEnum.DELETED.name());
        }
        packageSessionLearnerInvitationToPaymentOptionRepository.saveAll(packageSessionLearnerInvitationToPaymentOptions);
        return "Enroll invites deleted successfully";
    }
}
