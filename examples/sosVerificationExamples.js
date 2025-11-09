/**
 * SOS Verification Service Usage Examples
 * Demonstrates how to use the Enhanced SOS Verification Service
 */

import EnhancedSosVerificationService from '../src/services/EnhancedSosVerificationService.js';
import Redis from 'redis';

// Example 1: Basic usage with queue processing
async function basicUsageExample() {
    console.log('\n🔥 Example 1: Basic SOS Verification with Queue Processing\n');

    const service = new EnhancedSosVerificationService({
        redisUrl: 'redis://localhost:6379',
        queueName: 'sos-verification-queue',
        resultQueueName: 'sos-verification-results',
        headless: false // Show browser for demo
    });

    try {
        // Initialize service
        await service.initialize();
        console.log('✅ Service initialized');

        // Queue some verification jobs
        const jobId1 = await service.queueJob('Apple Inc', 'CA');
        const jobId2 = await service.queueJob('Microsoft Corporation', 'CA');
        const jobId3 = await service.queueJob('Test Business LLC', 'CA');

        console.log('📤 Queued jobs:', { jobId1, jobId2, jobId3 });

        // Process one job manually
        const result = await service.processJobFromQueue();
        console.log('✅ Job result:', result);

    } catch (error) {
        console.error('❌ Error:', error);
    } finally {
        await service.cleanup();
    }
}

// Example 2: DiaBrowser integration
async function diabrowserExample() {
    console.log('\n🔥 Example 2: DiaBrowser Integration\n');

    const service = new EnhancedSosVerificationService({
        redisUrl: 'redis://localhost:6379',
        diabrowserEndpoint: 'ws://localhost:9222', // Your DiaBrowser endpoint
        diabrowserAuth: 'your-auth-token', // Optional
        headless: true
    });

    try {
        await service.initialize();
        console.log('✅ Service with DiaBrowser initialized');

        // Queue a job
        const jobId = await service.queueJob('Google LLC', 'CA', {
            priority: 'high',
            clientId: 'client-123'
        });

        console.log('📤 High priority job queued:', jobId);

        // Process the job
        const result = await service.processJobFromQueue();
        console.log('✅ DiaBrowser verification result:', result);

    } catch (error) {
        console.error('❌ Error:', error);
    } finally {
        await service.cleanup();
    }
}

// Example 3: Worker pattern
async function workerExample() {
    console.log('\n🔥 Example 3: Continuous Worker Processing\n');

    const service = new EnhancedSosVerificationService({
        redisUrl: 'redis://localhost:6379',
        queueName: 'sos-verification-queue',
        resultQueueName: 'sos-verification-results'
    });

    try {
        await service.initialize();
        console.log('✅ Worker service initialized');

        // Queue multiple jobs
        const businesses = [
            { name: 'Tesla Inc', state: 'CA' },
            { name: 'Netflix Inc', state: 'CA' },
            { name: 'Uber Technologies Inc', state: 'CA' }
        ];

        for (const business of businesses) {
            await service.queueJob(business.name, business.state);
        }

        console.log(`📤 Queued ${businesses.length} businesses for verification`);

        // Start worker (runs indefinitely)
        console.log('🔄 Starting worker - press Ctrl+C to stop');
        
        // Set timeout to stop worker after 60 seconds for demo
        setTimeout(() => {
            console.log('\n⏰ Demo timeout - stopping worker');
            service.stopWorker();
        }, 60000);

        await service.startWorker();

    } catch (error) {
        console.error('❌ Error:', error);
    } finally {
        await service.cleanup();
    }
}

// Example 4: Result monitoring
async function resultMonitorExample() {
    console.log('\n🔥 Example 4: Result Monitoring\n');

    const redisClient = Redis.createClient({ url: 'redis://localhost:6379' });
    await redisClient.connect();

    console.log('👀 Monitoring verification results...');
    console.log('Press Ctrl+C to stop monitoring');

    try {
        while (true) {
            // Check for results (blocking for up to 5 seconds)
            const result = await redisClient.blPop('sos-verification-results', 5);
            
            if (result) {
                const data = JSON.parse(result.element);
                console.log('\n📨 New verification result:');
                console.log('  Business:', data.businessName);
                console.log('  State:', data.state);
                console.log('  Status:', data.status);
                console.log('  Success:', data.success);
                
                if (data.officialName) {
                    console.log('  Official Name:', data.officialName);
                }
                if (data.registrationDate) {
                    console.log('  Registration Date:', data.registrationDate);
                }
                if (data.entityType) {
                    console.log('  Entity Type:', data.entityType);
                }
                if (data.error) {
                    console.log('  Error:', data.error);
                }
                
                console.log('  Timestamp:', data.timestamp);
                console.log('---');
            } else {
                process.stdout.write('.');
            }
        }
    } catch (error) {
        console.error('❌ Monitoring error:', error);
    } finally {
        await redisClient.quit();
    }
}

// Example 5: Bulk verification
async function bulkVerificationExample() {
    console.log('\n🔥 Example 5: Bulk Business Verification\n');

    const service = new EnhancedSosVerificationService({
        redisUrl: 'redis://localhost:6379',
        headless: true
    });

    const businesses = [
        'Apple Inc',
        'Microsoft Corporation', 
        'Amazon.com Inc',
        'Alphabet Inc',
        'Meta Platforms Inc',
        'Tesla Inc',
        'NVIDIA Corporation',
        'PayPal Holdings Inc',
        'Adobe Inc',
        'Salesforce Inc'
    ];

    try {
        await service.initialize();
        console.log(`📋 Bulk verification of ${businesses.length} businesses`);

        // Queue all businesses
        const jobIds = [];
        for (const business of businesses) {
            const jobId = await service.queueJob(business, 'CA', {
                batch: 'tech-companies-2024'
            });
            jobIds.push(jobId);
        }

        console.log('📤 All jobs queued, processing...');

        // Process all jobs
        const results = [];
        for (let i = 0; i < businesses.length; i++) {
            console.log(`🔍 Processing ${i + 1}/${businesses.length}...`);
            const result = await service.processJobFromQueue();
            if (result) {
                results.push(result);
            }
        }

        // Summary
        console.log('\n📊 Bulk Verification Summary:');
        console.log(`Total processed: ${results.length}`);
        console.log(`Successful: ${results.filter(r => r.success).length}`);
        console.log(`Failed: ${results.filter(r => !r.success).length}`);
        
        const statusCounts = {};
        results.forEach(r => {
            if (r.status) {
                statusCounts[r.status] = (statusCounts[r.status] || 0) + 1;
            }
        });
        
        console.log('Status breakdown:', statusCounts);

    } catch (error) {
        console.error('❌ Error:', error);
    } finally {
        await service.cleanup();
    }
}

// Main execution
async function main() {
    const examples = [
        { name: 'Basic Usage', fn: basicUsageExample },
        { name: 'DiaBrowser Integration', fn: diabrowserExample },
        { name: 'Worker Pattern', fn: workerExample },
        { name: 'Result Monitoring', fn: resultMonitorExample },
        { name: 'Bulk Verification', fn: bulkVerificationExample }
    ];

    console.log('🎯 Enhanced SOS Verification Service Examples');
    console.log('='.repeat(50));

    const args = process.argv.slice(2);
    const exampleName = args[0];

    if (!exampleName) {
        console.log('\nAvailable examples:');
        examples.forEach((ex, index) => {
            console.log(`  ${index + 1}. ${ex.name}: node examples/sosVerificationExamples.js ${ex.name.toLowerCase().replace(' ', '-')}`);
        });
        console.log('\nOr run all: node examples/sosVerificationExamples.js all');
        return;
    }

    if (exampleName === 'all') {
        // Run all examples
        for (const example of examples) {
            try {
                await example.fn();
                await new Promise(resolve => setTimeout(resolve, 2000)); // Pause between examples
            } catch (error) {
                console.error(`❌ Example ${example.name} failed:`, error);
            }
        }
    } else {
        // Run specific example
        const example = examples.find(ex => 
            ex.name.toLowerCase().replace(' ', '-') === exampleName
        );

        if (example) {
            await example.fn();
        } else {
            console.error(`❌ Example '${exampleName}' not found`);
        }
    }
}

// Handle cleanup on exit
process.on('SIGINT', () => {
    console.log('\n\n👋 Goodbye!');
    process.exit(0);
});

main().catch(error => {
    console.error('❌ Example execution failed:', error);
    process.exit(1);
});
