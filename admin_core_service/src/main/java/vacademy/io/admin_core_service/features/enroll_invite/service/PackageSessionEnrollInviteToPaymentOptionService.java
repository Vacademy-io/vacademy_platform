package vacademy.io.admin_core_service.features.enroll_invite.service;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import vacademy.io.admin_core_service.features.common.enums.StatusEnum;
import vacademy.io.admin_core_service.features.enroll_invite.entity.EnrollInvite;
import vacademy.io.admin_core_service.features.enroll_invite.entity.PackageSessionLearnerInvitationToPaymentOption;
import vacademy.io.admin_core_service.features.enroll_invite.repository.PackageSessionLearnerInvitationToPaymentOptionRepository;
import vacademy.io.common.exceptions.VacademyException;

import java.util.Collections;
import java.util.List;
import java.util.Optional;

@Service
public class PackageSessionEnrollInviteToPaymentOptionService {

    @Autowired
    private PackageSessionLearnerInvitationToPaymentOptionRepository repository;

    /**
     * ADD THIS METHOD BACK
     * Creates and saves a single mapping entity.
     * @param mapping The entity to save.
     * @return The saved entity.
     */
    public PackageSessionLearnerInvitationToPaymentOption create(PackageSessionLearnerInvitationToPaymentOption mapping) {
        if (mapping == null) return null;
        return repository.save(mapping);
    }

    public void createPackageSessionLearnerInvitationToPaymentOptions(List<PackageSessionLearnerInvitationToPaymentOption> mappings) {
        if (mappings == null || mappings.isEmpty()) return;
        repository.saveAll(mappings);
    }

    public List<PackageSessionLearnerInvitationToPaymentOption> findByInvite(EnrollInvite enrollInvite) {
        if (enrollInvite == null) return Collections.emptyList();

        return Optional.ofNullable(repository.findByEnrollInviteAndStatusIn(enrollInvite, List.of(StatusEnum.ACTIVE.name())))
                .orElse(Collections.emptyList());
    }

    public List<PackageSessionLearnerInvitationToPaymentOption> findByPaymentOptionIds(List<String> paymentOptionIds) {
        if (paymentOptionIds == null || paymentOptionIds.isEmpty()) return Collections.emptyList();

        return Optional.ofNullable(repository.findByCriteria(paymentOptionIds, List.of(StatusEnum.ACTIVE.name()), List.of(StatusEnum.ACTIVE.name())))
                .orElse(Collections.emptyList());
    }

    public void deleteByEnrollInviteIds(List<String> enrollInviteIds) {
        if (enrollInviteIds == null || enrollInviteIds.isEmpty()) return;

        List<PackageSessionLearnerInvitationToPaymentOption> mappings =
                Optional.ofNullable(repository.findByEnrollInvite_IdInAndStatusIn(enrollInviteIds, List.of(StatusEnum.ACTIVE.name())))
                        .orElse(Collections.emptyList());

        for (PackageSessionLearnerInvitationToPaymentOption mapping : mappings) {
            if (mapping != null) {
                mapping.setStatus(StatusEnum.DELETED.name());
            }
        }
        repository.saveAll(mappings);
    }

    public void updateStatusByIds(List<String> ids, String status) {
        if (ids == null || ids.isEmpty() || status == null) return;
        repository.updateStatusByIds(ids, status);
    }

    public List<String>findPackageSessionsOfEnrollInvite(EnrollInvite enrollInvite){
        return repository.findPackageSessionIdsByEnrollInviteAndStatusIn(
                enrollInvite,
                List.of(StatusEnum.ACTIVE.name())
        );
    }
    public PackageSessionLearnerInvitationToPaymentOption updateStatus(String id, String status) {
        PackageSessionLearnerInvitationToPaymentOption mapping = repository.findById(id).orElseThrow(()->new VacademyException("PackageSessionLearnerInvitationToPaymentOption not found with id: " + id));
        mapping.setStatus(status);
        return mapping;
    }
}