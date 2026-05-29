import { useEffect, useRef, useState } from 'react'
import {
  saveProject,
  type SaveResult,
  type WebArcadeWorkingCopyPreferences,
} from '@/services/storage'
import type { Project } from '@/types/project'

export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error'

/**
 * Auto-saves the current Web Arcade working copy to tab-scoped storage.
 */
export const useAutoSave = (project: Project, preferences: WebArcadeWorkingCopyPreferences) => {
  const timeoutRef = useRef<number | undefined>(undefined)
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle')
  const [saveError, setSaveError] = useState<string | null>(null)
  const { panelOrder, theme } = preferences

  useEffect(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
    }
    setSaveStatus('idle')

    // Debounce by 1 second
    timeoutRef.current = window.setTimeout(() => {
      setSaveStatus('saving')

      const result: SaveResult = saveProject(project, {
        preferences: {
          panelOrder,
          theme,
        },
      })

      if (result.success) {
        setSaveStatus('saved')
        setSaveError(null)

        if (result.warning) {
          console.warn(result.warning)
        }

        // Reset to idle after 2 seconds
        setTimeout(() => setSaveStatus('idle'), 2000)
      } else {
        setSaveStatus('error')
        setSaveError(result.error || 'Unknown error')
        console.error('Auto-save failed:', result.error)
      }
    }, 1000)

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [panelOrder, project, theme])

  return { saveStatus, saveError }
}
