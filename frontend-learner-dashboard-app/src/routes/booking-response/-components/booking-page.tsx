import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useForm, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { formatInTimeZone } from "date-fns-tz";
import { toast } from "sonner";
import {
  ArrowLeft,
  CalendarCheck,
  CheckCircle,
  Clock,
  HourglassMedium,
  MapPin,
  VideoCamera,
} from "@phosphor-icons/react";
import { useDomainRouting } from "@/hooks/use-domain-routing";
import { handleGetPublicInstituteDetails } from "@/components/common/enroll-by-invite/-services/enroll-invite-services";
import { InstituteBrandingComponent } from "@/components/common/institute-branding";
import {
  ModernCard,
  ModernCardHeader,
  ModernCardTitle,
} from "@/components/design-system/modern-card";
import { MyButton } from "@/components/design-system/button";
import { MyInput } from "@/components/design-system/input";
import { Form, FormControl, FormField, FormItem } from "@/components/ui/form";
import { getDynamicSchema } from "@/routes/register/-utils/helper";
import { AssessmentCustomFieldOpenRegistration } from "@/types/assessment-open-registration";
import SlotPicker from "./slot-picker";
import BookingCustomFields from "./booking-custom-fields";
import {
  BookingCustomFieldFormValue,
  buildBookingCustomFieldDefaults,
  buildCustomFieldValues,
  convertBookingCustomFields,
} from "../-utils/booking-custom-field-utils";
import {
  BookingPageResponse,
  BookingView,
  bookSlot,
  extractBookingErrorMessage,
  getBrowserTimezone,
} from "../-services/booking-services";

// Fixed invitee fields + the page's campaign custom fields (validated by the
// same getDynamicSchema the audience-response/register forms use, nested
// under the `custom` group).
const buildDetailsSchema = (
  formFields: AssessmentCustomFieldOpenRegistration[]
) =>
  z
    .object({
      name: z.string().trim().min(1, "Please enter your name"),
      email: z
        .string()
        .trim()
        .email("Please enter a valid email")
        .or(z.literal("")),
      phone: z.string().trim(),
      custom: getDynamicSchema(formFields),
    })
    .refine((v) => v.email !== "" || v.phone !== "", {
      message: "Please provide an email or a phone number",
      path: ["email"],
    })
    .refine((v) => v.phone === "" || v.phone.replace(/\D/g, "").length >= 7, {
      message: "Please enter a valid phone number",
      path: ["phone"],
    });

interface DetailsFormValues {
  name: string;
  email: string;
  phone: string;
  custom: Record<string, BookingCustomFieldFormValue>;
}

interface BookingPageProps {
  pageData: BookingPageResponse;
  instituteId: string;
  slug: string;
}

type Step = "pick" | "details" | "confirmed";

const formatSlotFull = (iso: string, tz: string) =>
  formatInTimeZone(new Date(iso), tz, "EEEE, d MMMM yyyy 'at' h:mm a");

/** Confirmation view — shared shape for both PENDING and CONFIRMED bookings. */
export const BookingConfirmation = ({
  booking,
  instituteId,
}: {
  booking: BookingView;
  instituteId?: string;
}) => {
  const isPending = booking.status === "PENDING";
  const tz = booking.invitee_timezone;
  return (
    <div className="flex flex-col items-center gap-6 py-6 text-center">
      <div
        className={
          isPending
            ? "flex size-16 items-center justify-center rounded-full bg-warning-50"
            : "flex size-16 items-center justify-center rounded-full bg-success-50"
        }
      >
        {isPending ? (
          <HourglassMedium size={32} className="text-warning-600" />
        ) : (
          <CheckCircle size={32} className="text-success-600" />
        )}
      </div>
      <div className="flex flex-col gap-2">
        <h2 className="text-h3 font-semibold text-neutral-700">
          {isPending ? "Booking request received" : "Booking confirmed"}
        </h2>
        <p className="text-body text-neutral-500">
          {isPending
            ? `Your request for ${booking.title} is awaiting confirmation${
                booking.host_name ? ` from ${booking.host_name}` : ""
              }. We'll let you know as soon as it's approved.`
            : `You're scheduled for ${booking.title}${
                booking.host_name ? ` with ${booking.host_name}` : ""
              }.`}
        </p>
      </div>
      <div className="flex w-full flex-col gap-2 rounded-lg border border-neutral-200 bg-neutral-50 p-4 text-left">
        <div className="flex items-center gap-2 text-body text-neutral-600">
          <CalendarCheck size={18} className="shrink-0 text-primary-500" />
          <span className="font-semibold">
            {formatSlotFull(booking.start_time_utc, tz)}
          </span>
        </div>
        <div className="flex items-center gap-2 text-caption text-neutral-500">
          <Clock size={18} className="shrink-0 text-primary-500" />
          <span>Timezone: {tz.replace(/_/g, " ")}</span>
        </div>
      </div>
      {booking.meet_link && (
        <a
          href={booking.meet_link}
          target="_blank"
          rel="noopener noreferrer"
          className="w-full"
        >
          <MyButton
            type="button"
            buttonType="primary"
            scale="large"
            layoutVariant="default"
            className="w-full"
          >
            <VideoCamera size={18} className="mr-2" /> Join meeting link
          </MyButton>
        </a>
      )}
      <p className="text-caption text-neutral-500">
        {booking.invitee_email
          ? `A confirmation email with these details has been sent to ${booking.invitee_email}.`
          : "A confirmation with these details has been sent to you."}
      </p>
      <Link
        to="/booking-manage"
        search={{ token: booking.manage_token, instituteId }}
        className="text-body font-semibold text-primary-500 underline-offset-2 hover:underline"
      >
        Manage booking (cancel or reschedule)
      </Link>
    </div>
  );
};

const BookingPage = ({ pageData, instituteId, slug }: BookingPageProps) => {
  const domainRouting = useDomainRouting();
  const queryClient = useQueryClient();

  const [step, setStep] = useState<Step>("pick");
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [selectedTz, setSelectedTz] = useState<string | null>(null);
  // Picker state lives here (not in SlotPicker) so it survives navigating to
  // the details step and back, or a slot-taken failure returning to "pick".
  const browserTz = useMemo(() => getBrowserTimezone(), []);
  const [pickerTz, setPickerTz] = useState<string>(browserTz);
  const [weekOffset, setWeekOffset] = useState(0);
  const [selectedDayKey, setSelectedDayKey] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [booking, setBooking] = useState<BookingView | null>(null);

  const { data: instituteData } = useQuery(
    handleGetPublicInstituteDetails({ instituteId })
  );

  // Campaign custom fields linked to this booking page (empty for standalone
  // pages). Rendered in the details step and validated alongside the fixed
  // fields.
  const formFields = useMemo(
    () => convertBookingCustomFields(pageData.custom_fields ?? []),
    [pageData.custom_fields]
  );
  const detailsSchema = useMemo(
    () => buildDetailsSchema(formFields),
    [formFields]
  );

  const form = useForm<DetailsFormValues>({
    resolver: zodResolver(detailsSchema) as Resolver<DetailsFormValues>,
    defaultValues: {
      name: "",
      email: "",
      phone: "",
      custom: buildBookingCustomFieldDefaults(formFields),
    },
    mode: "onChange",
  });

  const handleSlotSelected = (slotIso: string, tz: string) => {
    setSelectedSlot(slotIso);
    setSelectedTz(tz);
    setStep("details");
  };

  const onSubmit = async (values: DetailsFormValues) => {
    if (!selectedSlot || !selectedTz) return;
    setSubmitting(true);
    try {
      const customFieldValues = buildCustomFieldValues(
        formFields,
        values.custom ?? {}
      );
      const result = await bookSlot({
        instituteId,
        slug,
        payload: {
          name: values.name,
          ...(values.email ? { email: values.email } : {}),
          ...(values.phone ? { phone: values.phone } : {}),
          start_time: selectedSlot,
          invitee_timezone: selectedTz,
          ...(Object.keys(customFieldValues).length
            ? { custom_field_values: customFieldValues }
            : {}),
        },
      });
      setBooking(result);
      setStep("confirmed");
    } catch (error) {
      // Most common: the slot was taken while filling the form. Surface the
      // backend message, refresh availability and send the user back to pick.
      toast.error(
        extractBookingErrorMessage(
          error,
          "Could not complete your booking. Please try again."
        )
      );
      await queryClient.invalidateQueries({ queryKey: ["GET_BOOKING_SLOTS"] });
      setSelectedSlot(null);
      setStep("pick");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen w-full bg-neutral-50">
      {/* Navbar header (mirrors audience-response) */}
      <nav className="sticky top-0 z-50 border-b border-neutral-200 bg-white shadow-sm">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="flex items-center justify-start py-3">
            <InstituteBrandingComponent
              branding={{
                instituteId: instituteId || null,
                instituteName:
                  instituteData?.institute_name ?? instituteData?.name ?? null,
                instituteLogoFileId:
                  instituteData?.institute_logo_file_id ?? null,
                instituteThemeCode:
                  (instituteData?.institute_theme_code as string) ||
                  (instituteData?.theme as string) ||
                  null,
                homeIconClickRoute: domainRouting.homeIconClickRoute ?? null,
              }}
              size="medium"
              showName={true}
              className="!flex-row !items-center !gap-3"
            />
          </div>
        </div>
      </nav>

      <div className="px-4 py-6 sm:px-6 lg:px-8">
        <div className="mx-auto flex max-w-2xl flex-col gap-6">
          {/* Page header */}
          <ModernCard variant="glass" padding="lg" rounded="lg">
            <ModernCardHeader className="mb-2 p-0">
              <ModernCardTitle size="lg" className="text-neutral-700">
                {pageData.title}
              </ModernCardTitle>
            </ModernCardHeader>
            {pageData.host_name && (
              <p className="text-body text-neutral-600">
                Hosted by{" "}
                <span className="font-semibold">{pageData.host_name}</span>
              </p>
            )}
            <div className="mt-2 flex flex-wrap items-center gap-4 text-caption text-neutral-500">
              <span className="flex items-center gap-1">
                <Clock size={16} className="text-primary-500" />
                {pageData.duration_minutes} min
              </span>
              {pageData.location_type && (
                <span className="flex items-center gap-1">
                  <MapPin size={16} className="text-primary-500" />
                  {pageData.location_type.replace(/_/g, " ").toLowerCase()}
                </span>
              )}
            </div>
            {pageData.description && (
              <p className="mt-3 text-body leading-relaxed text-neutral-600">
                {pageData.description}
              </p>
            )}
          </ModernCard>

          {/* Step content */}
          <ModernCard variant="glass" padding="lg" rounded="lg">
            {step === "pick" && (
              <>
                <ModernCardHeader className="mb-4 p-0">
                  <ModernCardTitle size="md" className="text-neutral-700">
                    Pick a time
                  </ModernCardTitle>
                </ModernCardHeader>
                <SlotPicker
                  instituteId={instituteId}
                  slug={slug}
                  pageTimezone={pageData.timezone}
                  bookingHorizonDays={pageData.booking_horizon_days}
                  onSelect={handleSlotSelected}
                  selectedSlot={selectedSlot}
                  browserTimezone={browserTz}
                  tz={pickerTz}
                  onTzChange={setPickerTz}
                  weekOffset={weekOffset}
                  onWeekOffsetChange={setWeekOffset}
                  selectedDayKey={selectedDayKey}
                  onSelectedDayKeyChange={setSelectedDayKey}
                />
              </>
            )}

            {step === "details" && selectedSlot && selectedTz && (
              <>
                <div className="mb-4 flex items-center gap-2">
                  <MyButton
                    type="button"
                    buttonType="secondary"
                    layoutVariant="icon"
                    scale="medium"
                    onClick={() => setStep("pick")}
                    aria-label="Back to time selection"
                  >
                    <ArrowLeft size={16} />
                  </MyButton>
                  <ModernCardTitle size="md" className="text-neutral-700">
                    Your details
                  </ModernCardTitle>
                </div>
                <div className="mb-4 flex items-center gap-2 rounded-lg border border-primary-100 bg-primary-50 p-3 text-body text-neutral-700">
                  <CalendarCheck
                    size={18}
                    className="shrink-0 text-primary-500"
                  />
                  <span className="font-semibold">
                    {formatSlotFull(selectedSlot, selectedTz)}
                  </span>
                </div>
                <Form {...form}>
                  <form
                    onSubmit={form.handleSubmit(onSubmit)}
                    className="flex flex-col gap-4"
                  >
                    <FormField
                      control={form.control}
                      name="name"
                      render={({ field }) => (
                        <FormItem>
                          <FormControl>
                            <MyInput
                              inputType="text"
                              label="Name"
                              required
                              inputPlaceholder="Your full name"
                              input={field.value}
                              onChangeFunction={field.onChange}
                              error={form.formState.errors.name?.message}
                              size="large"
                              className="w-full"
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="email"
                      render={({ field }) => (
                        <FormItem>
                          <FormControl>
                            <MyInput
                              inputType="email"
                              label="Email"
                              inputPlaceholder="you@example.com"
                              input={field.value}
                              onChangeFunction={field.onChange}
                              error={form.formState.errors.email?.message}
                              size="large"
                              className="w-full"
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="phone"
                      render={({ field }) => (
                        <FormItem>
                          <FormControl>
                            <MyInput
                              inputType="tel"
                              label="Phone"
                              inputPlaceholder="Your phone number"
                              input={field.value}
                              onChangeFunction={field.onChange}
                              error={form.formState.errors.phone?.message}
                              size="large"
                              className="w-full"
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                    <p className="text-caption text-neutral-500">
                      Provide at least an email or a phone number so we can
                      share your booking details.
                    </p>
                    {formFields.length > 0 && (
                      <BookingCustomFields
                        formFields={formFields}
                        control={form.control}
                      />
                    )}
                    <MyButton
                      type="submit"
                      buttonType="primary"
                      scale="large"
                      layoutVariant="default"
                      disable={submitting}
                      className="w-full"
                    >
                      {submitting
                        ? "Booking…"
                        : pageData.require_approval
                          ? "Request booking"
                          : "Confirm booking"}
                    </MyButton>
                  </form>
                </Form>
              </>
            )}

            {step === "confirmed" && booking && (
              <BookingConfirmation booking={booking} instituteId={instituteId} />
            )}
          </ModernCard>
        </div>
      </div>
    </div>
  );
};

export default BookingPage;
