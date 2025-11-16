// BROWSER CONSOLE TEST SCRIPT
// Copy this entire script and paste into the browser console at http://localhost:5173

console.log('🧪 Testing Empty Editor Fix\n');

// Get the transpileCode function from the app
async function testEmptyCode() {
  console.log('=== TEST 1: Empty string ===');
  
  // This simulates what happens when user deletes all code
  const emptyResult = await window.__testTranspiler?.('', '');
  
  if (!emptyResult) {
    console.log('❌ transpiler not available on window.__testTranspiler');
    console.log('✅ But we can still test by checking the preview pane behavior');
    console.log('\n📋 MANUAL TEST STEPS:');
    console.log('1. Select all text in editor (Cmd+A)');
    console.log('2. Delete it (Backspace)');
    console.log('3. Wait 1 second');
    console.log('4. Check preview - should be blank, NO ERROR ALERT');
    return;
  }
  
  console.log('Empty code result:', emptyResult);
  console.log('Success:', emptyResult.success);
  console.log('Code:', emptyResult.code);
  console.log('Error:', emptyResult.error);
  
  if (emptyResult.success && emptyResult.code?.includes('return null')) {
    console.log('✅ PASS: Empty code handled correctly');
  } else {
    console.log('❌ FAIL: Empty code not handled correctly');
  }
  
  console.log('\n=== TEST 2: Whitespace only ===');
  const whitespaceResult = await window.__testTranspiler?.('   \n  \n  ', '');
  console.log('Whitespace result:', whitespaceResult);
  
  if (whitespaceResult.success && whitespaceResult.code?.includes('return null')) {
    console.log('✅ PASS: Whitespace-only code handled correctly');
  } else {
    console.log('❌ FAIL: Whitespace-only code not handled correctly');
  }
}

testEmptyCode();
