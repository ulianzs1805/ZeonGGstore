const { chromium } = require('playwright');

async function testPNGClicks() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  const testCases = [
    { caseId: "furious", caseName: "Furious" },
    { caseId: "fable", caseName: "Fable" },
    { caseId: "chameleon", caseName: "Chameleon" },
    { caseId: "empire", caseName: "Empire" }
  ];

  for (const testCase of testCases) {
    try {
      console.log(`\n=== Testing ${testCase.caseName} Case ===`);
      
      // Go to homepage
      await page.goto('http://localhost:3003');
      await page.waitForTimeout(1000);
      
      // Scroll down to Recent Drops section
      await page.evaluate(() => {
        const recentDrops = document.querySelector('[class*="Recent"]');
        if (recentDrops) recentDrops.scrollIntoView();
      });
      
      await page.waitForTimeout(500);
      
      // Look for the first recent drop card
      const recentDropCards = await page.locator('.rounded-xl[class*="border"]').filter({ hasText: /.*/ }).all();
      console.log(`Found ${recentDropCards.length} recent drop cards`);
      
      if (recentDropCards.length === 0) {
        console.log('No recent drop cards found');
        continue;
      }
      
      // Get the first card and look for the case image layer
      const firstCard = recentDropCards[0];
      
      // Try clicking on the case image div (the one with cursor-pointer)
      const caseImageLayer = await firstCard.locator('div[class*="cursor-pointer"]').first();
      
      if (!caseImageLayer) {
        console.log('Case image layer not found');
        continue;
      }
      
      console.log('Clicking on case image layer...');
      await caseImageLayer.click();
      
      await page.waitForTimeout(500);
      
      // Check the URL
      const url = page.url();
      console.log(`Current URL: ${url}`);
      
      if (url.includes('/case')) {
        console.log(`✓ SUCCESS: Navigated to ${url}`);
      } else {
        console.log(`✗ FAIL: Expected /case URL, got ${url}`);
      }
      
    } catch (error) {
      console.error(`Error testing ${testCase.caseName}: ${error.message}`);
    }
  }

  await browser.close();
}

testPNGClicks().catch(console.error);
