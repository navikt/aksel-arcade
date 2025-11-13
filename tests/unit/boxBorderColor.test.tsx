import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Box } from '@navikt/ds-react';
import type { BoxProps } from '@navikt/ds-react';
import { BORDER_COLOR_TOKENS } from '../../src/services/akselMetadata';

// Contract:
// 1. BORDER_COLOR_TOKENS exposes ONLY token fragments (e.g. 'neutral-subtle', NOT 'border-neutral-subtle').
// 2. No token starts with '--ax-' or 'border-'.
// 3. Box.darkside component automatically adds '--ax-border-' prefix when rendering.
// 4. Rendering <Box borderColor={token}> preserves children with correct token fragments.

describe('Box borderColor tokens', () => {
  it('exports only token fragments without border- prefix', () => {
    expect(BORDER_COLOR_TOKENS.length).toBeGreaterThan(0);
    const hasBorderPrefix = BORDER_COLOR_TOKENS.filter((t: string) => t.startsWith('border-'));
    expect(hasBorderPrefix.length).toBe(0);
    const hasAxPrefix = BORDER_COLOR_TOKENS.filter((t: string) => t.startsWith('--ax-'));
    expect(hasAxPrefix.length).toBe(0);
  });

  it('renders children for a sample of valid tokens', () => {
    BORDER_COLOR_TOKENS.slice(0, 5).forEach((token) => {
      render(
        <Box borderWidth="1" borderColor={token as BoxProps['borderColor']} padding="1">
          <span data-testid={`child-${token}`}>child</span>
        </Box>
      );
      const el = screen.getByTestId(`child-${token}`);
      expect(el).toBeTruthy();
    });
  });

  it('resilience: prefixed token (any-cast) still renders children (not recommended)', () => {
    render(
      <Box borderWidth="1" borderColor={'--ax-border-neutral' as BoxProps['borderColor']} padding="1">
        <span data-testid="prefixed-child">child</span>
      </Box>
    );
    const el = screen.getByTestId('prefixed-child');
    expect(el).toBeTruthy();
  });
});
