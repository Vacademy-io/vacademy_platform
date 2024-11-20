package vacademy.io.common.auth.service;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.SignatureAlgorithm;
import io.jsonwebtoken.io.Decoders;
import io.jsonwebtoken.security.Keys;
import vacademy.io.common.auth.constants.AuthConstant;
import vacademy.io.common.auth.dto.OrgDTO;
import vacademy.io.common.auth.dto.SubmoduleDTO;
import vacademy.io.common.auth.entity.User;

import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.stereotype.Component;

import java.security.Key;
import java.util.*;
import java.util.function.Function;

@Component
public class JwtService {


    //todo: remove secret from here
    public static final String secretKey = "357638792F423F4428472B4B6250655368566D597133743677397A2443264629";


    public String extractUsername(String token) {
        return extractClaim(token, Claims::getSubject);
    }

    public <T> T extractClaim(String token, Function<Claims, T> claimsResolver) {
        final Claims claims = extractAllClaims(token);
        return claimsResolver.apply(claims);
    }


    public String generateRefreshToken(Map<String, Object> extraClaims, User userDetails) {
        return Jwts
                .builder()
                .setClaims(extraClaims)
                .setSubject(userDetails.getUsername())
                .setIssuedAt(new Date(System.currentTimeMillis()))
                .setExpiration(new Date(System.currentTimeMillis() + (AuthConstant.refreshTokenExpiryInSecs * 1000)))
                .signWith(getSignInKey(), SignatureAlgorithm.HS256)
                .compact();
    }

    public long getExpirationTime() {
        return AuthConstant.jwtTokenExpiryInMillis;
    }

    private String buildToken(
            Map<String, Object> extraClaims,
            User userDetails,
            long expiration
    ) {
        return Jwts
                .builder()
                .setClaims(extraClaims)
                .setSubject(userDetails.getUsername())
                .setIssuedAt(new Date(System.currentTimeMillis()))
                .setExpiration(new Date(System.currentTimeMillis() + expiration))
                .signWith(getSignInKey(), SignatureAlgorithm.HS256)
                .compact();
    }

    public boolean isTokenValid(String token, UserDetails userDetails) {
        final String username = extractUsername(token);
        return (username.equals(userDetails.getUsername()));
    }

    public boolean isTokenExpired(String token) {
        return extractExpiration(token).before(new Date());
    }

    private Date extractExpiration(String token) {
        return extractClaim(token, Claims::getExpiration);
    }

    private Claims extractAllClaims(String token) {
        return Jwts
                .parserBuilder()
                .setSigningKey(getSignInKey())
                .build()
                .parseClaimsJws(token)
                .getBody();
    }

    private Key getSignInKey() {
        byte[] keyBytes = Decoders.BASE64.decode(secretKey);
        return Keys.hmacShaKeyFor(keyBytes);
    }

    public String generateTokenForRoot(User userDetails) {
        // Create a map to hold extra claims (payload for the JWT)
        Map<String, Object> extraClaims = new HashMap<>();

        // Add user details to the claims
        extraClaims.put("user", userDetails.getId());               // User ID
        extraClaims.put("is_root_user", userDetails.isRootUser());  // Indicate if it's a root user

        // Call to build the JWT token with the provided claims and user details
        return buildToken(extraClaims, userDetails, AuthConstant.jwtTokenExpiryInMillis);
    }

    public String generateTokenForRoot(User userDetails, List<OrgDTO> orgs)  {
        // Create a map to hold extra claims (payload for the JWT)
        Map<String, Object> extraClaims = new HashMap<>();

        // Add user details to the claims
        extraClaims.put("user", userDetails.getId());
        extraClaims.put("username", userDetails.getUsername());
        extraClaims.put("email", userDetails.getEmail());

        List<Map<String, Object>> orgDetails = new ArrayList<>();
        for (OrgDTO org : orgs) {
            Map<String, Object> orgMap = new HashMap<>();
            orgMap.put("name", org.getName());
            orgMap.put("id", org.getId());
            List<Map<String, Object>> subModules = new ArrayList<>();
            for (SubmoduleDTO subModule : org.getSubModules()) {
                Map<String, Object> subModuleMap = new HashMap<>();
                subModuleMap.put("name", subModule.getName());
                subModuleMap.put("module", subModule.getModule());
                subModules.add(subModuleMap);
            }
            orgMap.put("sub_modules", subModules);
            orgMap.put("roles", org.getRoles());
            orgMap.put("permissions", org.getPermissions());

            orgDetails.add(orgMap);
        }

        extraClaims.put("org", orgDetails);

        return buildToken(extraClaims, userDetails, AuthConstant.jwtTokenExpiryInMillis);
    }
}