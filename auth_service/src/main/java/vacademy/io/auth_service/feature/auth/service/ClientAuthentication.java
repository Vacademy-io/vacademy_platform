package vacademy.io.auth_service.feature.auth.service;

import org.springframework.security.authentication.AbstractAuthenticationToken;

import org.springframework.security.core.authority.SimpleGrantedAuthority;

import java.util.Collections;


public class ClientAuthentication extends AbstractAuthenticationToken {

    private final String clientName;
    private final String clientToken;


    public ClientAuthentication(String clientName, String clientToken) {
        super(Collections.singletonList(new SimpleGrantedAuthority("ROLE_CLIENT")));
        this.clientName = clientName;
        this.clientToken = clientToken;
        setAuthenticated(true);
    }

    @Override
    public Object getCredentials() {
        return this.clientToken;
    }

    @Override
    public Object getPrincipal() {
        return this.clientName;
    }


}

