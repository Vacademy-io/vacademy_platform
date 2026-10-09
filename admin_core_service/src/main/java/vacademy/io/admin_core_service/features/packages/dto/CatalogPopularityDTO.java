package vacademy.io.admin_core_service.features.packages.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.Value;

import java.util.List;

/**
 * Body of {@code GET /admin-core-service/open/packages/v1/popularity?instituteId=}:
 *
 * <pre>{ "institute_id": "...", "ranks": [ { "package_id": "...", "rank": 1 }, ... ] }</pre>
 *
 * <p>Rank 1 is the catalogue course with the most distinct active learners. Ranks are unique and
 * consecutive (ties are broken deterministically, see {@code CatalogPopularityService}), courses
 * with no active learners are absent, and no enrolment count is ever included: the public site can
 * show "Bestseller" or sort by popularity without the institute publishing how many people bought
 * what.
 *
 * <p>Immutable on purpose: one instance is kept in the {@code catalogPopularityRanks} cache and
 * handed to every caller for up to 10 minutes.
 */
@Value
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class CatalogPopularityDTO {

    String instituteId;
    List<PackageRank> ranks;

    public CatalogPopularityDTO(String instituteId, List<PackageRank> ranks) {
        this.instituteId = instituteId;
        this.ranks = ranks == null ? List.of() : List.copyOf(ranks);
    }

    public static CatalogPopularityDTO empty(String instituteId) {
        return new CatalogPopularityDTO(instituteId, List.of());
    }

    /** One ranked course. Deliberately carries no count. */
    @Value
    @JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
    public static class PackageRank {
        String packageId;
        int rank;
    }
}
