import { UsernameStrategy, PasswordStrategy } from "@/config/signup/defaultSignupSettings";

/**
 * Generates a username based on the specified strategy
 */
export function generateUsername(strategy: UsernameStrategy, email: string, existingUsername?: string): string {
  console.log('[CredentialGenerator] Generating username with strategy:', strategy, 'email:', email);
  
  switch (strategy) {
    case 'email':
      // Use email as username
      const username = email.split('@')[0];
      console.log('[CredentialGenerator] Using email as username:', username);
      return username;
      
    case 'random':
      // Generate random username in format user_xxxxxx
      const randomSuffix = Math.random().toString(36).substring(2, 8);
      const randomUsername = `user_${randomSuffix}`;
      console.log('[CredentialGenerator] Generated random username:', randomUsername);
      return randomUsername;
      
    case 'manual':
      // Return existing username if provided, otherwise empty string
      if (existingUsername) {
        console.log('[CredentialGenerator] Using manual username:', existingUsername);
        return existingUsername;
      }
      console.log('[CredentialGenerator] Manual username required but not provided');
      return '';
      
    case 'both':
      // Try email first, fallback to random if email is too long
      const emailUsername = email.split('@')[0];
      if (emailUsername.length <= 20) {
        console.log('[CredentialGenerator] Using email as username (both strategy):', emailUsername);
        return emailUsername;
      } else {
        const fallbackUsername = `user_${Math.random().toString(36).substring(2, 8)}`;
        console.log('[CredentialGenerator] Email too long, using random fallback:', fallbackUsername);
        return fallbackUsername;
      }
      
    case ' ':
    default:
      // Empty or invalid strategy - return empty string
      console.log('[CredentialGenerator] Empty or invalid strategy, returning empty username');
      return '';
  }
}

/**
 * Generates a password based on the specified strategy
 */
export function generatePassword(strategy: PasswordStrategy, existingPassword?: string): string {
  console.log('[CredentialGenerator] Generating password with strategy:', strategy);
  
  switch (strategy) {
    case 'autoRandom':
      // Generate secure 12-character password
      const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
      let password = '';
      
      // Ensure at least one of each required character type
      password += chars.charAt(Math.floor(Math.random() * 26)); // Uppercase
      password += chars.charAt(26 + Math.floor(Math.random() * 26)); // Lowercase
      password += chars.charAt(52 + Math.floor(Math.random() * 10)); // Number
      password += chars.charAt(62 + Math.floor(Math.random() * 8)); // Special char
      
      // Fill remaining characters randomly
      for (let i = 4; i < 12; i++) {
        password += chars.charAt(Math.floor(Math.random() * chars.length));
      }
      
      // Shuffle the password
      password = password.split('').sort(() => Math.random() - 0.5).join('');
      
      console.log('[CredentialGenerator] Generated auto-random password (length:', password.length, ')');
      return password;
      
    case 'manual':
      // Return existing password if provided, otherwise empty string
      if (existingPassword) {
        console.log('[CredentialGenerator] Using manual password (length:', existingPassword.length, ')');
        return existingPassword;
      }
      console.log('[CredentialGenerator] Manual password required but not provided');
      return '';
      
    case ' ':
    default:
      // Empty or invalid strategy - return empty string
      console.log('[CredentialGenerator] Empty or invalid strategy, returning empty password');
      return '';
  }
}

/**
 * Determines if credentials are required based on strategies
 */
export function areCredentialsRequired(usernameStrategy: UsernameStrategy, passwordStrategy: PasswordStrategy): {
  needsUsername: boolean;
  needsPassword: boolean;
} {
  const needsUsername = usernameStrategy === 'manual' || usernameStrategy === ' ';
  const needsPassword = passwordStrategy === 'manual' || passwordStrategy === ' ';
  
  console.log('[CredentialGenerator] Credential requirements:', {
    usernameStrategy,
    passwordStrategy,
    needsUsername,
    needsPassword
  });
  
  return { needsUsername, needsPassword };
}

/**
 * Generates both username and password based on strategies
 */
export function generateCredentials(
  usernameStrategy: UsernameStrategy,
  passwordStrategy: PasswordStrategy,
  email: string,
  existingUsername?: string,
  existingPassword?: string
): {
  username: string;
  password: string;
  needsManualInput: boolean;
} {
  console.log('[CredentialGenerator] Generating credentials for email:', email);
  
  const username = generateUsername(usernameStrategy, email, existingUsername);
  const password = generatePassword(passwordStrategy, existingPassword);
  
  const needsManualInput = (usernameStrategy === 'manual' && !username) || 
                           (passwordStrategy === 'manual' && !password);
  
  console.log('[CredentialGenerator] Generated credentials:', {
    username: username || '(not generated)',
    password: password ? '(generated)' : '(not generated)',
    needsManualInput
  });
  
  return {
    username,
    password,
    needsManualInput
  };
}
