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

            {order ? (
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
                  <div className="mt-6 grid gap-5">
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
