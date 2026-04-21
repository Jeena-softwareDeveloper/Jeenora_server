const ReturnRequest = require('../../models/wear/returnRequestModel');
const RTO = require('../../models/wear/rtoModel');
const Supplier = require('../../models/wear/supplierModel');
const AuthOrder = require('../../models/wear/authOrder');
const { responseReturn } = require('../../utiles/response');
const mongoose = require('mongoose');

class ReturnRTOCController {
    
    // ==================== RETURN MANAGEMENT ====================
    
    // 1. Get all returns for supplier with filters
    get_supplier_returns = async (req, res) => {
        const { id } = req; // supplier user ID from middleware
        let { page = 1, limit = 20, status, search, startDate, endDate, sortBy = 'createdAt', sortOrder = 'desc' } = req.query;
        
        try {
            // Find supplier by user ID
            const supplier = await Supplier.findOne({ user: id });
            if (!supplier) {
                return responseReturn(res, 404, { error: 'Supplier not found' });
            }
            
            page = parseInt(page);
            limit = parseInt(limit);
            const skip = (page - 1) * limit;
            
            // Build query
            const query = { supplierId: supplier._id };
            
            // Status filter
            if (status && status !== 'all') {
                if (status === 'pending') {
                    query.status = { $in: ['requested', 'approved', 'pickup_scheduled', 'picked_up', 'qc_pending'] };
                } else if (status === 'active') {
                    query.status = { $in: ['qc_in_progress', 'refund_initiated', 'exchange_initiated'] };
                } else if (status === 'completed') {
                    query.status = { $in: ['refund_completed', 'exchange_completed', 'closed'] };
                } else {
                    query.status = status;
                }
            }
            
            // Date range filter
            if (startDate || endDate) {
                query.createdAt = {};
                if (startDate) query.createdAt.$gte = new Date(startDate);
                if (endDate) query.createdAt.$lte = new Date(endDate);
            }
            
            // Search filter
            if (search) {
                query.$or = [
                    { trackingId: { $regex: search, $options: 'i' } },
                    { 'pickupAddress.phone': { $regex: search, $options: 'i' } },
                    { reason: { $regex: search, $options: 'i' } }
                ];
            }
            
            // Sort configuration
            const sort = {};
            sort[sortBy] = sortOrder === 'desc' ? -1 : 1;
            
            // Execute query with pagination
            const [returns, total] = await Promise.all([
                ReturnRequest.find(query)
                    .populate('orderId', 'orderNumber customerName totalAmount')
                    .populate('productId', 'productName images price')
                    .populate('customerId', 'name phone email')
                    .sort(sort)
                    .skip(skip)
                    .limit(limit)
                    .lean(),
                ReturnRequest.countDocuments(query)
            ]);
            
            // Get statistics
            const stats = await ReturnRequest.getSupplierStats(supplier._id);
            
            responseReturn(res, 200, {
                success: true,
                returns,
                pagination: {
                    page,
                    limit,
                    total,
                    pages: Math.ceil(total / limit)
                },
                stats: {
                    total: total,
                    byStatus: stats,
                    pending: (stats.requested?.count || 0) + 
                            (stats.approved?.count || 0) + 
                            (stats.pickup_scheduled?.count || 0) + 
                            (stats.picked_up?.count || 0) + 
                            (stats.qc_pending?.count || 0),
                    completed: (stats.refund_completed?.count || 0) + 
                              (stats.exchange_completed?.count || 0) + 
                              (stats.closed?.count || 0)
                }
            });
            
        } catch (error) {
            console.error('Get Supplier Returns Error:', error);
            responseReturn(res, 500, { error: error.message });
        }
    };
    
    // 2. Get single return details
    get_return_details = async (req, res) => {
        const { returnId } = req.params;
        const { id } = req;
        
        try {
            const supplier = await Supplier.findOne({ user: id });
            if (!supplier) {
                return responseReturn(res, 404, { error: 'Supplier not found' });
            }
            
            const returnRequest = await ReturnRequest.findOne({
                _id: returnId,
                supplierId: supplier._id
            })
            .populate('orderId', 'orderNumber customerName totalAmount delivery_status createdAt')
            .populate('productId', 'productName images price category variants')
            .populate('customerId', 'name phone email address')
            .populate('exchangeProductId', 'productName images price')
            .lean();
            
            if (!returnRequest) {
                return responseReturn(res, 404, { error: 'Return request not found' });
            }
            
            // Get related RTO if exists
            let rtoDetails = null;
            if (returnRequest.isRTO && returnRequest.rtoTrackingId) {
                rtoDetails = await RTO.findOne({ 
                    trackingId: returnRequest.rtoTrackingId,
                    supplierId: supplier._id 
                }).lean();
            }
            
            responseReturn(res, 200, {
                success: true,
                return: returnRequest,
                rto: rtoDetails
            });
            
        } catch (error) {
            console.error('Get Return Details Error:', error);
            responseReturn(res, 500, { error: error.message });
        }
    };
    
    // 3. Update return QC status (supplier action)
    update_return_qc = async (req, res) => {
        const { returnId } = req.params;
        const { id } = req;
        const { qcResult, qcNotes, qcImages, status } = req.body;
        
        try {
            const supplier = await Supplier.findOne({ user: id });
            if (!supplier) {
                return responseReturn(res, 404, { error: 'Supplier not found' });
            }
            
            const returnRequest = await ReturnRequest.findOne({
                _id: returnId,
                supplierId: supplier._id
            });
            
            if (!returnRequest) {
                return responseReturn(res, 404, { error: 'Return request not found' });
            }
            
            // Validate QC can be performed
            if (!['qc_pending', 'qc_in_progress'].includes(returnRequest.status)) {
                return responseReturn(res, 400, { 
                    error: `Cannot perform QC on return with status: ${returnRequest.status}` 
                });
            }
            
            // Update QC details
            if (qcResult) returnRequest.qcResult = qcResult;
            if (qcNotes) returnRequest.qcNotes = qcNotes;
            if (qcImages && Array.isArray(qcImages)) {
                returnRequest.qcImages = [...(returnRequest.qcImages || []), ...qcImages];
            }
            returnRequest.qcBy = supplier._id;
            returnRequest.qcDate = new Date();
            
            // Update status if provided
            if (status) {
                await returnRequest.updateStatus(status, id, `QC updated: ${qcNotes || 'No notes'}`);
            } else {
                // Auto-set status based on QC result
                if (qcResult === 'pass') {
                    await returnRequest.updateStatus('qc_passed', id, `QC Passed: ${qcNotes || 'Product acceptable'}`);
                } else if (['fail', 'partial_damage', 'missing_parts'].includes(qcResult)) {
                    await returnRequest.updateStatus('qc_failed', id, `QC Failed: ${qcNotes || 'Product not acceptable'}`);
                } else {
                    returnRequest.status = 'qc_in_progress';
                    await returnRequest.save();
                }
            }
            
            responseReturn(res, 200, {
                success: true,
                message: 'QC updated successfully',
                return: returnRequest
            });
            
        } catch (error) {
            console.error('Update Return QC Error:', error);
            responseReturn(res, 500, { error: error.message });
        }
    };
    
    // 4. Update return status
    update_return_status = async (req, res) => {
        const { returnId } = req.params;
        const { id } = req;
        const { status, notes } = req.body;
        
        try {
            const supplier = await Supplier.findOne({ user: id });
            if (!supplier) {
                return responseReturn(res, 404, { error: 'Supplier not found' });
            }
            
            const returnRequest = await ReturnRequest.findOne({
                _id: returnId,
                supplierId: supplier._id
            });
            
            if (!returnRequest) {
                return responseReturn(res, 404, { error: 'Return request not found' });
            }
            
            await returnRequest.updateStatus(status, id, notes);
            
            responseReturn(res, 200, {
                success: true,
                message: `Return status updated to ${status}`,
                return: returnRequest
            });
            
        } catch (error) {
            console.error('Update Return Status Error:', error);
            if (error.message.includes('Invalid status transition')) {
                return responseReturn(res, 400, { error: error.message });
            }
            responseReturn(res, 500, { error: error.message });
        }
    };
    
    // 5. Get return statistics for dashboard
    get_return_stats = async (req, res) => {
        const { id } = req;
        
        try {
            const supplier = await Supplier.findOne({ user: id });
            if (!supplier) {
                return responseReturn(res, 404, { error: 'Supplier not found' });
            }
            
            // Get last 30 days returns
            const thirtyDaysAgo = new Date();
            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
            
            const recentReturns = await ReturnRequest.aggregate([
                { 
                    $match: { 
                        supplierId: supplier._id,
                        createdAt: { $gte: thirtyDaysAgo }
                    } 
                },
                {
                    $group: {
                        _id: {
                            $dateToString: { format: '%Y-%m-%d', date: '$createdAt' }
                        },
                        count: { $sum: 1 },
                        refundAmount: { $sum: '$refundAmount' }
                    }
                },
                { $sort: { '_id': 1 } },
                { $limit: 30 }
            ]);
            
            // Get return reasons distribution
            const reasonsDistribution = await ReturnRequest.aggregate([
                { $match: { supplierId: supplier._id } },
                {
                    $group: {
                        _id: '$reason',
                        count: { $sum: 1 }
                    }
                },
                { $sort: { count: -1 } }
            ]);
            
            // Get QC results
            const qcResults = await ReturnRequest.aggregate([
                { 
                    $match: { 
                        supplierId: supplier._id,
                        qcResult: { $exists: true, $ne: null }
                    } 
                },
                {
                    $group: {
                        _id: '$qcResult',
                        count: { $sum: 1 }
                    }
                }
            ]);
            
            responseReturn(res, 200, {
                success: true,
                stats: {
                    recentReturns,
                    reasonsDistribution,
                    qcResults,
                    totalReturns: await ReturnRequest.countDocuments({ supplierId: supplier._id }),
                    pendingReturns: await ReturnRequest.countDocuments({ 
                        supplierId: supplier._id,
                        status: { $in: ['requested', 'approved', 'pickup_scheduled', 'picked_up', 'qc_pending', 'qc_in_progress'] }
                    })
                }
            });
            
        } catch (error) {
            console.error('Get Return Stats Error:', error);
            responseReturn(res, 500, { error: error.message });
        }
    };
    
    // ==================== RTO MANAGEMENT ====================
    
    // 6. Get all RTOs for supplier
    get_supplier_rtos = async (req, res) => {
        const { id } = req;
        let { page = 1, limit = 20, status, search, startDate, endDate } = req.query;
        
        try {
            const supplier = await Supplier.findOne({ user: id });
            if (!supplier) {
                return responseReturn(res, 404, { error: 'Supplier not found' });
            }
            
            page = parseInt(page);
            limit = parseInt(limit);
            const skip = (page - 1) * limit;
            
            // Build query
            const query = { supplierId: supplier._id };
            
            if (status && status !== 'all') {
                query.status = status;
            }
            
            if (startDate || endDate) {
                query.createdAt = {};
                if (startDate) query.createdAt.$gte = new Date(startDate);
                if (endDate) query.createdAt.$lte = new Date(endDate);
            }
            
            if (search) {
                query.$or = [
                    { rtoId: { $regex: search, $options: 'i' } },
                    { trackingId: { $regex: search, $options: 'i' } },
                    { awbNumber: { $regex: search, $options: 'i' } },
                    { courierPartner: { $regex: search, $options: 'i' } }
                ];
            }
            
            const [rtos, total] = await Promise.all([
                RTO.find(query)
                    .populate('orderId', 'orderNumber customerName totalAmount')
                    .sort({ createdAt: -1 })
                    .skip(skip)
                    .limit(limit)
                    .lean(),
                RTO.countDocuments(query)
            ]);
            
            // Get RTO statistics
            const stats = await RTO.getSupplierStats(supplier._id);
            const trends = await RTO.getSupplierTrends(supplier._id);
            
            responseReturn(res, 200, {
                success: true,
                rtos,
                pagination: {
                    page,
                    limit,
                    total,
                    pages: Math.ceil(total / limit)
                },
                stats: {
                    total: total,
                    byStatus: stats,
                    trends: trends,
                    financialImpact: {
                        totalCharges: Object.values(stats).reduce((sum, stat) => sum + (stat.totalCharges || 0), 0),
                        avgTransitDays: Object.values(stats).reduce((sum, stat) => {
                            const count = stat.count || 0;
                            const avgDays = stat.avgTransitDays || 0;
                            return sum + (avgDays * count);
                        }, 0) / (total || 1)
                    }
                }
            });
            
        } catch (error) {
            console.error('Get Supplier RTOs Error:', error);
            responseReturn(res, 500, { error: error.message });
        }
    };
    
    // 7. Get single RTO details
    get_rto_details = async (req, res) => {
        const { rtoId } = req.params;
        const { id } = req;
        
        try {
            const supplier = await Supplier.findOne({ user: id });
            if (!supplier) {
                return responseReturn(res, 404, { error: 'Supplier not found' });
            }
            
            const rto = await RTO.findOne({
                _id: rtoId,
                supplierId: supplier._id
            })
            .populate('orderId', 'orderNumber customerName totalAmount delivery_address delivery_status')
            .populate('qcBy', 'businessDetails.shopName')
            .lean();
            
            if (!rto) {
                return responseReturn(res, 404, { error: 'RTO not found' });
            }
            
            responseReturn(res, 200, {
                success: true,
                rto
            });
            
        } catch (error) {
            console.error('Get RTO Details Error:', error);
            responseReturn(res, 500, { error: error.message });
        }
    };
    
    // 8. Acknowledge RTO receipt (supplier action)
    acknowledge_rto_receipt = async (req, res) => {
        const { rtoId } = req.params;
        const { id } = req;
        const { productCondition, damageDescription, qcNotes, qcImages } = req.body;
        
        try {
            const supplier = await Supplier.findOne({ user: id });
            if (!supplier) {
                return responseReturn(res, 404, { error: 'Supplier not found' });
            }
            
            const rto = await RTO.findOne({
                _id: rtoId,
                supplierId: supplier._id,
                status: { $in: ['received', 'initiated', 'acknowledged'] }
            });
            
            if (!rto) {
                return responseReturn(res, 404, { 
                    error: 'RTO not found or cannot be acknowledged in current status' 
                });
            }
            
            // Update RTO details
            if (productCondition) rto.productCondition = productCondition;
            if (damageDescription) rto.damageDescription = damageDescription;
            if (qcNotes) rto.qcNotes = qcNotes;
            if (qcImages && Array.isArray(qcImages)) {
                rto.qcImages = [...(rto.qcImages || []), ...qcImages];
            }
            
            // Determine if product is resalable
            rto.isResalable = ['new', 'like_new', 'sealed', 'minor_damage'].includes(productCondition);
            
            // Update status to QC pending
            await rto.updateStatus('qc_pending', id, `RTO acknowledged by supplier. Condition: ${productCondition}`);
            
            // Calculate financial impact
            rto.calculateFinancialImpact();
            await rto.save();
            
            responseReturn(res, 200, {
                success: true,
                message: 'RTO acknowledged successfully',
                rto
            });
            
        } catch (error) {
            console.error('Acknowledge RTO Receipt Error:', error);
            responseReturn(res, 500, { error: error.message });
        }
    };
    
    // 9. Update RTO QC status
    update_rto_qc = async (req, res) => {
        const { rtoId } = req.params;
        const { id } = req;
        const { qcStatus, qcNotes, disposalMethod, restockLocation, newSkuId } = req.body;
        
        try {
            const supplier = await Supplier.findOne({ user: id });
            if (!supplier) {
                return responseReturn(res, 404, { error: 'Supplier not found' });
            }
            
            const rto = await RTO.findOne({
                _id: rtoId,
                supplierId: supplier._id,
                status: 'qc_pending'
            });
            
            if (!rto) {
                return responseReturn(res, 404, { 
                    error: 'RTO not found or not in QC pending status' 
                });
            }
            
            // Update QC details
            if (qcStatus) rto.qcStatus = qcStatus;
            if (qcNotes) rto.qcNotes = qcNotes;
            rto.qcBy = supplier._id;
            rto.qcDate = new Date();
            
            // Determine next status based on QC result
            let nextStatus = 'qc_completed';
            if (disposalMethod) rto.disposalMethod = disposalMethod;
            if (restockLocation) rto.restockLocation = restockLocation;
            if (newSkuId) rto.newSkuId = newSkuId;
            
            // Update status
            await rto.updateStatus(nextStatus, id, `QC completed: ${qcNotes || 'No notes'}`);
            
            // Auto-set restocked/disposed based on QC status
            if (qcStatus === 'passed' && rto.isResalable) {
                rto.restockDate = new Date();
                await rto.updateStatus('restocked', id, 'Product restocked for resale');
            } else if (['failed', 'partial_damage'].includes(qcStatus)) {
                rto.disposalMethod = disposalMethod || 'destroyed';
                await rto.updateStatus('disposed', id, `Product disposed: ${disposalMethod}`);
            }
            
            responseReturn(res, 200, {
                success: true,
                message: 'RTO QC updated successfully',
                rto
            });
            
        } catch (error) {
            console.error('Update RTO QC Error:', error);
            responseReturn(res, 500, { error: error.message });
        }
    };
    
    // 10. Update RTO status
    update_rto_status = async (req, res) => {
        const { rtoId } = req.params;
        const { id } = req;
        const { status, notes } = req.body;
        
        try {
            const supplier = await Supplier.findOne({ user: id });
            if (!supplier) {
                return responseReturn(res, 404, { error: 'Supplier not found' });
            }
            
            const rto = await RTO.findOne({
                _id: rtoId,
                supplierId: supplier._id
            });
            
            if (!rto) {
                return responseReturn(res, 404, { error: 'RTO not found' });
            }
            
            await rto.updateStatus(status, id, notes);
            
            responseReturn(res, 200, {
                success: true,
                message: `RTO status updated to ${status}`,
                rto
            });
            
        } catch (error) {
            console.error('Update RTO Status Error:', error);
            if (error.message.includes('Invalid RTO status transition')) {
                return responseReturn(res, 400, { error: error.message });
            }
            responseReturn(res, 500, { error: error.message });
        }
    };
    
    // 11. Get RTO statistics for dashboard
    get_rto_stats = async (req, res) => {
        const { id } = req;
        
        try {
            const supplier = await Supplier.findOne({ user: id });
            if (!supplier) {
                return responseReturn(res, 404, { error: 'Supplier not found' });
            }
            
            const stats = await RTO.getSupplierStats(supplier._id);
            const trends = await RTO.getSupplierTrends(supplier._id);
            
            // Calculate financial metrics
            const totalRTOs = await RTO.countDocuments({ supplierId: supplier._id });
            const pendingRTOs = await RTO.countDocuments({ 
                supplierId: supplier._id,
                status: { $in: ['initiated', 'acknowledged', 'in_transit', 'received', 'qc_pending'] }
            });
            
            const totalCharges = Object.values(stats).reduce((sum, stat) => sum + (stat.totalCharges || 0), 0);
            const avgTransitDays = Object.values(stats).reduce((sum, stat) => {
                const count = stat.count || 0;
                const avgDays = stat.avgTransitDays || 0;
                return sum + (avgDays * count);
            }, 0) / (totalRTOs || 1);
            
            responseReturn(res, 200, {
                success: true,
                stats: {
                    total: totalRTOs,
                    pending: pendingRTOs,
                    byStatus: stats,
                    trends: trends,
                    financial: {
                        totalCharges,
                        avgTransitDays: Math.round(avgTransitDays * 10) / 10,
                        avgChargesPerRTO: totalRTOs > 0 ? Math.round((totalCharges / totalRTOs) * 100) / 100 : 0
                    }
                }
            });
            
        } catch (error) {
            console.error('Get RTO Stats Error:', error);
            responseReturn(res, 500, { error: error.message });
        }
    };
    
    // 12. Get combined return & RTO dashboard stats
    get_combined_dashboard_stats = async (req, res) => {
        const { id } = req;
        
        try {
            const supplier = await Supplier.findOne({ user: id });
            if (!supplier) {
                return responseReturn(res, 404, { error: 'Supplier not found' });
            }
            
            // Get return stats
            const returnStats = await ReturnRequest.aggregate([
                { $match: { supplierId: supplier._id } },
                {
                    $facet: {
                        byStatus: [
                            { $group: { _id: '$status', count: { $sum: 1 } } }
                        ],
                        byReason: [
                            { $group: { _id: '$reason', count: { $sum: 1 } } }
                        ],
                        recent: [
                            { $sort: { createdAt: -1 } },
                            { $limit: 10 }
                        ]
                    }
                }
            ]);
            
            // Get RTO stats
            const rtoStats = await RTO.aggregate([
                { $match: { supplierId: supplier._id } },
                {
                    $facet: {
                        byStatus: [
                            { $group: { _id: '$status', count: { $sum: 1 } } }
                        ],
                        byReason: [
                            { $group: { _id: '$reason', count: { $sum: 1 } } }
                        ],
                        financial: [
                            {
                                $group: {
                                    _id: null,
                                    totalCharges: { $sum: { $add: ['$shippingCost', '$rtoCharges', '$penaltyAmount'] } },
                                    avgTransitDays: { 
                                        $avg: { 
                                            $cond: [
                                                { $and: ['$inTransitAt', '$receivedAt'] },
                                                { $divide: [{ $subtract: ['$receivedAt', '$inTransitAt'] }, 1000 * 60 * 60 * 24] },
                                                null
                                            ]
                                        }
                                    }
                                }
                            }
                        ]
                    }
                }
            ]);
            
            // Calculate totals
            const totalReturns = await ReturnRequest.countDocuments({ supplierId: supplier._id });
            const totalRTOs = await RTO.countDocuments({ supplierId: supplier._id });
            
            const pendingReturns = await ReturnRequest.countDocuments({ 
                supplierId: supplier._id,
                status: { $in: ['requested', 'approved', 'pickup_scheduled', 'picked_up', 'qc_pending', 'qc_in_progress'] }
            });
            
            const pendingRTOs = await RTO.countDocuments({ 
                supplierId: supplier._id,
                status: { $in: ['initiated', 'acknowledged', 'in_transit', 'received', 'qc_pending'] }
            });
            
            responseReturn(res, 200, {
                success: true,
                dashboard: {
                    summary: {
                        totalReturns,
                        totalRTOs,
                        pendingReturns,
                        pendingRTOs,
                        totalPending: pendingReturns + pendingRTOs
                    },
                    returns: {
                        byStatus: returnStats[0]?.byStatus || [],
                        byReason: returnStats[0]?.byReason || [],
                        recent: returnStats[0]?.recent || []
                    },
                    rtos: {
                        byStatus: rtoStats[0]?.byStatus || [],
                        byReason: rtoStats[0]?.byReason || [],
                        financial: rtoStats[0]?.financial?.[0] || { totalCharges: 0, avgTransitDays: 0 }
                    }
                }
            });
            
        } catch (error) {
            console.error('Get Combined Dashboard Stats Error:', error);
            responseReturn(res, 500, { error: error.message });
        }
    };
}

module.exports = new ReturnRTOCController();
           