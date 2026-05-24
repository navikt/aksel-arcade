import { Box, Detail, ProgressBar, VStack } from '@navikt/ds-react'

interface ProjectSizeIndicatorProps {
  sizeBytes: number
  maxSizeBytes: number
}

export const ProjectSizeIndicator = ({ sizeBytes, maxSizeBytes }: ProjectSizeIndicatorProps) => {
  const formatMB = (bytes: number): number => bytes / (1024 * 1024)

  const sizeMB = formatMB(sizeBytes)
  const maxMB = formatMB(maxSizeBytes)
  const percentage = (sizeMB / maxMB) * 100

  return (
    <Box width="84px">
      <VStack gap="space-4">
        <Detail textColor="subtle">
          {sizeMB.toFixed(5)}/{maxMB} MB
        </Detail>
        <ProgressBar
          value={Math.min(percentage, 100)}
          size="small"
          aria-label="Project size usage"
        />
      </VStack>
    </Box>
  )
}
