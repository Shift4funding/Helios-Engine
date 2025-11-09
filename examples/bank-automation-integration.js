/**
 * Bank Statement Browser Automation
 * 
 * This example shows how to integrate Playwright stealth capabilities
 * with your bank statement analyzer for automated data collection.
 */

import { chromium } from 'playwright-extra';
import StealthPlugin from 'playwright-extra-plugin-stealth';
import { promises as fs } from 'fs';
import path from 'path';

// Configure stealth browser
chromium.use(StealthPlugin());

class BankStatementAutomator {
    constructor(options = {}) {
        this.headless = options.headless || false;
        this.downloadsPath = options.downloadsPath || './downloads';
        this.screenshotsPath = options.screenshotsPath || './screenshots';
        this.timeout = options.timeout || 30000;
    }

    /**
     * Launch browser with stealth configuration
     */
    async launchBrowser() {
        this.browser = await chromium.launch({
            headless: this.headless,
            slowMo: 100,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-web-security',
                '--disable-features=VizDisplayCompositor'
            ]
        });

        this.context = await this.browser.newContext({
            viewport: { width: 1366, height: 768 },
            acceptDownloads: true,
            userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        });

        console.log('🚀 Stealth browser launched successfully');
    }

    /**
     * Automated login to banking portal
     */
    async loginToBankPortal(loginConfig) {
        const page = await this.context.newPage();
        
        try {
            console.log('🔐 Attempting login to bank portal...');
            
            // Navigate to login page
            await page.goto(loginConfig.loginUrl, { waitUntil: 'networkidle' });
            
            // Fill login credentials
            await page.waitForSelector(loginConfig.usernameSelector);
            await page.fill(loginConfig.usernameSelector, loginConfig.username);
            
            await page.waitForSelector(loginConfig.passwordSelector);
            await page.fill(loginConfig.passwordSelector, loginConfig.password);
            
            // Handle additional security fields if present
            if (loginConfig.additionalFields) {
                for (const [selector, value] of Object.entries(loginConfig.additionalFields)) {
                    await page.waitForSelector(selector);
                    await page.fill(selector, value);
                }
            }
            
            // Submit login form
            await page.click(loginConfig.submitSelector);
            
            // Wait for successful login (check for expected element after login)
            await page.waitForSelector(loginConfig.successSelector, { timeout: this.timeout });
            
            console.log('✅ Login successful');
            return page;
            
        } catch (error) {
            console.error('❌ Login failed:', error.message);
            
            // Take screenshot for debugging
            await page.screenshot({ 
                path: path.join(this.screenshotsPath, `login-error-${Date.now()}.png`),
                fullPage: true 
            });
            
            throw error;
        }
    }

    /**
     * Navigate to statements section
     */
    async navigateToStatements(page, navigationConfig) {
        try {
            console.log('📋 Navigating to statements section...');
            
            // Click on statements/documents section
            await page.waitForSelector(navigationConfig.statementsSelector);
            await page.click(navigationConfig.statementsSelector);
            
            // Wait for statements page to load
            await page.waitForSelector(navigationConfig.statementsPageSelector);
            
            console.log('✅ Successfully navigated to statements');
            
        } catch (error) {
            console.error('❌ Navigation failed:', error.message);
            throw error;
        }
    }

    /**
     * Download bank statements
     */
    async downloadStatements(page, downloadConfig) {
        const downloadedFiles = [];
        
        try {
            console.log('📥 Starting statement downloads...');
            
            // Set up download event listener
            page.on('download', async download => {
                const fileName = download.suggestedFilename() || `statement-${Date.now()}.pdf`;
                const filePath = path.join(this.downloadsPath, fileName);
                
                await download.saveAs(filePath);
                downloadedFiles.push(filePath);
                
                console.log(`📄 Downloaded: ${fileName}`);
            });
            
            // Find and download statements
            const statementLinks = await page.$$eval(
                downloadConfig.statementLinkSelector, 
                links => links.map(link => link.href || link.onclick)
            );
            
            console.log(`📋 Found ${statementLinks.length} statements to download`);
            
            for (let i = 0; i < Math.min(statementLinks.length, downloadConfig.maxDownloads || 5); i++) {
                await page.click(`${downloadConfig.statementLinkSelector}:nth-child(${i + 1})`);
                await page.waitForTimeout(2000); // Wait between downloads
            }
            
            // Wait for all downloads to complete
            await page.waitForTimeout(5000);
            
            console.log(`✅ Downloaded ${downloadedFiles.length} statements`);
            return downloadedFiles;
            
        } catch (error) {
            console.error('❌ Download failed:', error.message);
            throw error;
        }
    }

    /**
     * Scrape transaction data from web interface
     */
    async scrapeTransactionData(page, scrapeConfig) {
        try {
            console.log('🔍 Scraping transaction data...');
            
            // Navigate to transactions page
            if (scrapeConfig.transactionsPageUrl) {
                await page.goto(scrapeConfig.transactionsPageUrl);
            }
            
            // Wait for transaction table to load
            await page.waitForSelector(scrapeConfig.transactionTableSelector);
            
            // Extract transaction data
            const transactions = await page.$$eval(
                scrapeConfig.transactionRowSelector,
                (rows, config) => {
                    return rows.map(row => {
                        const cells = row.querySelectorAll('td');
                        return {
                            date: cells[config.dateColumn]?.textContent?.trim(),
                            description: cells[config.descriptionColumn]?.textContent?.trim(),
                            amount: cells[config.amountColumn]?.textContent?.trim(),
                            balance: cells[config.balanceColumn]?.textContent?.trim()
                        };
                    });
                },
                scrapeConfig.columnMapping
            );
            
            console.log(`✅ Scraped ${transactions.length} transactions`);
            
            // Save transaction data
            const dataPath = path.join(this.downloadsPath, `transactions-${Date.now()}.json`);
            await fs.writeFile(dataPath, JSON.stringify(transactions, null, 2));
            
            return { transactions, dataPath };
            
        } catch (error) {
            console.error('❌ Scraping failed:', error.message);
            throw error;
        }
    }

    /**
     * Complete automated workflow
     */
    async runCompleteWorkflow(config) {
        await this.launchBrowser();
        
        try {
            // Ensure directories exist
            await fs.mkdir(this.downloadsPath, { recursive: true });
            await fs.mkdir(this.screenshotsPath, { recursive: true });
            
            // Step 1: Login
            const page = await this.loginToBankPortal(config.login);
            
            // Step 2: Navigate to statements
            if (config.navigation) {
                await this.navigateToStatements(page, config.navigation);
            }
            
            // Step 3: Download statements (if configured)
            let downloadedFiles = [];
            if (config.download) {
                downloadedFiles = await this.downloadStatements(page, config.download);
            }
            
            // Step 4: Scrape transaction data (if configured)
            let transactionData = null;
            if (config.scrape) {
                transactionData = await this.scrapeTransactionData(page, config.scrape);
            }
            
            // Step 5: Take final screenshot
            await page.screenshot({
                path: path.join(this.screenshotsPath, `final-state-${Date.now()}.png`),
                fullPage: true
            });
            
            console.log('🎉 Workflow completed successfully!');
            
            return {
                success: true,
                downloadedFiles,
                transactionData,
                timestamp: new Date().toISOString()
            };
            
        } catch (error) {
            console.error('💥 Workflow failed:', error.message);
            throw error;
        } finally {
            await this.cleanup();
        }
    }

    /**
     * Cleanup browser resources
     */
    async cleanup() {
        if (this.browser) {
            await this.browser.close();
            console.log('🧹 Browser closed');
        }
    }
}

// Example configuration for different banks
const exampleConfigs = {
    genericBank: {
        login: {
            loginUrl: 'https://example-bank.com/login',
            usernameSelector: '#username',
            passwordSelector: '#password',
            submitSelector: '#login-button',
            successSelector: '.dashboard-welcome'
        },
        navigation: {
            statementsSelector: '.nav-statements',
            statementsPageSelector: '.statements-container'
        },
        download: {
            statementLinkSelector: '.statement-download-link',
            maxDownloads: 3
        },
        scrape: {
            transactionTableSelector: '.transaction-table',
            transactionRowSelector: '.transaction-row',
            columnMapping: {
                dateColumn: 0,
                descriptionColumn: 1,
                amountColumn: 2,
                balanceColumn: 3
            }
        }
    }
};

// Usage example
async function runBankAutomation() {
    const automator = new BankStatementAutomator({
        headless: false, // Set to true for production
        downloadsPath: './downloaded-statements',
        screenshotsPath: './automation-screenshots'
    });
    
    try {
        const results = await automator.runCompleteWorkflow(exampleConfigs.genericBank);
        console.log('🏆 Automation results:', results);
        
        // Process downloaded files with your existing statement analyzer
        if (results.downloadedFiles.length > 0) {
            console.log('📊 Ready to analyze downloaded statements with your API');
            // Here you would call your existing statement analysis methods
        }
        
    } catch (error) {
        console.error('❌ Automation failed:', error);
    }
}

export {
    BankStatementAutomator,
    exampleConfigs,
    runBankAutomation
};

// Run demo if executed directly
if (process.argv[1] === new URL(import.meta.url).pathname) {
    console.log('🏦 Bank Statement Browser Automation Demo');
    console.log('==========================================\n');
    
    // Note: This would need real bank credentials and selectors to work
    console.log('⚠️  This is a demonstration example.');
    console.log('📝 Configure with real bank portal details to use.');
    console.log('🔒 Always ensure secure credential handling in production.\n');
}
