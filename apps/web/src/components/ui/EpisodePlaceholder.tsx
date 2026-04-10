/**
 * Designed placeholder for missing episode stills.
 * Matches the dark immersive aesthetic — not a plain grey block.
 */
import { Film } from 'lucide-react'

interface EpisodePlaceholderProps {
  seasonNumber: number
  episodeNumber: number
  className?: string
}

// Deterministic gradient per episode for visual variety
const GRADIENTS = [
  'from-violet-950/80 to-slate-900',
  'from-cyan-950/80 to-slate-900',
  'from-indigo-950/80 to-slate-900',
  'from-purple-950/80 to-slate-900',
  'from-blue-950/80 to-slate-900',
  'from-teal-950/80 to-slate-900',
]

export function EpisodePlaceholder({ seasonNumber, episodeNumber, className = '' }: EpisodePlaceholderProps) {
  const gradient = GRADIENTS[(seasonNumber + episodeNumber) % GRADIENTS.length]

  return (
    <div className={`relative w-full h-full bg-gradient-to-br ${gradient} flex flex-col items-center justify-center gap-2 ${className}`}>
      {/* Subtle grid pattern */}
      <div
        className="absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage: 'linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)',
          backgroundSize: '20px 20px',
        }}
      />
      <Film size={20} className="text-white/20 relative z-10" />
      <span className="text-[10px] font-mono text-white/20 relative z-10 tracking-widest">
        S{String(seasonNumber).padStart(2, '0')}E{String(episodeNumber).padStart(2, '0')}
      </span>
    </div>
  )
}
