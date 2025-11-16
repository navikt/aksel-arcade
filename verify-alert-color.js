// Manual Verification Script
// Run in browser DevTools console while viewing http://localhost:5173

console.log('🔍 Starting Alert Color Verification...\n');

// Find the sandbox iframe
const iframe = document.querySelector('iframe');
if (!iframe) {
  console.error('❌ No iframe found');
} else {
  console.log('✅ Found iframe');
  
  try {
    const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
    const root = iframeDoc.documentElement;
    const rootDiv = iframeDoc.getElementById('root');
    
    console.log(`\n📋 Root element classes: ${root.className}`);
    console.log(`📋 Root div classes: ${rootDiv?.className || 'not found'}`);
    console.log(`📋 Color scheme: ${getComputedStyle(root).colorScheme}`);
    
    // Find Alert element
    const alert = iframeDoc.querySelector('[class*="alert"]');
    if (!alert) {
      console.error('❌ No Alert element found');
    } else {
      console.log('\n✅ Found Alert element');
      console.log(`📋 Alert classes: ${alert.className}`);
      
      const alertStyle = getComputedStyle(alert);
      console.log(`📋 Alert computed color: ${alertStyle.color}`);
      console.log(`📋 Alert computed background: ${alertStyle.backgroundColor}`);
      
      // Check text elements inside Alert
      const textElements = alert.querySelectorAll('*');
      console.log(`\n📋 Checking ${textElements.length} child elements:`);
      
      textElements.forEach((el, i) => {
        if (el.textContent && el.textContent.trim() && el.children.length === 0) {
          const style = getComputedStyle(el);
          console.log(`  Child ${i} (${el.tagName}): color=${style.color}`);
        }
      });
      
      // Check CSS variables
      console.log('\n📋 CSS Variables on root:');
      const rootStyle = getComputedStyle(root);
      const vars = ['--ax-text-neutral', '--ax-text-subtle', '--ax-bg-default', '--ax-bg-sunken'];
      vars.forEach(v => {
        const value = rootStyle.getPropertyValue(v);
        console.log(`  ${v}: ${value || 'NOT DEFINED'}`);
      });
    }
    
    console.log('\n💡 To test theme toggle:');
    console.log('1. Click the theme toggle button (sun/moon icon)');
    console.log('2. Re-run this script');
    console.log('3. Compare the color values in light vs dark mode');
    console.log('\n✅ Expected behavior:');
    console.log('- Dark mode: Alert text should be light color (for dark background)');
    console.log('- Light mode: Alert text should be dark color rgb(32, 39, 51)');
    
  } catch (e) {
    console.error('❌ Cannot access iframe:', e.message);
  }
}
