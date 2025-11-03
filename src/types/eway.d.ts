/**
 * TypeScript declarations for Eway eCrypt JavaScript Library
 *
 * Official Library: https://secure.ewaypayments.com/scripts/eCrypt.min.js
 * Documentation: https://eway.io/api-v3/#client-side-encryption
 *
 * The eCrypt library is provided by Eway for client-side encryption
 * of sensitive card data (card number and CVN only).
 */

declare global {
  interface Window {
    /**
     * Eway eCrypt - Official client-side encryption library
     */
    eCrypt: {
      /**
       * Encrypts a value using Eway's Client Side Encryption Key
       *
       * This function uses RSA-OAEP encryption with Eway's public key
       * to encrypt sensitive card data in the browser before sending
       * it to your server.
       *
       * @param value - The value to encrypt (card number or CVN)
       * @param key - (Optional) Eway Client Side Encryption Key from MyEway.
       *              If not provided, the function will look for a
       *              data-eway-encrypt-key attribute in the form element.
       *
       * @returns Encrypted value with "eCrypted:" prefix (e.g., "eCrypted:base64string...")
       *
       * @example
       * ```typescript
       * // Basic usage
       * const encrypted = window.eCrypt.encryptValue("4444333322221111", clientSideKey);
       * // Returns: "eCrypted:Zw4URQ1LMm6RgXNbIVM1dlqcO15V..."
       *
       * // With form attribute (key detected automatically)
       * const encrypted = window.eCrypt.encryptValue("4444333322221111");
       * ```
       *
       * @throws Error if encryption fails or library is not loaded
       */
      encryptValue: (value: string, key?: string) => string;
    };
  }
}

export {};
