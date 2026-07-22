'use client';

import { useEffect, useMemo, useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { getSupabaseClient } from '@my-small-business/supabase/client';
import { claimReceiptOrder, getReceiptClaimDetails } from '@/app/actions/receipt-claims';
import { signUpCustomer } from '@/app/actions/customer-auth';
import { canSendMagicLink } from '@/app/actions/auth';
import { sendMagicLinkInvite } from '@/app/actions/email';
import { completePhoneCustomerProfile } from '@/app/actions/customer-phone-auth';

type ClaimState = Awaited<ReturnType<typeof getReceiptClaimDetails>>;
const phoneLoginEnabled =
  typeof process.env.NEXT_PUBLIC_ENABLE_CHECKOUT_PHONE_LOGIN === 'string' &&
  (process.env.NEXT_PUBLIC_ENABLE_CHECKOUT_PHONE_LOGIN === 'true' ||
    process.env.NEXT_PUBLIC_ENABLE_CHECKOUT_PHONE_LOGIN === '1');

function normalizeAuPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.startsWith('61') && digits.length === 11) {
    return `+${digits}`;
  }
  if (digits.startsWith('04') && digits.length === 10) {
    return `+61${digits.slice(1)}`;
  }
  if (phone.startsWith('+614') && phone.replace(/\D/g, '').length === 11) {
    return `+${phone.replace(/\D/g, '')}`;
  }
  return phone.trim();
}

function buildFallbackOrderEmail(phone: string): string {
  const normalizedDigits = phone.replace(/\D/g, '');
  return `phone-${normalizedDigits}@no-email.local`;
}

function isPlaceholderCustomerEmail(email: string | undefined | null): boolean {
  if (!email || !email.trim()) return true;
  return /^phone-\d+@no-email\.local$/i.test(email.trim());
}

function mapPhoneAuthError(errorMessage: string): string {
  const normalized = errorMessage.toLowerCase();
  if (normalized.includes('unsupported phone provider')) {
    return 'Phone login is not enabled yet. Please use email login for now.';
  }
  if (normalized.includes('invalid phone')) {
    return 'Please enter a valid Australian mobile number like +614XXXXXXXX.';
  }
  return errorMessage;
}

export function ClaimReceiptClient() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get('token') ?? '';
  const redirectPath = useMemo(() => `/rewards/claim?token=${encodeURIComponent(token)}`, [token]);
  const [claimState, setClaimState] = useState<ClaimState | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [loginPhone, setLoginPhone] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [otpResendCountdown, setOtpResendCountdown] = useState(0);
  const [requiresPhoneProfileCompletion, setRequiresPhoneProfileCompletion] = useState(false);
  const [phoneProfileName, setPhoneProfileName] = useState('');
  const [phoneProfileEmail, setPhoneProfileEmail] = useState('');
  const [phoneAuthUser, setPhoneAuthUser] = useState<{ id: string; phone: string; email: string } | null>(null);
  const [isClaimPending, startClaimTransition] = useTransition();
  const [isSignupPending, startSignupTransition] = useTransition();
  const [isMagicPending, startMagicTransition] = useTransition();
  const [isPhonePending, startPhoneTransition] = useTransition();

  useEffect(() => {
    if (otpResendCountdown <= 0) return;
    const timer = window.setTimeout(() => setOtpResendCountdown((value) => value - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [otpResendCountdown]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const nextState = await getReceiptClaimDetails(token);
      if (!cancelled) {
        setClaimState(nextState);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [token]);

  const order = claimState?.order;
  const shouldHideOrderDetails = Boolean(order?.alreadyClaimed && !order?.claimedByCurrentUser);

  const handleClaim = () => {
    setErrorMessage(null);
    setStatusMessage(null);

    startClaimTransition(async () => {
      const result = await claimReceiptOrder(token);
      if (!result.success) {
        setErrorMessage(result.error || 'Failed to claim receipt.');
        return;
      }

      const pointsMessage = typeof result.pointsEarned === 'number' && result.pointsEarned > 0
        ? ` ${result.pointsEarned.toLocaleString()} reward points have been added.`
        : '';
      const warningMessage = result.rewardWarning ? ` Reward sync warning: ${result.rewardWarning}` : '';
      setStatusMessage(
        result.alreadyClaimed
          ? `This receipt is already linked to your account.${warningMessage}`
          : `Receipt linked successfully.${pointsMessage}${warningMessage}`
      );

      const refreshed = await getReceiptClaimDetails(token);
      setClaimState(refreshed);
      router.refresh();
    });
  };

  const handleCreateAccount = () => {
    setErrorMessage(null);
    setStatusMessage(null);

    startSignupTransition(async () => {
      const signUpResult = await signUpCustomer(email, password, fullName || undefined, phone || undefined);
      if (!signUpResult.success) {
        setErrorMessage(signUpResult.error || 'Failed to create your account.');
        return;
      }

      const supabase = getSupabaseClient();
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        setErrorMessage(error.message);
        return;
      }

      setStatusMessage('Account created. Linking your receipt now...');
      const refreshed = await getReceiptClaimDetails(token);
      setClaimState(refreshed);
      const claimResult = await claimReceiptOrder(token);
      if (!claimResult.success) {
        setErrorMessage(claimResult.error || 'Failed to link receipt after sign-up.');
        return;
      }

      setStatusMessage(
        claimResult.pointsEarned
          ? `Account ready and receipt linked. ${claimResult.pointsEarned.toLocaleString()} reward points added.`
          : 'Account ready and receipt linked successfully.'
      );
      setClaimState(await getReceiptClaimDetails(token));
      router.refresh();
    });
  };

  const handleMagicLink = () => {
    setErrorMessage(null);
    setStatusMessage(null);

    startMagicTransition(async () => {
      const check = await canSendMagicLink(email);
      if (!check.allowed) {
        setErrorMessage(check.reason || 'Magic link sign-in is unavailable right now.');
        return;
      }

      const result = await sendMagicLinkInvite(email, redirectPath);
      if (!result.success) {
        setErrorMessage(result.error || 'Failed to send magic link.');
        return;
      }

      setStatusMessage('Magic link sent. Open it on this device and we will bring you back to this receipt claim page.');
    });
  };

  const handleSendPhoneOtp = () => {
    setErrorMessage(null);
    setStatusMessage(null);

    startPhoneTransition(async () => {
      try {
        const normalizedPhone = normalizeAuPhone(loginPhone);
        if (!normalizedPhone.startsWith('+614')) {
          throw new Error('Please enter a valid Australian mobile number (e.g. +61 4XX XXX XXX).');
        }

        const supabase = getSupabaseClient();
        const { error } = await supabase.auth.signInWithOtp({
          phone: normalizedPhone,
          options: {
            shouldCreateUser: true,
            data: { phone: normalizedPhone },
          },
        });

        if (error) {
          throw new Error(mapPhoneAuthError(error.message));
        }

        setLoginPhone(normalizedPhone);
        setOtpSent(true);
        setOtpResendCountdown(30);
        setStatusMessage('Verification code sent to your mobile.');
      } catch (error) {
        setErrorMessage(error instanceof Error ? error.message : 'Failed to send verification code.');
      }
    });
  };

  const handleVerifyPhoneOtp = () => {
    setErrorMessage(null);
    setStatusMessage(null);

    startPhoneTransition(async () => {
      try {
        const normalizedPhone = normalizeAuPhone(loginPhone);
        if (!otpCode || otpCode.length < 6) {
          throw new Error('Please enter the 6-digit verification code.');
        }

        const supabase = getSupabaseClient();
        const { data, error } = await supabase.auth.verifyOtp({
          phone: normalizedPhone,
          token: otpCode,
          type: 'sms',
        });

        if (error) {
          throw new Error(mapPhoneAuthError(error.message));
        }

        if (!data.user) {
          throw new Error('Verification succeeded but no user session was found.');
        }

        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('id, email, full_name, phone')
          .eq('id', data.user.id)
          .single();

        if (profileError || !profile) {
          throw new Error('Phone verified, but profile could not be loaded. Please try again.');
        }

        const profilePhone = profile.phone || normalizedPhone;
        const finalEmail = profile.email || buildFallbackOrderEmail(profilePhone);
        setPhoneAuthUser({ id: profile.id, phone: profilePhone, email: finalEmail });
        setOtpCode('');

        if (!profile.full_name) {
          setRequiresPhoneProfileCompletion(true);
          setPhoneProfileName('');
          setPhoneProfileEmail(isPlaceholderCustomerEmail(profile.email) ? '' : profile.email || '');
          setStatusMessage('Mobile verified. Finish your profile to link this receipt.');
          return;
        }

        const claimResult = await claimReceiptOrder(token);
        if (!claimResult.success) {
          throw new Error(claimResult.error || 'Failed to link receipt after mobile login.');
        }

        setStatusMessage(
          claimResult.pointsEarned
            ? `Mobile verified and receipt linked. ${claimResult.pointsEarned.toLocaleString()} reward points added.`
            : 'Mobile verified and receipt linked successfully.'
        );
        setClaimState(await getReceiptClaimDetails(token));
        router.refresh();
      } catch (error) {
        setErrorMessage(error instanceof Error ? error.message : 'Failed to verify code.');
      }
    });
  };

  const handleCompletePhoneProfile = () => {
    setErrorMessage(null);
    setStatusMessage(null);

    startPhoneTransition(async () => {
      try {
        if (!phoneAuthUser?.id) {
          throw new Error('Missing authenticated mobile user.');
        }
        if (!phoneProfileName.trim()) {
          throw new Error('Please enter your full name.');
        }

        const result = await completePhoneCustomerProfile({
          userId: phoneAuthUser.id,
          fullName: phoneProfileName.trim(),
          email: phoneProfileEmail.trim() || undefined,
          phone: phoneAuthUser.phone,
        });

        if (!result.success) {
          throw new Error(result.error || 'Failed to complete profile.');
        }

        setRequiresPhoneProfileCompletion(false);
        const claimResult = await claimReceiptOrder(token);
        if (!claimResult.success) {
          throw new Error(claimResult.error || 'Failed to link receipt after profile completion.');
        }

        setStatusMessage(
          claimResult.pointsEarned
            ? `Profile completed and receipt linked. ${claimResult.pointsEarned.toLocaleString()} reward points added.`
            : 'Profile completed and receipt linked successfully.'
        );
        setClaimState(await getReceiptClaimDetails(token));
        router.refresh();
      } catch (error) {
        setErrorMessage(error instanceof Error ? error.message : 'Failed to complete profile.');
      }
    });
  };

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_#fde68a_0%,_#fff7ed_32%,_#fff_72%)] px-4 py-10 text-gray-900">
      <div className="mx-auto max-w-4xl overflow-hidden rounded-[2rem] bg-white shadow-[0_24px_80px_rgba(120,53,15,0.12)] ring-1 ring-amber-100">
        <div className="grid lg:grid-cols-[1.1fr_0.9fr]">
          <div className="bg-[linear-gradient(135deg,_#111827_0%,_#1f2937_52%,_#78350f_100%)] px-6 py-8 text-white sm:px-8 sm:py-10">
            <p className="text-xs font-semibold uppercase tracking-[0.35em] text-amber-300">Pappa&apos;s Rewards</p>
            <h1 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">
              Turn this store receipt into points for your next order
            </h1>
            <p className="mt-4 max-w-lg text-sm leading-6 text-white/78 sm:text-base">
              Link this purchase to your account and keep your in-store rewards in one place.
            </p>

            {order && !shouldHideOrderDetails ? (
              <div className="mt-8 grid gap-4 rounded-[1.5rem] bg-white/10 p-5 backdrop-blur-sm sm:grid-cols-2">
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-amber-200">Order</p>
                  <p className="mt-1 text-xl font-semibold">{order.orderNumber}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-amber-200">Estimated points</p>
                  <p className="mt-1 text-xl font-semibold">{order.rewardPointsEstimate.toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-amber-200">Receipt total</p>
                  <p className="mt-1 text-lg font-semibold">${order.total.toFixed(2)}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-amber-200">Purchased</p>
                  <p className="mt-1 text-sm text-white/80">{new Date(order.createdAt).toLocaleString()}</p>
                </div>
              </div>
            ) : order ? (
              <div className="mt-8 rounded-[1.5rem] bg-white/10 p-5 text-sm text-white/80 backdrop-blur-sm">
                This receipt has already been linked to a rewards account.
              </div>
            ) : (
              <div className="mt-8 rounded-[1.5rem] bg-white/10 p-5 text-sm text-white/80 backdrop-blur-sm">
                Loading your receipt...
              </div>
            )}
          </div>

          <div className="px-6 py-8 sm:px-8 sm:py-10">
            <div className="mb-6">
              <p className="text-sm font-medium uppercase tracking-[0.24em] text-amber-700">Receipt Claim</p>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight text-gray-950">Link your purchase</h2>
              <p className="mt-2 text-sm leading-6 text-gray-600">
                Sign in or create your account to save this in-store order to your rewards profile.
              </p>
            </div>

            {!claimState ? (
              <p className="text-sm text-gray-600">Loading receipt details...</p>
            ) : !claimState.success || !order ? (
              <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                {claimState.error || 'This receipt claim is unavailable.'}
              </div>
            ) : (
              <>
                {!shouldHideOrderDetails ? (
                  <div className="rounded-[1.5rem] border border-amber-100 bg-amber-50/60 p-5">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-xs uppercase tracking-[0.2em] text-amber-700">Receipt summary</p>
                        <p className="mt-1 text-lg font-semibold text-gray-950">{order.orderNumber}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs uppercase tracking-[0.2em] text-amber-700">Total</p>
                        <p className="mt-1 text-lg font-semibold text-gray-950">${order.total.toFixed(2)}</p>
                      </div>
                    </div>
                    <div className="mt-4 grid gap-2 text-sm text-gray-600 sm:grid-cols-2">
                      <p>Purchased: {new Date(order.createdAt).toLocaleString()}</p>
                      <p>Points to add: {order.rewardPointsEstimate.toLocaleString()}</p>
                      {order.customerName ? <p>Name on receipt: {order.customerName}</p> : <p>Guest in-store order</p>}
                      <p>Status: {order.paymentStatus.toUpperCase()} / {order.orderStatus.toUpperCase()}</p>
                    </div>
                  </div>
                ) : null}

                {statusMessage ? (
                  <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700">
                    {statusMessage}
                  </div>
                ) : null}

                {errorMessage ? (
                  <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                    {errorMessage}
                  </div>
                ) : null}

                {order.alreadyClaimed && !order.claimedByCurrentUser ? (
                  <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
                    This receipt has already been linked to a rewards account.
                  </div>
                ) : claimState.requiresAuth ? (
                  <div className="mt-6 grid gap-5">
                    {phoneLoginEnabled ? (
                      <div className="rounded-[1.5rem] border border-gray-200 p-5 shadow-sm">
                        <h3 className="text-lg font-semibold text-gray-950">Login with mobile number</h3>
                        <p className="mt-2 text-sm text-gray-600">
                          Use your phone number to verify your account and link this receipt.
                        </p>
                        {!requiresPhoneProfileCompletion ? (
                          <div className="mt-4 grid gap-3">
                            <input
                              type="tel"
                              value={loginPhone}
                              onChange={(event) => setLoginPhone(event.target.value)}
                              placeholder="+61 4XX XXX XXX"
                              className="h-11 rounded-xl border border-gray-300 px-3 outline-none ring-0 transition focus:border-amber-500"
                            />
                            {!otpSent ? (
                              <button
                                type="button"
                                onClick={handleSendPhoneOtp}
                                disabled={!loginPhone || isPhonePending}
                                className="h-11 rounded-xl bg-gray-950 px-5 text-sm font-medium text-white transition hover:bg-gray-800 disabled:opacity-50"
                              >
                                {isPhonePending ? 'Sending code...' : 'Send verification code'}
                              </button>
                            ) : (
                              <>
                                <input
                                  type="text"
                                  value={otpCode}
                                  onChange={(event) => setOtpCode(event.target.value)}
                                  placeholder="Enter 6-digit code"
                                  maxLength={6}
                                  className="h-11 rounded-xl border border-gray-300 px-3 outline-none ring-0 transition focus:border-amber-500"
                                />
                                <button
                                  type="button"
                                  onClick={handleVerifyPhoneOtp}
                                  disabled={!otpCode || isPhonePending}
                                  className="h-11 rounded-xl bg-emerald-600 px-5 text-sm font-medium text-white transition hover:bg-emerald-500 disabled:opacity-50"
                                >
                                  {isPhonePending ? 'Verifying...' : 'Verify and continue'}
                                </button>
                                {otpResendCountdown > 0 ? (
                                  <p className="text-sm text-gray-500">
                                    You can request a new code in {otpResendCountdown}s.
                                  </p>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={handleSendPhoneOtp}
                                    disabled={isPhonePending}
                                    className="h-11 rounded-xl border border-gray-300 px-5 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:opacity-50"
                                  >
                                    Resend code
                                  </button>
                                )}
                              </>
                            )}
                          </div>
                        ) : (
                          <div className="mt-4 grid gap-3">
                            <input
                              type="text"
                              value={phoneProfileName}
                              onChange={(event) => setPhoneProfileName(event.target.value)}
                              placeholder="Full name"
                              className="h-11 rounded-xl border border-gray-300 px-3 outline-none ring-0 transition focus:border-amber-500"
                            />
                            <input
                              type="email"
                              value={phoneProfileEmail}
                              onChange={(event) => setPhoneProfileEmail(event.target.value)}
                              placeholder="Email (optional)"
                              className="h-11 rounded-xl border border-gray-300 px-3 outline-none ring-0 transition focus:border-amber-500"
                            />
                            <button
                              type="button"
                              onClick={handleCompletePhoneProfile}
                              disabled={!phoneProfileName || isPhonePending}
                              className="h-11 rounded-xl bg-amber-500 px-5 text-sm font-medium text-black transition hover:bg-amber-400 disabled:opacity-50"
                            >
                              {isPhonePending ? 'Saving profile...' : 'Complete profile and link receipt'}
                            </button>
                          </div>
                        )}
                      </div>
                    ) : null}

                    <div className="rounded-[1.5rem] border border-gray-200 p-5 shadow-sm">
                      <h3 className="text-lg font-semibold text-gray-950">Already have an account?</h3>
                      <p className="mt-2 text-sm text-gray-600">
                        Sign in and we&apos;ll bring you right back here to finish linking this purchase.
                      </p>
                      <div className="mt-4 flex flex-wrap gap-3">
                        <Link
                          href={`/login?redirect=${encodeURIComponent(redirectPath)}`}
                          className="inline-flex h-11 items-center justify-center rounded-xl bg-gray-950 px-5 text-sm font-medium text-white transition hover:bg-gray-800"
                        >
                          Login with password
                        </Link>
                      </div>
                    </div>

                    <div className="rounded-[1.5rem] border border-gray-200 p-5 shadow-sm">
                      <h3 className="text-lg font-semibold text-gray-950">Send me a magic link</h3>
                      <p className="mt-2 text-sm text-gray-600">
                        Enter your email and we&apos;ll send a one-tap sign-in link for this receipt.
                      </p>
                      <div className="mt-4 grid gap-3">
                        <input
                          type="email"
                          value={email}
                          onChange={(event) => setEmail(event.target.value)}
                          placeholder="you@email.com"
                          className="h-11 rounded-xl border border-gray-300 px-3 outline-none ring-0 transition focus:border-amber-500"
                        />
                        <button
                          type="button"
                          onClick={handleMagicLink}
                          disabled={!email || isMagicPending}
                          className="h-11 rounded-xl border border-amber-300 bg-amber-50 px-5 text-sm font-medium text-amber-950 transition hover:bg-amber-100 disabled:opacity-50"
                        >
                          {isMagicPending ? 'Sending...' : 'Send magic link'}
                        </button>
                      </div>
                    </div>

                    <div className="rounded-[1.5rem] border border-gray-200 p-5 shadow-sm">
                      <h3 className="text-lg font-semibold text-gray-950">Create your rewards account</h3>
                      <p className="mt-2 text-sm text-gray-600">
                        Set up your account now and we&apos;ll link this order straight away.
                      </p>
                      <div className="mt-4 grid gap-3">
                        <input
                          type="text"
                          value={fullName}
                          onChange={(event) => setFullName(event.target.value)}
                          placeholder="Full name"
                          className="h-11 rounded-xl border border-gray-300 px-3 outline-none ring-0 transition focus:border-amber-500"
                        />
                        <input
                          type="email"
                          value={email}
                          onChange={(event) => setEmail(event.target.value)}
                          placeholder="Email"
                          className="h-11 rounded-xl border border-gray-300 px-3 outline-none ring-0 transition focus:border-amber-500"
                        />
                        <input
                          type="tel"
                          value={phone}
                          onChange={(event) => setPhone(event.target.value)}
                          placeholder="Phone (optional)"
                          className="h-11 rounded-xl border border-gray-300 px-3 outline-none ring-0 transition focus:border-amber-500"
                        />
                        <input
                          type="password"
                          value={password}
                          onChange={(event) => setPassword(event.target.value)}
                          placeholder="Password"
                          className="h-11 rounded-xl border border-gray-300 px-3 outline-none ring-0 transition focus:border-amber-500"
                        />
                        <button
                          type="button"
                          onClick={handleCreateAccount}
                          disabled={!email || !password || isSignupPending}
                          className="h-11 rounded-xl bg-amber-500 px-5 text-sm font-medium text-black transition hover:bg-amber-400 disabled:opacity-50"
                        >
                          {isSignupPending ? 'Creating account...' : 'Create account and link receipt'}
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="mt-6 rounded-[1.5rem] border border-gray-200 p-5 shadow-sm">
                    <h3 className="text-lg font-semibold text-gray-950">
                      {order.claimedByCurrentUser ? 'Receipt already linked' : 'Ready to link'}
                    </h3>
                    <p className="mt-2 text-sm text-gray-600">
                      {order.claimedByCurrentUser
                        ? 'This in-store order is already attached to your account.'
                        : 'Link this purchase now so your in-store rewards stay connected to your account.'}
                    </p>
                    {!order.claimedByCurrentUser ? (
                      <button
                        type="button"
                        onClick={handleClaim}
                        disabled={isClaimPending}
                        className="mt-4 inline-flex h-11 items-center justify-center rounded-xl bg-gray-950 px-5 text-sm font-medium text-white transition hover:bg-gray-800 disabled:opacity-50"
                      >
                        {isClaimPending ? 'Linking receipt...' : 'Link this receipt'}
                      </button>
                    ) : null}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
