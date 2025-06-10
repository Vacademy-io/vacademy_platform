package vacademy.io.common.auth.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import vacademy.io.common.auth.entity.OAuth2VendorToUserDetail;

import java.util.Optional;

@Repository
public interface OAuth2VendorToUserDetailRepository extends JpaRepository<OAuth2VendorToUserDetail,String> {
    Optional<OAuth2VendorToUserDetail> findByProviderIdAndSubject(String providerId, String subject);
}
