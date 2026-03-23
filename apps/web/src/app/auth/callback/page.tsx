'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { getSupabaseClient } from '@my-small-business/supabase/client';
import { LoadingSpinner } from '@/components/Loading';
import { FaCheckCircle, FaExclamationCircle } from 'react-icons/fa';
import { Icon } from '@/components/Icon';
import posthog from 'posthog-js';

function AuthCallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState<string>('Processing authentication...');

  useEffect(() => {
    const handleAuthCallback = async () => {
      try {
        const supabase = getSupabaseClient();

        // Get the hash from URL (Supabase auth callbacks use hash fragments)
        const hashString = window.location.hash.substring(1);

        const hashParams = new URLSearchParams(hashString);
        const accessToken = hashParams.get('access_token');
        const refreshToken = hashParams.get('refresh_token');
        const error = hashParams.get('error');
        const errorDescription = hashParams.get('error_description');

        // Also check query params (some flows use query params)
        const queryError = searchParams.get('error');
        const queryErrorDescription = searchParams.get('error_description');

        // Handle errors
        if (error || queryError) {
          const errorMsg = errorDescription || queryErrorDescription || error || queryError || 'Authentication failed';
          console.error('❌ [AuthCallback] Error detected:', errorMsg);
          console.error('❌ [AuthCallback] Error details:', { error, errorDescription, queryError, queryErrorDescription });
          setStatus('error');
          setMessage(errorMsg);

          // Redirect to login after showing error
          setTimeout(() => {
            router.push('/login?error=' + encodeURIComponent(errorMsg));
          }, 3000);
          return;
        }

        // If we have tokens in the hash, exchange them for a session
        if (accessToken && refreshToken) {


          const { data: sessionData, error: sessionError } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });

          if (sessionError) {

            setStatus('error');
            setMessage(sessionError.message || 'Failed to create session');
            setTimeout(() => {
              router.push('/login?error=' + encodeURIComponent(sessionError.message || 'Authentication failed'));
            }, 3000);
            return;
          }

          if (sessionData?.user) {
            posthog.identify(sessionData.user.id, { email: sessionData.user.email });
            posthog.capture('auth_callback_completed', { auth_method: 'magic_link', email: sessionData.user.email });
            // Get user profile to determine role
            const { data: profile, error: profileError } = await supabase
              .from('profiles')
              .select('role_slug')
              .eq('id', sessionData.user.id)
              .single();

            if (profileError) {
              // Still allow login, just redirect to home
              setStatus('success');
              setMessage('Authentication successful! Redirecting...');
              setTimeout(() => {
                router.push('/');
              }, 1500);
              return;
            }

            setStatus('success');
            setMessage('Authentication successful! Redirecting...');

            // Get redirect path from query params if provided
            const redirectPath = searchParams.get('redirect') ||
              (typeof window !== 'undefined'
                ? new URLSearchParams(window.location.search).get('redirect')
                : null);

            // Redirect based on role or redirect path
            setTimeout(() => {
              let targetPath = '/';
              if (redirectPath) {
                targetPath = redirectPath;
              } else if (profile?.role_slug === 'admin') {
                targetPath = '/admin';
              } else if (profile?.role_slug === 'staff') {
                targetPath = '/staff';
              } else if (profile?.role_slug === 'customer') {
                targetPath = '/order';
              } else {
                console.log('🔄 [AuthCallback] Redirecting to home (default)');
              }
              router.push(targetPath);
            }, 1500);
            return;
          } else {
            console.warn('⚠️ [AuthCallback] Session data exists but no user found');
          }
        } else {
          console.log('⚠️ [AuthCallback] No tokens found in hash');
        }

        // If no tokens in hash, check if user is already authenticated
        const { data: { user }, error: userError } = await supabase.auth.getUser();

        if (userError || !user) {
          console.warn('⚠️ [AuthCallback] No authenticated user found');
          setStatus('error');
          setMessage('No authentication token found. Please try logging in again.');
          setTimeout(() => {
            router.push('/login');
          }, 3000);
          return;
        }

        // User is authenticated, get profile and redirect
        const { data: profile } = await supabase
          .from('profiles')
          .select('role_slug')
          .eq('id', user.id)
          .single();

        setStatus('success');
        setMessage('Authentication successful! Redirecting...');

        const redirectPath = searchParams.get('redirect');

        setTimeout(() => {
          let targetPath = '/';
          if (redirectPath) {
            targetPath = redirectPath;
          } else if (profile?.role_slug === 'admin') {
            targetPath = '/admin';
          } else if (profile?.role_slug === 'staff') {
            targetPath = '/staff';
          } else if (profile?.role_slug === 'customer') {
            targetPath = '/order';
          } else {
            console.log('🔄 [AuthCallback] Redirecting authenticated user to home (default)');
          }
          router.push(targetPath);
        }, 1500);

      } catch (err) {
        setStatus('error');
        setMessage(err instanceof Error ? err.message : 'An unexpected error occurred');
        setTimeout(() => {
          router.push('/login');
        }, 3000);
      }
    };

    handleAuthCallback();
  }, [router, searchParams]);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-neutral-900 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white dark:bg-neutral-800 rounded-lg shadow-lg p-8 text-center">
        {status === 'loading' && (
          <>
            <LoadingSpinner size="lg" className="mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
              Authenticating...
            </h2>
            <p className="text-gray-600 dark:text-gray-400">{message}</p>
          </>
        )}

        {status === 'success' && (
          <>
            <Icon icon={FaCheckCircle} className="w-16 h-16 text-green-500 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
              Success!
            </h2>
            <p className="text-gray-600 dark:text-gray-400">{message}</p>
          </>
        )}

        {status === 'error' && (
          <>
            <Icon icon={FaExclamationCircle} className="w-16 h-16 text-red-500 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
              Authentication Failed
            </h2>
            <p className="text-gray-600 dark:text-gray-400 mb-4">{message}</p>
            <p className="text-sm text-gray-500 dark:text-gray-500">
              Redirecting to login page...
            </p>
          </>
        )}
      </div>
    </div>
  );
}

export default function AuthCallbackPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 dark:bg-neutral-900 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white dark:bg-neutral-800 rounded-lg shadow-lg p-8 text-center">
          <LoadingSpinner size="lg" className="mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
            Loading...
          </h2>
        </div>
      </div>
    }>
      <AuthCallbackContent />
    </Suspense>
  );
}
