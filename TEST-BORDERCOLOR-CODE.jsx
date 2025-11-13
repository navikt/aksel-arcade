// Test code for verifying borderColor fix in AkselArcade
// This should be manually pasted into the editor at http://localhost:5174

import { Box } from "@navikt/ds-react";

export default function App() {
  return (
    <div style={{ padding: "20px" }}>
      <h1>BorderColor Fix Test</h1>
      
      {/* Test 1: Fixed usage - should work now */}
      <Box 
        padding="4" 
        borderWidth="1" 
        borderColor="neutral-subtle"
      >
        ✓ Box with borderColor="neutral-subtle" (correct token fragment)
      </Box>
      
      <br />
      
      {/* Test 2: Without borderColor - baseline */}
      <Box 
        padding="4" 
        borderWidth="1"
      >
        ✓ Box without borderColor (baseline)
      </Box>
      
      <br />
      
      {/* Test 3: Various colors */}
      <div style={{ display: "flex", gap: "10px" }}>
        <Box padding="3" borderWidth="2" borderColor="accent">accent</Box>
        <Box padding="3" borderWidth="2" borderColor="success">success</Box>
        <Box padding="3" borderWidth="2" borderColor="danger">danger</Box>
      </div>
    </div>
  );
}
