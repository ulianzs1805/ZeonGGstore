// Test script to verify PNG click behavior
// Run this in browser console

async function testRecentDropsPNGClick() {
  console.log('=== Testing Recent Drops PNG Click ===\n');
  
  // Wait a bit for page to load
  await new Promise(r => setTimeout(r, 1000));
  
  // Find all recent drop cards
  const cards = document.querySelectorAll('[class*="rounded-xl"][class*="border"][class*="px-2"]');
  console.log(`Found ${cards.length} potential drop cards`);
  
  // Look for the cursor-pointer div (case image layer)
  const caseImageLayer = document.querySelector('[class*="cursor-pointer"][class*="z-10"]');
  
  if (!caseImageLayer) {
    console.log('❌ Case image layer not found!');
    return;
  }
  
  console.log('✓ Found case image layer');
  console.log('  Class:', caseImageLayer.className);
  console.log('  Has pointer-events-auto:', caseImageLayer.className.includes('pointer-events-auto'));
  console.log('  Has cursor-pointer:', caseImageLayer.className.includes('cursor-pointer'));
  
  // Check onClick handler
  const onClickStr = caseImageLayer.getAttribute('onclick');
  console.log('  onClick attribute:', onClickStr ? 'Present' : 'Not found (using React handler)');
  
  // Simulate click
  console.log('\nSimulating click on case image layer...');
  caseImageLayer.click();
  
  // Wait for navigation
  await new Promise(r => setTimeout(r, 1000));
  
  const currentUrl = window.location.href;
  console.log(`\nAfter click - URL: ${currentUrl}`);
  
  if (currentUrl.includes('/case')) {
    console.log('✓ SUCCESS: Navigated to /case');
  } else {
    console.log('❌ FAIL: Did not navigate to /case');
  }
}

testRecentDropsPNGClick();
