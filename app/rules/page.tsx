import Link from 'next/link'
import PublicNav from '../_components/PublicNav'

export default function RulesPage() {
  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <PublicNav />
      <div className="max-w-lg mx-auto px-4 pb-16 pt-6 space-y-8">
        <h1 className="text-2xl font-bold">Rules &amp; About</h1>

        {/* Section 1 */}
        <section>
          <h2 className="text-base font-semibold text-white mb-2">What is Ultimate Frisbee?</h2>
          <p className="text-sm text-gray-400 leading-relaxed">
            Ultimate Frisbee is a non-contact team sport played with a flying disc. Two teams
            compete to advance the disc down the field and score by catching it in the opposing
            end zone. Unlike most team sports, Ultimate has no referees — players are responsible
            for making their own calls, guided by the Spirit of the Game.
          </p>
        </section>

        {/* Section 2 */}
        <section>
          <h2 className="text-base font-semibold text-white mb-2">How We Play (5v5 Mixed)</h2>
          <ul className="space-y-2 text-sm text-gray-400">
            <li className="flex gap-2">
              <span className="text-gray-600 shrink-0">·</span>
              <span><span className="text-gray-200">No referees.</span> Spirit of the Game governs all disputes — players call their own fouls and violations honestly.</span>
            </li>
            <li className="flex gap-2">
              <span className="text-gray-600 shrink-0">·</span>
              <span><span className="text-gray-200">No running with the disc.</span> The thrower must establish a pivot foot and pass within a stall count of 10 seconds.</span>
            </li>
            <li className="flex gap-2">
              <span className="text-gray-600 shrink-0">·</span>
              <span><span className="text-gray-200">Score by catching in the end zone.</span> A point is scored when a player catches the disc in the opposing team&apos;s end zone.</span>
            </li>
            <li className="flex gap-2">
              <span className="text-gray-600 shrink-0">·</span>
              <span><span className="text-gray-200">Win condition.</span> First to 11 points, or the team leading when the 30-minute time cap expires.</span>
            </li>
            <li className="flex gap-2">
              <span className="text-gray-600 shrink-0">·</span>
              <span><span className="text-gray-200">Mixed gender.</span> Teams must field at least 2 players of each gender on the field at all times.</span>
            </li>
          </ul>
        </section>

        {/* Section 3 */}
        <section>
          <h2 className="text-base font-semibold text-white mb-2">The Spirit of the Game</h2>
          <p className="text-sm text-gray-400 leading-relaxed mb-3">
            Spirit of the Game (SOTG) is the foundation of Ultimate. It places the responsibility
            of fair play on every player. Competitive play is encouraged, but never at the expense
            of respect, joy, or camaraderie.
          </p>
          <p className="text-sm text-gray-400 leading-relaxed">
            In this league, after each match each team nominates one player from the opposing team
            who best demonstrated Spirit of the Game — through fair calls, positive attitude, and
            great sportsmanship. These nominations are tallied on the{' '}
            <Link href="/spirit" className="text-green-400 hover:text-green-300 transition-colors">
              Spirit leaderboard
            </Link>
            .
          </p>
        </section>

        {/* Section 4 */}
        <section>
          <h2 className="text-base font-semibold text-white mb-2">League Format</h2>
          <ul className="space-y-2 text-sm text-gray-400">
            <li className="flex gap-2">
              <span className="text-gray-600 shrink-0">·</span>
              <span><span className="text-gray-200">Double round-robin.</span> 5 teams, each playing every other team twice — 20 matches total across 10 matchweeks.</span>
            </li>
            <li className="flex gap-2">
              <span className="text-gray-600 shrink-0">·</span>
              <span><span className="text-gray-200">Game days.</span> Tuesday and Friday at 20:30 MVT, Vilimale Turf.</span>
            </li>
            <li className="flex gap-2">
              <span className="text-gray-600 shrink-0">·</span>
              <span><span className="text-gray-200">Points.</span> Win = 3 pts · Draw = 1 pt · Loss = 0 pts.</span>
            </li>
            <li className="flex gap-2">
              <span className="text-gray-600 shrink-0">·</span>
              <span><span className="text-gray-200">Tiebreaker order.</span> Goal difference → Head-to-head record → Goals scored.</span>
            </li>
          </ul>
        </section>
      </div>
    </div>
  )
}
