package vacademy.io.admin_core_service.features.learner_tracking.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Table(name = "concentration_score")
@Getter
@Setter
@NoArgsConstructor
public class ConcentrationScore {

    @Id
    private String id;

    @Column(name = "concentration_score", nullable = false)
    private Double concentrationScore;

    @Column(name = "tab_switch_count", nullable = false)
    private int tabSwitchCount;

    @Column(name = "pause_count", nullable = false)
    private int pauseCount;

    @Column(name = "answer_times_in_sec", columnDefinition = "integer[]")
    private Integer[] answerTimesInSec;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "activity_id", nullable = false)
    private ActivityLog activityLog;

    public ConcentrationScore(String id, Double concentrationScore, int tabSwitchCount, int pauseCount, Integer[] answerTimesInSec, ActivityLog activityLog) {
        this.concentrationScore = concentrationScore;
        this.tabSwitchCount = tabSwitchCount;
        this.pauseCount = pauseCount;
        this.answerTimesInSec = answerTimesInSec;
        this.activityLog = activityLog;
        this.id = id;
    }
}
