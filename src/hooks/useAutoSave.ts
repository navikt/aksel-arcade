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
  const latestProjectRef = useRef(project)
  const latestPreferencesRef = useRef(preferences)
  const hasInitializedPreviewFullscreenRef = useRef(false)
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle')
  const [saveError, setSaveError] = useState<string | null>(null)
  const { theme, panelOrder, multiPageEnabled, pagePanelOpen, selectedEditTarget, previewFullscreen } =
    preferences

  useEffect(() => {
    latestProjectRef.current = project
  }, [project])

  useEffect(() => {
    latestPreferencesRef.current = preferences
  }, [preferences])

  useEffect(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
    }
    setSaveStatus('idle')

    // Debounce by 1 second
    timeoutRef.current = window.setTimeout(() => {
      setSaveStatus('saving')

      const result: SaveResult = saveProject(project, { preferences: latestPreferencesRef.current })

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
  }, [multiPageEnabled, pagePanelOpen, panelOrder, project, selectedEditTarget, theme])

  useEffect(() => {
    if (!hasInitializedPreviewFullscreenRef.current) {
      hasInitializedPreviewFullscreenRef.current = true
      return
    }

    const result = saveProject(latestProjectRef.current, {
      preferences: latestPreferencesRef.current,
      updateLastModified: false,
    })

    if (result.success) {
      setSaveError(null)
      return
    }

    setSaveStatus('error')
    setSaveError(result.error || 'Unknown error')
    console.error('Preview fullscreen persistence failed:', result.error)
  }, [previewFullscreen])

  return { saveStatus, saveError }
}
