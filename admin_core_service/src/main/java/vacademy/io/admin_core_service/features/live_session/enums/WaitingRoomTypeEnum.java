package vacademy.io.admin_core_service.features.live_session.enums;

public enum WaitingRoomTypeEnum {
    // Existing behaviour: learner enters the waiting-room screen during the
    // waiting-room window.
    WAITING_ROOM,
    // Learner joins the live class directly during the waiting-room window
    // (pre-join), skipping the waiting-room screen.
    PRE_JOINING,
}
