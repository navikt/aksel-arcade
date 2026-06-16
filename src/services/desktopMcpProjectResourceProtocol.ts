export type DesktopMcpProjectResourceErrorCode =
  | 'project-unavailable'
  | 'source-not-found'
  | 'invalid-resource-uri'

export interface DesktopMcpProjectResourceReadRequest {
  uri: string
}

export interface DesktopMcpProjectResourceReadSuccess {
  ok: true
  uri: string
  mimeType: string
  text: string
}

export interface DesktopMcpProjectResourceReadFailure {
  ok: false
  code: DesktopMcpProjectResourceErrorCode
  message: string
  resourceUri: string
}

export type DesktopMcpProjectResourceReadResult =
  | DesktopMcpProjectResourceReadSuccess
  | DesktopMcpProjectResourceReadFailure

export type DesktopMcpProjectResourceReadHandler = (
  request: DesktopMcpProjectResourceReadRequest
) => DesktopMcpProjectResourceReadResult | Promise<DesktopMcpProjectResourceReadResult>
