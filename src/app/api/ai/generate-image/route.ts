import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { generateProductImage } from '@/lib/google-genai';

export async function POST(request: NextRequest) {
  try {
    // Get the authorization header
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Missing or invalid authorization header' }, { status: 401 });
    }

    const token = authHeader.split(' ')[1];
    
    // Use service role client to verify the token
    const supabase = await createServiceRoleClient();
    
    // Verify the JWT token
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    
    if (userError) {
      console.error('Auth error:', userError);
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }
    
    if (!user) {
      console.error('No user found');
      return NextResponse.json({ error: 'Unauthorized - Invalid user' }, { status: 401 });
    }

    // Check if user is admin
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role_slug')
      .eq('id', user.id)
      .single();

    if (profileError) {
      console.error('Profile error:', profileError);
      return NextResponse.json({ error: 'Profile lookup failed' }, { status: 500 });
    }

    if (!profile || profile.role_slug !== 'admin') {
      console.error('User is not admin:', profile?.role_slug);
      return NextResponse.json({ error: 'Forbidden - Admin access required' }, { status: 403 });
    }

    // Parse request body
    const body = await request.json();
    const { 
      productName, 
      description, 
      ingredients, 
      context, 
      referenceImageBase64,
      maxSizeKB = 200 
    } = body;

    if (!productName) {
      return NextResponse.json({ error: 'Product name is required' }, { status: 400 });
    }

    // Generate the image
    const result = await generateProductImage({
      productName,
      description,
      ingredients,
      context,
      referenceImageBase64,
      maxSizeKB
    });

    if (result.error) {
      return NextResponse.json({ error: result.error }, { status: 500 });
    }

    return NextResponse.json({ 
      success: true, 
      imageBase64: result.imageBase64 
    });

  } catch (error) {
    console.error('AI image generation error:', error);
    return NextResponse.json({ 
      error: 'Failed to generate image' 
    }, { status: 500 });
  }
}
