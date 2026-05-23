package vacademy.io.auth_service.feature.vimotion.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import vacademy.io.auth_service.feature.vimotion.entity.InviteRedemption;

import java.util.List;

@Repository
public interface InviteRedemptionRepository extends JpaRepository<InviteRedemption, String> {
    List<InviteRedemption> findByInviteCodeIdOrderByRedeemedAtDesc(String inviteCodeId);
}
