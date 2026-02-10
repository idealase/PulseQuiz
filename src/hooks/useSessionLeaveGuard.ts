import { useEffect, useRef } from 'react'
import { useLocation } from 'react-router-dom'

export const useSessionLeaveGuard = (enabled: boolean, message: string) => {
  const location = useLocation()
  const previousHashRef = useRef(window.location.hash)
  const isRevertingRef = useRef(false)

  useEffect(() => {
    previousHashRef.current = window.location.hash
  }, [location])

  useEffect(() => {
    if (!enabled) return

    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      event.returnValue = message
      return message
    }

    const handleHashChange = () => {
      if (isRevertingRef.current) {
        isRevertingRef.current = false
        return
      }

      const shouldLeave = window.confirm(message)
      if (!shouldLeave) {
        isRevertingRef.current = true
        window.location.hash = previousHashRef.current || '#/'
      } else {
        previousHashRef.current = window.location.hash
      }
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    window.addEventListener('hashchange', handleHashChange)

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload)
      window.removeEventListener('hashchange', handleHashChange)
    }
  }, [enabled, message])
}
