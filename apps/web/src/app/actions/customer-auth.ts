'use server';

import { createServiceRoleClient } from '@my-small-business/supabase/server';

// Sign up a new customer
export async function signUpCustomer(
  email: string,
  password: string,
  fullName?: string,
  phone?: string
): Promise<{ success: boolean; error?: string; userId?: string }> {
  console.log('🚀 [CustomerAuth] Starting signup process...', {
    email: email?.substring(0, 5) + '***',
    hasPassword: !!password,
    passwordLength: password?.length,
    hasFullName: !!fullName,
    hasPhone: !!phone
  });

  try {
    const supabase = await createServiceRoleClient();
    console.log('✅ [CustomerAuth] Service role client created');

    // Validate inputs
    if (!email || !email.trim()) {
      console.error('❌ [CustomerAuth] Email is required');
      return { success: false, error: 'Email is required' };
    }

    if (!password || password.length < 6) {
      console.error('❌ [CustomerAuth] Password is too short');
      return { success: false, error: 'Password must be at least 6 characters' };
    }

    const normalizedEmail = email.trim().toLowerCase();
    console.log('📧 [CustomerAuth] Normalized email:', normalizedEmail);

    // Check if user already exists
    console.log('🔍 [CustomerAuth] Checking if user already exists...');
    const { data: { users }, error: checkError } = await supabase.auth.admin.listUsers();
    
    if (checkError) {
      console.error('❌ [CustomerAuth] Error checking existing users:', {
        message: checkError.message,
        status: checkError.status,
        name: checkError.name
      });
      // Continue anyway - might be a transient error
    } else {
      console.log('📋 [CustomerAuth] Found', users?.length || 0, 'existing users');
      if (users && users.length > 0) {
        const existingUser = users.find(u => u.email?.toLowerCase() === normalizedEmail);
        if (existingUser) {
          console.error('❌ [CustomerAuth] User already exists:', {
            id: existingUser.id,
            email: existingUser.email,
            created_at: existingUser.created_at
          });
          return { success: false, error: 'An account with this email already exists' };
        }
      }
      console.log('✅ [CustomerAuth] Email is available');
    }

    // Create auth user
    console.log('🔄 [CustomerAuth] Creating auth user...', {
      email: normalizedEmail,
      email_confirm: true,
      hasMetadata: !!(fullName || phone)
    });

    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email: normalizedEmail,
      password,
      email_confirm: true, // Auto-confirm for customer signups
      user_metadata: {
        full_name: fullName,
        phone: phone
      }
    });

    if (authError) {
      console.error('❌ [CustomerAuth] Error creating customer auth user:', {
        message: authError.message,
        status: authError.status,
        name: authError.name,
        code: (authError as any).code
      });
      
      // Provide user-friendly error messages
      let errorMessage = authError.message;
      if (authError.message.includes('already registered') || authError.message.includes('already exists')) {
        errorMessage = 'An account with this email already exists. Please sign in instead.';
      } else if (authError.message.includes('invalid email')) {
        errorMessage = 'Please enter a valid email address.';
      } else if (authError.message.includes('password')) {
        errorMessage = 'Password does not meet requirements. Please use a stronger password (at least 6 characters).';
      }
      
      return { success: false, error: errorMessage };
    }

    if (!authData) {
      console.error('❌ [CustomerAuth] No authData returned from createUser');
      return { success: false, error: 'Failed to create user account. No data returned.' };
    }

    if (!authData.user) {
      console.error('❌ [CustomerAuth] No user in authData:', authData);
      return { success: false, error: 'Failed to create user account. User data missing.' };
    }

    console.log('✅ [CustomerAuth] Auth user created successfully:', {
      id: authData.user.id,
      email: authData.user.email,
      email_confirmed: !!authData.user.email_confirmed_at,
      created_at: authData.user.created_at
    });

    // Wait a moment for the trigger to create the profile
    console.log('⏳ [CustomerAuth] Waiting for profile trigger...');
    await new Promise(resolve => setTimeout(resolve, 500));

    // Check if profile was created by trigger
    console.log('🔍 [CustomerAuth] Checking if profile was created by trigger...');
    const { data: existingProfile, error: profileCheckError } = await supabase
      .from('profiles')
      .select('id, email, role_slug, full_name, phone')
      .eq('id', authData.user.id)
      .single();

    if (profileCheckError) {
      if (profileCheckError.code === 'PGRST116') {
        console.log('⚠️ [CustomerAuth] Profile not found (expected if trigger hasn\'t run yet)');
      } else {
        console.error('❌ [CustomerAuth] Error checking profile:', {
          message: profileCheckError.message,
          code: profileCheckError.code,
          details: profileCheckError.details,
          hint: profileCheckError.hint
        });
      }
    } else {
      console.log('📋 [CustomerAuth] Profile found (created by trigger):', {
        id: existingProfile.id,
        email: existingProfile.email,
        role: existingProfile.role_slug
      });
    }

    // Update or create profile with customer role and additional info
    if (existingProfile) {
      console.log('📋 [CustomerAuth] Profile exists, updating to customer role...');
      const { data: updatedProfile, error: profileError } = await supabase
        .from('profiles')
        .update({
          role_slug: 'customer',
          full_name: fullName || null,
          phone: phone || null
        })
        .eq('id', authData.user.id)
        .select()
        .single();

      if (profileError) {
        console.error('❌ [CustomerAuth] Error updating customer profile:', {
          message: profileError.message,
          code: profileError.code,
          details: profileError.details
        });
        return { success: false, error: 'Account created but failed to set customer role. Please contact support.' };
      }
      console.log('✅ [CustomerAuth] Profile updated successfully:', {
        id: updatedProfile?.id,
        role: updatedProfile?.role_slug,
        email: updatedProfile?.email
      });
    } else {
      console.log('📋 [CustomerAuth] Profile not found, creating manually...');
      const { data: newProfile, error: profileError } = await supabase
        .from('profiles')
        .insert({
          id: authData.user.id,
          email: authData.user.email,
          role_slug: 'customer',
          full_name: fullName || null,
          phone: phone || null
        })
        .select()
        .single();

      if (profileError) {
        console.error('❌ [CustomerAuth] Error creating customer profile:', {
          message: profileError.message,
          code: profileError.code,
          details: profileError.details,
          hint: profileError.hint
        });
        return { success: false, error: `Account created but failed to create profile: ${profileError.message}. Please contact support.` };
      }
      console.log('✅ [CustomerAuth] Profile created successfully:', {
        id: newProfile?.id,
        role: newProfile?.role_slug,
        email: newProfile?.email
      });
    }

    // Verify the account was created correctly
    console.log('🔍 [CustomerAuth] Verifying account creation...');
    const { data: verifyProfile, error: verifyError } = await supabase
      .from('profiles')
      .select('id, email, role_slug, full_name, phone, created_at')
      .eq('id', authData.user.id)
      .single();

    if (verifyError) {
      console.error('❌ [CustomerAuth] Failed to verify profile creation:', {
        message: verifyError.message,
        code: verifyError.code
      });
      return { success: false, error: 'Account created but verification failed. Please try logging in.' };
    }

    if (!verifyProfile) {
      console.error('❌ [CustomerAuth] Profile verification returned no data');
      return { success: false, error: 'Account created but profile not found. Please contact support.' };
    }

    console.log('✅ [CustomerAuth] Profile verified:', {
      id: verifyProfile.id,
      email: verifyProfile.email,
      role: verifyProfile.role_slug,
      hasFullName: !!verifyProfile.full_name,
      hasPhone: !!verifyProfile.phone
    });

    if (verifyProfile.role_slug !== 'customer') {
      console.error('❌ [CustomerAuth] Profile role is not customer:', verifyProfile.role_slug);
      return { success: false, error: `Account created but role assignment failed. Role is: ${verifyProfile.role_slug}. Please contact support.` };
    }

    // Verify user exists in auth.users
    console.log('🔍 [CustomerAuth] Verifying user in auth.users...');
    const { data: { user: verifyUser }, error: verifyUserError } = await supabase.auth.admin.getUserById(authData.user.id);
    
    if (verifyUserError) {
      console.error('❌ [CustomerAuth] Failed to verify user in auth.users:', verifyUserError);
      return { success: false, error: 'Account created but user verification failed. Please try logging in.' };
    }

    if (!verifyUser) {
      console.error('❌ [CustomerAuth] User not found in auth.users after creation');
      return { success: false, error: 'Account creation may have failed. Please try again.' };
    }

    console.log('✅ [CustomerAuth] User verified in auth.users:', {
      id: verifyUser.id,
      email: verifyUser.email,
      email_confirmed: !!verifyUser.email_confirmed_at
    });

    console.log('✅ [CustomerAuth] Customer account fully created and verified!');
    return { success: true, userId: authData.user.id };
  } catch (error) {
    console.error('❌ [CustomerAuth] Unexpected error signing up customer:', {
      error,
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    });
    return { success: false, error: `An unexpected error occurred: ${error instanceof Error ? error.message : 'Unknown error'}` };
  }
}

// Note: Customer sign-in should be done client-side using getSupabaseClient()
// This file only contains server-side signup functionality

// Check if email is available for customer signup
export async function checkEmailAvailable(email: string): Promise<{ available: boolean; error?: string }> {
  try {
    const supabase = await createServiceRoleClient();

    const { data: { users }, error: authError } = await supabase.auth.admin.listUsers();
    if (authError) {
      return { available: false, error: 'Failed to check email availability' };
    }

    const existingUser = users?.find(u => u.email?.toLowerCase() === email.toLowerCase());
    return { available: !existingUser };
  } catch (error) {
    console.error('Unexpected error checking email:', error);
    return { available: false, error: 'An unexpected error occurred' };
  }
}
