import { NextRequest, NextResponse } from 'next/server'
import { jwtVerify } from 'jose'

const secret = new TextEncoder().encode(process.env.JWT_SECRET)

export async function proxy(req: NextRequest) {
  const isAdminRoute =
    req.nextUrl.pathname.startsWith('/admin') ||
    req.nextUrl.pathname.startsWith('/api/admin')

  const isLoginRoute =
    req.nextUrl.pathname === '/admin/login' ||
    req.nextUrl.pathname === '/api/admin/login'

  // Allow non-admin routes and the login route to pass through
  if (!isAdminRoute || isLoginRoute) return NextResponse.next()

  const token = req.cookies.get('ufa_admin_session')?.value

  if (!token) {
    return NextResponse.redirect(new URL('/admin/login', req.url))
  }

  try {
    const { payload } = await jwtVerify(token, secret)
    if (payload.role !== 'admin') throw new Error('Not admin')
    return NextResponse.next()
  } catch {
    return NextResponse.redirect(new URL('/admin/login', req.url))
  }
}

export const config = {
  matcher: ['/admin/:path*', '/api/admin/:path*'],
}
