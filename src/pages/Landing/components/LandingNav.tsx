import { useNavigate } from 'react-router-dom'
import { Hexagon } from 'lucide-react'

interface LandingNavProps {
  scrolled: boolean
}

export default function LandingNav({ scrolled }: LandingNavProps) {
  const navigate = useNavigate()

  return (
    <nav
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-700 ${
        scrolled
          ? 'glass-strong shadow-glass-sm border-b border-white/[0.04]'
          : 'bg-transparent backdrop-blur-[0px]'
      }`}
    >
      <div className="max-w-[1200px] mx-auto px-8 h-16 flex items-center justify-between">
        {/* Left: Logo */}
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
            <Hexagon className="w-4 h-4 text-primary" />
          </div>
          <span className="text-sm font-medium text-foreground tracking-tight">
            HMI Agent Studio
          </span>
        </div>

        {/* Center: Nav links */}
        <div className="hidden md:flex items-center gap-8">
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/login')}
            className="hidden sm:block px-4 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            登录
          </button>
          <button
            onClick={() => navigate('/workspace?from=home')}
            className="px-4 py-2 text-sm font-medium rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition-all duration-200"
          >
            开始生成
          </button>
        </div>
      </div>
    </nav>
  )
}
