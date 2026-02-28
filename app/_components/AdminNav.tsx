'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const links = [
  { href: '/admin/dashboard', label: 'Dashboard' },
  { href: '/admin/fixtures', label: 'Fixtures' },
  { href: '/admin/setup', label: 'Setup' },
]

export default function AdminNav() {
  const pathname = usePathname()

  return (
    <nav className="bg-gray-950 border-b border-gray-800 sticky top-0 z-10">
      <div className="max-w-lg mx-auto px-4 flex items-center gap-6 h-12 overflow-x-auto">
        <span className="text-white font-semibold whitespace-nowrap text-sm shrink-0">
          Admin
        </span>
        {links.map(({ href, label }) => (
          <Link
            key={href}
            href={href}
            className={`whitespace-nowrap text-sm shrink-0 transition-colors ${
              pathname === href || pathname.startsWith(href + '/')
                ? 'text-white font-medium'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            {label}
          </Link>
        ))}
      </div>
    </nav>
  )
}
