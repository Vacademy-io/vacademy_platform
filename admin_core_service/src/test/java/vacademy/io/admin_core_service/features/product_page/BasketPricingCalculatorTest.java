package vacademy.io.admin_core_service.features.product_page;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import vacademy.io.admin_core_service.features.product_page.service.BasketPricingCalculator;

import java.util.ArrayList;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;

/**
 * The authoritative half of the pricing contract. basket-pricing.ts mirrors it
 * for display, and basket-pricing.test.ts asserts the SAME cases — if these two
 * files ever disagree, a parent is shown one price and charged another.
 */
class BasketPricingCalculatorTest {

    private final BasketPricingCalculator calculator = new BasketPricingCalculator();

    private static final double PRICE = 349; // one subject, on its enroll invite

    private static final String GROUPS = "\"groups\":[{\"label\":\"Class 5\",\"levels\":[\"Class 5\"]}]";

    /** The iThinkers B2C price card, as absolute prices per count. */
    private static final String FLAT = "{\"basketPricing\":{\"enabled\":true,"
            + "\"ladder\":{\"prices\":[349,599,799],\"perExtra\":150}," + GROUPS + "}}";

    /** The same card, as discounts off what the courses cost on their invites. */
    private static final String DISCOUNT = "{\"basketPricing\":{\"enabled\":true,"
            + "\"pricingBasis\":\"DISCOUNT\",\"ladder\":{\"prices\":[],\"perExtra\":0},"
            + "\"tiers\":[{\"minCourses\":2,\"type\":\"AMOUNT\",\"value\":99},"
            + "{\"minCourses\":3,\"type\":\"AMOUNT\",\"value\":248},"
            + "{\"minCourses\":4,\"type\":\"AMOUNT\",\"value\":447},"
            + "{\"minCourses\":5,\"type\":\"AMOUNT\",\"value\":646}]," + GROUPS + "}}";

    private static List<BasketPricingCalculator.BasketItem> items(int n, double price) {
        List<BasketPricingCalculator.BasketItem> out = new ArrayList<>();
        for (int i = 0; i < n; i++) {
            out.add(new BasketPricingCalculator.BasketItem("Class 5", "Subject " + i, price));
        }
        return out;
    }

    private static List<BasketPricingCalculator.BasketItem> items(int n) {
        return items(n, PRICE);
    }

    @Nested
    @DisplayName("the published price card")
    class PriceCard {

        @ParameterizedTest(name = "{0} subject(s) cost {1} on a FLAT page")
        @CsvSource({ "1,349", "2,599", "3,799", "4,949", "5,1099" })
        void flatChargesTheCardPrice(int count, double expected) {
            assertEquals(expected, calculator.price(FLAT, items(count)).getTotal());
        }

        @ParameterizedTest(name = "{0} subject(s) cost {1} on a DISCOUNT page")
        @CsvSource({ "1,349", "2,599", "3,799", "4,949", "5,1099" })
        void discountChargesTheSame(int count, double expected) {
            assertEquals(expected, calculator.price(DISCOUNT, items(count)).getTotal());
        }

        @Test
        @DisplayName("reports what the courses cost apart, so the saving can be shown")
        void reportsTheBase() {
            BasketPricingCalculator.BasketPrice priced = calculator.price(DISCOUNT, items(3));
            assertEquals(1047, priced.getItemTotal());
            assertEquals(799, priced.getTotal());
        }
    }

    @Nested
    @DisplayName("percentage tiers")
    class Percentages {

        private static final String PCT = "{\"basketPricing\":{\"enabled\":true,"
                + "\"pricingBasis\":\"DISCOUNT\",\"ladder\":{\"prices\":[],\"perExtra\":0},"
                + "\"tiers\":[{\"minCourses\":2,\"type\":\"PERCENT\",\"value\":15},"
                + "{\"minCourses\":4,\"type\":\"PERCENT\",\"value\":25}]," + GROUPS + "}}";

        @Test
        @DisplayName("keep scaling past the last rung, which a flat ladder cannot")
        void scaleWithoutARungPerCount() {
            assertEquals(593, calculator.price(PCT, items(2)).getTotal());
            assertEquals(1571, calculator.price(PCT, items(6)).getTotal());
        }

        @Test
        @DisplayName("follow the courses when the invite reprices them")
        void followTheInvite() {
            assertEquals(850, calculator.price(PCT, items(2, 500)).getTotal());
        }
    }

    @Nested
    @DisplayName("guardrails")
    class Guardrails {

        @Test
        @DisplayName("an unconfigured page keeps summing item prices")
        void unconfiguredReturnsNull() {
            assertNull(calculator.price("{\"basketPricing\":{\"enabled\":false}}", items(3)));
            assertNull(calculator.price(null, items(3)));
        }

        @Test
        @DisplayName("a free course stays free under DISCOUNT")
        void freeStaysFree() {
            assertEquals(0, calculator.price(DISCOUNT, items(1, 0)).getTotal());
        }

        @Test
        @DisplayName("FLAT pages with free courses are exactly as they were")
        void flatIsUntouched() {
            assertEquals(599, calculator.price(FLAT, items(2, 0)).getTotal());
            assertEquals(1099, calculator.price(FLAT, items(5, 0)).getTotal());
        }

        @Test
        @DisplayName("a DISCOUNT tier cannot charge more than the courses cost apart")
        void neverAboveTheBase() {
            String bad = "{\"basketPricing\":{\"enabled\":true,\"pricingBasis\":\"DISCOUNT\","
                    + "\"ladder\":{\"prices\":[],\"perExtra\":0},"
                    + "\"tiers\":[{\"minCourses\":1,\"type\":\"AMOUNT\",\"value\":-500}]," + GROUPS + "}}";
            assertEquals(349, calculator.price(bad, items(1)).getTotal());
        }

        @Test
        @DisplayName("a discount is never taken away for adding another subject")
        void tiersNeverRegress() {
            // Under a highest-threshold rule this would punish the fifth subject.
            String backwards = "{\"basketPricing\":{\"enabled\":true,\"pricingBasis\":\"DISCOUNT\","
                    + "\"ladder\":{\"prices\":[],\"perExtra\":0},"
                    + "\"tiers\":[{\"minCourses\":2,\"type\":\"AMOUNT\",\"value\":500},"
                    + "{\"minCourses\":5,\"type\":\"AMOUNT\",\"value\":100}]," + GROUPS + "}}";
            assertEquals(698 - 500, calculator.price(backwards, items(2)).getTotal());
            assertEquals(1745 - 500, calculator.price(backwards, items(5)).getTotal());
        }

        @Test
        @DisplayName("a full pack still wins when it is cheaper")
        void packStillWins() {
            String withPack = DISCOUNT.replace(GROUPS,
                    "\"groups\":[{\"label\":\"Class 5\",\"levels\":[\"Class 5\"],\"packPrice\":499}]");
            assertEquals(499, calculator.price(withPack, items(3)).getTotal());
        }
    }
}
