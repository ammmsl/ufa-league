import { NextRequest, NextResponse } from 'next/server'
import { jwtVerify } from 'jose'

const secret = new TextEncoder().encode(process.env.JWT_SECRET)
const COOKIE = 'ufa_admin_session'

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl

  const token = req.cookies.get(COOKIE)?.value
  let isAuth = false
  if (token) {
    try {
      const { payload } = await jwtVerify(token, secret)
      isAuth = payload.role === 'admin'
    } catch { /* invalid token */ }
  }

  // API routes — return 401 JSON (consumed by fetch(), no redirect)
  if (pathname.startsWith('/api/admin/')) {
    if (!isAuth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    return NextResponse.next()
  }

  // Admin UI pages — redirect to login
  if (pathname.startsWith('/admin/') && !pathname.startsWith('/admin/login')) {
    if (!isAuth) return NextResponse.redirect(new URL('/admin/login', req.url))
    return NextResponse.next()
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/admin/:path*', '/api/admin/:path*'],
}
