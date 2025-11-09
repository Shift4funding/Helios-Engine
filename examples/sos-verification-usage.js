
/**
 * SOS Verification Service Usage Example
 * 
 * This example demonstrates how to use the SosVerificationService
 * with playwright-extra stealth plugin for business verification.
 */

import SosVerificationService from '../src/services/sosVerificationService.js';
import logger from '../src/utils/logger.js';

async function demonstrateSosVerification() {
    console.log('🚀 SOS Verification Service Demo\n');
    
    let sosService;
    
    try {
        // Create and initialize the SOS verification service
        console.log('📋 Initializing SOS Verification Service...');
        sosService = new SosVerificationService({
            queueName: 'sos-verification-demo-queue',
            redisConfig: {
                host: 'localhost',
                port: 6379,
                // Add password if needed: password: 'your-redis-password'
            }
        });
        
        // Test Redis connection
        await sosService.redis.ping();
        console.log('✅ Connected to Redis successfully\n');
        
        // Example 1: Add a job to the queue
        console.log('📤 Adding verification job to queue...');
        const jobId = await sosService.addJob({
            businessName: 'Apple Inc',
            state: 'CA'
        });
        console.log(`✅ Job added with ID: ${jobId}\n`);
        
        // Example 2: Process the job
        console.log('⚙️ Processing verification job...');
        const startTime = Date.now();
        
        // This will connect to DiaBrowser or launch local browser with stealth
        await sosService.processNextJob();
        
        const endTime = Date.now();
        console.log(`✅ Job processed in ${endTime - startTime}ms\n`);
        
        // Example 3: Get the result
        console.log('📊 Retrieving verification result...');
        setTimeout(async () => {
            try {
                const result = await sosService.redis.get(`sos-result:${jobId}`);
                if (result) {
                    const parsedResult = JSON.parse(result);
                    console.log('🎯 Verification Result:');
                    console.log(`  Business Name: ${parsedResult.businessName}`);
                    console.log(`  State: ${parsedResult.state}`);
                    console.log(`  Status: ${parsedResult.status || 'Unknown'}`);
                    console.log(`  Registration Date: ${parsedResult.registrationDate || 'Unknown'}`);
                    console.log(`  Verified: ${parsedResult.verified || false}`);
                    console.log(`  Success: ${parsedResult.success}`);
                    if (parsedResult.error) {
                        console.log(`  Error: ${parsedResult.error}`);
                    }
                } else {
                    console.log('❌ No result found - job may still be processing');
                }
            } catch (error) {
                console.error('❌ Error retrieving result:', error);
            }
        }, 2000);
        
        // Example 4: Multiple jobs
        console.log('\n📤 Adding multiple verification jobs...');
        const businessesToVerify = [
            { businessName: 'Microsoft Corporation', state: 'CA' },
            { businessName: 'Google LLC', state: 'CA' },
            { businessName: 'Facebook Inc', state: 'CA' }
        ];
        
        const jobIds = [];
        for (const business of businessesToVerify) {
            const id = await sosService.addJob(business);
            jobIds.push(id);
            console.log(`  ✅ Added job ${id} for ${business.businessName}`);
        }
        
        // Example 5: Start worker to process multiple jobs
        console.log('\n🏃 Starting worker to process queue...');
        
        // Note: In production, you would run the worker in a separate process
        // sosService.startWorker();
        
        console.log('\n📝 Usage Notes:');
        console.log('  1. The service automatically connects to DiaBrowser if available');
        console.log('  2. Falls back to local Chromium with stealth configuration');
        console.log('  3. Uses playwright-extra with stealth plugin for detection avoidance');
        console.log('  4. Jobs are processed through Redis queue for scalability');
        console.log('  5. Results are stored in Redis with expiration');
        
        console.log('\n🔧 To run as a worker service:');
        console.log('  const worker = new SosVerificationService();');
        console.log('  await worker.startWorker(); // Runs continuously');
        
    } catch (error) {
        console.error('❌ Demo failed:', error);
    } finally {
        // Cleanup
        if (sosService) {
            try {
                await sosService.cleanup();
                console.log('\n🧹 Cleanup completed');
            } catch (cleanupError) {
                console.error('❌ Cleanup error:', cleanupError);
            }
        }
    }
}

// NPM Command Instructions
console.log('📦 Required NPM packages installed:');
console.log('  ✅ playwright-extra');
console.log('  ✅ playwright-extra-plugin-stealth');
console.log('  ✅ ioredis');
console.log('  ✅ playwright\n');

console.log('🔧 Installation commands used:');
console.log('  npm install playwright-extra playwright-extra-plugin-stealth ioredis\n');

// Run the demo
if (import.meta.url === `file://${process.argv[1]}`) {
    demonstrateSosVerification()
        .then(() => {
            console.log('\n🎉 Demo completed!');
            process.exit(0);
        })
        .catch((error) => {
            console.error('\n❌ Demo failed:', error);
            process.exit(1);
        });
}
