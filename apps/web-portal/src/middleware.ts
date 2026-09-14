import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  })

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
          supabaseResponse = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // IMPORTANT: Avoid writing any logic between createServerClient and
  // supabase.auth.getUser(). A simple mistake could make it very hard to debug
  // issues with users being randomly logged out.

  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Check user role and protect admin routes
  const isAuthRoute = request.nextUrl.pathname.startsWith('/login') || request.nextUrl.pathname.startsWith('/auth')
  const isPublicRoute = request.nextUrl.pathname.startsWith('/qr') || request.nextUrl.pathname.startsWith('/manifest')

  if (!user && !isAuthRoute && !isPublicRoute) {
    const redirectUrl = request.nextUrl.clone()
    redirectUrl.pathname = '/login'
    redirectUrl.searchParams.set('redirect', request.nextUrl.pathname)
    return NextResponse.redirect(redirectUrl)
  }

  if (user) {
    try {
      // Link staff.profile_id to current profile by matching email
      await supabase.rpc('link_staff_profile', { p_profile_id: user.id })
      
      const { data: profile } = await supabase
        .from('profiles')
        .select('role_slug')
        .eq('id', user.id)
        .single()
        
      if (profile?.role_slug !== 'admin' && profile?.role_slug !== 'staff') {
        if (!isAuthRoute && !isPublicRoute) {
          const redirectUrl = request.nextUrl.clone()
          redirectUrl.pathname = '/login'
          redirectUrl.searchParams.set('error', 'unauthorized')
          const response = NextResponse.redirect(redirectUrl)
          
          // Clear auth cookies to force logout from the portal
          const cookiesToClear = request.cookies.getAll().filter(c => c.name.startsWith('sb-'))
          cookiesToClear.forEach(c => {
             response.cookies.delete(c.name)
          })
          
          return response
        }
      }
    } catch (e) {
      // best-effort; ignore
    }
  }

  // IMPORTANT: You *must* return the supabaseResponse object as it is. If you're
  // creating a new response object with NextResponse.next() make sure to:
  // 1. Pass the request in it, like so:
  //    const myNewResponse = NextResponse.next({ request })
  // 2. Copy over the cookies, like so:
  //    myNewResponse.cookies.setAll(supabaseResponse.cookies.getAll())
  // 3. Change the myNewResponse object instead of the supabaseResponse object

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
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
