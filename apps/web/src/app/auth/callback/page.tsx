'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { getSupabaseClient } from '@my-small-business/supabase/client';
import { LoadingSpinner } from '@/components/Loading';
import { FaCheckCircle, FaExclamationCircle } from 'react-icons/fa';

function AuthCallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState<string>('Processing authentication...');

  useEffect(() => {
    const handleAuthCallback = async () => {
      try {
        // Debug: Log full URL and environment info
        console.log('🔍 [AuthCallback] Page loaded');
        console.log('🔍 [AuthCallback] Full URL:', window.location.href);
        console.log('🔍 [AuthCallback] Origin:', window.location.origin);
        console.log('🔍 [AuthCallback] Pathname:', window.location.pathname);
        console.log('🔍 [AuthCallback] Hash:', window.location.hash);
        console.log('🔍 [AuthCallback] Search:', window.location.search);
        console.log('🔍 [AuthCallback] User Agent:', navigator.userAgent);
        
        const supabase = getSupabaseClient();
        
        // Get the hash from URL (Supabase auth callbacks use hash fragments)
        const hashString = window.location.hash.substring(1);
        console.log('🔍 [AuthCallback] Hash string (after #):', hashString);
        
        const hashParams = new URLSearchParams(hashString);
        const accessToken = hashParams.get('access_token');
        const refreshToken = hashParams.get('refresh_token');
        const error = hashParams.get('error');
        const errorDescription = hashParams.get('error_description');
        
        console.log('🔍 [AuthCallback] Hash params:', {
          hasAccessToken: !!accessToken,
          hasRefreshToken: !!refreshToken,
          hasError: !!error,
          error,
          errorDescription,
          accessTokenLength: accessToken?.length || 0,
          refreshTokenLength: refreshToken?.length || 0
        });

        // Also check query params (some flows use query params)
        const queryError = searchParams.get('error');
        const queryErrorDescription = searchParams.get('error_description');
        
        console.log('🔍 [AuthCallback] Query params:', {
          queryError,
          queryErrorDescription,
          allSearchParams: Object.fromEntries(searchParams.entries())
        });

        // Handle errors
        if (error || queryError) {
          const errorMsg = errorDescription || queryErrorDescription || error || queryError || 'Authentication failed';
          console.error('❌ [AuthCallback] Error detected:', errorMsg);
          console.error('❌ [AuthCallback] Error details:', { error, errorDescription, queryError, queryErrorDescription });
          setStatus('error');
          setMessage(errorMsg);
          
          // Redirect to login after showing error
          setTimeout(() => {
            console.log('🔄 [AuthCallback] Redirecting to login with error');
            router.push('/login?error=' + encodeURIComponent(errorMsg));
          }, 3000);
          return;
        }

        // If we have tokens in the hash, exchange them for a session
        if (accessToken && refreshToken) {
          console.log('✅ [AuthCallback] Found tokens in hash, setting session...');
          console.log('🔍 [AuthCallback] Token details:', {
            accessTokenPrefix: accessToken.substring(0, 20) + '...',
            refreshTokenPrefix: refreshToken.substring(0, 20) + '...'
          });
          
          const { data: sessionData, error: sessionError } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });

          if (sessionError) {
            console.error('❌ [AuthCallback] Error setting session:', sessionError);
            console.error('❌ [AuthCallback] Session error details:', {
              message: sessionError.message,
              status: sessionError.status,
              name: sessionError.name
            });
            setStatus('error');
            setMessage(sessionError.message || 'Failed to create session');
            setTimeout(() => {
              router.push('/login?error=' + encodeURIComponent(sessionError.message || 'Authentication failed'));
            }, 3000);
            return;
          }

          console.log('✅ [AuthCallback] Session set successfully');
          console.log('🔍 [AuthCallback] Session data:', {
            hasUser: !!sessionData?.user,
            userId: sessionData?.user?.id,
            userEmail: sessionData?.user?.email
          });

          if (sessionData?.user) {
            // Get user profile to determine role
            console.log('🔍 [AuthCallback] Fetching user profile...');
            const { data: profile, error: profileError } = await supabase
              .from('profiles')
              .select('role_slug')
              .eq('id', sessionData.user.id)
              .single();

            if (profileError) {
              console.error('❌ [AuthCallback] Error fetching profile:', profileError);
              console.error('❌ [AuthCallback] Profile error details:', {
                message: profileError.message,
                code: profileError.code,
                details: profileError.details
              });
              // Still allow login, just redirect to home
              setStatus('success');
              setMessage('Authentication successful! Redirecting...');
              setTimeout(() => {
                console.log('🔄 [AuthCallback] Redirecting to home (no profile)');
                router.push('/');
              }, 1500);
              return;
            }

            console.log('✅ [AuthCallback] Profile fetched:', {
              role: profile?.role_slug,
              userId: sessionData.user.id
            });

            setStatus('success');
            setMessage('Authentication successful! Redirecting...');

            // Get redirect path from query params if provided
            const redirectPath = searchParams.get('redirect') || 
              (typeof window !== 'undefined' 
                ? new URLSearchParams(window.location.search).get('redirect')
                : null);

            console.log('🔍 [AuthCallback] Redirect path:', redirectPath);

            // Redirect based on role or redirect path
            setTimeout(() => {
              let targetPath = '/';
              if (redirectPath) {
                targetPath = redirectPath;
                console.log('🔄 [AuthCallback] Redirecting to custom path:', targetPath);
              } else if (profile?.role_slug === 'admin') {
                targetPath = '/admin';
                console.log('🔄 [AuthCallback] Redirecting admin to:', targetPath);
              } else if (profile?.role_slug === 'staff') {
                targetPath = '/staff';
                console.log('🔄 [AuthCallback] Redirecting staff to:', targetPath);
              } else if (profile?.role_slug === 'customer') {
                targetPath = '/order';
                console.log('🔄 [AuthCallback] Redirecting customer to:', targetPath);
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
        console.log('🔍 [AuthCallback] Checking if user is already authenticated...');
        const { data: { user }, error: userError } = await supabase.auth.getUser();
        
        console.log('🔍 [AuthCallback] getUser result:', {
          hasUser: !!user,
          userId: user?.id,
          userEmail: user?.email,
          hasError: !!userError,
          errorMessage: userError?.message
        });
        
        if (userError || !user) {
          console.warn('⚠️ [AuthCallback] No authenticated user found');
          setStatus('error');
          setMessage('No authentication token found. Please try logging in again.');
          setTimeout(() => {
            console.log('🔄 [AuthCallback] Redirecting to login (no user)');
            router.push('/login');
          }, 3000);
          return;
        }

        // User is authenticated, get profile and redirect
        console.log('✅ [AuthCallback] User is authenticated, fetching profile...');
        const { data: profile } = await supabase
          .from('profiles')
          .select('role_slug')
          .eq('id', user.id)
          .single();

        console.log('✅ [AuthCallback] Profile for authenticated user:', {
          role: profile?.role_slug,
          userId: user.id
        });

        setStatus('success');
        setMessage('Authentication successful! Redirecting...');

        const redirectPath = searchParams.get('redirect');
        console.log('🔍 [AuthCallback] Redirect path (for authenticated user):', redirectPath);
        
        setTimeout(() => {
          let targetPath = '/';
          if (redirectPath) {
            targetPath = redirectPath;
            console.log('🔄 [AuthCallback] Redirecting authenticated user to custom path:', targetPath);
          } else if (profile?.role_slug === 'admin') {
            targetPath = '/admin';
            console.log('🔄 [AuthCallback] Redirecting authenticated admin to:', targetPath);
          } else if (profile?.role_slug === 'staff') {
            targetPath = '/staff';
            console.log('🔄 [AuthCallback] Redirecting authenticated staff to:', targetPath);
          } else if (profile?.role_slug === 'customer') {
            targetPath = '/order';
            console.log('🔄 [AuthCallback] Redirecting authenticated customer to:', targetPath);
          } else {
            console.log('🔄 [AuthCallback] Redirecting authenticated user to home (default)');
          }
          router.push(targetPath);
        }, 1500);

      } catch (err) {
        console.error('❌ [AuthCallback] Unexpected error:', err);
        console.error('❌ [AuthCallback] Error stack:', err instanceof Error ? err.stack : 'No stack trace');
        console.error('❌ [AuthCallback] Error details:', {
          message: err instanceof Error ? err.message : 'Unknown error',
          name: err instanceof Error ? err.name : 'Unknown',
          toString: String(err)
        });
        setStatus('error');
        setMessage(err instanceof Error ? err.message : 'An unexpected error occurred');
        setTimeout(() => {
          console.log('🔄 [AuthCallback] Redirecting to login after error');
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
            <FaCheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
              Success!
            </h2>
            <p className="text-gray-600 dark:text-gray-400">{message}</p>
          </>
        )}

        {status === 'error' && (
          <>
            <FaExclamationCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
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
