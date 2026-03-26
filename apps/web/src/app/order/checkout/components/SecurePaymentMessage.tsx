import React from "react";
import { Icon } from "@/components/Icon";
import { FaLock } from "react-icons/fa";

interface SecurePaymentMessageProps {
  paymentMethod: string | null;
}

export function SecurePaymentMessage({
  paymentMethod,
}: SecurePaymentMessageProps) {
  if (paymentMethod !== "online") return null;

  return (
    <div className="bg-slate-900 border border-blue-600 rounded-lg p-4 mt-4">
      <div className="flex items-start gap-3">
        <Icon
          icon={FaLock}
          className="w-6 h-6 text-blue-400 flex-shrink-0 mt-0.5"
        />
        <div className="flex-1">
          <h4 className="text-base font-semibold text-blue-100 mb-1">
            Secure Payment Processing
          </h4>
          <p className="text-sm text-blue-200">
            We do not store your card information. All payments are securely
            processed by Stripe, a trusted third-party payment provider used by
            millions of businesses worldwide. Your payment details are encrypted
            and never touch our servers.
          </p>
        </div>
      </div>
    </div>
  );
}
