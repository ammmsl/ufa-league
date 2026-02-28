import { ImageResponse } from 'next/og'
import { type NextRequest } from 'next/server'

export const runtime = 'edge'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)

  const home      = searchParams.get('home') ?? 'Home'
  const away      = searchParams.get('away') ?? 'Away'
  const matchweek = searchParams.get('mw')
  const sh        = searchParams.get('sh')
  const sa        = searchParams.get('sa')

  const isPlayed  = sh !== null && sa !== null
  const homeScore = isPlayed ? Number(sh) : null
  const awayScore = isPlayed ? Number(sa) : null
  const homeWon   = isPlayed && homeScore! > awayScore!
  const awayWon   = isPlayed && awayScore! > homeScore!

  return new ImageResponse(
    (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          width: '100%',
          height: '100%',
          backgroundColor: '#09090b',
          padding: '64px 72px',
          justifyContent: 'center',
          alignItems: 'stretch',
        }}
      >
        {/* Top label */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'center',
            color: '#6b7280',
            fontSize: 22,
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            marginBottom: 48,
          }}
        >
          {matchweek ? `Matchweek ${matchweek} · ` : ''}UFA League
        </div>

        {/* Score row */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 24,
          }}
        >
          {/* Home team */}
          <div
            style={{
              display: 'flex',
              flex: 1,
              flexDirection: 'column',
              alignItems: 'flex-start',
            }}
          >
            <div
              style={{
                color: isPlayed ? (homeWon ? '#ffffff' : '#6b7280') : '#ffffff',
                fontSize: 38,
                fontWeight: 700,
                lineHeight: 1.2,
              }}
            >
              {home}
            </div>
          </div>

          {/* Centre: score or vs */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              minWidth: 200,
            }}
          >
            {isPlayed ? (
              <div
                style={{
                  color: '#ffffff',
                  fontSize: 88,
                  fontWeight: 800,
                  letterSpacing: '-0.02em',
                  fontVariantNumeric: 'tabular-nums',
                  display: 'flex',
                  gap: 16,
                  alignItems: 'center',
                }}
              >
                <span>{homeScore}</span>
                <span style={{ color: '#374151', fontSize: 60 }}>–</span>
                <span>{awayScore}</span>
              </div>
            ) : (
              <div
                style={{
                  color: '#374151',
                  fontSize: 52,
                  fontWeight: 300,
                }}
              >
                vs
              </div>
            )}
          </div>

          {/* Away team */}
          <div
            style={{
              display: 'flex',
              flex: 1,
              flexDirection: 'column',
              alignItems: 'flex-end',
            }}
          >
            <div
              style={{
                color: isPlayed ? (awayWon ? '#ffffff' : '#6b7280') : '#ffffff',
                fontSize: 38,
                fontWeight: 700,
                lineHeight: 1.2,
                textAlign: 'right',
              }}
            >
              {away}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'center',
            color: '#4ade80',
            fontSize: 18,
            marginTop: 56,
            letterSpacing: '0.04em',
          }}
        >
          5v5 Mixed Ultimate Frisbee · Malé, Maldives
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
    }
  )
}
