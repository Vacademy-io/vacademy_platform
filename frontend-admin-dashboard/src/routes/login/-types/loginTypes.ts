// types.ts
import { ReactNode } from "react";
import { z } from "zod";

// SplashScreen Props
export interface SplashScreenProps {
    children: ReactNode;
    isAnimationEnabled: boolean;
}

// FormContainer Props
export interface FormContainerProps {
    children: ReactNode;
}

// ForgotPassword Component State
export interface ForgotPasswordState {
    userEmail: string;
    emailError: string | null;
}

// LoginForm Component State
export interface LoginFormState {
    userEmail: string;
    userPassword: string;
    emailError: string | null;
    passwordError: string | null;
}

// SetPassword Component State
export interface SetPasswordState {
    userPassword: string;
    userConfirmPassword: string;
    passwordError: string | null;
    confirmPasswordError: string | null;
}

// LoginButton Props
export interface LoginButtonProps {
    btnText: string;
}

// Heading Props
export interface HeadingProps {
    heading: string;
    subHeading: string;
}

// Validation Schemas
export interface ForgotPasswordSchemaType {
    email: z.ZodString;
}

export interface LoginSchemaType {
    email: z.ZodString;
    password: z.ZodString;
}

export interface SetPasswordSchemaType {
    password: z.ZodString;
    confirmPassword: z.ZodString;
}
