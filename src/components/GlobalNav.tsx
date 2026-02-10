import { Link, useLocation } from 'react-router-dom'

export default function GlobalNav() {
  const location = useLocation()
  const isHome = location.pathname === '/'

  return (
    <div className="fixed top-4 left-4 z-50">
      <Link
        to="/"
        aria-label="Home menu"
        className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold shadow-lg transition-all ${
          isHome
            ? 'bg-white/15 border-white/20 text-white/80'
            : 'bg-white/10 border-white/30 text-white/90 hover:bg-white/20'
        }`}
      >
        <span className="text-lg">🏠</span>
        <span>Menu</span>
      </Link>
    </div>
  )
}
