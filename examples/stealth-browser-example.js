/**
 * Playwright Stealth Browser Example
 * 
 * This example demonstrates how to use playwright-extra with the stealth plugin
 * to launch a browser that's harder to detect as automated.
 */

import { chromium } from 'playwright-extra';
import StealthPlugin from 'playwright-extra-plugin-stealth';

// Add the stealth plugin to playwright-extra
chromium.use(StealthPlugin());

async function launchStealthBrowser() {
    try {
        console.log('🚀 Launching stealth-enabled browser...');
        
        // Launch browser with stealth capabilities
        const browser = await chromium.launch({
            headless: false, // Set to true for headless mode
            slowMo: 50,      // Optional: slow down operations for debugging
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-accelerated-2d-canvas',
                '--no-first-run',
                '--no-zygote',
                '--disable-gpu'
            ]
        });

        console.log('✅ Browser launched successfully');

        // Create a new page
        const page = await browser.newPage();
        
        // Set viewport size
        await page.setViewportSize({ width: 1366, height: 768 });

        // Navigate to a test site
        console.log('🌐 Navigating to test page...');
        await page.goto('https://bot.sannysoft.com/', { 
            waitUntil: 'networkidle' 
        });

        // Wait a moment to see the results
        await page.waitForTimeout(3000);

        console.log('📊 Bot detection test completed. Check the browser window for results.');
        
        // Take a screenshot (optional)
        await page.screenshot({ 
            path: 'stealth-test-results.png',
            fullPage: true 
        });
        
        console.log('📸 Screenshot saved as stealth-test-results.png');

        // Example: Extract some data from the page
        const title = await page.title();
        console.log(`📄 Page title: ${title}`);

        // Keep browser open for inspection (remove in production)
        console.log('🔍 Browser will stay open for 10 seconds for inspection...');
        await page.waitForTimeout(10000);

        // Close browser
        await browser.close();
        console.log('✅ Browser closed successfully');

    } catch (error) {
        console.error('❌ Error launching stealth browser:', error);
    }
}

// Example function for automated tasks
async function performAutomatedTask() {
    try {
        console.log('🤖 Starting automated task with stealth browser...');
        
        const browser = await chromium.launch({
            headless: true, // Running headless for automation
        });

        const page = await browser.newPage();

        // Example: Navigate and interact with a website
        await page.goto('https://example.com');
        
        // Wait for page load
        await page.waitForLoadState('networkidle');
        
        // Example interactions
        const pageContent = await page.textContent('body');
        console.log('📝 Page loaded, content length:', pageContent.length);
        
        // Example: Fill a form (if present)
        // await page.fill('input[name="username"]', 'your-username');
        // await page.fill('input[name="password"]', 'your-password');
        // await page.click('button[type="submit"]');
        
        await browser.close();
        console.log('✅ Automated task completed');
        
    } catch (error) {
        console.error('❌ Error in automated task:', error);
    }
}

// Export functions for use in other modules
export {
    launchStealthBrowser,
    performAutomatedTask,
    chromium // Export configured chromium for reuse
};

// Run the example if this file is executed directly
if (process.argv[1] === new URL(import.meta.url).pathname) {
    console.log('🎭 Playwright Stealth Browser Example');
    console.log('=====================================\n');
    
    // Run the stealth browser demo
    launchStealthBrowser()
        .then(() => {
            console.log('\n🎉 Demo completed successfully!');
        })
        .catch(error => {
            console.error('\n💥 Demo failed:', error);
        });
}
