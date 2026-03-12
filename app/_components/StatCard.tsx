interface StatCardProps {
  label: string
  value: string | number
  highlight?: boolean   // renders value in accent green
  size?: 'sm' | 'md'   // 'sm' = text-xl, 'md' = text-2xl (default)
}

export default function StatCard({ label, value, highlight = false, size = 'md' }: StatCardProps) {
  const valueSize = size === 'sm' ? 'text-xl' : 'text-2xl'
  return (
    <div className="bg-gray-800 rounded-lg py-2 text-center">
      <div className={`${valueSize} font-bold tabular-nums ${highlight ? 'text-green-400' : 'text-white'}`}>
        {value}
      </div>
      <div className="text-xs text-gray-400 mt-0.5">{label}</div>
    </div>
  )
}
