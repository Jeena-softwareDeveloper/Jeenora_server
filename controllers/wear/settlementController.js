const Supplier = require('../../models/wear/supplierModel');
const AuthOrder = require('../../models/wear/authOrder');
const ReturnRequest = require('../../models/wear/returnRequestModel');
const RTO = require('../../models/wear/rtoModel');
const { responseReturn } = require('../../utiles/response');
const mongoose = require('mongoose');

class SettlementController {
    
    // ==================== SETTLEMENT CALCULATION ====================
    
    // 1. Calculate settlement for a specific period
    calculate_settlement = async (req, res) => {
        const { id } = req; // supplier user ID
        const { startDate, endDate, includeReturns = true, includeRTOs = true } = req.body;
        
        try {
            const supplier = await Supplier.findOne({ user: id });
            if (!supplier) {
                return responseReturn(res, 404, { error: 'Supplier not found' });
            }
            
            // Date range
            const start = startDate ? new Date(startDate) : new Date();
            const end = endDate ? new Date(endDate) : new Date();
            start.setHours(0, 0, 0, 0);
            end.setHours(23, 59, 59, 999);
            
            // Get delivered orders in period
            const deliveredOrders = await AuthOrder.find({
                sellerId: id,
                delivery_status: 'delivered',
                updatedAt: { $gte: start, $lte: end }
            });
            
            // Calculate order revenue
            let totalOrderRevenue = 0;
            let totalPlatformFee = 0;
            let totalSupplierRevenue = 0;
            const orderDetails = [];
            
            deliveredOrders.forEach(order => {
                const platformFee = order.price * 0.05; // 5% platform fee
                const supplierRevenue = order.price - platformFee;
                
                totalOrderRevenue += order.price;
                totalPlatformFee += platformFee;
                totalSupplierRevenue += supplierRevenue;
                
                orderDetails.push({
                    orderId: order._id,
                    orderNumber: order.orderNumber,
                    amount: order.price,
                    platformFee,
                    supplierRevenue,
                    deliveryDate: order.updatedAt,
                    status: 'delivered'
                });
            });
            
            // Calculate return deductions
            let totalReturnDeductions = 0;
            let returnDetails = [];
            
            if (includeReturns) {
                const returns = await ReturnRequest.find({
                    supplierId: supplier._id,
                    status: { $in: ['refund_completed', 'exchange_completed'] },
                    updatedAt: { $gte: start, $lte: end }
                });
                
                returns.forEach(returnItem => {
                    const deduction = returnItem.refundAmount || 0;
                    totalReturnDeductions += deduction;
                    
                    returnDetails.push({
                        returnId: returnItem._id,
                        trackingId: returnItem.trackingId,
                        amount: deduction,
                        reason: returnItem.reason,
                        status: returnItem.status,
                        date: returnItem.updatedAt
                    });
                });
            }
            
            // Calculate RTO deductions
            let totalRTODeductions = 0;
            let rtoDetails = [];
            
            if (includeRTOs) {
                const rtos = await RTO.find({
                    supplierId: supplier._id,
                    status: { $in: ['restocked', 'disposed', 'lost'] },
                    updatedAt: { $gte: start, $lte: end }
                });
                
                rtos.forEach(rto => {
                    const deduction = rto.netLoss || 0;
                    totalRTODeductions += deduction;
                    
                    rtoDetails.push({
                        rtoId: rto._id,
                        trackingId: rto.trackingId,
                        amount: deduction,
                        reason: rto.reason,
                        status: rto.status,
                        date: rto.updatedAt
                    });
                });
            }
            
            // Calculate net settlement
            const netSettlement = totalSupplierRevenue - totalReturnDeductions - totalRTODeductions;
            
            responseReturn(res, 200, {
                success: true,
                settlement: {
                    period: {
                        start: start,
                        end: end
                    },
                    summary: {
                        totalOrderRevenue,
                        totalPlatformFee,
                        totalSupplierRevenue,
                        totalReturnDeductions,
                        totalRTODeductions,
                        netSettlement
                    },
                    breakdown: {
                        orders: {
                            count: deliveredOrders.length,
                            details: orderDetails
                        },
                        returns: {
                            count: returnDetails.length,
                            details: returnDetails
                        },
                        rtos: {
                            count: rtoDetails.length,
                            details: rtoDetails
                        }
                    }
                }
            });
            
        } catch (error) {
            console.error('Calculate Settlement Error:', error);
            responseReturn(res, 500, { error: error.message });
        }
    };
    
    // 2. Generate settlement statement
    generate_settlement_statement = async (req, res) => {
        const { id } = req;
        const { settlementId, period } = req.body;
        
        try {
            const supplier = await Supplier.findOne({ user: id });
            if (!supplier) {
                return responseReturn(res, 404, { error: 'Supplier not found' });
            }
            
            // In a real system, you'd save settlements to a database
            // For now, we'll generate a fresh statement
            
            const statement = {
                statementId: `STMT-${Date.now()}-${supplier._id.toString().slice(-6)}`,
                supplierId: supplier._id,
                supplierName: supplier.businessDetails?.shopName || 'Unknown',
                period: period || 'Monthly',
                generatedAt: new Date(),
                status: 'generated',
                items: []
            };
            
            // Add financial summary
            const settlement = await this.calculateSettlementForPeriod(supplier._id, period);
            
            statement.summary = settlement.summary;
            statement.breakdown = settlement.breakdown;
            
            responseReturn(res, 200, {
                success: true,
                statement,
                downloadUrl: `/api/settlements/${statement.statementId}/download` // Mock URL
            });
            
        } catch (error) {
            console.error('Generate Settlement Statement Error:', error);
            responseReturn(res, 500, { error: error.message });
        }
    };
    
    // 3. Get settlement history
    get_settlement_history = async (req, res) => {
        const { id } = req;
        let { page = 1, limit = 20, status, startDate, endDate } = req.query;
        
        try {
            const supplier = await Supplier.findOne({ user: id });
            if (!supplier) {
                return responseReturn(res, 404, { error: 'Supplier not found' });
            }
            
            page = parseInt(page);
            limit = parseInt(limit);
            const skip = (page - 1) * limit;
            
            // In a real system, you'd query from a settlements collection
            // For now, we'll simulate with calculated settlements
            
            // Get last 6 months of data
            const sixMonthsAgo = new Date();
            sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
            
            const settlements = [];
            const currentDate = new Date();
            
            // Generate monthly settlements for last 6 months
            for (let i = 0; i < 6; i++) {
                const monthStart = new Date(currentDate.getFullYear(), currentDate.getMonth() - i, 1);
                const monthEnd = new Date(currentDate.getFullYear(), currentDate.getMonth() - i + 1, 0);
                
                const settlement = await this.calculateSettlementForPeriod(
                    supplier._id, 
                    monthStart, 
                    monthEnd
                );
                
                settlements.push({
                    settlementId: `SETT-${monthStart.getFullYear()}${String(monthStart.getMonth() + 1).padStart(2, '0')}-${supplier._id.toString().slice(-6)}`,
                    period: `${monthStart.toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })}`,
                    startDate: monthStart,
                    endDate: monthEnd,
                    totalRevenue: settlement.summary.totalSupplierRevenue,
                    totalDeductions: settlement.summary.totalReturnDeductions + settlement.summary.totalRTODeductions,
                    netAmount: settlement.summary.netSettlement,
                    status: 'processed',
                    processedAt: monthEnd,
                    paymentDate: new Date(monthEnd.getTime() + 7 * 24 * 60 * 60 * 1000) // 7 days after period end
                });
            }
            
            // Apply filters
            let filteredSettlements = settlements;
            
            if (status) {
                filteredSettlements = filteredSettlements.filter(s => s.status === status);
            }
            
            if (startDate) {
                const start = new Date(startDate);
                filteredSettlements = filteredSettlements.filter(s => s.endDate >= start);
            }
            
            if (endDate) {
                const end = new Date(endDate);
                filteredSettlements = filteredSettlements.filter(s => s.endDate <= end);
            }
            
            // Paginate
            const total = filteredSettlements.length;
            const paginatedSettlements = filteredSettlements.slice(skip, skip + limit);
            
            // Calculate totals
            const totalRevenue = filteredSettlements.reduce((sum, s) => sum + s.totalRevenue, 0);
            const totalDeductions = filteredSettlements.reduce((sum, s) => sum + s.totalDeductions, 0);
            const totalNetAmount = filteredSettlements.reduce((sum, s) => sum + s.netAmount, 0);
            
            responseReturn(res, 200, {
                success: true,
                settlements: paginatedSettlements,
                pagination: {
                    page,
                    limit,
                    total,
                    pages: Math.ceil(total / limit)
                },
                summary: {
                    totalRevenue,
                    totalDeductions,
                    totalNetAmount,
                    averageMonthly: totalNetAmount / (filteredSettlements.length || 1)
                }
            });
            
        } catch (error) {
            console.error('Get Settlement History Error:', error);
            responseReturn(res, 500, { error: error.message });
        }
    };
    
    // 4. Get payout details
    get_payout_details = async (req, res) => {
        const { id } = req;
        const { payoutId } = req.params;
        
        try {
            const supplier = await Supplier.findOne({ user: id });
            if (!supplier) {
                return responseReturn(res, 404, { error: 'Supplier not found' });
            }
            
            // In a real system, you'd fetch from payouts collection
            // For now, simulate with calculated data
            
            const payout = {
                payoutId,
                supplierId: supplier._id,
                supplierName: supplier.businessDetails?.shopName || 'Unknown',
                bankDetails: {
                    accountNumber: supplier.bankDetails?.accountNumber?.slice(-4) || '****',
                    bankName: supplier.bankDetails?.bankName || 'Not Provided',
                    ifsc: supplier.bankDetails?.ifsc || 'Not Provided'
                },
                amount: 15000, // Mock amount
                status: 'processed',
                processedAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // 7 days ago
                transactionId: `TXN${Date.now()}${supplier._id.toString().slice(-6)}`,
                settlementPeriod: 'March 2026',
                breakdown: {
                    orderRevenue: 18000,
                    platformFees: 900,
                    returnDeductions: 1500,
                    rtoDeductions: 600,
                    netAmount: 15000
                }
            };
            
            responseReturn(res, 200, {
                success: true,
                payout
            });
            
        } catch (error) {
            console.error('Get Payout Details Error:', error);
            responseReturn(res, 500, { error: error.message });
        }
    };
    
    // 5. Request payout
    request_payout = async (req, res) => {
        const { id } = req;
        const { amount, notes } = req.body;
        
        try {
            const supplier = await Supplier.findOne({ user: id });
            if (!supplier) {
                return responseReturn(res, 404, { error: 'Supplier not found' });
            }
            
            // Validate bank details
            if (!supplier.bankDetails?.accountNumber || !supplier.bankDetails?.ifsc) {
                return responseReturn(res, 400, { 
                    error: 'Bank details not complete. Please update your bank information.' 
                });
            }
            
            // Check available balance
            const availableBalance = await this.calculateAvailableBalance(supplier._id);
            
            if (amount > availableBalance) {
                return responseReturn(res, 400, { 
                    error: `Requested amount exceeds available balance. Available: ₹${availableBalance}` 
                });
            }
            
            // Create payout request
            const payoutRequest = {
                requestId: `REQ-${Date.now()}-${supplier._id.toString().slice(-6)}`,
                supplierId: supplier._id,
                supplierName: supplier.businessDetails?.shopName || 'Unknown',
                amount,
                requestedAt: new Date(),
                status: 'pending',
                notes: notes || '',
                bankDetails: {
                    accountNumber: supplier.bankDetails.accountNumber,
                    bankName: supplier.bankDetails.bankName,
                    ifsc: supplier.bankDetails.ifsc
                }
            };
            
            // In a real system, save to database
            // For now, return success
            
            responseReturn(res, 200, {
                success: true,
                message: 'Payout request submitted successfully',
                payoutRequest,
                estimatedProcessing: '3-5 business days'
            });
            
        } catch (error) {
            console.error('Request Payout Error:', error);
            responseReturn(res, 500, { error: error.message });
        }
    };
    
    // 6. Get financial dashboard
    get_financial_dashboard = async (req, res) => {
        const { id } = req;
        
        try {
            const supplier = await Supplier.findOne({ user: id });
            if (!supplier) {
                return responseReturn(res, 404, { error: 'Supplier not found' });
            }
            
            // Calculate current month stats
            const currentMonthStart = new Date();
            currentMonthStart.setDate(1);
            currentMonthStart.setHours(0, 0, 0, 0);
            
            const currentMonthEnd = new Date();
            currentMonthEnd.setHours(23, 59, 59, 999);
            
            const currentMonthSettlement = await this.calculateSettlementForPeriod(
                supplier._id,
                currentMonthStart,
                currentMonthEnd
            );
            
            // Calculate last month stats
            const lastMonthStart = new Date();
            lastMonthStart.setMonth(lastMonthStart.getMonth() - 1);
            lastMonthStart.setDate(1);
            lastMonthStart.setHours(0, 0, 0, 0);
            
            const lastMonthEnd = new Date();
            lastMonthEnd.setMonth(lastMonthEnd.getMonth() - 1);
            lastMonthEnd.setDate(0);
            lastMonthEnd.setHours(23, 59, 59, 999);
            
            const lastMonthSettlement = await this.calculateSettlementForPeriod(
                supplier._id,
                lastMonthStart,
                lastMonthEnd
            );
            
            // Calculate available balance
            const availableBalance = await this.calculateAvailableBalance(supplier._id);
            
            // Get recent payouts
            const recentPayouts = await this.getRecentPayouts(supplier._id);
            
            // Calculate trends
            const revenueTrend = currentMonthSettlement.summary.totalSupplierRevenue - 
                               lastMonthSettlement.summary.totalSupplierRevenue;
            const deductionTrend = (currentMonthSettlement.summary.totalReturnDeductions + 
                                  currentMonthSettlement.summary.totalRTODeductions) - 
                                 (lastMonthSettlement.summary.totalReturnDeductions + 
                                  lastMonthSettlement.summary.totalRTODeductions);
            
            responseReturn(res, 200, {
                success: true,
                dashboard: {
                    summary: {
                        availableBalance,
                        currentMonthRevenue: currentMonthSettlement.summary.totalSupplierRevenue,
                        currentMonthDeductions: currentMonthSettlement.summary.totalReturnDeductions + 
                                              currentMonthSettlement.summary.totalRTODeductions,
                        currentMonthNet: currentMonthSettlement.summary.netSettlement,
                        lastMonthNet: lastMonthSettlement.summary.netSettlement
                    },
                    trends: {
                        revenue: {
                            value: revenueTrend,
                            percentage: lastMonthSettlement.summary.totalSupplierRevenue > 0 ? 
                                      (revenueTrend / lastMonthSettlement.summary.totalSupplierRevenue) * 100 : 0,
                            direction: revenueTrend >= 0 ? 'up' : 'down'
                        },
                        deductions: {
                            value: deductionTrend,
                            percentage: (lastMonthSettlement.summary.totalReturnDeductions + 
                                       lastMonthSettlement.summary.totalRTODeductions) > 0 ? 
                                      (deductionTrend / (lastMonthSettlement.summary.totalReturnDeductions + 
                                       lastMonthSettlement.summary.totalRTODeductions)) * 100 : 0,
                            direction: deductionTrend <= 0 ? 'up' : 'down' // Lower deductions is good
                        }
                    },
                    recentPayouts,
                    upcomingPayout: {
                        estimatedAmount: availableBalance,
                        estimatedDate: new Date(currentMonthEnd.getTime() + 7 * 24 * 60 * 60 * 1000),
                        status: 'pending_calculation'
                    }
                }
            });
            
        } catch (error) {
            console.error('Get Financial Dashboard Error:', error);
            responseReturn(res, 500, { error: error.message });
        }
    };
    
    // ==================== HELPER METHODS ====================
    
    // Helper: Calculate settlement for a period
    calculateSettlementForPeriod = async (supplierId, startDate, endDate) => {
        try {
            // Get delivered orders in period
            const deliveredOrders = await AuthOrder.find({
                sellerId: supplierId,
                delivery_status: 'delivered',
                updatedAt: { $gte: startDate, $lte: endDate }
            });
            
            // Calculate order revenue
            let totalOrderRevenue = 0;
            let totalPlatformFee = 0;
            let totalSupplierRevenue = 0;
            
            deliveredOrders.forEach(order => {
                const platformFee = order.price * 0.05; // 5% platform fee
                const supplierRevenue = order.price - platformFee;
                
                totalOrderRevenue += order.price;
                totalPlatformFee += platformFee;
                totalSupplierRevenue += supplierRevenue;
            });
            
            // Calculate return deductions
            const returns = await ReturnRequest.find({
                supplierId: supplierId,
                status: { $in: ['refund_completed', 'exchange_completed'] },
                updatedAt: { $gte: startDate, $lte: endDate }
            });
            
            let totalReturnDeductions = 0;
            returns.forEach(returnItem => {
                totalReturnDeductions += returnItem.refundAmount || 0;
            });
            
            // Calculate RTO deductions
            const rtos = await RTO.find({
                supplierId: supplierId,
                status: { $in: ['restocked', 'disposed', 'lost'] },
                updatedAt: { $gte: startDate, $lte: endDate }
            });
            
            let totalRTODeductions = 0;
            rtos.forEach(rto => {
                totalRTODeductions += rto.netLoss || 0;
            });
            
            // Calculate net settlement
            const netSettlement = totalSupplierRevenue - totalReturnDeductions - totalRTODeductions;
            
            return {
                summary: {
                    totalOrderRevenue,
                    totalPlatformFee,
                    totalSupplierRevenue,
                    totalReturnDeductions,
                    totalRTODeductions,
                    netSettlement
                },
                breakdown: {
                    orders: {
                        count: deliveredOrders.length,
                        totalRevenue: totalSupplierRevenue
                    },
                    returns: {
                        count: returns.length,
                        totalDeductions: totalReturnDeductions
                    },
                    rtos: {
                        count: rtos.length,
                        totalDeductions: totalRTODeductions
                    }
                }
            };
        } catch (error) {
            console.error('Calculate Settlement For Period Error:', error);
            return {
                summary: {
                    totalOrderRevenue: 0,
                    totalPlatformFee: 0,
                    totalSupplierRevenue: 0,
                    totalReturnDeductions: 0,
                    totalRTODeductions: 0,
                    netSettlement: 0
                },
                breakdown: {
                    orders: { count: 0, totalRevenue: 0 },
                    returns: { count: 0, totalDeductions: 0 },
                    rtos: { count: 0, totalDeductions: 0 }
                }
            };
        }
    };
    
    // Helper: Calculate available balance
    calculateAvailableBalance = async (supplierId) => {
        try {
            // Get current month delivered orders
            const currentMonthStart = new Date();
            currentMonthStart.setDate(1);
            currentMonthStart.setHours(0, 0, 0, 0);
            
            const currentMonthEnd = new Date();
            currentMonthEnd.setHours(23, 59, 59, 999);
            
            const settlement = await this.calculateSettlementForPeriod(
                supplierId,
                currentMonthStart,
                currentMonthEnd
            );
            
            // Assume 70% of current month is available for payout
            return Math.max(0, settlement.summary.netSettlement * 0.7);
        } catch (error) {
            console.error('Calculate Available Balance Error:', error);
            return 0;
        }
    };
    
    // Helper: Get recent payouts
    getRecentPayouts = async (supplierId) => {
        // Mock data for recent payouts
        return [
            {
                payoutId: `PAY-${Date.now() - 86400000}-${supplierId.toString().slice(-6)}`,
                amount: 12000,
                date: new Date(Date.now() - 86400000), // 1 day ago
                status: 'processed',
                transactionId: `TXN${Date.now() - 86400000}`
            },
            {
                payoutId: `PAY-${Date.now() - 172800000}-${supplierId.toString().slice(-6)}`,
                amount: 8500,
                date: new Date(Date.now() - 172800000), // 2 days ago
                status: 'processed',
                transactionId: `TXN${Date.now() - 172800000}`
            },
            {
                payoutId: `PAY-${Date.now() - 259200000}-${supplierId.toString().slice(-6)}`,
                amount: 10500,
                date: new Date(Date.now() - 259200000), // 3 days ago
                status: 'processed',
                transactionId: `TXN${Date.now() - 259200000}`
            }
        ];
    };
}

module.exports = new SettlementController();
       