package vacademy.io.admin_core_service.features.suborg.registration.repository;

import jakarta.persistence.criteria.Predicate;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.util.StringUtils;
import vacademy.io.admin_core_service.features.suborg.registration.entity.SubOrgRegistration;

import java.util.ArrayList;
import java.util.List;

/**
 * Dynamic JPA Specification for the admin registrations listing. The template
 * scope is always required; city/state/pincode are optional case-insensitive
 * "contains" filters (address values are free-text as the registrant typed them);
 * status is an exact match; search is a case-insensitive "contains" across the
 * org name / admin name / admin email.
 */
public class SubOrgRegistrationSpecification {

    private SubOrgRegistrationSpecification() {
    }

    public static Specification<SubOrgRegistration> withFilters(
            String templateInviteId, String city, String state, String pincode,
            String status, String search) {

        return (root, query, cb) -> {
            List<Predicate> predicates = new ArrayList<>();

            // Always scope to the one template link being viewed.
            predicates.add(cb.equal(root.get("templateInviteId"), templateInviteId));

            if (StringUtils.hasText(city)) {
                predicates.add(cb.like(cb.lower(root.get("city")),
                        "%" + city.trim().toLowerCase() + "%"));
            }
            if (StringUtils.hasText(state)) {
                predicates.add(cb.like(cb.lower(root.get("state")),
                        "%" + state.trim().toLowerCase() + "%"));
            }
            if (StringUtils.hasText(pincode)) {
                predicates.add(cb.like(cb.lower(root.get("pincode")),
                        "%" + pincode.trim().toLowerCase() + "%"));
            }
            if (StringUtils.hasText(status)) {
                predicates.add(cb.equal(root.get("status"), status.trim()));
            }
            if (StringUtils.hasText(search)) {
                String like = "%" + search.trim().toLowerCase() + "%";
                predicates.add(cb.or(
                        cb.like(cb.lower(root.get("orgName")), like),
                        cb.like(cb.lower(root.get("adminName")), like),
                        cb.like(cb.lower(root.get("adminEmail")), like)));
            }

            return cb.and(predicates.toArray(new Predicate[0]));
        };
    }
}
