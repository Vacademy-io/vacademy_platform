import { UsernameStrategy, PasswordStrategy } from "@/config/signup/defaultSignupSettings";

/**
 * Generates a username based on the specified strategy
 */
export function generateUsername(strategy: UsernameStrategy, email: string, existingUsername?: string): string {
  switch (strategy) {
    case 'email':
      // Use email as username
      const username = email.split('@')[0];
      return username;
      
    case 'random':
      // Generate random username in format user_xxxxxx
      const randomSuffix = Math.random().toString(36).substring(2, 8);
      const randomUsername = `user_${randomSuffix}`;
      return randomUsername;
      
    case 'manual':
      // Return existing username if provided, otherwise empty string
      if (existingUsername) {
        return existingUsername;
      }
      return '';
      
    case 'both':
      // Try email first, fallback to random if email is too long
      const emailUsername = email.split('@')[0];
      if (emailUsername.length <= 20) {
        return emailUsername;
      } else {
        const fallbackUsername = `user_${Math.random().toString(36).substring(2, 8)}`;
        return fallbackUsername;
      }
      
    case ' ':
    default:
      // Empty or invalid strategy - return empty string
      return '';
  }
}

/**
 * Generates a password based on the specified strategy
 */
export function generatePassword(strategy: PasswordStrategy, existingPassword?: string): string {
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
      
      return password;
      
    case 'manual':
      // Return existing password if provided, otherwise empty string
      if (existingPassword) {
        return existingPassword;
      }
      return '';
      
    case ' ':
    default:
      // Empty or invalid strategy - return empty string
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
  const username = generateUsername(usernameStrategy, email, existingUsername);
  const password = generatePassword(passwordStrategy, existingPassword);
  
  const needsManualInput = (usernameStrategy === 'manual' && !username) || 
                           (passwordStrategy === 'manual' && !password);
  
  return {
    username,
    password,
    needsManualInput
  };
}
