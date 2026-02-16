import { Link, useLocation } from 'react-router-dom'

export default function GlobalNav() {
  const location = useLocation()
  const isHome = location.pathname === '/'
  const isSettings = location.pathname === '/settings'

  return (
    <>
      <div className="fixed top-3 left-3 sm:top-4 sm:left-4 z-50">
        <Link
          to="/"
          aria-label="Home menu"
          className={`inline-flex items-center gap-1.5 sm:gap-2 rounded-full border px-3 py-1.5 sm:px-4 sm:py-2 text-sm font-semibold shadow-lg transition-all ${
            isHome
              ? 'bg-white/15 border-white/20 text-white/80'
              : 'bg-white/10 border-white/30 text-white/90 hover:bg-white/20'
          }`}
        >
          <span className="text-base sm:text-lg">🏠</span>
          <span className="hidden sm:inline">Menu</span>
        </Link>
      </div>

      <div className="fixed top-3 right-3 sm:top-4 sm:right-4 z-50">
        <Link
          to="/settings"
          state={{ from: location.pathname }}
          aria-label="Settings"
          className={`inline-flex items-center justify-center w-9 h-9 sm:w-10 sm:h-10 rounded-full border shadow-lg transition-all ${
            isSettings
              ? 'bg-white/20 border-white/30 text-white'
              : 'bg-white/10 border-white/20 text-white/70 hover:bg-white/20 hover:text-white'
          }`}
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" />
          </svg>
        </Link>
      </div>
    </>
  )
}
