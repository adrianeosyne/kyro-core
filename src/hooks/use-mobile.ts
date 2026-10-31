import * as React from "react"

const MOBILE_BREAKPOINT = 768

export function useIsMobile() {
  const [isMobile, setIsMobile] = React.useState<boolean | undefined>(undefined)

  React.useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`)
    const update = () => setIsMobile(window.innerWidth < MOBILE_BREAKPOINT)
    // Defer the first read so the effect body never updates state
    // synchronously; the media-query listener handles every change after that.
    const initial = window.setTimeout(update, 0)
    mql.addEventListener("change", update)
    return () => {
      window.clearTimeout(initial)
      mql.removeEventListener("change", update)
    }
  }, [])

  return !!isMobile
}
