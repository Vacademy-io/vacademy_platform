package vacademy.io.auth_service.feature.user.util;

import java.security.SecureRandom;
import java.util.stream.Collectors;
import java.util.stream.IntStream;

public class RandomCredentialGenerator {

    private static final String CHARACTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    private static final SecureRandom RANDOM = new SecureRandom();

    public static String generateRandomPassword() {
        return generateRandomString(6);
    }

    public static String generateRandomUsername() {
        return generateRandomString(6);
    }

    private static String generateRandomString(int length) {
        return IntStream.range(0, length)
                .mapToObj(i -> String.valueOf(CHARACTERS.charAt(RANDOM.nextInt(CHARACTERS.length()))))
                .collect(Collectors.joining());
    }
}
