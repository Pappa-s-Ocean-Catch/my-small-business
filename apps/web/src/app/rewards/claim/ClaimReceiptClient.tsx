'use client';

import { useEffect, useMemo, useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { getSupabaseClient } from '@my-small-business/supabase/client';
import { claimReceiptOrder, getReceiptClaimDetails } from '@/app/actions/receipt-claims';
import { signUpCustomer } from '@/app/actions/customer-auth';
import { canSendMagicLink } from '@/app/actions/auth';
import { sendMagicLinkInvite } from '@/app/actions/email';

type ClaimState = Awaited<ReturnType<typeof getReceiptClaimDetails>>;

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
  const [isClaimPending, startClaimTransition] = useTransition();
  const [isSignupPending, startSignupTransition] = useTransition();
  const [isMagicPending, startMagicTransition] = useTransition();

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

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-10 text-gray-900">
      <div className="mx-auto max-w-2xl rounded-3xl bg-white p-6 shadow-sm ring-1 ring-black/5 sm:p-8">
        <div className="mb-6">
          <p className="text-sm font-medium uppercase tracking-[0.24em] text-amber-700">Receipt Rewards</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">Link this in-store order to your account</h1>
          <p className="mt-3 text-sm text-gray-600">
            This receipt link can only be claimed once, and it cannot be guessed from an order number.
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
            <div className="rounded-2xl border border-gray-200 bg-gray-50 p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-sm text-gray-500">Order</p>
                  <p className="text-xl font-semibold">{order.orderNumber}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-gray-500">Total</p>
                  <p className="text-xl font-semibold">${order.total.toFixed(2)}</p>
                </div>
              </div>
              <div className="mt-4 grid gap-2 text-sm text-gray-600 sm:grid-cols-2">
                <p>Placed: {new Date(order.createdAt).toLocaleString()}</p>
                <p>Status: {order.paymentStatus.toUpperCase()} / {order.orderStatus.toUpperCase()}</p>
                {order.customerName ? <p>Name on receipt: {order.customerName}</p> : <p>Guest in-store order</p>}
                <p>Estimated points: {order.rewardPointsEstimate.toLocaleString()}</p>
              </div>
            </div>

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
                This receipt has already been linked to another customer account.
              </div>
            ) : claimState.requiresAuth ? (
              <div className="mt-6 grid gap-6">
                <div className="rounded-2xl border border-gray-200 p-5">
                  <h2 className="text-lg font-semibold">Already have an account?</h2>
                  <p className="mt-2 text-sm text-gray-600">
                    Sign in and we&apos;ll bring you straight back here to finish linking this order.
                  </p>
                  <div className="mt-4 flex flex-wrap gap-3">
                    <Link
                      href={`/login?redirect=${encodeURIComponent(redirectPath)}`}
                      className="inline-flex h-11 items-center justify-center rounded-xl bg-black px-5 text-sm font-medium text-white"
                    >
                      Login with password
                    </Link>
                  </div>
                </div>

                <div className="rounded-2xl border border-gray-200 p-5">
                  <h2 className="text-lg font-semibold">Email magic link</h2>
                  <p className="mt-2 text-sm text-gray-600">
                    Prefer a one-tap sign-in link? Enter your email and we&apos;ll return you to this receipt after login.
                  </p>
                  <div className="mt-4 grid gap-3">
                    <input
                      type="email"
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                      placeholder="you@email.com"
                      className="h-11 rounded-xl border border-gray-300 px-3 outline-none ring-0 focus:border-black"
                    />
                    <button
                      type="button"
                      onClick={handleMagicLink}
                      disabled={!email || isMagicPending}
                      className="h-11 rounded-xl border border-black px-5 text-sm font-medium disabled:opacity-50"
                    >
                      {isMagicPending ? 'Sending...' : 'Send magic link'}
                    </button>
                  </div>
                </div>

                <div className="rounded-2xl border border-gray-200 p-5">
                  <h2 className="text-lg font-semibold">Create an account</h2>
                  <p className="mt-2 text-sm text-gray-600">
                    Set up your rewards account now and link this order immediately.
                  </p>
                  <div className="mt-4 grid gap-3">
                    <input
                      type="text"
                      value={fullName}
                      onChange={(event) => setFullName(event.target.value)}
                      placeholder="Full name"
                      className="h-11 rounded-xl border border-gray-300 px-3 outline-none ring-0 focus:border-black"
                    />
                    <input
                      type="email"
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                      placeholder="Email"
                      className="h-11 rounded-xl border border-gray-300 px-3 outline-none ring-0 focus:border-black"
                    />
                    <input
                      type="tel"
                      value={phone}
                      onChange={(event) => setPhone(event.target.value)}
                      placeholder="Phone (optional)"
                      className="h-11 rounded-xl border border-gray-300 px-3 outline-none ring-0 focus:border-black"
                    />
                    <input
                      type="password"
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      placeholder="Password"
                      className="h-11 rounded-xl border border-gray-300 px-3 outline-none ring-0 focus:border-black"
                    />
                    <button
                      type="button"
                      onClick={handleCreateAccount}
                      disabled={!email || !password || isSignupPending}
                      className="h-11 rounded-xl bg-amber-500 px-5 text-sm font-medium text-black disabled:opacity-50"
                    >
                      {isSignupPending ? 'Creating account...' : 'Create account and link receipt'}
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="mt-6 rounded-2xl border border-gray-200 p-5">
                <h2 className="text-lg font-semibold">
                  {order.claimedByCurrentUser ? 'Receipt already linked' : 'Ready to link'}
                </h2>
                <p className="mt-2 text-sm text-gray-600">
                  {order.claimedByCurrentUser
                    ? 'This in-store order is already attached to your account.'
                    : 'Link this in-store receipt now so the order stays on your account and rewards can be tracked.'}
                </p>
                {!order.claimedByCurrentUser ? (
                  <button
                    type="button"
                    onClick={handleClaim}
                    disabled={isClaimPending}
                    className="mt-4 inline-flex h-11 items-center justify-center rounded-xl bg-black px-5 text-sm font-medium text-white disabled:opacity-50"
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
  );
}
