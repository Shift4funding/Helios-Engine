
/**
 * Analysis Dashboard Component
 * 
 * Displays statement analysis results and alerts with color-coded severity
 */

import React, { useState, useEffect } from 'react';
import { AlertTriangle, CheckCircle, XCircle, Clock, TrendingUp, DollarSign, Activity } from 'lucide-react';

const AnalysisDashboard = ({ statementId }) => {
    const [analysisData, setAnalysisData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        if (statementId) {
            fetchAnalysisData();
        }
    }, [statementId]);

    const fetchAnalysisData = async () => {
        try {
            setLoading(true);
            setError(null);
            
            const response = await fetch(`/api/statements/${statementId}`, {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                throw new Error(`Failed to fetch analysis: ${response.statusText}`);
            }

            const data = await response.json();
            setAnalysisData(data);
        } catch (err) {
            setError(err.message);
            console.error('Error fetching analysis data:', err);
        } finally {
            setLoading(false);
        }
    };

    const getSeverityConfig = (severity) => {
        const configs = {
            'CRITICAL': {
                color: 'bg-red-100 border-red-500 text-red-900',
                icon: XCircle,
                iconColor: 'text-red-600',
                badge: 'bg-red-500 text-white'
            },
            'HIGH': {
                color: 'bg-red-50 border-red-400 text-red-800',
                icon: AlertTriangle,
                iconColor: 'text-red-500',
                badge: 'bg-red-400 text-white'
            },
            'MEDIUM': {
                color: 'bg-yellow-50 border-yellow-400 text-yellow-800',
                icon: AlertTriangle,
                iconColor: 'text-yellow-500',
                badge: 'bg-yellow-500 text-white'
            },
            'LOW': {
                color: 'bg-green-50 border-green-400 text-green-800',
                icon: CheckCircle,
                iconColor: 'text-green-500',
                badge: 'bg-green-500 text-white'
            }
        };
        return configs[severity] || configs['LOW'];
    };

    const formatCurrency = (amount) => {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD'
        }).format(amount);
    };

    const formatDate = (dateString) => {
        return new Date(dateString).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-96">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
                <span className="ml-3 text-gray-600">Loading analysis...</span>
            </div>
        );
    }

    if (error) {
        return (
            <div className="bg-red-50 border border-red-200 rounded-lg p-6">
                <div className="flex items-center">
                    <XCircle className="h-6 w-6 text-red-600 mr-3" />
                    <div>
                        <h3 className="text-red-800 font-medium">Error Loading Analysis</h3>
                        <p className="text-red-600 text-sm mt-1">{error}</p>
                    </div>
                </div>
                <button
                    onClick={fetchAnalysisData}
                    className="mt-4 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors"
                >
                    Retry
                </button>
            </div>
        );
    }

    if (!analysisData) {
        return (
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-6 text-center">
                <p className="text-gray-500">No analysis data available</p>
            </div>
        );
    }

    const { analysis, summary, alerts = [], fileName, uploadDate } = analysisData.data || analysisData;

    return (
        <div className="max-w-7xl mx-auto p-6 space-y-6">
            {/* Header */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900">Statement Analysis</h1>
                        <p className="text-gray-600 mt-1">
                            {fileName} • Uploaded {formatDate(uploadDate)}
                        </p>
                    </div>
                    <div className="flex items-center space-x-2">
                        <Activity className="h-5 w-5 text-blue-600" />
                        <span className="text-sm text-gray-500">Statement ID: {statementId}</span>
                    </div>
                </div>
            </div>

            {/* Summary Cards */}
            {summary && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    {/* Veritas Score */}
                    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                        <div className="flex items-center">
                            <TrendingUp className="h-8 w-8 text-blue-600" />
                            <div className="ml-4">
                                <p className="text-sm font-medium text-gray-600">Veritas Score</p>
                                <p className="text-2xl font-bold text-gray-900">
                                    {summary.veritasScore || summary.finalScore || 'N/A'}
                                </p>
                                <p className="text-sm text-gray-500">
                                    Grade: {summary.veritasGrade || summary.finalGrade || 'N/A'}
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Risk Level */}
                    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                        <div className="flex items-center">
                            <AlertTriangle className="h-8 w-8 text-orange-600" />
                            <div className="ml-4">
                                <p className="text-sm font-medium text-gray-600">Risk Level</p>
                                <p className="text-2xl font-bold text-gray-900">
                                    {summary.riskLevel || 'N/A'}
                                </p>
                                <p className="text-sm text-gray-500">
                                    Score: {summary.riskScore || 'N/A'}
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Total Deposits */}
                    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                        <div className="flex items-center">
                            <DollarSign className="h-8 w-8 text-green-600" />
                            <div className="ml-4">
                                <p className="text-sm font-medium text-gray-600">Total Deposits</p>
                                <p className="text-2xl font-bold text-gray-900">
                                    {summary.totalDeposits ? formatCurrency(summary.totalDeposits) : 'N/A'}
                                </p>
                                <p className="text-sm text-gray-500">
                                    Avg Balance: {summary.averageDailyBalance ? formatCurrency(summary.averageDailyBalance) : 'N/A'}
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* NSF Count */}
                    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                        <div className="flex items-center">
                            <XCircle className="h-8 w-8 text-red-600" />
                            <div className="ml-4">
                                <p className="text-sm font-medium text-gray-600">NSF Count</p>
                                <p className="text-2xl font-bold text-gray-900">
                                    {summary.nsfCount || 0}
                                </p>
                                <p className="text-sm text-gray-500">
                                    Transactions: {summary.transactionCount || analysis?.transactionSummary?.totalTransactions || 'N/A'}
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Alerts Section */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200">
                <div className="px-6 py-4 border-b border-gray-200">
                    <div className="flex items-center justify-between">
                        <h2 className="text-lg font-medium text-gray-900">Analysis Alerts</h2>
                        <span className="text-sm text-gray-500">
                            {alerts.length} alert{alerts.length !== 1 ? 's' : ''}
                        </span>
                    </div>
                </div>

                <div className="p-6">
                    {alerts.length === 0 ? (
                        <div className="text-center py-8">
                            <CheckCircle className="h-12 w-12 text-green-500 mx-auto" />
                            <h3 className="mt-2 text-sm font-medium text-gray-900">No Alerts</h3>
                            <p className="mt-1 text-sm text-gray-500">
                                No issues detected in this statement analysis.
                            </p>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {alerts.map((alert, index) => {
                                const config = getSeverityConfig(alert.severity);
                                const Icon = config.icon;

                                return (
                                    <div
                                        key={index}
                                        className={`border-l-4 rounded-lg p-4 ${config.color}`}
                                    >
                                        <div className="flex items-start">
                                            <Icon className={`h-5 w-5 ${config.iconColor} mt-0.5`} />
                                            <div className="ml-3 flex-1">
                                                <div className="flex items-center justify-between">
                                                    <h4 className="text-sm font-medium">
                                                        {alert.code.replace(/_/g, ' ')}
                                                    </h4>
                                                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${config.badge}`}>
                                                        {alert.severity}
                                                    </span>
                                                </div>
                                                <p className="mt-1 text-sm">{alert.message}</p>
                                                
                                                {/* Alert Data Details */}
                                                {alert.data && Object.keys(alert.data).length > 0 && (
                                                    <div className="mt-3 text-xs">
                                                        <details className="cursor-pointer">
                                                            <summary className="font-medium text-gray-700 hover:text-gray-900">
                                                                View Details
                                                            </summary>
                                                            <div className="mt-2 bg-white bg-opacity-50 rounded p-2 space-y-1">
                                                                {Object.entries(alert.data).map(([key, value]) => (
                                                                    <div key={key} className="flex justify-between">
                                                                        <span className="font-medium capitalize">
                                                                            {key.replace(/([A-Z])/g, ' $1').trim()}:
                                                                        </span>
                                                                        <span>
                                                                            {typeof value === 'number' && key.includes('amount') || key.includes('balance') || key.includes('revenue') 
                                                                                ? formatCurrency(value)
                                                                                : typeof value === 'object' 
                                                                                    ? JSON.stringify(value)
                                                                                    : String(value)
                                                                            }
                                                                        </span>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </details>
                                                    </div>
                                                )}
                                                
                                                <p className="text-xs text-gray-600 mt-2">
                                                    <Clock className="h-3 w-3 inline mr-1" />
                                                    {formatDate(alert.timestamp)}
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>

            {/* Waterfall Results (if available) */}
            {analysis?.finalRiskAssessment && (
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                    <h3 className="text-lg font-medium text-gray-900 mb-4">Analysis Summary</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <h4 className="font-medium text-gray-700">Helios Engine Analysis</h4>
                            <p className="text-sm text-gray-600">
                                Internal analysis completed with {analysis.transactionSummary?.totalTransactions || 'N/A'} transactions processed
                            </p>
                        </div>
                        {analysis.enhancedVerification?.externalApis && (
                            <div>
                                <h4 className="font-medium text-gray-700">External Verification</h4>
                                <p className="text-sm text-gray-600">
                                    {analysis.enhancedVerification.externalApis.executed 
                                        ? `External APIs executed - Cost: $${analysis.enhancedVerification.externalApis.totalCost || 0}`
                                        : `External APIs skipped - Saved: $${analysis.enhancedVerification.externalApis.costSaved || 0}`
                                    }
                                </p>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default AnalysisDashboard;
