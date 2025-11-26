package vacademy.io.admin_core_service.features.slide.dto;

/**
 * Projection interface for batch read time calculation.
 * Used to efficiently fetch read times for multiple package sessions in a single query.
 */
public interface PackageSessionReadTimeProjection {
    String getPackageSessionId();
    Double getReadTimeInMinutes();
}

