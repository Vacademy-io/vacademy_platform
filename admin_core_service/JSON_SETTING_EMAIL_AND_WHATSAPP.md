# 📢 Notification Settings (Email + WhatsApp)

This project contains JSON configuration files for **Email** and **WhatsApp** notification settings.  
Each institute can maintain its own configuration independently.

---

## 📁 Files

- `email-setting.json` → Email & Welcome Mail settings.
- `whatsapp-setting.json` → WhatsApp & WhatsApp Welcome settings.

---

## ✉️ Email Settings (`email-setting.json`)

### `EMAIL_SETTING`
Holds all email-related configurations.

- **`MARKETING_EMAIL`** → Used for sending promotional/marketing emails.
- **`UTILITY_EMAIL`** → Used for transactional/utility-related emails (OTP, alerts).

**Keys:**
- `host`: SMTP host (e.g., `smtp.gmail.com`)
- `port`: SMTP port (e.g., `587`)
- `username`: Email account username
- `password`: Email password / app key
- `from`: Default sender email

### `WELCOME_MAIL_SETTING`
Configuration for welcome emails.

**Keys:**
- `allowUniqueLink`: Boolean (true/false)
- `template`: Template ID/name

---

## 📱 WhatsApp Settings (`whatsapp-setting.json`)

### `WHATSAPP_SETTING`
Holds all WhatsApp configurations.

- **`MARKETING_WHATSAPP`** → Promotional WhatsApp messages.
- **`UTILITY_WHATSAPP`** → OTP, reminders, alerts.

**Keys:**
- `appId`: WhatsApp application ID
- `accessToken`: API authentication token
- `phoneNumberId`: WhatsApp phone number ID
- `from`: Default sender bot name/number

### `WHATSAPP_WELCOME_SETTING`
Configuration for WhatsApp welcome messages.

**Keys:**
- `allowUniqueLink`: Boolean (true/false)
- `templateName`: Template name for the welcome message
- `languageCode`: Language code (e.g., `en`, `hi`)

---

✅ With these two files, you can keep **Email** and **WhatsApp** settings separate and well-documented.
