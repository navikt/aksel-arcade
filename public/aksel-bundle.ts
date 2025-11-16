// This file creates a bundle that the sandbox can import
// It includes the Theme component which is not available via ESM.sh

import { Theme } from '@navikt/ds-react/Theme';
import * as AkselReact from '@navikt/ds-react';

// Export everything for the sandbox
export { Theme };
export default AkselReact;
