/**
 * Playwright Stealth Browser Setup
 * 
 * This example shows how to configure Playwright with stealth-like capabilities
 * using built-in options and manual configurations.
 */

import { chromium, firefox, webkit } from 'playwright';

/**
 * Get stealth browser configuration
 */
export function getStealthConfig(options = {}) {
    return {
        headless: options.headless ?? true,
        slowMo: options.slowMo ?? 50,
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
            '--disable-ipc-flooding-protection',
            '--disable-renderer-backgrounding',
            '--disable-backgrounding-occluded-windows',
            '--disable-field-trial-config',
            '--disable-back-forward-cache',
            '--disable-hang-monitor',
            '--disable-prompt-on-repost',
            '--disable-sync',
            '--disable-translate',
            '--hide-scrollbars',
            '--metrics-recording-only',
            '--mute-audio',
            '--no-default-browser-check',
            '--no-first-run',
            '--safebrowsing-disable-auto-update',
            '--start-maximized',
            '--password-store=basic',
            '--use-mock-keychain'
        ]
    };
}

/**
 * Apply stealth settings to a page
 */
export async function applyStealth(page) {
    // Override navigator.webdriver
    await page.addInitScript(() => {
        Object.defineProperty(navigator, 'webdriver', {
            get: () => undefined,
        });
    });

    // Override the `plugins` property to use a custom getter
    await page.addInitScript(() => {
        Object.defineProperty(navigator, 'plugins', {
            get: () => [1, 2, 3, 4, 5],
        });
    });

    // Override the `languages` property to use a custom getter
    await page.addInitScript(() => {
        Object.defineProperty(navigator, 'languages', {
            get: () => ['en-US', 'en'],
        });
    });

    // Override permissions
    await page.addInitScript(() => {
        const originalQuery = window.navigator.permissions.query;
        window.navigator.permissions.query = (parameters) => (
            parameters.name === 'notifications' ?
                Promise.resolve({ state: Notification.permission }) :
                originalQuery(parameters)
        );
    });

    // Hide chrome objects
    await page.addInitScript(() => {
        delete window.chrome;
        delete window.cdc_adoQpoasnfa76pfcZLmcfl_Array;
        delete window.cdc_adoQpoasnfa76pfcZLmcfl_Promise;
        delete window.cdc_adoQpoasnfa76pfcZLmcfl_Symbol;
    });

    // Override user agent
    await page.setExtraHTTPHeaders({
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
        'Accept-Encoding': 'gzip, deflate, br',
        'Upgrade-Insecure-Requests': '1'
    });

    return page;
}

/**
 * Launch a stealth browser
 */
export async function launchStealthBrowser(options = {}) {
    const browser = await chromium.launch(getStealthConfig(options));
    
    const context = await browser.newContext({
        viewport: { width: 1366, height: 768 },
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        locale: 'en-US',
        timezoneId: 'America/New_York',
        permissions: ['geolocation'],
        ignoreHTTPSErrors: true,
        javaScriptEnabled: true
    });

    return { browser, context };
}

/**
 * Create a stealth page
 */
export async function createStealthPage(context) {
    const page = await context.newPage();
    return await applyStealth(page);
}

/**
 * Example: Basic stealth browsing
 */
export async function basicStealthExample() {
    console.log('🚀 Starting basic stealth browser example...');
    
    const { browser, context } = await launchStealthBrowser({ headless: false });
    
    try {
        const page = await createStealthPage(context);
        
        console.log('🌐 Navigating to bot detection test...');
        await page.goto('https://bot.sannysoft.com/', { waitUntil: 'networkidle' });
        
        // Take screenshot
        await page.screenshot({ path: 'stealth-test-results.png', fullPage: true });
        console.log('📸 Screenshot saved: stealth-test-results.png');
        
        // Wait to see results
        await page.waitForTimeout(5000);
        
        const title = await page.title();
        console.log(`📄 Page title: ${title}`);
        
        console.log('✅ Basic stealth example completed');
        
    } catch (error) {
        console.error('❌ Error:', error.message);
    } finally {
        await browser.close();
    }
}

/**
 * Example: Web scraping with stealth
 */
export async function stealthScrapeExample(url, selector) {
    console.log(`🕷️  Starting stealth scraping: ${url}`);
    
    const { browser, context } = await launchStealthBrowser({ headless: true });
    
    try {
        const page = await createStealthPage(context);
        
        await page.goto(url, { waitUntil: 'networkidle' });
        
        if (selector) {
            await page.waitForSelector(selector, { timeout: 10000 });
            
            const elements = await page.$$eval(selector, elements => 
                elements.map(el => el.textContent.trim())
            );
            
            console.log(`✅ Scraped ${elements.length} elements`);
            return elements;
        }
        
        const content = await page.content();
        console.log(`✅ Page content length: ${content.length} characters`);
        return content;
        
    } catch (error) {
        console.error('❌ Scraping error:', error.message);
        throw error;
    } finally {
        await browser.close();
    }
}

/**
 * Example: Form automation with stealth
 */
export async function stealthFormExample(config) {
    console.log('📝 Starting stealth form automation...');
    
    const { browser, context } = await launchStealthBrowser({ headless: false });
    
    try {
        const page = await createStealthPage(context);
        
        await page.goto(config.url);
        
        // Fill form fields
        for (const [selector, value] of Object.entries(config.fields)) {
            await page.waitForSelector(selector);
            await page.fill(selector, value);
            await page.waitForTimeout(Math.random() * 500 + 100); // Random delay
        }
        
        if (config.submitSelector) {
            await page.click(config.submitSelector);
            await page.waitForLoadState('networkidle');
        }
        
        console.log('✅ Form automation completed');
        return await page.url();
        
    } catch (error) {
        console.error('❌ Form automation error:', error.message);
        throw error;
    } finally {
        await browser.close();
    }
}

/**
 * Example: Screenshot and PDF generation
 */
export async function generateReports(url, options = {}) {
    console.log(`📊 Generating reports for: ${url}`);
    
    const { browser, context } = await launchStealthBrowser({ headless: true });
    
    try {
        const page = await createStealthPage(context);
        
        await page.goto(url, { waitUntil: 'networkidle' });
        
        // Generate screenshot
        const screenshotPath = options.screenshotPath || 'page-screenshot.png';
        await page.screenshot({ 
            path: screenshotPath, 
            fullPage: true 
        });
        
        // Generate PDF
        const pdfPath = options.pdfPath || 'page-report.pdf';
        await page.pdf({
            path: pdfPath,
            format: 'A4',
            printBackground: true
        });
        
        console.log(`✅ Reports generated: ${screenshotPath}, ${pdfPath}`);
        return { screenshotPath, pdfPath };
        
    } catch (error) {
        console.error('❌ Report generation error:', error.message);
        throw error;
    } finally {
        await browser.close();
    }
}

// Run example if executed directly
if (process.argv[1] === new URL(import.meta.url).pathname) {
    console.log('🎭 Playwright Stealth Configuration Example');
    console.log('=============================================\n');
    
    basicStealthExample()
        .then(() => console.log('\n🎉 Example completed successfully!'))
        .catch(error => console.error('\n💥 Example failed:', error));
}
