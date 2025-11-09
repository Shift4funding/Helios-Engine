/**
 * Advanced Playwright Stealth Examples
 * 
 * This file demonstrates various browser automation scenarios using
 * playwright-extra with stealth capabilities.
 */

import { chromium } from 'playwright-extra';
import StealthPlugin from 'playwright-extra-plugin-stealth';

// Add stealth plugin with custom configuration
chromium.use(StealthPlugin({
    // Optional: Configure specific stealth features
    runOnInsecureOrigins: true,
    enabledEvasions: new Set([
        'chrome.app',
        'chrome.csi',
        'chrome.loadTimes',
        'chrome.runtime',
        'defaultArgs',
        'iframe.contentWindow',
        'media.codecs',
        'navigator.hardwareConcurrency',
        'navigator.languages',
        'navigator.permissions',
        'navigator.plugins',
        'navigator.vendor',
        'navigator.webdriver',
        'sourceurl',
        'user-agent-override',
        'webgl.vendor',
        'window.outerdimensions'
    ])
}));

/**
 * Basic stealth browser launch configuration
 */
const getStealthBrowserConfig = (headless = false) => ({
    headless,
    slowMo: 50,
    viewport: { width: 1366, height: 768 },
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
    args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--disable-gpu',
        '--disable-web-security',
        '--disable-features=VizDisplayCompositor',
        '--start-maximized'
    ]
});

/**
 * Example 1: Web Scraping with Stealth
 */
async function scrapeWithStealth(url, selector) {
    const browser = await chromium.launch(getStealthBrowserConfig(true));
    const page = await browser.newPage();
    
    try {
        console.log(`🕷️  Scraping: ${url}`);
        
        // Navigate with stealth
        await page.goto(url, { 
            waitUntil: 'networkidle',
            timeout: 30000 
        });
        
        // Wait for content to load
        await page.waitForSelector(selector, { timeout: 10000 });
        
        // Extract data
        const data = await page.evaluate((sel) => {
            const elements = document.querySelectorAll(sel);
            return Array.from(elements).map(el => el.textContent.trim());
        }, selector);
        
        console.log(`✅ Scraped ${data.length} items`);
        return data;
        
    } catch (error) {
        console.error('❌ Scraping failed:', error.message);
        throw error;
    } finally {
        await browser.close();
    }
}

/**
 * Example 2: Form Automation with Stealth
 */
async function automateFormSubmission(formData) {
    const browser = await chromium.launch(getStealthBrowserConfig(false));
    const page = await browser.newPage();
    
    try {
        console.log('📝 Starting form automation...');
        
        // Navigate to form page
        await page.goto(formData.url);
        
        // Fill form fields
        for (const [selector, value] of Object.entries(formData.fields)) {
            await page.waitForSelector(selector);
            await page.fill(selector, value);
            await page.waitForTimeout(100); // Human-like delay
        }
        
        // Submit form
        if (formData.submitSelector) {
            await page.click(formData.submitSelector);
            await page.waitForLoadState('networkidle');
        }
        
        console.log('✅ Form submitted successfully');
        
        // Capture result
        const result = await page.url();
        return { success: true, finalUrl: result };
        
    } catch (error) {
        console.error('❌ Form automation failed:', error.message);
        throw error;
    } finally {
        await browser.close();
    }
}

/**
 * Example 3: API Testing with Browser Context
 */
async function testAPIWithBrowser(apiEndpoint, testData) {
    const browser = await chromium.launch(getStealthBrowserConfig(true));
    const page = await browser.newPage();
    
    try {
        console.log('🧪 Testing API with browser context...');
        
        // Intercept network requests
        const responses = [];
        page.on('response', response => {
            if (response.url().includes(apiEndpoint)) {
                responses.push({
                    status: response.status(),
                    url: response.url(),
                    headers: response.headers()
                });
            }
        });
        
        // Navigate to page that uses the API
        await page.goto(testData.pageUrl);
        
        // Trigger API call
        await page.evaluate((data) => {
            return fetch(data.endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data.payload)
            });
        }, { endpoint: apiEndpoint, payload: testData.payload });
        
        // Wait for response
        await page.waitForTimeout(2000);
        
        console.log(`✅ Captured ${responses.length} API responses`);
        return responses;
        
    } catch (error) {
        console.error('❌ API testing failed:', error.message);
        throw error;
    } finally {
        await browser.close();
    }
}

/**
 * Example 4: Screenshot and PDF Generation
 */
async function generateReports(url, options = {}) {
    const browser = await chromium.launch(getStealthBrowserConfig(true));
    const page = await browser.newPage();
    
    try {
        console.log('📸 Generating reports...');
        
        await page.goto(url, { waitUntil: 'networkidle' });
        
        // Generate screenshot
        const screenshotPath = options.screenshotPath || 'page-screenshot.png';
        await page.screenshot({
            path: screenshotPath,
            fullPage: true,
            type: 'png'
        });
        
        // Generate PDF
        const pdfPath = options.pdfPath || 'page-report.pdf';
        await page.pdf({
            path: pdfPath,
            format: 'A4',
            printBackground: true,
            margin: {
                top: '1cm',
                right: '1cm',
                bottom: '1cm',
                left: '1cm'
            }
        });
        
        console.log(`✅ Reports generated: ${screenshotPath}, ${pdfPath}`);
        return { screenshotPath, pdfPath };
        
    } catch (error) {
        console.error('❌ Report generation failed:', error.message);
        throw error;
    } finally {
        await browser.close();
    }
}

/**
 * Example 5: Multi-Page Session with Stealth
 */
async function multiPageSession(urls) {
    const browser = await chromium.launch(getStealthBrowserConfig(false));
    
    try {
        console.log('🔄 Starting multi-page session...');
        const results = [];
        
        for (const url of urls) {
            const page = await browser.newPage();
            
            // Each page gets stealth protection
            await page.goto(url, { waitUntil: 'networkidle' });
            
            const pageInfo = {
                url,
                title: await page.title(),
                timestamp: new Date().toISOString()
            };
            
            results.push(pageInfo);
            console.log(`✅ Processed: ${pageInfo.title}`);
            
            await page.close();
            await new Promise(resolve => setTimeout(resolve, 1000)); // Delay between pages
        }
        
        return results;
        
    } catch (error) {
        console.error('❌ Multi-page session failed:', error.message);
        throw error;
    } finally {
        await browser.close();
    }
}

/**
 * Utility function to check if stealth is working
 */
async function testStealthCapabilities() {
    const browser = await chromium.launch(getStealthBrowserConfig(false));
    const page = await browser.newPage();
    
    try {
        console.log('🕵️  Testing stealth capabilities...');
        
        // Test bot detection
        await page.goto('https://bot.sannysoft.com/');
        await page.waitForTimeout(3000);
        
        // Take screenshot of results
        await page.screenshot({ 
            path: 'stealth-test.png',
            fullPage: true 
        });
        
        console.log('✅ Stealth test completed - check stealth-test.png');
        
        // Keep browser open for manual inspection
        await page.waitForTimeout(5000);
        
    } catch (error) {
        console.error('❌ Stealth test failed:', error.message);
        throw error;
    } finally {
        await browser.close();
    }
}

// Export all functions
export {
    scrapeWithStealth,
    automateFormSubmission,
    testAPIWithBrowser,
    generateReports,
    multiPageSession,
    testStealthCapabilities,
    getStealthBrowserConfig,
    chromium // Export configured chromium instance
};

// Demo runner
if (process.argv[1] === new URL(import.meta.url).pathname) {
    console.log('🎭 Advanced Playwright Stealth Examples');
    console.log('=========================================\n');
    
    // Run stealth capability test
    testStealthCapabilities()
        .then(() => console.log('\n🎉 Stealth test completed!'))
        .catch(error => console.error('\n💥 Test failed:', error));
}
