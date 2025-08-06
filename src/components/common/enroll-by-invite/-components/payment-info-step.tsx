import { CardElement } from "@stripe/react-stripe-js";

interface PaymentInfoStepProps {
    error: string | null;
}

const CheckoutForm = ({ error }: { error: string | null }) => {
    return (
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-expect-error
        <form style={styles.form}>
            <h2 style={styles.heading}>💳 Secure Payment</h2>
            <p style={styles.subheading}>Enter your card details below.</p>
            <div style={styles.cardElementContainer}>
                <CardElement options={cardElementOptions} />
            </div>
            {error && (
                // eslint-disable-next-line @typescript-eslint/ban-ts-comment
                // @ts-expect-error
                <div style={styles.error}>
                    <strong>❌ Error</strong>
                    <p style={styles.errorText}>{error}</p>
                </div>
            )}
        </form>
    );
};

const PaymentInfoStep = ({ error }: PaymentInfoStepProps) => {
    return (
        <div style={styles.wrapper}>
            <CheckoutForm error={error} />
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
