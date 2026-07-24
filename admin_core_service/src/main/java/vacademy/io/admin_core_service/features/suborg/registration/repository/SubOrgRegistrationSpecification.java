package vacademy.io.admin_core_service.features.suborg.registration.repository;

import jakarta.persistence.criteria.CriteriaBuilder;
import jakarta.persistence.criteria.CriteriaQuery;
import jakarta.persistence.criteria.Path;
import jakarta.persistence.criteria.Predicate;
import jakarta.persistence.criteria.Root;
import jakarta.persistence.criteria.Subquery;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.util.CollectionUtils;
import org.springframework.util.StringUtils;
import vacademy.io.admin_core_service.features.common.entity.CustomFieldValues;
import vacademy.io.admin_core_service.features.common.enums.CustomFieldValueSourceTypeEnum;
import vacademy.io.admin_core_service.features.suborg.registration.entity.SubOrgRegistration;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

/**
 * Dynamic JPA Specification for the admin registrations listing. The template
 * scope is always required; city/state/pincode are optional case-insensitive
 * multi-value "match any of" filters — the admin picks exact values from the
 * distinct-facets multi-select, so a value is matched when it equals (ignoring
 * case) any of the selected options; each entry in {@code customFieldFilters}
 * (custom_field id → selected values) narrows to registrations that submitted
 * one of those values for that field; status is an exact match; search is a
 * case-insensitive "contains" across the org name / admin name / admin email.
 */
public class SubOrgRegistrationSpecification {

    /** Custom-field values are stored under this source type for sub-org registrations. */
    private static final String CFV_SOURCE_TYPE =
            CustomFieldValueSourceTypeEnum.SUB_ORG_REGISTRATION.name();

    private SubOrgRegistrationSpecification() {
    }

    public static Specification<SubOrgRegistration> withFilters(
            String templateInviteId, List<String> cities, List<String> states, List<String> pincodes,
            String legacyCityContains, String legacyStateContains, String legacyPincodeContains,
            String status, String search, Map<String, List<String>> customFieldFilters) {

        return (root, query, cb) -> {
            List<Predicate> predicates = new ArrayList<>();

            // Always scope to the one template link being viewed.
            predicates.add(cb.equal(root.get("templateInviteId"), templateInviteId));

            addInAnyOf(predicates, cb, root.get("city"), cities);
            addInAnyOf(predicates, cb, root.get("state"), states);
            addInAnyOf(predicates, cb, root.get("pincode"), pincodes);

            // Rollout-safety shim: older admin bundles send singular free-text `city`/
            // `state`/`pincode` params with the original case-insensitive "contains"
            // semantics. Honour them so a stale bundle's filter keeps filtering (instead
            // of silently returning everything). Remove once no shipped bundle sends them.
            addContains(predicates, cb, root.get("city"), legacyCityContains);
            addContains(predicates, cb, root.get("state"), legacyStateContains);
            addContains(predicates, cb, root.get("pincode"), legacyPincodeContains);

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

            addCustomFieldFilters(predicates, root, query, cb, customFieldFilters);

            return cb.and(predicates.toArray(new Predicate[0]));
        };
    }

    /** Legacy free-text filter: case-insensitive "contains"; no-op when blank. */
    private static void addContains(
            List<Predicate> predicates,
            CriteriaBuilder cb,
            Path<String> column,
            String value) {
        if (!StringUtils.hasText(value)) {
            return;
        }
        predicates.add(cb.like(cb.lower(column), "%" + value.trim().toLowerCase() + "%"));
    }

    /**
     * Adds a case-insensitive "column matches any of the selected values" predicate.
     * Blank selections are ignored; no-op when the list is empty/null.
     */
    private static void addInAnyOf(
            List<Predicate> predicates,
            CriteriaBuilder cb,
            Path<String> column,
            List<String> values) {
        List<String> normalized = normalize(values);
        if (normalized.isEmpty()) {
            return;
        }
        predicates.add(cb.lower(column).in(normalized));
    }

    /**
     * For each selected custom field, restrict to registrations that submitted one
     * of the chosen values. Each field is its own EXISTS-style subquery over
     * custom_field_values (ANDed across fields, ORed within a field's values), so
     * a registration must satisfy every active field filter.
     */
    private static void addCustomFieldFilters(
            List<Predicate> predicates,
            Root<SubOrgRegistration> root,
            CriteriaQuery<?> query,
            CriteriaBuilder cb,
            Map<String, List<String>> customFieldFilters) {
        if (CollectionUtils.isEmpty(customFieldFilters) || query == null) {
            return;
        }
        for (Map.Entry<String, List<String>> entry : customFieldFilters.entrySet()) {
            String fieldId = entry.getKey();
            if (!StringUtils.hasText(fieldId)) {
                continue;
            }
            List<String> values = normalize(entry.getValue());
            if (values.isEmpty()) {
                continue;
            }
            Subquery<String> sub = query.subquery(String.class);
            Root<CustomFieldValues> cfv = sub.from(CustomFieldValues.class);
            sub.select(cfv.get("sourceId"))
                    .where(cb.and(
                            cb.equal(cfv.get("sourceType"), CFV_SOURCE_TYPE),
                            cb.equal(cfv.get("customFieldId"), fieldId.trim()),
                            cb.lower(cfv.get("value")).in(values)));
            predicates.add(root.get("id").in(sub));
        }
    }

    /** Trim, drop blanks, lowercase and dedupe — for case-insensitive IN matching. */
    private static List<String> normalize(List<String> values) {
        if (CollectionUtils.isEmpty(values)) {
            return List.of();
        }
        return values.stream()
                .filter(StringUtils::hasText)
                .map(v -> v.trim().toLowerCase())
                .distinct()
                .collect(Collectors.toList());
    }
}
