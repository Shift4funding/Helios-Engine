const moment = require('moment');
const { IndustryStandards } = require('../config/industryStandards');
const { RiskModels } = require('../utils/riskModels');
const { TValueCalculator } = require('../utils/tValueCalculator');

class AnalyticsService {
    constructor() {
        this.industryStandards = new IndustryStandards();
        this.riskModels = new RiskModels();
        this.tValueCalculator = new TValueCalculator();
    }

    async analyzeSpendingPatterns(transactions, businessProfile) {
        return {
            // Enhanced Cash Flow Analysis (CLFP Standards)
            cashFlow: await this.analyzeCashFlow(transactions),
            
            // ELFA Compliance Metrics
            complianceMetrics: await this.assessCompliance(transactions),
            
            // NEF-Aligned Business Health
            businessMetrics: await this.calculateBusinessMetrics(transactions, businessProfile),
            
            // AACFB Risk Assessment
            riskIndicators: await this.assessRiskFactors(transactions),
            
            // Equipment Leasing Metrics (ELFA)
            equipmentMetrics: await this.analyzeEquipmentFinancing(transactions),
            
            // Industry Analysis (Tamarack AI Models)
            industryAnalysis: await this.runIndustryAnalysis(transactions, businessProfile)
        };
    }

    async analyzeCashFlow(transactions) {
        const dailyBalances = await this.calculateDailyBalances(transactions);
        const paymentHistory = await this.extractPaymentHistory(transactions);
        
        return {
            // Standard TValue Metrics
            npv: await this.calculateNetPresentValue(transactions),
            irr: await this.calculateInternalRateOfReturn(transactions),
            
            // Enhanced Cash Flow Analysis
            averageDailyBalance: await this.calculateAverageDailyBalance(dailyBalances),
            endingDailyBalance: await this.calculateEndingDailyBalance(dailyBalances),
            
            // Payment Performance (TValue)
            paymentTiming: await this.analyzePaymentTiming(paymentHistory),
            irregularPayments: await this.detectIrregularPayments(paymentHistory),
            
            // Debt Service Analysis
            debtServiceRatio: await this.calculateDebtServiceRatio(transactions),
            amortizationSchedule: await this.generateAmortizationSchedule(transactions),
            
            // Future Value Projections
            projectedCashFlows: await this.projectFutureCashFlows(transactions),
            sensitivityAnalysis: await this.performSensitivityAnalysis(transactions)
        };
    }

    async calculateBusinessMetrics(transactions, businessProfile) {
        return {
            // ELFA Standards
            assetUtilization: await this.calculateAssetUtilization(transactions),
            equipmentROI: await this.calculateEquipmentROI(transactions),
            
            // AACFB Metrics
            collateralValue: await this.assessCollateralValue(transactions),
            industryPosition: await this.analyzeMarketPosition(businessProfile),
            
            // Working Capital Analysis
            workingCapitalTurnover: await this.calculateWCTurnover(transactions),
            daysWorkingCapital: await this.calculateDWC(transactions),
            
            // Enhanced Financial Ratios
            quickRatio: await this.calculateQuickRatio(transactions),
            currentRatio: await this.calculateCurrentRatio(transactions)
        };
    }

    // Risk assessment aligned with AACFB & CLFP standards
    async assessRiskFactors(transactions) {
        return {
            // Core Risk Metrics
            debtServiceCoverage: await this.calculateDSCR(transactions),
            fixedChargeCoverage: await this.calculateFixedChargeCoverage(transactions),
            
            // Enhanced Risk Analysis
            portfolioConcentration: await this.analyzePortfolioConcentration(transactions),
            collateralRisk: await this.assessCollateralRisk(transactions),
            
            // Predictive Metrics (Tamarack AI)
            defaultProbability: await this.calculateDefaultRisk(transactions),
            recoveryPotential: await this.assessRecoveryPotential(transactions)
        };
    }

    // Helper Methods Implementation
    async calculateNetPresentValue(transactions) {
        const cashFlows = this.extractCashFlows(transactions);
        const discountRate = await this.determineDiscountRate(transactions);
        
        return this.tValueCalculator.calculateNPV(cashFlows, discountRate);
    }

    async calculateInternalRateOfReturn(transactions) {
        const cashFlows = this.extractCashFlows(transactions);
        return this.tValueCalculator.calculateIRR(cashFlows);
    }

    async generateAmortizationSchedule(transactions) {
        const loanTerms = await this.extractLoanTerms(transactions);
        return this.tValueCalculator.generateSchedule({
            principal: loanTerms.principal,
            rate: loanTerms.interestRate,
            term: loanTerms.term,
            paymentFrequency: loanTerms.paymentFrequency,
            compoundingPeriods: loanTerms.compoundingPeriods
        });
    }

    async calculateDebtServiceRatio(transactions) {
        const operatingIncome = await this.calculateOperatingIncome(transactions);
        const debtService = await this.calculateTotalDebtService(transactions);
        
        return {
            ratio: operatingIncome / debtService,
            components: {
                operatingIncome,
                debtService,
                coverage: this.assessCoverageStrength(operatingIncome / debtService)
            }
        };
    }

    async projectFutureCashFlows(transactions) {
        const historicalPattern = await this.analyzeHistoricalPattern(transactions);
        const seasonalityFactors = await this.calculateSeasonalityFactors(transactions);
        const growthTrend = await this.calculateGrowthTrend(transactions);

        return this.tValueCalculator.projectCashFlows({
            historicalPattern,
            seasonalityFactors,
            growthTrend,
            projectionPeriods: 12 // Configurable
        });
    }
}

module.exports = new AnalyticsService();