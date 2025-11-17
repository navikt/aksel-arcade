import { useEffect, useRef, useState } from 'react'
import { saveProject, type SaveResult } from '@/services/storage'
import type { Project } from '@/types/project'

export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error'

/**
 * Auto-saves project to localStorage with 1-second debounce
 */
export const useAutoSave = (project: Project) => {
  const timeoutRef = useRef<number | undefined>(undefined)
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle')
  const [saveError, setSaveError] = useState<string | null>(null)

  useEffect(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
    }
    setSaveStatus('idle')

    // Debounce by 1 second
    timeoutRef.current = window.setTimeout(() => {
      setSaveStatus('saving')

      const result: SaveResult = saveProject(project)

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
  }, [project])

  return { saveStatus, saveError }
}
