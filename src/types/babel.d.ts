// Type definitions for @babel/standalone
declare module '@babel/standalone' {
  export interface TransformOptions {
    presets?: string[]
    filename?: string
  }

  export interface TransformResult {
    code: string | null
  }

  export function transform(code: string, options?: TransformOptions): TransformResult
}
