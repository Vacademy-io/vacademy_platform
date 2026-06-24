package vacademy.io.auth_service.feature.auth.service;

import jakarta.annotation.PostConstruct;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.security.oauth2.core.DelegatingOAuth2TokenValidator;
import org.springframework.security.oauth2.core.OAuth2Error;
import org.springframework.security.oauth2.core.OAuth2TokenValidator;
import org.springframework.security.oauth2.core.OAuth2TokenValidatorResult;
import org.springframework.security.oauth2.jose.jws.SignatureAlgorithm;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.jwt.JwtException;
import org.springframework.security.oauth2.jwt.JwtValidators;
import org.springframework.security.oauth2.jwt.NimbusJwtDecoder;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import vacademy.io.common.exceptions.VacademyException;

import java.util.Arrays;
import java.util.List;

/**
 * Verifies a native "Sign in with Apple" identity token (OIDC id_token).
 *
 * <p>Apple signs id_tokens with <b>RS256</b> against the public keys published at
 * {@code https://appleid.apple.com/auth/keys}. We verify signature + standard
 * timestamps + issuer, and assert the audience is one of our iOS bundle ids
 * (native {@code aud} == bundle id, unlike the web flow where {@code aud} == the
 * Services ID).
 *
 * <p>The allowed-audience list is fail-closed: if {@code apple.native.audiences}
 * is unset, every token is rejected.
 */
@Service
public class AppleIdentityTokenVerifier {

    private static final Logger log = LoggerFactory.getLogger(AppleIdentityTokenVerifier.class);

    private static final String APPLE_ISSUER = "https://appleid.apple.com";
    private static final String APPLE_JWKS_URI = "https://appleid.apple.com/auth/keys";

    private final List<String> allowedAudiences;
    private final JwtDecoder jwtDecoder;

    public AppleIdentityTokenVerifier(@Value("${apple.native.audiences:}") String audiencesCsv) {
        this.allowedAudiences = Arrays.stream(audiencesCsv.split(","))
                .map(String::trim)
                .filter(StringUtils::hasText)
                .toList();

        NimbusJwtDecoder decoder = NimbusJwtDecoder
                .withJwkSetUri(APPLE_JWKS_URI)
                .jwsAlgorithm(SignatureAlgorithm.RS256)
                .build();

        OAuth2TokenValidator<Jwt> defaultWithIssuer = JwtValidators.createDefaultWithIssuer(APPLE_ISSUER);
        OAuth2TokenValidator<Jwt> audienceValidator = buildAudienceValidator();
        decoder.setJwtValidator(new DelegatingOAuth2TokenValidator<>(defaultWithIssuer, audienceValidator));

        this.jwtDecoder = decoder;
    }

    @PostConstruct
    void warnIfUnconfigured() {
        if (allowedAudiences.isEmpty()) {
            log.warn("apple.native.audiences is empty — every native Apple sign-in will be REJECTED until "
                    + "APPLE_NATIVE_AUDIENCES (comma-separated iOS bundle ids) is configured.");
        } else {
            log.info("Apple native sign-in configured for {} audience(s).", allowedAudiences.size());
        }
    }

    /**
     * Verifies the identity token and returns the parsed JWT, or throws
     * {@link VacademyException} on any validation failure.
     */
    public Jwt verify(String identityToken) {
        if (!StringUtils.hasText(identityToken)) {
            throw new VacademyException(HttpStatus.BAD_REQUEST, "Apple identity token is required");
        }
        try {
            return jwtDecoder.decode(identityToken);
        } catch (JwtException e) {
            log.warn("Apple identity token verification failed: {}", e.getMessage());
            throw new VacademyException(HttpStatus.UNAUTHORIZED, "Invalid Apple identity token");
        }
    }

    private OAuth2TokenValidator<Jwt> buildAudienceValidator() {
        return jwt -> {
            List<String> aud = jwt.getAudience();
            if (aud != null && aud.stream().anyMatch(allowedAudiences::contains)) {
                return OAuth2TokenValidatorResult.success();
            }
            return OAuth2TokenValidatorResult.failure(new OAuth2Error(
                    "invalid_token",
                    "Apple id_token audience " + aud + " is not in the allowed bundle-id list",
                    null));
        };
    }
}
