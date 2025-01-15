package vacademy.io.common.core.utils;

import java.security.SecureRandom;

public class RandomGenerator {

    private static final String ALPHANUMERIC = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    private static final SecureRandom random = new SecureRandom();

    private static final String NUMERIC = "0123456789";


    public static String generatePassword(int length) {
        StringBuilder password = new StringBuilder(length);
        for (int i = 0; i < length; i++) {
            int index = random.nextInt(ALPHANUMERIC.length());
            password.append(ALPHANUMERIC.charAt(index));
        }
        return password.toString();
    }

    public static String generateNumber(int length) {
        StringBuilder password = new StringBuilder(length);
        for (int i = 0; i < length; i++) {
            int index = random.nextInt(NUMERIC.length());
            password.append(NUMERIC.charAt(index));
        }
        return password.toString();
    }
}
