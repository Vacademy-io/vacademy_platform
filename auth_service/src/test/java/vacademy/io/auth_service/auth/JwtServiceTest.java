package vacademy.io.auth_service.auth;

import io.jsonwebtoken.ExpiredJwtException;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.MalformedJwtException;
import io.jsonwebtoken.SignatureAlgorithm;
import io.jsonwebtoken.io.Decoders;
import io.jsonwebtoken.security.Keys;
import io.jsonwebtoken.security.SignatureException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.userdetails.UserDetails;
import vacademy.io.common.auth.entity.User;
import vacademy.io.common.auth.entity.UserRole;
import vacademy.io.common.auth.service.JwtService;

import java.security.Key;
import java.util.*;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Unit tests for JWT token generation, validation, and edge cases.
 */
class JwtServiceTest {

    private JwtService jwtService;
    private User testUser;

    @BeforeEach
    void setUp() {
        jwtService = new JwtService();

        testUser = new User();
        testUser.setId("test-user-id");
        testUser.setUsername("testuser@example.com");
        testUser.setEmail("testuser@example.com");
        testUser.setFullName("Test User");
        testUser.setRootUser(false);
    }

    @Nested
    @DisplayName("Token Generation")
    class TokenGeneration {

        @Test
        @DisplayName("should generate a valid JWT token")
        void shouldGenerateValidToken() {
            String token = jwtService.generateToken(testUser, Collections.emptyList(), Collections.emptyList());

            assertNotNull(token);
            assertFalse(token.isEmpty());
            // JWT has 3 parts separated by dots
            assertEquals(3, token.split("\\.").length);
        }

        @Test
        @DisplayName("should generate a refresh token")
        void shouldGenerateRefreshToken() {
            Map<String, Object> claims = new HashMap<>();
            claims.put("type", "refresh");
            String token = jwtService.generateRefreshToken(claims, testUser);

            assertNotNull(token);
            assertFalse(token.isEmpty());
        }

        @Test
        @DisplayName("should generate token with custom expiry in days")
        void shouldGenerateTokenWithCustomExpiry() {
            String token = jwtService.generateToken(testUser, Collections.emptyList(), Collections.emptyList(), 7);

            assertNotNull(token);
            assertFalse(jwtService.isTokenExpired(token));
        }
    }

    @Nested
    @DisplayName("Token Extraction")
    class TokenExtraction {

        @Test
        @DisplayName("should extract username from token")
        void shouldExtractUsername() {
            String token = jwtService.generateToken(testUser, Collections.emptyList(), Collections.emptyList());

            String extractedUsername = jwtService.extractUsername(token);

            assertEquals("testuser@example.com", extractedUsername);
        }
    }

    @Nested
    @DisplayName("Token Validation")
    class TokenValidation {

        @Test
        @DisplayName("should validate token for correct user")
        void shouldValidateTokenForCorrectUser() {
            String token = jwtService.generateToken(testUser, Collections.emptyList(), Collections.emptyList());

            UserDetails userDetails = createUserDetails("testuser@example.com");

            assertTrue(jwtService.isTokenValid(token, userDetails));
        }

        @Test
        @DisplayName("should reject token for wrong user")
        void shouldRejectTokenForWrongUser() {
            String token = jwtService.generateToken(testUser, Collections.emptyList(), Collections.emptyList());

            UserDetails wrongUser = createUserDetails("wronguser@example.com");

            assertFalse(jwtService.isTokenValid(token, wrongUser));
        }

        @Test
        @DisplayName("should detect non-expired token")
        void shouldDetectNonExpiredToken() {
            String token = jwtService.generateToken(testUser, Collections.emptyList(), Collections.emptyList());

            assertFalse(jwtService.isTokenExpired(token));
        }
    }

    @Nested
    @DisplayName("Edge Cases")
    class EdgeCases {

        @Test
        @DisplayName("should throw on malformed token")
        void shouldThrowOnMalformedToken() {
            assertThrows(MalformedJwtException.class, () -> {
                jwtService.extractUsername("not.a.valid.jwt.token");
            });
        }

        @Test
        @DisplayName("should throw on token signed with different key")
        void shouldThrowOnInvalidSignature() {
            // Generate a token with a different secret key
            Key wrongKey = Keys.hmacShaKeyFor(
                    Decoders.BASE64.decode("AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA")
            );
            String tamperedToken = Jwts.builder()
                    .setSubject("testuser@example.com")
                    .setIssuedAt(new Date())
                    .setExpiration(new Date(System.currentTimeMillis() + 3600000))
                    .signWith(wrongKey, SignatureAlgorithm.HS256)
                    .compact();

            assertThrows(SignatureException.class, () -> {
                jwtService.extractUsername(tamperedToken);
            });
        }

        @Test
        @DisplayName("should throw on expired token")
        void shouldThrowOnExpiredToken() {
            // Generate a token that's already expired
            Key key = Keys.hmacShaKeyFor(Decoders.BASE64.decode(JwtService.secretKey));
            String expiredToken = Jwts.builder()
                    .setSubject("testuser@example.com")
                    .setIssuedAt(new Date(System.currentTimeMillis() - 7200000)) // 2 hours ago
                    .setExpiration(new Date(System.currentTimeMillis() - 3600000)) // 1 hour ago
                    .signWith(key, SignatureAlgorithm.HS256)
                    .compact();

            assertThrows(ExpiredJwtException.class, () -> {
                jwtService.extractUsername(expiredToken);
            });
        }

        @Test
        @DisplayName("should return positive expiration time")
        void shouldReturnPositiveExpirationTime() {
            long expirationTime = jwtService.getExpirationTime();
            assertTrue(expirationTime > 0);
        }
    }

    /**
     * Helper to create a simple UserDetails for validation testing.
     */
    private UserDetails createUserDetails(String username) {
        return new UserDetails() {
            @Override
            public Collection<? extends GrantedAuthority> getAuthorities() {
                return Collections.emptyList();
            }

            @Override
            public String getPassword() {
                return "password";
            }

            @Override
            public String getUsername() {
                return username;
            }

            @Override
            public boolean isAccountNonExpired() {
                return true;
            }

            @Override
            public boolean isAccountNonLocked() {
                return true;
            }

            @Override
            public boolean isCredentialsNonExpired() {
                return true;
            }

            @Override
            public boolean isEnabled() {
                return true;
            }
        };
    }
}
