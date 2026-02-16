import { Routes, Route } from 'react-router-dom'
import { ConfigProvider } from './context/ConfigContext'
import { ThemeProvider } from './context/ThemeContext'
import { DevModeProvider } from './context/DevModeContext'
import { AITelemetryProvider } from './context/AITelemetryContext'
import DevLogOverlay from './components/DevLogOverlay'
import GlobalNav from './components/GlobalNav'
import Landing from './pages/Landing'
import HostCreate from './pages/HostCreate'
import HostSession from './pages/HostSession'
import PlayerJoin from './pages/PlayerJoin'
import PlayerSession from './pages/PlayerSession'
import AudienceJoin from './pages/AudienceJoin'
import AudienceSession from './pages/AudienceSession'
import SoloPlay from './pages/SoloPlay'
import Settings from './pages/Settings'

function App() {
  return (
    <DevModeProvider>
    <ConfigProvider>
      <AITelemetryProvider>
      <ThemeProvider>
        <div className="min-h-screen text-white">
          <GlobalNav />
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/solo" element={<SoloPlay />} />
            <Route path="/host" element={<HostCreate />} />
            <Route path="/host/:code" element={<HostSession />} />
            <Route path="/join" element={<PlayerJoin />} />
            <Route path="/join/:code" element={<PlayerJoin />} />
            <Route path="/play/:code" element={<PlayerSession />} />
            <Route path="/watch" element={<AudienceJoin />} />
            <Route path="/watch/:code" element={<AudienceJoin />} />
            <Route path="/audience/:code" element={<AudienceSession />} />
            <Route path="/settings" element={<Settings />} />
          </Routes>
          <DevLogOverlay />
        </div>
      </ThemeProvider>
      </AITelemetryProvider>
    </ConfigProvider>
    </DevModeProvider>
  )
}

export default App
