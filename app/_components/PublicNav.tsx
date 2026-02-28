import Link from 'next/link'

export default function PublicNav() {
  return (
    <nav className="bg-gray-950 border-b border-gray-800 sticky top-0 z-10">
      <div className="max-w-lg mx-auto px-4 flex items-center gap-6 h-12 overflow-x-auto">
        <Link href="/" className="text-white font-semibold whitespace-nowrap text-sm shrink-0">
          UFA League
        </Link>
        <Link href="/fixtures" className="text-gray-400 hover:text-white whitespace-nowrap text-sm shrink-0 transition-colors">
          Fixtures
        </Link>
        <Link href="/standings" className="text-gray-400 hover:text-white whitespace-nowrap text-sm shrink-0 transition-colors">
          Standings
        </Link>
        <Link href="/teams" className="text-gray-400 hover:text-white whitespace-nowrap text-sm shrink-0 transition-colors">
          Teams
        </Link>
        <Link href="/players" className="text-gray-400 hover:text-white whitespace-nowrap text-sm shrink-0 transition-colors">
          Players
        </Link>
        <Link href="/spirit" className="text-gray-400 hover:text-white whitespace-nowrap text-sm shrink-0 transition-colors">
          Spirit
        </Link>
        <Link href="/stats" className="text-gray-400 hover:text-white whitespace-nowrap text-sm shrink-0 transition-colors">
          Stats
        </Link>
        <Link href="/mvp" className="text-gray-400 hover:text-white whitespace-nowrap text-sm shrink-0 transition-colors">
          MVP
        </Link>
        <Link href="/gallery" className="text-gray-400 hover:text-white whitespace-nowrap text-sm shrink-0 transition-colors">
          Gallery
        </Link>
        <Link href="/rules" className="text-gray-400 hover:text-white whitespace-nowrap text-sm shrink-0 transition-colors">
          Rules
        </Link>
      </div>
    </nav>
  )
}
