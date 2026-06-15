import { MyButton } from "@/components/design-system/button";
import PhoneInput from "react-phone-input-2";
import "react-phone-input-2/lib/bootstrap.css";
import { zodResolver } from "@hookform/resolvers/zod";
import { FieldErrors, FormProvider, useForm } from "react-hook-form";
import SelectField from "@/components/design-system/select-field";
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { generateZodSchema } from "../-types/registrationFormSchema";
import { RegistrationFormValues, CustomField } from "../-types/type";
import { useEffect, useMemo } from "react";
import { getPreferredPhoneCountries } from "@/services/domain-routing";
import { CustomFieldRenderer } from "@/components/common/custom-fields/CustomFieldRenderer";
import {
  getFieldRenderType,
  FieldRenderType,
} from "@/components/common/enroll-by-invite/-utils/custom-field-helpers";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

interface RegistrationFormProps {
  customFields: CustomField[];
  verifiedEmail: string;
  verifiedEmails: string[];
  onSubmit: (formValues: RegistrationFormValues) => void;
  onError: (errors: FieldErrors) => void;
  onEmailChange: (email: string) => void;
}

/**
 * Identify the email field by its render type (and name as a fallback) rather
 * than a hardcoded `fieldKey === "email"`. The email custom field's key varies
 * per institute (name/UUID-derived), so keying off the literal string meant the
 * verified email never prefilled and the field stayed editable.
 */
const isEmailField = (field: CustomField): boolean => {
  if (getFieldRenderType(field.fieldKey, field.fieldType) === FieldRenderType.EMAIL) {
    return true;
  }
  const key = (field.fieldKey || "").toLowerCase();
  const label = (field.fieldName || "").toLowerCase();
  return (
    key === "email" ||
    key.includes("mail") ||
    label.includes("email") ||
    label.includes("e-mail")
  );
};

export default function RegistrationForm({
  customFields,
  verifiedEmail,
  verifiedEmails,
  onSubmit,
  onError,
  onEmailChange,
}: RegistrationFormProps) {
  const schema = generateZodSchema(customFields);
  // Default selected country + picker order from the institute's preferred countries.
  const { defaultCountry, preferredCountries } = useMemo(
    () => getPreferredPhoneCountries(),
    [],
  );
  // Actual keys of every email field in this form (keys vary per institute).
  const emailFieldKeys = useMemo(
    () => (customFields || []).filter(isEmailField).map((f) => f.fieldKey),
    [customFields],
  );
  const form = useForm({
    resolver: zodResolver(schema),
    defaultValues: emailFieldKeys.reduce<Record<string, string>>(
      (acc, key) => ({ ...acc, [key]: verifiedEmail }),
      {},
    ),
  });

  const {
    handleSubmit,
    formState: { errors },
  } = form;

  useEffect(() => {
    if (verifiedEmail) {
      emailFieldKeys.forEach((key) => {
        form.setValue(key as never, verifiedEmail as never);
      });
    }
  }, [verifiedEmail, emailFieldKeys, form]);

  return (
    <Card className="w-full border-primary-100/60 shadow-lg">
      <CardHeader className="pb-2 pt-6 px-6">
        <CardTitle className="text-xl font-bold text-gray-900">
          Registration Form
        </CardTitle>
        <CardDescription className="text-gray-500">
          Fill in your details to join the session
        </CardDescription>
      </CardHeader>

      <Separator className="mx-6 w-auto" />

      <CardContent className="pt-5 px-6 pb-6">
        <FormProvider {...form}>
          <form
            onSubmit={handleSubmit(onSubmit, onError)}
            className="flex flex-col gap-5"
          >
            <div className="flex flex-col gap-4 overflow-auto max-h-screen-50 pr-1">
              {[...(customFields || [])].sort((a, b) => (a.formOrder ?? 0) - (b.formOrder ?? 0)).map((responseField) => {
                const renderType = getFieldRenderType(
                  responseField.fieldKey,
                  responseField.fieldType
                );
                // Only show the email picker when there's an actual choice
                // (a returning user with 2+ verified emails). For a single
                // verified email, render it as a clean prefilled/locked field
                // instead of a pointless one-option dropdown.
                const isEmailWithVerifiedList =
                  isEmailField(responseField) && verifiedEmails.length > 1;
                const isMobileNumber =
                  responseField.fieldKey === "mobile_number";

                return (
                  <div key={responseField.id} className="flex flex-col gap-4">
                    {isMobileNumber ? (
                      <FormField
                        control={form.control}
                        name={responseField.fieldKey as never}
                        render={({ field }) => (
                          <FormItem className="!w-full">
                            <FormLabel className="text-sm font-medium text-gray-700">
                              {responseField.fieldName}
                              {responseField.mandatory && (
                                <span className="text-red-500 ml-0.5">*</span>
                              )}
                            </FormLabel>
                            <FormControl>
                              <PhoneInput
                                {...field}
                                country={defaultCountry}
                                enableSearch={true}
                                placeholder={`Enter ${responseField.fieldName.toLowerCase()}`}
                                onChange={(val) => {
                                  const formattedValue = val.startsWith("+")
                                    ? val
                                    : `+${val}`;
                                  field.onChange(formattedValue);
                                }}
                                inputClass="!w-full h-11 !rounded-lg !border-gray-200 !text-sm focus:!border-primary-300 focus:!ring-primary-100"
                                buttonClass="!rounded-l-lg !border-gray-200 !h-11"
                                disabled={false}
                                value={field.value}
                                countryCodeEditable={false}
                                enableAreaCodes={true}
                                disableCountryGuess={false}
                                preferredCountries={preferredCountries}
                                inputProps={{
                                  // Cap input at the E.164 max (+ and up to 15
                                  // digits). Country-aware length/format is
                                  // enforced by the zod schema, not here.
                                  maxLength: 16,
                                }}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    ) : isEmailWithVerifiedList ? (
                      <SelectField
                        label={responseField.fieldName}
                        name={responseField.fieldKey}
                        options={verifiedEmails.map((email, idx) => ({
                          value: email,
                          label: email,
                          _id: idx,
                        }))}
                        control={form.control}
                        className="mt-2 w-full font-thin"
                        onSelect={(value) => {
                          form.setValue(responseField.fieldKey as never, value as never);
                          onEmailChange(value);
                        }}
                      />
                    ) : (
                      <FormField
                        control={form.control}
                        name={responseField.fieldKey as never}
                        render={({ field }) => {
                          const isVerifiedEmailField =
                            isEmailField(responseField) && verifiedEmail !== "";
                          return (
                            <FormItem>
                              <FormLabel className="text-sm font-medium text-gray-700">
                                {responseField.fieldName}
                                {responseField.mandatory && (
                                  <span className="text-red-500 ml-0.5">*</span>
                                )}
                              </FormLabel>
                              <FormControl>
                                <CustomFieldRenderer
                                  type={renderType}
                                  name={responseField.fieldName}
                                  value={field.value || ""}
                                  onChange={(val) => field.onChange(val)}
                                  config={responseField.config}
                                  required={responseField.mandatory}
                                  disabled={isVerifiedEmailField}
                                />
                              </FormControl>
                              {isVerifiedEmailField && (
                                <p className="text-xs text-green-600 mt-1 flex items-center gap-1">
                                  <svg
                                    className="w-3.5 h-3.5"
                                    fill="none"
                                    viewBox="0 0 24 24"
                                    stroke="currentColor"
                                    strokeWidth={2.5}
                                  >
                                    <path
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      d="M5 13l4 4L19 7"
                                    />
                                  </svg>
                                  Email verified
                                </p>
                              )}
                            </FormItem>
                          );
                        }}
                      />
                    )}

                    {typeof responseField.fieldKey === "string" &&
                      !!errors &&
                      Object.prototype.hasOwnProperty.call(
                        errors,
                        responseField.fieldKey
                      ) &&
                      (errors as Record<string, FieldErrors>)[
                        responseField.fieldKey
                      ] && (
                        <p className="text-sm text-red-500">
                          {(errors as Record<string, FieldErrors>)[
                            responseField.fieldKey
                          ]?.message?.toString()}
                        </p>
                      )}
                  </div>
                );
              })}
            </div>

            <MyButton
              buttonType="primary"
              type="submit"
              className="w-full h-11 text-sm font-semibold rounded-lg mt-1"
            >
              Join Now
            </MyButton>
          </form>
        </FormProvider>
      </CardContent>
    </Card>
  );
}
