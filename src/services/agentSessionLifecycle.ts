type AgentSessionProjectReplacementListener = () => void

const projectReplacementListeners = new Set<AgentSessionProjectReplacementListener>()

export const notifyAgentSessionProjectReplaced = (): void => {
  for (const listener of [...projectReplacementListeners]) {
    listener()
  }
}

export const subscribeToAgentSessionProjectReplacement = (
  listener: AgentSessionProjectReplacementListener
): (() => void) => {
  projectReplacementListeners.add(listener)

  return () => {
    projectReplacementListeners.delete(listener)
  }
}
