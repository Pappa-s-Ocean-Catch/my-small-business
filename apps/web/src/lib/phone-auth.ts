export function normalizeAuPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.startsWith("61") && digits.length === 11) {
    return `+${digits}`;
  }
  if (digits.startsWith("04") && digits.length === 10) {
    return `+61${digits.slice(1)}`;
  }
  if (phone.startsWith("+614") && phone.replace(/\D/g, "").length === 11) {
    return `+${phone.replace(/\D/g, "")}`;
  }
  return phone.trim();
}

export function buildFallbackOrderEmail(phone: string): string {
  const normalizedDigits = phone.replace(/\D/g, "");
  return `phone-${normalizedDigits}@no-email.local`;
}

/** True when profile has no real email (phone OTP / fallback-only). Changing phone then requires re-verification. */
export function isPlaceholderCustomerEmail(email: string | undefined | null): boolean {
  if (!email || !email.trim()) {
    return true;
  }
  return /^phone-\d+@no-email\.local$/i.test(email.trim());
}

export function mapPhoneAuthError(errorMessage: string): string {
  const normalized = errorMessage.toLowerCase();

  if (normalized.includes("unsupported phone provider")) {
    return "Phone login is not enabled in Supabase yet. Please configure Phone Auth provider in Supabase Auth settings (or enable the SMS hook provider) and try again.";
  }

  if (
    normalized.includes("sms") &&
    (normalized.includes("not configured") || normalized.includes("provider"))
  ) {
    return "SMS provider is not fully configured. Please check Supabase Phone Auth provider settings and your SMS hook endpoint configuration.";
  }

  if (normalized.includes("rate limit") || normalized.includes("too many requests")) {
    return "Too many requests. Please wait a few minutes before trying again.";
  }

  if (normalized.includes("invalid format") || normalized.includes("invalid phone")) {
    return "Please enter a valid mobile number (e.g., +61 4XX XXX XXX).";
  }
  
  if (normalized.includes("token has expired or is invalid")) {
    return "Verification code is invalid or has expired. Please try again.";
  }

  return "Could not verify phone number. Please try again or use another login method.";
}
