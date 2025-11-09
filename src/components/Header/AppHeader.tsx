import { Heading, TextField } from '@navikt/ds-react'
import './AppHeader.css'

interface AppHeaderProps {
  projectName: string
  onProjectNameChange: (name: string) => void
}

export const AppHeader = ({ projectName, onProjectNameChange }: AppHeaderProps) => {
  return (
    <header className="app-header">
      <Heading size="large" level="1" className="app-header__logo">
        Aksel Arcade
      </Heading>
      
      <TextField
        label="Project name"
        hideLabel
        value={projectName}
        onChange={(e) => onProjectNameChange(e.target.value)}
        className="app-header__project-name"
        size="small"
      />
    </header>
  )
}
