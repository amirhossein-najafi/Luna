import { useEffect, useState } from 'react'

type InstallPromptEvent = Event & { prompt: () => Promise<void> }

export function useInstallPrompt() {
  const [event, setEvent] = useState<InstallPromptEvent | null>(null)

  useEffect(() => {
    function onPrompt(prompt: Event) {
      prompt.preventDefault()
      setEvent(prompt as InstallPromptEvent)
    }
    window.addEventListener('beforeinstallprompt', onPrompt)
    return () => window.removeEventListener('beforeinstallprompt', onPrompt)
  }, [])

  async function install() {
    if (!event) return
    await event.prompt()
    setEvent(null)
  }

  return { canInstall: event != null, install }
}
