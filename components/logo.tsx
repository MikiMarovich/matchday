import { Trophy } from 'lucide-react'

export function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <div className="logo-mark">
        <Trophy />
      </div>
      {!compact && (
        <span className="text-lg font-black tracking-tight text-white">
          MATCH<span className="text-lime">DAY</span>
        </span>
      )}
    </div>
  )
}
