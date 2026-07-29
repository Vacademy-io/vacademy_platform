package vacademy.io.auth_service.config;

import com.fasterxml.jackson.annotation.JsonTypeInfo;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializationFeature;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.data.redis.serializer.GenericJackson2JsonRedisSerializer;
import org.springframework.security.jackson2.CoreJackson2Module;
import vacademy.io.common.auth.entity.User;

import java.util.ArrayList;
import java.util.List;
import java.util.stream.Collectors;
import java.util.stream.Stream;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertInstanceOf;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * Pins the fix for the prod incident where {@code GET /auth-service/v1/users/by-role} intermittently
 * returned HTTP 400 and doubts were consequently created with zero recipients (no email/push/bell).
 *
 * <p>The cached value could be written but never read back, for TWO independent reasons:</p>
 * <ol>
 *   <li><b>Final root type.</b> The serializer uses
 *       {@code activateDefaultTyping(..., NON_FINAL, ...)}, which writes a type id only for non-final
 *       runtime types. {@code Stream.toList()} returns the FINAL
 *       {@code java.util.ImmutableCollections$ListN}, so the root array carried no type id while the
 *       read side (into {@code Object}) demanded one.</li>
 *   <li><b>Derived getter.</b> {@code User.getUserTopLevelDto()} is computed and has no setter, so
 *       Jackson wrote a {@code userTopLevelDto} property it could not read back.</li>
 * </ol>
 *
 * <p>Because the cache TTL is 5 minutes, the first caller after each expiry repopulated the entry and
 * got a correct answer while everyone in the following 5 minutes got the failure — which is why it
 * looked random.</p>
 *
 * <p>These tests exercise {@link CacheConfig#cacheObjectMapper()} — the real production mapper — so
 * they fail if that configuration regresses.</p>
 */
class UsersByRoleCacheSerializationTest {

    private static GenericJackson2JsonRedisSerializer productionSerializer() {
        return new GenericJackson2JsonRedisSerializer(CacheConfig.cacheObjectMapper());
    }

    /** The pre-fix mapper: strict on unknown properties, otherwise identical. */
    private static GenericJackson2JsonRedisSerializer legacyStrictSerializer() {
        ObjectMapper m = new ObjectMapper();
        m.registerModule(new CoreJackson2Module());
        m.registerModule(new JavaTimeModule());
        m.disable(SerializationFeature.WRITE_DATES_AS_TIMESTAMPS);
        m.activateDefaultTyping(m.getPolymorphicTypeValidator(),
                ObjectMapper.DefaultTyping.NON_FINAL, JsonTypeInfo.As.PROPERTY);
        return new GenericJackson2JsonRedisSerializer(m);
    }

    private static User sampleUser() {
        User u = new User();
        u.setId("df9fc79e-94ea-4a85-8a17-c9699a23dff4");
        u.setUsername("Zainab");
        u.setEmail("zainab@edustream.ae");
        u.setFullName("Zainab");
        u.setMobileNumber("971503826863");
        return u;
    }

    private static List<User> cacheableList() {
        return Stream.of(sampleUser()).collect(Collectors.toCollection(ArrayList::new));
    }

    @Test
    @DisplayName("regression 1: a Stream.toList() root is final, so it serializes without a type id and cannot be read back")
    void immutableListRootIsUnreadable() {
        List<User> immutable = Stream.of(sampleUser()).map(u -> u).toList();
        assertEquals("java.util.ImmutableCollections$ListN", immutable.getClass().getName(),
                "precondition: Stream.toList() returns the final ImmutableCollections$ListN");

        GenericJackson2JsonRedisSerializer serializer = productionSerializer();
        byte[] written = serializer.serialize(immutable);
        assertNotNull(written);

        String json = new String(written);
        assertTrue(json.startsWith("[{"),
                "final root ⇒ no type id is written; got: " + json.substring(0, Math.min(80, json.length())));

        assertThrows(Exception.class, () -> serializer.deserialize(written),
                "this is the exact failure prod hit on every cache HIT");
    }

    @Test
    @DisplayName("regression 2: User.getUserTopLevelDto() is a derived getter with no setter — strict mapping cannot read it back")
    void derivedGetterBreaksStrictMapping() {
        GenericJackson2JsonRedisSerializer strict = legacyStrictSerializer();
        byte[] written = strict.serialize(cacheableList());

        assertTrue(new String(written).contains("userTopLevelDto"),
                "precondition: the derived getter is serialized");
        assertThrows(Exception.class, () -> strict.deserialize(written),
                "strict mapping rejects the unreadable derived property");
    }

    @Test
    @DisplayName("fixed: the production mapper round-trips the list the service now caches")
    void productionConfigRoundTrips() {
        GenericJackson2JsonRedisSerializer serializer = productionSerializer();

        byte[] written = serializer.serialize(cacheableList());
        assertNotNull(written);

        Object back = assertDoesNotThrow(() -> serializer.deserialize(written),
                "the value the cache now stores must be readable back");
        assertInstanceOf(List.class, back);

        List<?> list = (List<?>) back;
        assertEquals(1, list.size());
        assertInstanceOf(User.class, list.get(0));

        User user = (User) list.get(0);
        assertEquals("df9fc79e-94ea-4a85-8a17-c9699a23dff4", user.getId());
        assertEquals("zainab@edustream.ae", user.getEmail());
        assertEquals("Zainab", user.getFullName());
    }
}
