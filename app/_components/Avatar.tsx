// Deterministic color from name — picks from design-system-adjacent palette
function nameToColor(name: string): string {
  const colors = [
    '#16a34a', // green-600
    '#0284c7', // sky-600
    '#7c3aed', // violet-600
    '#dc2626', // red-600
    '#d97706', // amber-600
    '#0891b2', // cyan-600
    '#db2777', // pink-600
    '#65a30d', // lime-600
    '#ea580c', // orange-600
    '#4f46e5', // indigo-600
  ]
  let hash = 0
  for (let i = 0; i < name.length; i++) {
    hash = (hash * 31 + name.charCodeAt(i)) >>> 0
  }
  return colors[hash % colors.length]
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/)
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

export function TeamAvatar({ id: _id, name, size = 32 }: { id: string; name: string; size?: number }) {
  const bg = nameToColor(name)
  const rx = Math.max(3, size * 0.15)
  const fontSize = Math.max(9, Math.round(size * 0.38))
  const textY = Math.round(size * 0.645)

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      aria-label={name}
      style={{ flexShrink: 0 }}
    >
      <rect width={size} height={size} rx={rx} fill={bg} />
      <text
        x={size / 2}
        y={textY}
        textAnchor="middle"
        fill="white"
        fontSize={fontSize}
        fontWeight="700"
        fontFamily="system-ui, -apple-system, sans-serif"
      >
        {initials(name)}
      </text>
    </svg>
  )
}

export function PlayerAvatar({ id: _id, name, size = 32 }: { id: string; name: string; size?: number }) {
  const bg = nameToColor(name)
  const rx = size / 2
  const fontSize = Math.max(9, Math.round(size * 0.38))
  const textY = Math.round(size * 0.645)

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      aria-label={name}
      style={{ flexShrink: 0 }}
    >
      <rect width={size} height={size} rx={rx} fill={bg} />
      <text
        x={size / 2}
        y={textY}
        textAnchor="middle"
        fill="white"
        fontSize={fontSize}
        fontWeight="700"
        fontFamily="system-ui, -apple-system, sans-serif"
      >
        {initials(name)}
      </text>
    </svg>
  )
}
