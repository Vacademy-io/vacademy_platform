package vacademy.io.admin_core_service.features.points_ledger.job;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.time.LocalDate;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.assertEquals;

/**
 * Streak length decides the size of a points award, so an off-by-one here is real
 * money to a learner. Pure set maths — no Spring, no DB.
 */
class PointsAccrualJobTest {

    private final PointsAccrualJob job = new PointsAccrualJob(null, null, null, null, null);

    private static final LocalDate D1 = LocalDate.of(2026, 9, 10);
    private static final LocalDate D2 = LocalDate.of(2026, 9, 11);
    private static final LocalDate D3 = LocalDate.of(2026, 9, 12);
    private static final LocalDate D4 = LocalDate.of(2026, 9, 13);

    @Test
    @DisplayName("a single active day is a streak of one")
    void singleDay() {
        assertEquals(1, job.streakLengthEndingOn(Set.of(D4), D4));
    }

    @Test
    @DisplayName("consecutive days accumulate")
    void consecutive() {
        assertEquals(4, job.streakLengthEndingOn(Set.of(D1, D2, D3, D4), D4));
    }

    @Test
    @DisplayName("a gap breaks the streak — only the run ending on the day counts")
    void gapBreaksIt() {
        // D1 active, D2 missed, D3 and D4 active -> streak ending D4 is 2, not 3.
        assertEquals(2, job.streakLengthEndingOn(Set.of(D1, D3, D4), D4));
    }

    @Test
    @DisplayName("a day with no activity has no streak")
    void inactiveDay() {
        assertEquals(0, job.streakLengthEndingOn(Set.of(D1, D2), D4));
    }

    @Test
    @DisplayName("the streak is measured to the day asked about, not to the latest day")
    void measuredToTheGivenDay() {
        // Asking about D2 must ignore D3/D4 entirely.
        assertEquals(2, job.streakLengthEndingOn(Set.of(D1, D2, D3, D4), D2));
    }

    @Test
    @DisplayName("an empty history yields zero rather than throwing")
    void emptyHistory() {
        assertEquals(0, job.streakLengthEndingOn(Set.of(), D4));
    }
}
