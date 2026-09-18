import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

const allowedOrigins = [
  'https://pappasfishnchips.com.au',
  'https://www.pappasfishnchips.com.au',
  'https://app.pappasfishnchips.com.au',
  'http://localhost:3000',
  'https://localhost:3000',
  'http://localhost:3001',
  'https://localhost:3001'
]

export async function middleware(request: NextRequest) {
  const origin = request.headers.get('origin') ?? ''

  // Allow explicitly listed origins, or any Vercel preview URLs
  const isAllowedOrigin = allowedOrigins.includes(origin) || origin.endsWith('.vercel.app')

  // 1. Handle Preflight (OPTIONS) requests immediately
  if (request.method === 'OPTIONS') {
    const preflightHeaders = new Headers()
    if (isAllowedOrigin) {
      preflightHeaders.set('Access-Control-Allow-Origin', origin)
    }
    preflightHeaders.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH')
    preflightHeaders.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-requested-with')
    preflightHeaders.set('Access-Control-Allow-Credentials', 'true')
    return new NextResponse(null, { status: 200, headers: preflightHeaders })
  }

  let supabaseResponse = NextResponse.next({
    request,
  })

  // 2. Set CORS headers on the actual response
  if (isAllowedOrigin) {
    supabaseResponse.headers.set('Access-Control-Allow-Origin', origin)
    supabaseResponse.headers.set('Access-Control-Allow-Credentials', 'true')
    supabaseResponse.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH')
    supabaseResponse.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-requested-with')
  }

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => request.cookies.set(name, value))
          // IMPORTANT: we must preserve our custom headers when recreating the response
          const newResponse = NextResponse.next({ request })

          // Copy CORS headers over to the new response
          if (isAllowedOrigin) {
            newResponse.headers.set('Access-Control-Allow-Origin', origin)
            newResponse.headers.set('Access-Control-Allow-Credentials', 'true')
            newResponse.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH')
            newResponse.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-requested-with')
          }

          supabaseResponse = newResponse

          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Link staff.profile_id to current profile by matching email
  try {
    if (user?.id) {
      await supabase.rpc('link_staff_profile', { p_profile_id: user.id })
    }
  } catch (e) {
    // best-effort; ignore
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * Feel free to modify this pattern to include more paths.
     */
    '/((?!_next/static|_next/image|favicon.ico|api/marketplace/extension-sync|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
