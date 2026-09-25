package vacademy.io.admin_core_service.features.engagement;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import vacademy.io.admin_core_service.features.engagement.dto.EngagementItemRequest;
import vacademy.io.admin_core_service.features.engagement.entity.EngagementEnums;
import vacademy.io.admin_core_service.features.engagement.entity.EngagementItem;
import vacademy.io.admin_core_service.features.engagement.service.EngagementItemChangePolicy;
import vacademy.io.common.exceptions.VacademyException;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

class EngagementItemChangePolicyTest {

    private final ObjectMapper om = new ObjectMapper();

    private static final String PAYLOAD =
            "{\"format\":\"MCQ\",\"prompt\":\"<p>2+2?</p>\",\"options\":[{\"id\":\"a\",\"text\":\"3\"},{\"id\":\"b\",\"text\":\"4\"}],\"correctOptionId\":\"b\"}";
    /** Same content, keys reordered — what jsonb hands back. */
    private static final String PAYLOAD_REORDERED =
            "{\"correctOptionId\":\"b\",\"options\":[{\"text\":\"3\",\"id\":\"a\"},{\"text\":\"4\",\"id\":\"b\"}],\"prompt\":\"<p>2+2?</p>\",\"format\":\"MCQ\"}";

    private EngagementItem stored() {
        EngagementItem item = new EngagementItem();
        item.setId("item-1");
        item.setItemType("QUESTION_OF_DAY");
        item.setTitle("Question");
        item.setPayloadJson(PAYLOAD_REORDERED);
        item.setCompletionPoints(10);
        item.setCorrectPoints(20);
        item.setIsRequired(true);
        item.setHideResultUntilReveal(false);
        item.setVersion(1);
        return item;
    }

    private EngagementItemRequest request(String payload) {
        EngagementItemRequest r = new EngagementItemRequest();
        r.setId("item-1");
        r.setItemType("QUESTION_OF_DAY");
        r.setTitle("Question");
        r.setPayloadJson(payload);
        r.setCompletionPoints(10);
        r.setCorrectPoints(20);
        r.setIsRequired(true);
        r.setHideResultUntilReveal(false);
        r.setSortOrder(3);
        return r;
    }

    @Test
    @DisplayName("re-saving an unchanged task (payload keys reordered by jsonb) is not a change")
    void unchangedIsNotAChange() {
        assertFalse(EngagementItemChangePolicy.isLearnerVisibleChange(stored(), request(PAYLOAD), om));
    }

    @Test
    @DisplayName("a title, points or option-text edit is a change")
    void realEditsAreChanges() {
        EngagementItemRequest title = request(PAYLOAD);
        title.setTitle("Better question");
        assertTrue(EngagementItemChangePolicy.isLearnerVisibleChange(stored(), title, om));

        EngagementItemRequest points = request(PAYLOAD);
        points.setCorrectPoints(25);
        assertTrue(EngagementItemChangePolicy.isLearnerVisibleChange(stored(), points, om));

        EngagementItemRequest optionText = request(PAYLOAD.replace("\"text\":\"3\"", "\"text\":\"three\""));
        assertTrue(EngagementItemChangePolicy.isLearnerVisibleChange(stored(), optionText, om));
    }

    @Test
    @DisplayName("after learners answered, fixing option text is allowed")
    void optionTextFixAllowedAfterAnswers() {
        EngagementItemRequest optionText = request(PAYLOAD.replace("\"text\":\"3\"", "\"text\":\"three\""));
        assertDoesNotThrow(() -> EngagementItemChangePolicy.guardAnswerKey(stored(), optionText, 5, om));
    }

    @Test
    @DisplayName("after learners answered, the correct option, the option set, the format and the type are frozen")
    void answerKeyFrozenAfterAnswers() {
        EngagementItemRequest correct = request(PAYLOAD.replace("\"correctOptionId\":\"b\"", "\"correctOptionId\":\"a\""));
        assertThrows(VacademyException.class, () -> EngagementItemChangePolicy.guardAnswerKey(stored(), correct, 1, om));

        EngagementItemRequest newOption = request(PAYLOAD.replace("]", ",{\"id\":\"c\",\"text\":\"5\"}]"));
        assertThrows(VacademyException.class, () -> EngagementItemChangePolicy.guardAnswerKey(stored(), newOption, 1, om));

        EngagementItemRequest format = request(PAYLOAD.replace("\"format\":\"MCQ\"", "\"format\":\"TEXT\""));
        assertThrows(VacademyException.class, () -> EngagementItemChangePolicy.guardAnswerKey(stored(), format, 1, om));

        EngagementItemRequest type = request(PAYLOAD);
        type.setItemType("POLL");
        assertThrows(VacademyException.class, () -> EngagementItemChangePolicy.guardAnswerKey(stored(), type, 1, om));
    }

    @Test
    @DisplayName("before anyone answered, the key may change")
    void keyEditableBeforeAnswers() {
        EngagementItemRequest correct = request(PAYLOAD.replace("\"correctOptionId\":\"b\"", "\"correctOptionId\":\"a\""));
        assertDoesNotThrow(() -> EngagementItemChangePolicy.guardAnswerKey(stored(), correct, 0, om));
    }

    @Test
    @DisplayName("validation: negative points, one-option poll, unmarked MCQ, empty reading, lesson without slide")
    void validation() {
        EngagementItemRequest negative = request(PAYLOAD);
        negative.setCompletionPoints(-5);
        assertThrows(VacademyException.class,
                () -> EngagementItemChangePolicy.validate(EngagementEnums.ItemType.QUESTION_OF_DAY, negative, om));

        EngagementItemRequest poll = request("{\"options\":[{\"id\":\"a\",\"text\":\"yes\"}]}");
        poll.setItemType("POLL");
        assertThrows(VacademyException.class,
                () -> EngagementItemChangePolicy.validate(EngagementEnums.ItemType.POLL, poll, om));

        EngagementItemRequest unmarked = request(PAYLOAD.replace("\"correctOptionId\":\"b\"", "\"correctOptionId\":\"z\""));
        assertThrows(VacademyException.class,
                () -> EngagementItemChangePolicy.validate(EngagementEnums.ItemType.QUESTION_OF_DAY, unmarked, om));

        EngagementItemRequest reading = request(null);
        reading.setItemType("READING_HTML");
        reading.setContentHtml("   ");
        assertThrows(VacademyException.class,
                () -> EngagementItemChangePolicy.validate(EngagementEnums.ItemType.READING_HTML, reading, om));

        EngagementItemRequest lesson = request(null);
        lesson.setItemType("COURSE_SLIDE");
        assertThrows(VacademyException.class,
                () -> EngagementItemChangePolicy.validate(EngagementEnums.ItemType.COURSE_SLIDE, lesson, om));

        EngagementItemRequest written = request("{\"format\":\"TEXT\",\"prompt\":\"<p>Why?</p>\"}");
        assertDoesNotThrow(() -> EngagementItemChangePolicy.validate(EngagementEnums.ItemType.QUESTION_OF_DAY, written, om));
        assertDoesNotThrow(() -> EngagementItemChangePolicy.validate(EngagementEnums.ItemType.QUESTION_OF_DAY, request(PAYLOAD), om));
    }
}
