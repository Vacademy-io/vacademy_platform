// src/i18n.ts
import i18n from "i18next";
import { initReactI18next } from "react-i18next";

i18n.use(initReactI18next).init({
    resources: {
        English: {
            translation: {
                loginHeading: "Glad To Have You Back!",
                loginSubheading: "Login and take the reins - your admin tools are waiting!",
                loginInput1: "you@email.com",
                loginInput2: "Password",
                loginText: "Forgot Password?",
                loginBtn: "Login",
                forgotPassHeading: "Forgot Password",
                // forgotPassSubheading: "Enter your email to receive a password reset link",
                forgotPassSubheading:
                    "Enter your email, and we'll send your password to your inbox",
                forgotPassInput1: "you@email.com",
                forgotPassBtn: "Send Reset Link",
                forgotPassBottomText: "Remember your password?",

                setPassHeading: "Set New Password",
                setPassSubheading: "Secure your account with a new password",
                setPassInput1: "New password",
                setPassInput2: "Confirm new password",
                setPassBtn: "Reset Password",
                setPassBottomText: "Back to Login?",
            },
        },
        हिन्दी: {
            translation: {
                glad: "आपका वापस आना हमारे लिए खुशी की बात है!",
                takeReins:
                    "लॉगिन करें और जिम्मेदारी संभालें - आपके प्रशासनिक उपकरण आपकी प्रतीक्षा कर रहे हैं!",
                username: "उपयोगकर्ता नाम",
                password: "पासवर्ड",
                forgotPassword: "पासवर्ड भूल गए?",
                login: "लॉगिन करें",
            },
        },
    },
    lng: "English", // Update default language to match Zustand store
    fallbackLng: "English",
    interpolation: {
        escapeValue: false,
    },
});

export default i18n;
