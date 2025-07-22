import React, { useState } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { Cross2Icon } from "@radix-ui/react-icons";
import { MyButton } from "@/components/design-system/button";
import { LockSimple } from "phosphor-react";
import { SiStripe } from "react-icons/si";
import { EnvelopeSimple } from "phosphor-react";

interface DonationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onContinue?: () => void;
  onSkip?: () => void;
}

export const DonationDialog: React.FC<DonationDialogProps> = ({
  open,
  onOpenChange,
  onContinue,
  onSkip,
}) => {
  const [donationType, setDonationType] = useState<'one-time' | 'monthly'>('monthly');
  const [selectedAmount, setSelectedAmount] = useState<number | 'other'>(12);
  const [customAmount, setCustomAmount] = useState('');
  const [step, setStep] = useState<'select' | 'summary' | 'payment'>('select');
  const [email, setEmail] = useState('you@example.com');

  const getAmount = () => {
    if (selectedAmount === 'other') {
      const val = parseFloat(customAmount);
      return isNaN(val) ? '' : val;
    }
    return selectedAmount;
  };

  const handleContinue = () => {
    if (step === 'select') {
      setStep('summary');
    } else if (step === 'summary') {
      setStep('payment');
    } else if (onContinue) {
      onContinue();
    }
  };

  const handleEdit = () => {
    setStep('select');
  };

  // Reset step when dialog is closed
  React.useEffect(() => {
    if (!open) setStep('select');
  }, [open]);

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-[9999] bg-black/60 animate-fade-in" />
        <DialogPrimitive.Content
          className="fixed left-1/2 top-1/2 z-[9999] w-full max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-lg bg-white p-6 shadow-xl focus:outline-none flex flex-col gap-4"
        >
          <button
            className="absolute right-2 top-2 text-gray-400 hover:text-gray-700 focus:outline-none"
            onClick={() => onOpenChange(false)}
            aria-label="Close"
          >
            <Cross2Icon className="h-4 w-4" />
          </button>
          <h2 className="text-lg font-bold text-center text-primary-700 mb-1">Support free education</h2>

          {step === 'select' ? (
            <>
              <div className="flex justify-center mb-1 -space-x-6">
                <MyButton
                  buttonType={donationType === 'one-time' ? 'primary' : 'secondary'}
                  scale="medium"
                  className="h-12 min-w-[160px] text-base rounded-full z-10 shadow-lg"
                  onClick={() => setDonationType('one-time')}
                >
                  One-time
                </MyButton>
                <MyButton
                  buttonType={donationType === 'monthly' ? 'primary' : 'secondary'}
                  scale="medium"
                  className="h-12 min-w-[160px] text-base rounded-full z-20 shadow-lg"
                  onClick={() => setDonationType('monthly')}
                >
                  Monthly
                </MyButton>
              </div>

              <p className="text-xs text-gray-700 text-center mt-1 mb-1">
                Choose an amount to donate {donationType}
              </p>

              <div className="grid grid-cols-2 gap-3 justify-center mb-2">
                {[12, 20, 30, 50].map((amount) => (
                  <div
                    key={amount}
                    className={`h-11 min-w-[90px] flex items-center justify-center rounded border cursor-pointer select-none text-sm font-medium transition-colors duration-200
                      ${selectedAmount === amount ? 'bg-primary-500 text-white border-primary-500' : 'bg-white text-gray-800 border-gray-300 hover:bg-primary-50'}`}
                    onClick={() => setSelectedAmount(amount)}
                    role="button"
                    tabIndex={0}
                    onKeyPress={(e) => { if (e.key === 'Enter' || e.key === ' ') setSelectedAmount(amount); }}
                  >
                    ${amount}
                  </div>
                ))}
                {selectedAmount !== 'other' && (
                  <div
                    className={`h-11 w-full flex items-center justify-center rounded border cursor-pointer select-none text-sm font-medium transition-colors duration-200
                      bg-white text-gray-800 border-gray-300 hover:bg-primary-50`}
                    onClick={() => setSelectedAmount('other')}
                    role="button"
                    tabIndex={0}
                    onKeyPress={(e) => { if (e.key === 'Enter' || e.key === ' ') setSelectedAmount('other'); }}
                    style={{ gridColumn: 'span 2' }}
                  >
                    Other
                  </div>
                )}
                {selectedAmount === 'other' && (
                  <input
                    type="number"
                    min="0"
                    placeholder="USD $"
                    className="border rounded p-2 text-xs w-full mt-1 mb-1 col-span-2 h-12"
                    value={customAmount}
                    onChange={(e) => setCustomAmount(e.target.value)}
                    style={{ gridColumn: 'span 2' }}
                  />
                )}
              </div>
            </>
          ) : step === 'summary' ? (
            <>
              <div className="mb-2 bg-white border border-neutral-300 rounded-lg p-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-semibold text-gray-700">Donation Summary</span>
                </div>
                <div className="flex items-center justify-between text-sm mb-1">
                  <span className="text-gray-600">Amount:</span>
                  <span className="font-semibold text-gray-900">${getAmount()}</span>
                </div>
                <div className="flex items-center justify-between text-sm mb-2">
                  <span className="text-gray-600">Frequency:</span>
                  <span className="font-semibold text-gray-900">{donationType === 'monthly' ? 'Monthly' : 'One-time'}</span>
                </div>
                <button
                  className="text-xs font-medium ml-auto block rounded border border-neutral-300 bg-white text-neutral-600 px-3 py-1 focus:outline-none transition-colors duration-200 hover:bg-primary-50/50 hover:border-primary-300"
                  onClick={handleEdit}
                  style={{ boxShadow: 'none', textDecoration: 'none' }}
                >
                  Edit
                </button>
              </div>
              <div className="mb-2">
                <label className="block text-xs text-gray-600 mb-1" htmlFor="donation-email">Your Email</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                    <EnvelopeSimple size={16} />
                  </span>
                  <input
                    id="donation-email"
                    type="email"
                    className="border rounded pl-9 p-2 text-xs w-full h-10"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                  />
                </div>
                <p className="text-[11px] text-gray-400 mt-1">We'll send your receipt to this email address</p>
              </div>
            </>
          ) : (
            <>
              <div className="mb-2 bg-white border border-neutral-300 rounded-lg p-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-semibold text-gray-700">Donation Summary</span>
                </div>
                <div className="flex items-center justify-between text-sm mb-1">
                  <span className="text-gray-600">Amount:</span>
                  <span className="font-semibold text-gray-900">${getAmount()}</span>
                </div>
                <div className="flex items-center justify-between text-sm mb-2">
                  <span className="text-gray-600">Frequency:</span>
                  <span className="font-semibold text-gray-900">{donationType === 'monthly' ? 'Monthly' : 'One-time'}</span>
                </div>
                <div className="flex items-center justify-between text-sm mb-1">
                  <span className="text-gray-600">Email:</span>
                  <span className="font-semibold text-gray-900">{email}</span>
                </div>
                <button
                  className="text-xs font-medium ml-auto block rounded border border-neutral-300 bg-white text-neutral-600 px-3 py-1 focus:outline-none transition-colors duration-200 hover:bg-primary-50/50 hover:border-primary-300"
                  onClick={handleEdit}
                  style={{ boxShadow: 'none', textDecoration: 'none' }}
                >
                  Edit
                </button>
              </div>
              <div className="mb-2">
               
                <label className="block text-xs text-gray-600 mb-1" htmlFor="card-number">Card Details</label>
                <div className="relative mb-2">
                  <input
                    id="card-number"
                    type="text"
                    className="border rounded p-2 text-xs w-full h-10 pr-20"
                    placeholder="Card number"
                    autoComplete="cc-number"
                  />
                  <button
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-primary-600 hover:underline px-2 py-1 bg-white"
                    type="button"
                    onClick={() => {/* autofill logic here */}}
                    tabIndex={0}
                  >
                    Autofill
                  </button>
                </div>
                <div className="flex flex-col gap-2 w-full mt-3">
                  <MyButton
                    buttonType="primary"
                    scale="medium"
                    layoutVariant="default"
                    className="w-full h-11 text-base flex items-center justify-center gap-2"
                    onClick={onContinue}
                  >
                    <LockSimple size={18} weight="bold" /> Donate Now
                  </MyButton>
                  <MyButton
                    buttonType="secondary"
                    scale="medium"
                    layoutVariant="default"
                    className="w-full h-10 text-sm border-none"
                    onClick={onSkip}
                  >
                    Skip
                  </MyButton>
                </div>
                <div className="text-xs text-gray-500 text-center mt-2 flex items-center justify-center gap-1">
                  <LockSimple size={14} className="inline-block mr-1" />
                  Secure payment powered by
                  <span className="font-semibold flex items-center gap-1 ml-1">
                    <SiStripe size={16} className="text-indigo-600" /> Stripe
                  </span>
                </div>
              </div>
            </>
          )}

          {step !== 'payment' && (
            <div className="flex flex-col gap-2 w-full mt-3">
              <MyButton
                buttonType="primary"
                scale="medium"
                layoutVariant="default"
                className="w-full h-11 text-base"
                onClick={handleContinue}
              >
                Continue
              </MyButton>
              <MyButton
                buttonType="secondary"
                scale="medium"
                layoutVariant="default"
                className="w-full h-10 text-sm border-none"
                onClick={onSkip}
              >
                Skip
              </MyButton>
            </div>
          )}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
};
