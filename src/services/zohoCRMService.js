import { ZohoBaseService } from './zohoBaseService.js';

export class ZohoCRMService extends ZohoBaseService {
    constructor() {
        super();
        this.baseUrl = 'https://www.zohoapis.com/crm/v3';
    }

    async updateApplication(analysis) {
        const endpoint = `${this.baseUrl}/Deals/${analysis.applicationId}`;
        const data = this.formatAnalysisForCRM(analysis);
        
        const response = await this.client.patch(endpoint, {
            data: [{
                id: analysis.applicationId,
                ...data
            }]
        });

        return this.handleResponse(response);
    }

    formatAnalysisForCRM(analysis) {
        return {
            Risk_Score: analysis.riskScore,
            Average_Balance: analysis.metrics.averageBalance,
            Monthly_Income: analysis.metrics.monthlyIncome,
            Expense_Ratio: analysis.metrics.expenseRatio
        };
    }
}