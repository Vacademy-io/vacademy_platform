package vacademy.io.admin_core_service.features.slide.dto;

/**
 * One row of {@code SlideRepository.calculateTotalReadTimeInMinutesBatch}: the
 * package-session triple that identifies a level, plus its total slide read time.
 *
 * <p>The single-key {@code calculateTotalReadTimeInMinutes} returns a bare scalar
 * because the triple is already known by the caller. The batch form has to carry
 * the triple back so callers can regroup the rows.
 */
public interface LevelReadTimeProjection {

    String getPackageId();

    String getSessionId();

    String getLevelId();

    Double getReadTimeInMinutes();
}
