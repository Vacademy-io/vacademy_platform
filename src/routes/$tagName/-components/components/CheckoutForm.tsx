import React, { useState, useEffect } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { Cross2Icon } from "@radix-ui/react-icons";
import { MyButton } from "@/components/design-system/button";
import { Loader2, MapPin, User, Mail, Phone, CreditCard, ChevronRight, CheckCircle2 } from "lucide-react";
import PhoneInput from "react-phone-input-2";
import "react-phone-input-2/lib/bootstrap.css";
import { getAccessToken, isTokenExpired } from "@/lib/auth/sessionUtility";
import { Preferences } from "@capacitor/preferences";
import {
    ENROLLMENT_PAYMENT_INITIATION,
    ENROLLMENT_PAYMENT_INITIATION_V2,
    ENROLLMENT_INVITE_URL,
    LIVE_SESSION_REQUEST_OTP,
    LIVE_SESSION_VERIFY_OTP,
    REQUEST_WHATSAPP_OTP,
    VERIFY_WHATSAPP_OTP,
    INSTITUTE_ID,
} from "@/constants/urls";
import { getBooksPreferenceFieldId } from "../../-services/custom-fields-service";
import { toast } from "sonner";
import axios from "axios";
import { performFullAuthCycle } from "@/services/auth-cycle-service";
import { loginEnrolledUser } from "@/services/signup-api";

interface CheckoutFormProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    instituteId: string;
    totalAmount: number;
    items: any[];
    membershipPlan?: any;
    isRentMode?: boolean;
}

export const CheckoutForm: React.FC<CheckoutFormProps> = ({
    open,
    onOpenChange,
    instituteId,
    totalAmount,
    items,
    membershipPlan,
    isRentMode = false,
}) => {
    const [email, setEmail] = useState("");
    const [fullName, setFullName] = useState("");
    const [phone, setPhone] = useState("");
    const [address, setAddress] = useState("");
    const [otp, setOtp] = useState("");
    const [loading, setLoading] = useState(false);
    const [isInitializing, setIsInitializing] = useState(false);
    const [phoneOtpSent, setPhoneOtpSent] = useState(false);
    const [isPhoneVerified, setIsPhoneVerified] = useState(false);
    const [isLoadingPhoneOtp, setIsLoadingPhoneOtp] = useState(false);
    const [isVerifyingPhoneOtp, setIsVerifyingPhoneOtp] = useState(false);
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [showFullForm, setShowFullForm] = useState(true);

    const [emailError, setEmailError] = useState("");
    const [phoneError, setPhoneError] = useState("");
    const [nameError, setNameError] = useState("");
    const [addressError, setAddressError] = useState("");

    const [paymentPlanData, setPaymentPlanData] = useState<any>(null);

    const targetInviteId = membershipPlan?.enrollInviteId ||
        (items.length > 0 ? items[0]?.enrollInviteId : null);

    // Add validation
    useEffect(() => {
        if (!open || !targetInviteId) {
            if (open && !targetInviteId) {
                console.error("[CheckoutForm] No valid enrollInviteId found");
                toast.error("Missing enrollment information");
            }
            return;
        }
        // ... rest of fetch logic
    }, [open, targetInviteId, instituteId]);

    // Reset state when opening/closing
    useEffect(() => {
        if (!open) {
            setPhoneOtpSent(false);
            setOtp("");
            setIsPhoneVerified(false);
            setShowFullForm(true);
        } else {
            const checkAuthAndLoadProfile = async () => {
                try {
                    const token = await getAccessToken();
                    if (token && !isTokenExpired(token)) {
                        setIsAuthenticated(true);
                        const { value } = await Preferences.get({ key: "StudentDetails" });
                        if (value) {
                            const parsedData = JSON.parse(value);
                            const studentDetails = Array.isArray(parsedData) ? parsedData[0] : parsedData;
                            if (studentDetails) {
                                setFullName(studentDetails.full_name || studentDetails.first_name || "");
                                setEmail(studentDetails.email || studentDetails.username || "");
                                const phoneNum = studentDetails.mobile_number || studentDetails.phone_number || "";
                                setPhone(phoneNum);
                                setAddress(studentDetails.address_line || studentDetails.address || "");
                                
                                const hasPhone = !!(phoneNum && phoneNum.replace(/\D/g, "").length >= 10);
                                if (hasPhone) {
                                    setIsPhoneVerified(true);
                                }
                                
                                setShowFullForm(!hasPhone);
                            }
                        }
                    } else {
                        setIsAuthenticated(false);
                        setShowFullForm(true);
                    }
                } catch (error) {
                    console.error(error);
                    setIsAuthenticated(false);
                    setShowFullForm(true);
                }
            };
            checkAuthAndLoadProfile();
        }
    }, [open]);

    // Fetch enrollment details to get valid plan_id and payment_option_id
    useEffect(() => {
        if (!open || !targetInviteId || isInitializing) return;

        console.log("[CheckoutForm] Fetching enrollment details for invite:", targetInviteId);
        setIsInitializing(true);
        const enrollmentUrl = `${ENROLLMENT_INVITE_URL}/${instituteId}/${targetInviteId}`;
        console.log("[CheckoutForm] Fetching from URL:", enrollmentUrl);
        axios.get(enrollmentUrl)
            .then(response => {
                const data = response.data;
                console.log("[CheckoutForm] Enrollment details fetched:", data);
                if (data.package_session_to_payment_options?.length > 0) {
                    const firstOption = data.package_session_to_payment_options[0];
                    const plans = firstOption.payment_option.payment_plans;
                    if (plans?.length > 0) {
                        setPaymentPlanData({
                            planId: plans[0].id,
                            paymentOptionId: firstOption.payment_option.id,
                            enrollInviteId: firstOption.enroll_invite_id || data.id,
                            vendorId: data.vendor_id || "PHONEPE"
                        });
                    }
                }
            })
            .catch(err => {
                console.error("[CheckoutForm] Failed to fetch enrollment details:", err);
                const errorMessage = err.response?.data?.message || err.message || "Failed to load payment options. Please try again.";
                toast.error(errorMessage);
            })
            .finally(() => {
                setIsInitializing(false);
            });

    }, [open, targetInviteId, instituteId]);

    const validateEmail = (email: string): boolean => {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    };

    const validatePhone = (phone: string): boolean => {
        const cleaned = phone.replace(/[\s-]/g, "");
        return cleaned.length >= 10;
    };

    const handleSendPhoneOTP = async () => {
        if (!phone.trim() || !validatePhone(phone)) {
            setPhoneError("Valid phone number is required to send OTP");
            return;
        }

        setIsLoadingPhoneOtp(true);
        try {
            await axios.post(
                REQUEST_WHATSAPP_OTP,
                {
                    phone_number: phone.replace(/\D/g, ""),
                    institute_id: instituteId
                },
                {
                    headers: { "Content-Type": "application/json" },
                }
            );

            setPhoneOtpSent(true);
            toast.success("OTP sent to your WhatsApp");
        } catch (error) {
            console.error("Failed to send WhatsApp OTP:", error);
            toast.error("Failed to send OTP. Please try again");
        } finally {
            setIsLoadingPhoneOtp(false);
        }
    };

    const handleVerifyPhoneOTP = async () => {
        if (!otp.trim()) {
            toast.error("Please enter the OTP");
            return;
        }

        setIsVerifyingPhoneOtp(true);
        try {
            await axios.post(
                VERIFY_WHATSAPP_OTP,
                {
                    phone_number: phone.replace(/\D/g, ""),
                    otp: otp,
                    institute_id: instituteId
                },
                {
                    headers: { "Content-Type": "application/json" },
                }
            );

            setIsPhoneVerified(true);
            setPhoneOtpSent(false);
            setOtp("");
            setPhoneError("");
            toast.success("Phone verified successfully");
        } catch (error) {
            console.error("Failed to verify WhatsApp OTP:", error);
            toast.error("Invalid OTP. Please try again");
        } finally {
            setIsVerifyingPhoneOtp(false);
        }
    };

    const handleCheckout = async () => {
        let hasErrors = false;
        setEmailError("");
        setPhoneError("");
        setNameError("");
        setAddressError("");

        if (showFullForm) {
            if (!fullName.trim()) {
                setNameError("Full name is required");
                hasErrors = true;
            }
            if (!email.trim() || !validateEmail(email)) {
                setEmailError("Valid email is required");
                hasErrors = true;
            }
            if (!phone.trim() || !validatePhone(phone)) {
                setPhoneError("Valid phone number is required");
                hasErrors = true;
            }
        }

        if (!isPhoneVerified) {
            setPhoneError("Phone verification is required");
            hasErrors = true;
        }
        if (!address.trim()) {
            setAddressError("Delivery address is required");
            hasErrors = true;
        }

        if (hasErrors) return;

        setLoading(true);
        try {
            const orderId = `book_order_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

            // Store order_id in localStorage for verification on return
            localStorage.setItem("pendingOrderId", orderId);

            // Common user payload
            const userPayload = {
                full_name: fullName.trim() || "Student",
                email: email.trim() || "student@example.com",
                mobileNumber: phone,
                address_line: address,
                city: "",
                region: "",
                pin_code: "",
                date_of_birth: new Date().toISOString(),
                gender: null,
                password: "",
                profile_pic_file_id: "",
                roles: ["STUDENT"],
            };

            // Get the redirect URL (current page)
            const redirectUrl = window.location.href;

            let response;

            if (isRentMode) {
                // ============ RENT MODE: Use v1 API with custom_field_values ============
                console.log("[CheckoutForm] Processing RENT mode checkout");

                // Fetch the "Books Preference" custom field ID
                const booksPreferenceFieldId = await getBooksPreferenceFieldId(instituteId);

                if (!booksPreferenceFieldId) {
                    throw new Error("Unable to find Books Preference custom field. Please contact support.");
                }

                // Build the books preference value - only the book names (titles)
                const bookNames = items.map(item => item.title || item.name || "Unknown Book");
                const booksPreferenceValue = bookNames.join(", ");

                console.log("[CheckoutForm] Books preference value (names only):", booksPreferenceValue);

                // Use membership plan for Rent mode
                const sessionIds = membershipPlan?.packageSessionId
                    ? [membershipPlan.packageSessionId]
                    : [];

                const rentPayload = {
                    user: {
                        ...userPayload,
                        username: email.split('@')[0],
                        mobile_number: phone,
                        root_user: true,
                    },
                    institute_id: instituteId,
                    subject_id: "",
                    vendor_id: "PHONEPE",
                    learner_package_session_enroll: {
                        package_session_ids: sessionIds,
                        plan_id: paymentPlanData?.planId || membershipPlan?.id || items[0]?.id,
                        payment_option_id: paymentPlanData?.paymentOptionId || "default",
                        enroll_invite_id: paymentPlanData?.enrollInviteId || membershipPlan?.enrollInviteId || items[0]?.enrollInviteId || items[0]?.id,
                        payment_initiation_request: {
                            amount: totalAmount,
                            currency: "INR",
                            description: `Rent subscription for ${items.length} books`,
                            charge_automatically: true,
                            institute_id: instituteId,
                            order_id: orderId,
                            redirect_url: redirectUrl,
                            phone_pe_request: {
                                redirect_url: redirectUrl
                            }
                        },
                        custom_field_values: [
                            {
                                custom_field_id: booksPreferenceFieldId,
                                value: booksPreferenceValue
                            }
                        ],
                    },
                };

                console.log("[CheckoutForm] Sending RENT Checkout Payload:", rentPayload);

                response = await axios.post(
                    ENROLLMENT_PAYMENT_INITIATION,
                    rentPayload,
                    {
                        headers: {
                            "clientId": instituteId,
                            "X-Institute-Id": instituteId
                        }
                    }
                );
            } else {
                // ============ BUY MODE: Use v2 API with learner_package_session_enrollments array ============
                console.log("[CheckoutForm] Processing BUY mode checkout");

                // Build learner_package_session_enrollments array for each item
                const learnerPackageSessionEnrollments = items.map(item => ({
                    package_session_id: item.packageSessionId || item.id,
                    plan_id: paymentPlanData?.planId || item.planId || item.id,
                    payment_option_id: paymentPlanData?.paymentOptionId || item.paymentOptionId || "default",
                    enroll_invite_id: item.enrollInviteId || item.id
                }));

                // Calculate total amount as sum of all package sessions
                const calculatedTotalAmount = items.reduce(
                    (total, item) => total + (item.price * (item.quantity || 1)),
                    0
                );

                const buyPayload = {
                    user: userPayload,
                    institute_id: instituteId,
                    vendor_id: "PHONEPE",
                    learner_package_session_enrollments: learnerPackageSessionEnrollments,
                    payment_initiation_request: {
                        amount: calculatedTotalAmount,
                        currency: "INR",
                        merchant_id: "PGTESTPAYUAT",
                        redirect_url: redirectUrl,
                        phone_pe_request: {
                            redirect_url: redirectUrl
                        }
                    }
                };

                console.log("[CheckoutForm] Sending BUY Checkout Payload:", buyPayload);

                response = await axios.post(
                    ENROLLMENT_PAYMENT_INITIATION_V2,
                    buyPayload,
                    {
                        headers: {
                            "Content-Type": "application/json",
                            "clientId": instituteId,
                            "X-Institute-Id": instituteId
                        }
                    }
                );
            }

            console.log("Checkout response data:", response.data);

            // Update local storage if backend returned a different order/transaction ID
            // Check multiple possible locations for the authoritative ID
            const backendOrderId =
                response.data?.payment_response?.order_id ||
                response.data?.payment_response?.response_data?.phonePeOrderId;

            if (backendOrderId && backendOrderId !== orderId) {
                console.log("Backend generated different Order ID. Updating localStorage:", backendOrderId);
                localStorage.setItem("pendingOrderId", backendOrderId);
            }

            // Handle automatic login BEFORE redirection or finishing
            const userUsername = response.data?.user?.username;
            const userPassword = response.data?.user?.password;

            // Check if tokens are directly in the response (most automatic flow)
            const directAccessToken = response.data?.accessToken || response.data?.token?.accessToken || response.data?.responseData?.accessToken;
            const directRefreshToken = response.data?.refreshToken || response.data?.token?.refreshToken || response.data?.responseData?.refreshToken;

            if (directAccessToken && directRefreshToken) {
                try {
                    console.log("[CheckoutForm] Found direct tokens in response, performing auth cycle");
                    await performFullAuthCycle({ accessToken: directAccessToken, refreshToken: directRefreshToken }, instituteId || INSTITUTE_ID);
                } catch (e) {
                    console.error("[CheckoutForm] Auth cycle with direct tokens failed:", e);
                }
            } else if (userUsername && userPassword) {
                try {
                    console.log("[CheckoutForm] Performing direct auto-login cycle using credentials");
                    const loginResponse = await loginEnrolledUser(userUsername, userPassword, instituteId || INSTITUTE_ID);
                    await performFullAuthCycle(loginResponse, instituteId || INSTITUTE_ID);

                    // Store as fallback for post-redirect verification in CartComponent if needed
                    localStorage.setItem("pendingUsername", userUsername);
                    localStorage.setItem("pendingUserPassword", userPassword);
                    localStorage.setItem("pendingInstituteId", instituteId || INSTITUTE_ID);
                } catch (loginError) {
                    console.error("[CheckoutForm] Pre-redirect auto-login failed:", loginError);
                }
            }

            // Use dynamic origin for redirection
            const targetDashboardUrl = new URL("/dashboard", window.location.origin).toString();

            // Store credentials and tokens BEFORE ANY REDIRECT
            if (userUsername && userPassword) {
                console.log("[CheckoutForm] Storing pending credentials for CartComponent fallback");
                localStorage.setItem("pendingUsername", userUsername);
                localStorage.setItem("pendingUserPassword", userPassword);
            }

            if (directAccessToken && directRefreshToken) {
                console.log("[CheckoutForm] Storing pending tokens for CartComponent auto-login");
                localStorage.setItem("pendingAccessToken", directAccessToken);
                localStorage.setItem("pendingRefreshToken", directRefreshToken);
                localStorage.setItem("pendingInstituteId", instituteId || INSTITUTE_ID);
            }

            // Check for redirect URL from response (e.g. PhonePe)
            const paymentRedirectUrl =
                response.data?.payment_response?.response_data?.redirectUrl;

            if (paymentRedirectUrl) {
                window.location.href = paymentRedirectUrl;
            } else if (response.data && (response.data.responseCode === "SUCCESS" || response.data.status === "SUCCESS")) {
                toast.success("Checkout successful!");
                // Clean up credentials storage as we are doing direct redirect with tokens potentially
                localStorage.removeItem("pendingUserEmail");
                localStorage.removeItem("pendingUserPassword");
                localStorage.removeItem("pendingOrderId");
                localStorage.removeItem("pendingAccessToken");
                localStorage.removeItem("pendingRefreshToken");

                if (directAccessToken && directRefreshToken) {
                    window.location.href = `${targetDashboardUrl}?accessToken=${directAccessToken}&refreshToken=${directRefreshToken}`;
                } else {
                    window.location.href = targetDashboardUrl;
                }
            } else {
                console.warn("No redirect URL found in response structure:", response.data);
                throw new Error("Unable to initiate PhonePe payment. Redirect URL missing from backend response.");
            }
        } catch (error: any) {
            console.error("Checkout failed:", error);
            const errorMessage = error.response?.data?.ex || error.response?.data?.message || error.message || "Checkout failed. Please try again.";
            toast.error(errorMessage);
        } finally {
            setLoading(false);
        }
    };

    return (
        <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
            <DialogPrimitive.Portal>
                <DialogPrimitive.Overlay className="fixed inset-0 z-[10000] bg-black/50 backdrop-blur-sm" />
                <DialogPrimitive.Content className="fixed left-1/2 top-1/2 z-[10001] w-[95%] max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-xl bg-white p-0 shadow-2xl focus:outline-none overflow-hidden flex flex-col max-h-[90vh]">

                    {/* Compact Header */}
                    <div className="bg-primary-600 px-5 py-2 text-white flex justify-between items-center shrink-0">
                        <div>
                            <h2 className="text-lg font-bold">Checkout</h2>
                            <p className="text-sm text-black font-medium leading-tight">Complete your information</p>
                        </div>
                        <button
                            className="p-1.5 rounded-full hover:bg-white/10 transition-colors"
                            onClick={() => onOpenChange(false)}
                        >
                            <Cross2Icon className="h-5 w-5" />
                        </button>
                    </div>

                    <div className="p-4 space-y-4 overflow-y-auto scrollbar-hide flex-1">
                        {isInitializing ? (
                            <div className="flex flex-col items-center justify-center py-10 space-y-3">
                                <Loader2 className="h-8 w-8 text-primary-500 animate-spin" />
                                <p className="text-sm text-gray-500 font-medium">Preparing checkout...</p>
                            </div>
                        ) : (
                            <>
                                {!showFullForm && (
                                    <div className="bg-primary-50 p-3 rounded-xl border border-primary-100 flex items-start gap-3 mb-2">
                                        <div className="bg-primary-100 p-2 rounded-full mt-0.5 shrink-0">
                                            <User className="h-4 w-4 text-primary-600" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-semibold text-gray-900 truncate">{fullName}</p>
                                            <p className="text-xs text-gray-500 mt-0.5 truncate">{email}</p>
                                            <p className="text-xs text-gray-500 mt-0.5">+{phone}</p>
                                        </div>
                                    </div>
                                )}

                                {showFullForm && (
                                    <>
                                        {/* Name */}
                                        <div className="space-y-1">
                                            <label className="text-[11px] font-bold text-gray-900 uppercase flex items-center gap-1.5">
                                                <User className="h-3 w-3" /> Full Name
                                            </label>
                                    <input
                                        type="text"
                                        value={fullName}
                                        onChange={(e) => setFullName(e.target.value)}
                                        className={`w-full px-3 py-2 bg-gray-50 border rounded-lg transition-all focus:bg-white focus:ring-2 text-sm font-medium ${nameError ? "border-red-300 focus:ring-red-50" : "border-gray-200 focus:ring-primary-50 focus:border-primary-400"}`}
                                        placeholder="Enter your name"
                                    />
                                    {nameError && <p className="text-red-500 text-[10px] font-semibold">{nameError}</p>}
                                </div>

                                {/* Email */}
                                <div className="space-y-1">
                                    <label className="text-[11px] font-bold text-gray-900 uppercase flex items-center gap-1.5">
                                        <Mail className="h-3 w-3" /> Email Address
                                    </label>
                                    <input
                                        type="email"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        className={`w-full px-3 py-2 bg-gray-50 border rounded-lg transition-all focus:bg-white focus:ring-2 text-sm font-medium ${emailError ? "border-red-300 focus:ring-red-50" : "border-gray-200 focus:ring-primary-50 focus:border-primary-400"}`}
                                        placeholder="email@example.com"
                                    />
                                    {emailError && <p className="text-red-500 text-[10px] font-semibold">{emailError}</p>}
                                </div>

                                {/* Phone */}
                                <div className="space-y-1">
                                    <label className="text-[11px] font-bold text-gray-900 uppercase flex items-center gap-1.5">
                                        <Phone className="h-3 w-3" /> Phone Number (WhatsApp)
                                    </label>
                                    <div className="flex gap-2">
                                        <div className="relative flex-1">
                                            <PhoneInput
                                                country="in"
                                                value={phone}
                                                disabled={isPhoneVerified}
                                                onChange={(value) => {
                                                    setPhone(value);
                                                    if (phoneOtpSent) setPhoneOtpSent(false);
                                                }}
                                                inputClass={`!w-full !px-3 !py-2 !pl-12 !h-[38px] !bg-gray-50 !border ${phoneError ? "!border-red-300" : "!border-gray-200"} !rounded-lg !text-sm !font-medium focus:!bg-white focus:!ring-2 focus:!ring-primary-50 ${isPhoneVerified ? "!text-green-700 !bg-green-50/50 !border-green-200" : ""}`}
                                                containerClass="!w-full"
                                                buttonClass={`!rounded-l-lg !border-gray-200 !bg-gray-50 !w-10 ${isPhoneVerified ? "!bg-green-50/50 !border-green-200" : ""}`}
                                                dropdownClass="!rounded-lg !shadow-xl"
                                            />
                                            {isPhoneVerified && <CheckCircle2 className="absolute right-2.5 top-2.5 h-4 w-4 text-green-500 z-10" />}
                                        </div>
                                        {!isPhoneVerified && (
                                            <MyButton
                                                buttonType="secondary"
                                                scale="small"
                                                layoutVariant="default"
                                                className="h-[38px] px-3 text-xs font-bold"
                                                onClick={handleSendPhoneOTP}
                                                disabled={isLoadingPhoneOtp || !phone || phoneOtpSent}
                                            >
                                                {isLoadingPhoneOtp ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : phoneOtpSent ? "Sent" : "Verify"}
                                            </MyButton>
                                        )}
                                    </div>
                                    {phoneError && <p className="text-red-500 text-[10px] font-semibold ml-1">{phoneError}</p>}

                                    {/* OTP Input for Phone */}
                                    {phoneOtpSent && !isPhoneVerified && (
                                        <div className="flex gap-2 mt-2 animate-in slide-in-from-top-1 duration-200">
                                            <input
                                                type="text"
                                                value={otp}
                                                onChange={(e) => setOtp(e.target.value)}
                                                className="flex-1 px-3 py-1.5 bg-white border border-primary-300 rounded-lg text-sm font-bold tracking-[0.2em] text-center focus:ring-2 focus:ring-primary-50"
                                                placeholder="------"
                                                maxLength={6}
                                            />
                                            <MyButton
                                                buttonType="primary"
                                                scale="small"
                                                layoutVariant="default"
                                                className="h-[34px] px-4 text-xs font-bold"
                                                onClick={handleVerifyPhoneOTP}
                                                disabled={isVerifyingPhoneOtp || otp.length < 4}
                                            >
                                                {isVerifyingPhoneOtp ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Verify OTP"}
                                            </MyButton>
                                        </div>
                                    )}
                                </div>
                                </>
                                )}

                                {/* Address */}
                                <div className="space-y-1">
                                    <label className="text-[11px] font-bold text-gray-900 uppercase flex items-center gap-1.5">
                                        <MapPin className="h-3 w-3" /> Delivery Address
                                    </label>
                                    <textarea
                                        value={address}
                                        onChange={(e) => setAddress(e.target.value)}
                                        rows={2}
                                        className={`w-full px-3 py-2 bg-gray-50 border rounded-lg transition-all focus:bg-white focus:ring-2 resize-none text-sm font-medium ${addressError ? "border-red-300 focus:ring-red-50" : "border-gray-200 focus:ring-primary-50 focus:border-primary-400"}`}
                                        placeholder="Full address for delivery"
                                    />
                                    {addressError && <p className="text-red-500 text-[10px] font-semibold ml-1">{addressError}</p>}
                                </div>

                                {/* Compact Summary */}
                                <div className="bg-gray-50 rounded-xl p-3 border border-gray-100 flex items-center justify-between">
                                    <div className="flex flex-col">
                                        <span className="text-[10px] text-gray-500 font-bold uppercase tracking-tight">Order Total</span>
                                        <span className="text-base font-black text-primary-600">₹{totalAmount.toFixed(0)}</span>
                                    </div>
                                    <div className="text-right">
                                        <span className="text-[10px] text-gray-400 font-medium block">{items.length} Items</span>
                                        <span className="text-[10px] text-green-600 font-bold flex items-center justify-end gap-1">
                                            <span className="w-1 h-1 bg-green-500 rounded-full" /> Secure
                                        </span>
                                    </div>
                                </div>
                            </>
                        )}
                    </div>

                    {/* Compact Footer */}
                    <div className="p-4 bg-white border-t border-gray-100 shrink-0">
                        <MyButton
                            buttonType="primary"
                            scale="large"
                            layoutVariant="default"
                            className="w-full h-11 text-base font-bold shadow-lg shadow-primary-100 active:scale-[0.98] transition-all rounded-lg flex items-center justify-center gap-2"
                            onClick={handleCheckout}
                            disabled={loading || isInitializing || !isPhoneVerified}
                        >
                            {loading ? (
                                <Loader2 className="animate-spin h-5 w-5" />
                            ) : (
                                <>
                                    <span>Proceed to Payment</span>
                                    <ChevronRight className="h-4 w-4" />
                                </>
                            )}
                        </MyButton>
                        {!isPhoneVerified && (
                            <p className="text-center text-[9px] text-red-400 mt-2 font-bold">WhatsApp verification required to continue</p>
                        )}
                    </div>
                </DialogPrimitive.Content>
            </DialogPrimitive.Portal>
        </DialogPrimitive.Root>
    );
};
