import { describe, expect, it } from 'vitest'
import {
  FORM_SUMMARY_JSX_CODE,
  HOOKS_DEMO_HOOKS_CODE,
  HOOKS_DEMO_JSX_CODE,
  INTRO_JSX_CODE,
} from '@/utils/projectDefaults'
import { transpileCode } from '@/services/transpiler'

const BUILT_IN_JSX_TEMPLATES = [INTRO_JSX_CODE, HOOKS_DEMO_JSX_CODE, FORM_SUMMARY_JSX_CODE]

describe('built-in project templates', () => {
  it('uses current Aksel v8 primitives and spacing tokens', () => {
    const combinedTemplates = BUILT_IN_JSX_TEMPLATES.join('\n')

    expect(combinedTemplates).not.toContain('BoxNew')
    expect(combinedTemplates).not.toContain('<Alert')
    expect(combinedTemplates).not.toMatch(/\bgap="\d+"/)
    expect(combinedTemplates).not.toMatch(/borderRadius="(?:large|xlarge|medium|small)"/)
    expect(combinedTemplates).toContain('<Box')
    expect(combinedTemplates).toContain('<InlineMessage')
    expect(combinedTemplates).toContain('gap="space-32"')
    expect(combinedTemplates).toContain('borderRadius="8"')
  })

  it('teaches the preferred import-free Arcade source shapes', () => {
    expect(INTRO_JSX_CODE.trim()).toMatch(/^<Box/)
    expect(INTRO_JSX_CODE).not.toContain('export default function App')
    expect(HOOKS_DEMO_JSX_CODE.trim()).toMatch(/^\(\(\) => \{/)
    expect(HOOKS_DEMO_JSX_CODE).not.toContain("from './hooks'")
    expect(HOOKS_DEMO_HOOKS_CODE).not.toContain("from 'react'")
  })

  it('transpiles every built-in example for the sandbox runtime', async () => {
    await expect(transpileCode(INTRO_JSX_CODE, '')).resolves.toMatchObject({ success: true })
    await expect(transpileCode(HOOKS_DEMO_JSX_CODE, HOOKS_DEMO_HOOKS_CODE)).resolves.toMatchObject({
      success: true,
    })
    await expect(transpileCode(FORM_SUMMARY_JSX_CODE, '')).resolves.toMatchObject({ success: true })
  })
})
