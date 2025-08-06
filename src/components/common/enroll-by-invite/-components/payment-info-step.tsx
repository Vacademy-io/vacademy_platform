import { useState } from "react";
import { loadStripe } from "@stripe/stripe-js";
import {
    Elements,
    CardElement,
    useStripe,
    useElements,
} from "@stripe/react-stripe-js";

import { useSuspenseQuery } from "@tanstack/react-query";
import { handleGetStripeKeys } from "../-services/enroll-invite-services";

interface PaymentInfo {
    cardholderName: string;
    cardNumber: string;
    expiryDate: string;
    cvv: string;
}

interface PaymentInfoStepProps {
    instituteId: string;
    paymentInfo: PaymentInfo;
    onPaymentInfoChange: (field: keyof PaymentInfo, value: string) => void;
}

const CheckoutForm = () => {
    const stripe = useStripe();
    const elements = useElements();
    const [paymentMethodId, setPaymentMethodId] = useState(null);
    const [error, setError] = useState(null);
    const [loading, setLoading] = useState(false); // Added for loading state

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!stripe || !elements) return;

        setLoading(true); // Start loading
        setError(null);
        setPaymentMethodId(null);

        const cardElement = elements.getElement(CardElement);

        const { error, paymentMethod } = await stripe.createPaymentMethod({
            type: "card",
            card: cardElement,
        });

        if (error) {
            console.error(error.message);
            setError(error.message);
        } else {
            console.log("Payment Method:", paymentMethod);
            setPaymentMethodId(paymentMethod.id);
        }

        setLoading(false); // Stop loading
    };

    return (
        <form onSubmit={handleSubmit} style={styles.form}>
            <h2 style={styles.heading}>💳 Secure Payment</h2>
            <p style={styles.subheading}>Enter your card details below.</p>
            <div style={styles.cardElementContainer}>
                <CardElement options={cardElementOptions} />
            </div>
            <button
                type="submit"
                disabled={!stripe || loading}
                style={
                    loading
                        ? { ...styles.button, ...styles.buttonDisabled }
                        : styles.button
                }
            >
                {loading ? "Processing..." : "Generate Payment Method ID"}
            </button>
            {paymentMethodId && (
                <div style={styles.success}>
                    <strong>✅ Success!</strong>
                    <p style={styles.successText}>
                        Payment Method ID: <code>{paymentMethodId}</code>
                    </p>
                </div>
            )}
            {error && (
                <div style={styles.error}>
                    <strong>❌ Error</strong>
                    <p style={styles.errorText}>{error}</p>
                </div>
            )}
        </form>
    );
};

const PaymentInfoStep = ({
    instituteId,
    paymentInfo,
    onPaymentInfoChange,
}: PaymentInfoStepProps) => {
    const { data: stripeKeys } = useSuspenseQuery(
        handleGetStripeKeys(instituteId)
    );
    // Replace with your own publishable key
    const stripePromise = loadStripe(stripeKeys.publishableKey);

    return (
        <div style={styles.wrapper}>
            <Elements stripe={stripePromise}>
                <CheckoutForm />
            </Elements>
        </div>
    );
};

const styles = {
    wrapper: {
        display: "flex",
        justifyContent: "center",
        padding: "20px",
        fontFamily:
            "'Segoe UI', 'Roboto', 'Helvetica Neue', 'Arial', sans-serif",
    },
    form: {
        width: "100%",
        maxWidth: "480px",
        padding: "40px",
        backgroundColor: "rgba(255, 255, 255, 0.95)",
        borderRadius: "16px",
        backdropFilter: "blur(10px)",
        border: "2px solid rgba(255, 255, 255, 0.18)",
        textAlign: "center",
    },
    heading: {
        fontSize: "2rem",
        fontWeight: "bold",
        color: "#333",
        marginBottom: "10px",
    },
    subheading: {
        fontSize: "1rem",
        color: "#666",
        marginBottom: "30px",
    },
    cardElementContainer: {
        padding: "18px 15px",
        border: "1px solid #ddd",
        borderRadius: "8px",
        marginBottom: "25px",
        backgroundColor: "#fff",
    },
    button: {
        width: "100%",
        padding: "15px",
        fontSize: "1rem",
        fontWeight: "bold",
        color: "#fff",
        backgroundColor: "#007bff",
        border: "none",
        borderRadius: "8px",
        cursor: "pointer",
        transition:
            "background-color 0.3s ease, transform 0.2s ease, box-shadow 0.3s ease",
        boxShadow: "0 4px 15px rgba(0, 123, 255, 0.3)",
    },
    buttonDisabled: {
        backgroundColor: "#aaa",
        cursor: "not-allowed",
        boxShadow: "none",
    },
    success: {
        marginTop: "20px",
        padding: "15px",
        backgroundColor: "rgba(40, 167, 69, 0.1)",
        color: "#155724",
        border: "1px solid rgba(40, 167, 69, 0.2)",
        borderRadius: "8px",
        textAlign: "left",
        wordWrap: "break-word",
    },
    successText: {
        margin: "5px 0 0 0",
        fontSize: "0.9rem",
    },
    error: {
        marginTop: "20px",
        padding: "15px",
        backgroundColor: "rgba(220, 53, 69, 0.1)",
        color: "#721c24",
        border: "1px solid rgba(220, 53, 69, 0.2)",
        borderRadius: "8px",
        textAlign: "left",
    },
    errorText: {
        margin: "5px 0 0 0",
        fontSize: "0.9rem",
    },
};

const cardElementOptions = {
    style: {
        base: {
            color: "#32325d",
            fontFamily: "Arial, sans-serif",
            fontSmoothing: "antialiased",
            fontSize: "16px",
            "::placeholder": {
                color: "#aab7c4",
            },
        },
        invalid: {
            color: "#fa755a",
            iconColor: "#fa755a",
        },
    },
    hidePostalCode: true,
};

export default PaymentInfoStep;
