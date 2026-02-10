export type SessionRole = 'host' | 'player' | 'observer'

export type ResumeInfo = {
  code: string
  role: SessionRole
  path: string
}

const LAST_SESSION_KEY = 'last_session'

const normalizeCode = (code: string) => code.trim().toUpperCase()

export const setLastSession = (role: SessionRole, code: string) => {
  const payload = { role, code: normalizeCode(code) }
  sessionStorage.setItem(LAST_SESSION_KEY, JSON.stringify(payload))
}

export const clearLastSession = () => {
  sessionStorage.removeItem(LAST_SESSION_KEY)
}

export const getLastSession = (): { code: string; role: SessionRole } | null => {
  const raw = sessionStorage.getItem(LAST_SESSION_KEY)
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as { code?: string; role?: SessionRole }
    if (!parsed.code || !parsed.role) return null
    return { code: normalizeCode(parsed.code), role: parsed.role }
  } catch {
    return null
  }
}

export const getResumeInfo = (): ResumeInfo | null => {
  const last = getLastSession()
  if (!last) return null

  const { code, role } = last
  if (role === 'host' && sessionStorage.getItem(`host_${code}`)) {
    return { code, role, path: `/host/${code}` }
  }
  if (role === 'player' && sessionStorage.getItem(`player_${code}`)) {
    return { code, role, path: `/play/${code}` }
  }
  if (role === 'observer' && sessionStorage.getItem(`observer_${code}`)) {
    return { code, role, path: `/audience/${code}` }
  }

  return null
}

export const hasActiveSession = () => Boolean(getResumeInfo())
