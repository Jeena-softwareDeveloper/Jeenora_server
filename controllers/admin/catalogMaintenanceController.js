const WearProduct = require('../../models/partner/WearProduct');
const Supplier = require('../../models/partner/Supplier');
const { responseReturn } = require('../../utils/response');
const mongoose = require('mongoose');

class CatalogMaintenanceController {
    
    // ==================== CATALOG SYNC & MAINTENANCE ====================
    
    // 1. Get catalog sync status
    get_catalog_sync_status = async (req, res) => {
        const { id } = req; // supplier user ID
        
        try {
            const supplier = await Supplier.findOne({ user: id });
            if (!supplier) {
                return responseReturn(res, 404, { error: 'Supplier not found' });
            }
            
            // Get all supplier products
            const products = await WearProduct.find({ partnerId: supplier._id });
            
            // Calculate sync status
            const totalProducts = products.length;
            const activeProducts = products.filter(p => p.status === 'active').length;
            const pendingProducts = products.filter(p => p.status === 'pending').length;
            const rejectedProducts = products.filter(p => p.status === 'rejected').length;
            const outOfStockProducts = products.filter(p => p.stock <= 0).length;
            
            // Get products needing attention
            const needsAttention = products.filter(p => 
                p.status === 'pending' || 
                p.stock <= 0 || 
                (p.lastSync && Date.now() - new Date(p.lastSync).getTime() > 7 * 24 * 60 * 60 * 1000)
            ).length;
            
            // Get sync history
            const syncHistory = await this.getSyncHistory(supplier._id);
            
            responseReturn(res, 200, {
                success: true,
                status: {
                    summary: {
                        totalProducts,
                        activeProducts,
                        pendingProducts,
                        rejectedProducts,
                        outOfStockProducts,
                        needsAttention
                    },
                    syncStatus: {
                        lastSync: syncHistory[0]?.timestamp || null,
                        syncFrequency: 'daily',
                        nextSync: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours from now
                        autoSyncEnabled: true
                    },
                    issues: await this.getCatalogIssues(supplier._id, products),
                    recommendations: await this.getCatalogRecommendations(supplier._id, products)
                }
            });
            
        } catch (error) {
            console.error('Get Catalog Sync Status Error:', error);
            responseReturn(res, 500, { error: error.message });
        }
    };
    
    // 2. Sync catalog with platform
    sync_catalog = async (req, res) => {
        const { id } = req;
        const { syncType = 'full', force = false } = req.body;
        
        try {
            const supplier = await Supplier.findOne({ user: id });
            if (!supplier) {
                return responseReturn(res, 404, { error: 'Supplier not found' });
            }
            
            // Record sync start
            const syncId = `SYNC-${Date.now()}-${supplier._id.toString().slice(-6)}`;
            const syncStart = new Date();
            
            // Get products to sync
            const query = { partnerId: supplier._id };
            
            if (syncType === 'pending') {
                query.status = 'pending';
            } else if (syncType === 'active') {
                query.status = 'active';
            } else if (syncType === 'out_of_stock') {
                query.stock = { $lte: 0 };
            }
            
            const products = await WearProduct.find(query);
            
            // Simulate sync process
            const syncResults = {
                syncId,
                supplierId: supplier._id,
                syncType,
                startTime: syncStart,
                totalProducts: products.length,
                processed: 0,
                succeeded: 0,
                failed: 0,
                details: []
            };
            
            // Process each product
            for (const product of products) {
                try {
                    // Update last sync timestamp
                    product.lastSync = new Date();
                    
                    // Check for issues
                    const issues = await this.checkProductIssues(product);
                    
                    if (issues.length > 0 && !force) {
                        syncResults.failed++;
                        syncResults.details.push({
                            productId: product._id,
                            sku: product.sku,
                            status: 'failed',
                            reason: 'Product has issues',
                            issues
                        });
                        continue;
                    }
                    
                    // Update sync status
                    if (product.status === 'pending') {
                        product.status = 'active';
                    }
                    
                    await product.save();
                    
                    syncResults.succeeded++;
                    syncResults.details.push({
                        productId: product._id,
                        sku: product.sku,
                        status: 'succeeded',
                        changes: ['lastSync updated', 'status activated']
                    });
                    
                } catch (error) {
                    syncResults.failed++;
                    syncResults.details.push({
                        productId: product._id,
                        sku: product.sku,
                        status: 'failed',
                        reason: error.message
                    });
                }
                
                syncResults.processed++;
            }
            
            syncResults.endTime = new Date();
            syncResults.duration = syncResults.endTime - syncResults.startTime;
            
            // Save sync record
            await this.saveSyncRecord(syncResults);
            
            responseReturn(res, 200, {
                success: true,
                message: `Catalog sync completed: ${syncResults.succeeded} succeeded, ${syncResults.failed} failed`,
                syncResults
            });
            
        } catch (error) {
            console.error('Sync Catalog Error:', error);
            responseReturn(res, 500, { error: error.message });
        }
    };
    
    // 3. Bulk update catalog
    bulk_update_catalog = async (req, res) => {
        const { id } = req;
        const { updates, operation } = req.body; // updates: array of { productId, changes }
        
        try {
            const supplier = await Supplier.findOne({ user: id });
            if (!supplier) {
                return responseReturn(res, 404, { error: 'Supplier not found' });
            }
            
            if (!Array.isArray(updates) || updates.length === 0) {
                return responseReturn(res, 400, { error: 'No updates provided' });
            }
            
            if (updates.length > 100) {
                return responseReturn(res, 400, { error: 'Maximum 100 products per bulk update' });
            }
            
            const results = {
                total: updates.length,
                succeeded: 0,
                failed: 0,
                details: []
            };
            
            // Process bulk updates
            for (const update of updates) {
                try {
                    const product = await WearProduct.findOne({
                        _id: update.productId,
                        partnerId: supplier._id
                    });
                    
                    if (!product) {
                        results.failed++;
                        results.details.push({
                            productId: update.productId,
                            status: 'failed',
                            reason: 'Product not found or not authorized'
                        });
                        continue;
                    }
                    
                    // Apply updates based on operation
                    switch (operation) {
                        case 'update_price':
                            if (update.changes.price !== undefined) {
                                product.price = update.changes.price;
                                product.lastPriceUpdate = new Date();
                            }
                            break;
                            
                        case 'update_stock':
                            if (update.changes.stock !== undefined) {
                                product.stock = update.changes.stock;
                                product.lastStockUpdate = new Date();
                            }
                            break;
                            
                        case 'update_status':
                            if (update.changes.status) {
                                product.status = update.changes.status;
                            }
                            break;
                            
                        case 'update_all':
                            Object.keys(update.changes).forEach(key => {
                                if (product[key] !== undefined) {
                                    product[key] = update.changes[key];
                                }
                            });
                            break;
                            
                        default:
                            throw new Error(`Invalid operation: ${operation}`);
                    }
                    
                    await product.save();
                    
                    results.succeeded++;
                    results.details.push({
                        productId: product._id,
                        sku: product.sku,
                        status: 'succeeded',
                        changes: update.changes
                    });
                    
                } catch (error) {
                    results.failed++;
                    results.details.push({
                        productId: update.productId,
                        status: 'failed',
                        reason: error.message
                    });
                }
            }
            
            responseReturn(res, 200, {
                success: true,
                message: `Bulk update completed: ${results.succeeded} succeeded, ${results.failed} failed`,
                results
            });
            
        } catch (error) {
            console.error('Bulk Update Catalog Error:', error);
            responseReturn(res, 500, { error: error.message });
        }
    };
    
    // 4. Get catalog analytics
    get_catalog_analytics = async (req, res) => {
        const { id } = req;
        const { period = 'month', startDate, endDate } = req.query;
        
        try {
            const supplier = await Supplier.findOne({ user: id });
            if (!supplier) {
                return responseReturn(res, 404, { error: 'Supplier not found' });
            }
            
            // Date range
            let start, end;
            if (startDate && endDate) {
                start = new Date(startDate);
                end = new Date(endDate);
            } else {
                end = new Date();
                start = new Date();
                
                switch (period) {
                    case 'week':
                        start.setDate(start.getDate() - 7);
                        break;
                    case 'month':
                        start.setMonth(start.getMonth() - 1);
                        break;
                    case 'quarter':
                        start.setMonth(start.getMonth() - 3);
                        break;
                    case 'year':
                        start.setFullYear(start.getFullYear() - 1);
                        break;
                    default:
                        start.setMonth(start.getMonth() - 1);
                }
            }
            
            start.setHours(0, 0, 0, 0);
            end.setHours(23, 59, 59, 999);
            
            // Get products
            const products = await WearProduct.find({
                partnerId: supplier._id,
                createdAt: { $gte: start, $lte: end }
            });
            
            // Calculate analytics
            const analytics = {
                period: { start, end },
                summary: {
                    totalProducts: products.length,
                    activeProducts: products.filter(p => p.status === 'active').length,
                    newProducts: products.filter(p => 
                        p.createdAt >= start && p.createdAt <= end
                    ).length,
                    avgPrice: products.length > 0 ? 
                        products.reduce((sum, p) => sum + (p.price || 0), 0) / products.length : 0,
                    avgStock: products.length > 0 ? 
                        products.reduce((sum, p) => sum + (p.stock || 0), 0) / products.length : 0
                },
                byCategory: await this.getProductsByCategory(products),
                byStatus: await this.getProductsByStatus(products),
                performance: await this.getProductPerformance(supplier._id, start, end),
                trends: await this.getCatalogTrends(supplier._id, start, end)
            };
            
            responseReturn(res, 200, {
                success: true,
                analytics
            });
            
        } catch (error) {
            console.error('Get Catalog Analytics Error:', error);
            responseReturn(res, 500, { error: error.message });
        }
    };
    
    // 5. Export catalog data
    export_catalog_data = async (req, res) => {
        const { id } = req;
        const { format = 'json', include = 'all' } = req.query;
        
        try {
            const supplier = await Supplier.findOne({ user: id });
            if (!supplier) {
                return responseReturn(res, 404, { error: 'Supplier not found' });
            }
            
            // Build query
            const query = { partnerId: supplier._id };
            
            if (include === 'active') {
                query.status = 'active';
            } else if (include === 'pending') {
                query.status = 'pending';
            } else if (include === 'out_of_stock') {
                query.stock = { $lte: 0 };
            }
            
            const products = await WearProduct.find(query)
                .select('-__v -createdAt -updatedAt')
                .lean();
            
            // Format data based on requested format
            let exportData;
            let contentType;
            let filename;
            
            switch (format) {
                case 'json':
                    exportData = JSON.stringify(products, null, 2);
                    contentType = 'application/json';
                    filename = `catalog-export-${Date.now()}.json`;
                    break;
                    
                case 'csv':
                    exportData = this.convertToCSV(products);
                    contentType = 'text/csv';
                    filename = `catalog-export-${Date.now()}.csv`;
                    break;
                    
                case 'excel':
                    // For Excel, we'd use a library like exceljs
                    // For now, return CSV
                    exportData = this.convertToCSV(products);
                    contentType = 'application/vnd.ms-excel';
                    filename = `catalog-export-${Date.now()}.xlsx`;
                    break;
                    
                default:
                    return responseReturn(res, 400, { error: 'Unsupported format' });
            }
            
            responseReturn(res, 200, {
                success: true,
                message: 'Catalog data exported successfully',
                export: {
                    format,
                    itemCount: products.length,
                    downloadUrl: `/api/catalog/export/${filename}`, // Mock URL
                    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours
                }
            });
            
        } catch (error) {
            console.error('Export Catalog Data Error:', error);
            responseReturn(res, 500, { error: error.message });
        }
    };
    
    // 6. Import catalog data
    import_catalog_data = async (req, res) => {
        const { id } = req;
        const { data, format = 'json', action = 'validate' } = req.body;
        
        try {
            const supplier = await Supplier.findOne({ user: id });
            if (!supplier) {
                return responseReturn(res, 404, { error: 'Supplier not found' });
            }
            
            if (!data) {
                return responseReturn(res, 400, { error: 'No data provided' });
            }
            
            // Parse data based on format
            let products;
            try {
                if (format === 'json') {
                    products = JSON.parse(data);
                } else if (format === 'csv') {
                    products = this.parseCSV(data);
                } else {
                    return responseReturn(res, 400, { error: 'Unsupported format' });
                }
            } catch (parseError) {
                return responseReturn(res, 400, { error: `Failed to parse ${format}: ${parseError.message}` });
            }
            
            if (!Array.isArray(products)) {
                return responseReturn(res, 400, { error: 'Data must be an array of products' });
            }
            
            if (products.length > 1000) {
                return responseReturn(res, 400, { error: 'Maximum 1000 products per import' });
            }
            
            // Validate products
            const validationResults = await this.validateImportProducts(products, supplier._id);
            
            if (action === 'validate') {
                return responseReturn(res, 200, {
                    success: true,
                    message: 'Import validation completed',
                    validation: validationResults,
                    nextSteps: 'Send action: "import" to proceed with import'
                });
            }
            
            if (action === 'import') {
                // Import products
                const importResults = await this.importProducts(validationResults.validProducts, supplier._id);
                
                responseReturn(res, 200, {
                    success: true,
                    message: 'Import completed',
                    import: importResults,
                    summary: {
                        total: products.length,
                        imported: importResults.succeeded,
                        skipped: importResults.failed,
                        duplicates: validationResults.duplicates.length
                    }
                });
            } else {
                return responseReturn(res, 400, { error: 'Invalid action' });
            }
            
        } catch (error) {
            console.error('Import Catalog Data Error:', error);
            responseReturn(res, 500, { error: error.message });
        }
    };
    
    // ==================== HELPER METHODS ====================
    
    // Helper: Get sync history
    getSyncHistory = async (supplierId) => {
        // Mock sync history
        return [
            {
                syncId: `SYNC-${Date.now() - 86400000}-${supplierId.toString().slice(-6)}`,
                timestamp: new Date(Date.now() - 86400000),
                type: 'auto',
                status: 'completed',
                productsSynced: 45,
                duration: 12000 // ms
            },
            {
                syncId: `SYNC-${Date.now() - 172800000}-${supplierId.toString().slice(-6)}`,
                timestamp: new Date(Date.now() - 172800000),
                type: 'manual',
                status: 'completed',
                productsSynced: 23,
                duration: 8000
            }
        ];
    };
    
    // Helper: Get catalog issues
    getCatalogIssues = async (supplierId, products) => {
        const issues = [];
        
        // Check for products with missing images
        const missingImages = products.filter(p => 
            !p.images || p.images.length === 0 || p.images.some(img => !img || img === '')
        );
        
        if (missingImages.length > 0) {
            issues.push({
                type: 'missing_images',
                count: missingImages.length,
                severity: 'high',
                message: `${missingImages.length} products have missing or invalid images`,
                products: missingImages.map(p => ({ id: p._id, sku: p.sku }))
            });
        }
        
        // Check for products with low stock
        const lowStock = products.filter(p => p.stock > 0 && p.stock <= 5);
        
        if (lowStock.length > 0) {
            issues.push({
                type: 'low_stock',
                count: lowStock.length,
                severity: 'medium',
                message: `${lowStock.length} products have low stock (≤ 5 units)`,
                products: lowStock.map(p => ({ id: p._id, sku: p.sku, stock: p.stock }))
            });
        }
        
        // Check for products with outdated sync
        const outdatedSync = products.filter(p => 
            p.lastSync && Date.now() - new Date(p.lastSync).getTime() > 7 * 24 * 60 * 60 * 1000
        );
        
        if (outdatedSync.length > 0) {
            issues.push({
                type: 'outdated_sync',
                count: outdatedSync.length,
                severity: 'low',
                message: `${outdatedSync.length} products haven't been synced in over 7 days`,
                products: outdatedSync.map(p => ({ 
                    id: p._id, 
                    sku: p.sku, 
                    lastSync: p.lastSync 
                }))
            });
        }
        
        // Check for products with missing prices
        const missingPrices = products.filter(p => !p.price || p.price <= 0);
        
        if (missingPrices.length > 0) {
            issues.push({
                type: 'missing_price',
                count: missingPrices.length,
                severity: 'high',
                message: `${missingPrices.length} products have missing or invalid prices`,
                products: missingPrices.map(p => ({ id: p._id, sku: p.sku }))
            });
        }
        
        return issues;
    };
    
    // Helper: Get catalog recommendations
    getCatalogRecommendations = async (supplierId, products) => {
        const recommendations = [];
        
        // Recommendation: Optimize prices
        const highPricedProducts = products.filter(p => p.price > 5000);
        if (highPricedProducts.length > 0) {
            recommendations.push({
                type: 'price_optimization',
                priority: 'medium',
                message: `Consider optimizing prices for ${highPricedProducts.length} high-priced products`,
                action: 'Review pricing strategy',
                products: highPricedProducts.map(p => ({ id: p._id, sku: p.sku, price: p.price }))
            });
        }
        
        // Recommendation: Add more products in popular categories
        const popularCategories = ['tshirts', 'jeans', 'shirts', 'dresses'];
        const categoryCounts = {};
        
        products.forEach(p => {
            if (p.category) {
                categoryCounts[p.category] = (categoryCounts[p.category] || 0) + 1;
            }
        });
        
        const underrepresentedCategories = popularCategories.filter(cat => 
            !categoryCounts[cat] || categoryCounts[cat] < 5
        );
        
        if (underrepresentedCategories.length > 0) {
            recommendations.push({
                type: 'category_expansion',
                priority: 'low',
                message: `Consider adding products in underrepresented categories: ${underrepresentedCategories.join(', ')}`,
                action: 'Expand catalog in popular categories'
            });
        }
        
        // Recommendation: Improve product descriptions
        const shortDescriptions = products.filter(p => 
            !p.description || p.description.length < 50
        );
        
        if (shortDescriptions.length > 0) {
            recommendations.push({
                type: 'description_improvement',
                priority: 'medium',
                message: `${shortDescriptions.length} products have short descriptions`,
                action: 'Enhance product descriptions for better SEO',
                products: shortDescriptions.map(p => ({ id: p._id, sku: p.sku }))
            });
        }
        
        return recommendations;
    };
    
    // Helper: Check product issues
    checkProductIssues = async (product) => {
        const issues = [];
        
        if (!product.images || product.images.length === 0) {
            issues.push('Missing images');
        }
        
        if (!product.price || product.price <= 0) {
            issues.push('Invalid price');
        }
        
        if (!product.description || product.description.length < 20) {
            issues.push('Short description');
        }
        
        if (product.stock < 0) {
            issues.push('Negative stock');
        }
        
        return issues;
    };
    
    // Helper: Save sync record
    saveSyncRecord = async (syncResults) => {
        // In a real system, save to database
        // For now, just log
        console.log('Sync record saved:', syncResults.syncId);
        return true;
    };
    
    // Helper: Get products by category
    getProductsByCategory = async (products) => {
        const categoryMap = {};
        
        products.forEach(product => {
            const category = product.category || 'uncategorized';
            categoryMap[category] = (categoryMap[category] || 0) + 1;
        });
        
        return Object.entries(categoryMap).map(([category, count]) => ({
            category,
            count,
            percentage: (count / products.length) * 100
        })).sort((a, b) => b.count - a.count);
    };
    
    // Helper: Get products by status
    getProductsByStatus = async (products) => {
        const statusMap = {};
        
        products.forEach(product => {
            const status = product.status || 'unknown';
            statusMap[status] = (statusMap[status] || 0) + 1;
        });
        
        return Object.entries(statusMap).map(([status, count]) => ({
            status,
            count,
            percentage: (count / products.length) * 100
        }));
    };
    
    // Helper: Get product performance
    getProductPerformance = async (supplierId, startDate, endDate) => {
        // Mock performance data
        return {
            topPerformers: [
                { productId: 'prod1', sku: 'JEEN-TSH-ABC123', sales: 45, revenue: 22500 },
                { productId: 'prod2', sku: 'JEEN-JNS-XYZ789', sales: 32, revenue: 25600 },
                { productId: 'prod3', sku: 'JEEN-SHR-DEF456', sales: 28, revenue: 19600 }
            ],
            lowPerformers: [
                { productId: 'prod4', sku: 'JEEN-DRS-GHI789', sales: 2, revenue: 1000 },
                { productId: 'prod5', sku: 'JEEN-JKT-JKL012', sales: 3, revenue: 4500 }
            ],
            conversionRate: 3.2, // percentage
            avgOrderValue: 1250,
            returnRate: 1.5 // percentage
        };
    };
    
    // Helper: Get catalog trends
    getCatalogTrends = async (supplierId, startDate, endDate) => {
        // Mock trend data
        return {
            newProducts: [
                { month: 'Jan', count: 12 },
                { month: 'Feb', count: 18 },
                { month: 'Mar', count: 15 }
            ],
            priceTrend: [
                { month: 'Jan', avgPrice: 850 },
                { month: 'Feb', avgPrice: 920 },
                { month: 'Mar', avgPrice: 880 }
            ],
            stockTrend: [
                { month: 'Jan', avgStock: 45 },
                { month: 'Feb', avgStock: 38 },
                { month: 'Mar', avgStock: 42 }
            ]
        };
    };
    
    // Helper: Convert to CSV
    convertToCSV = (products) => {
        if (products.length === 0) return '';
        
        const headers = Object.keys(products[0]).join(',');
        const rows = products.map(product => 
            Object.values(product).map(value => 
                typeof value === 'string' ? `"${value.replace(/"/g, '""')}"` : value
            ).join(',')
        );
        
        return [headers, ...rows].join('\n');
    };
    
    // Helper: Parse CSV
    parseCSV = (csvData) => {
        // Simple CSV parser
        const lines = csvData.split('\n');
        const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
        
        return lines.slice(1).map(line => {
            const values = line.split(',').map(v => v.trim().replace(/"/g, ''));
            const product = {};
            
            headers.forEach((header, index) => {
                if (values[index] !== undefined) {
                    // Try to parse numbers
                    const numValue = parseFloat(values[index]);
                    product[header] = isNaN(numValue) ? values[index] : numValue;
                }
            });
            
            return product;
        }).filter(product => Object.keys(product).length > 0);
    };
    
    // Helper: Validate import products
    validateImportProducts = async (products, supplierId) => {
        const validationResults = {
            validProducts: [],
            invalidProducts: [],
            duplicates: [],
            issues: []
        };
        
        const existingSkus = new Set();
        
        for (const product of products) {
            const issues = [];
            
            // Check required fields
            if (!product.name) issues.push('Missing product name');
            if (!product.sku) issues.push('Missing SKU');
            if (!product.price || product.price <= 0) issues.push('Invalid price');
            if (!product.category) issues.push('Missing category');
            
            // Check for duplicates
            if (product.sku && existingSkus.has(product.sku)) {
                validationResults.duplicates.push({
                    sku: product.sku,
                    product
                });
                continue;
            }
            
            if (issues.length > 0) {
                validationResults.invalidProducts.push({
                    product,
                    issues
                });
            } else {
                validationResults.validProducts.push(product);
                existingSkus.add(product.sku);
            }
        }
        
        return validationResults;
    };
    
    // Helper: Import products
    importProducts = async (products, supplierId) => {
        const importResults = {
            succeeded: 0,
            failed: 0,
            details: []
        };
        
        for (const productData of products) {
            try {
                // Check if product already exists
                const existingProduct = await WearProduct.findOne({
                    sku: productData.sku,
                    partnerId: supplierId
                });
                
                if (existingProduct) {
                    // Update existing product
                    Object.keys(productData).forEach(key => {
                        if (productData[key] !== undefined) {
                            existingProduct[key] = productData[key];
                        }
                    });
                    
                    await existingProduct.save();
                    
                    importResults.details.push({
                        sku: productData.sku,
                        action: 'updated',
                        productId: existingProduct._id
                    });
                } else {
                    // Create new product
                    const newProduct = new WearProduct({
                        ...productData,
                        partnerId: supplierId,
                        status: 'pending',
                        createdAt: new Date(),
                        updatedAt: new Date()
                    });
                    
                    await newProduct.save();
                    
                    importResults.details.push({
                        sku: productData.sku,
                        action: 'created',
                        productId: newProduct._id
                    });
                }
                
                importResults.succeeded++;
                
            } catch (error) {
                importResults.failed++;
                importResults.details.push({
                    sku: productData.sku,
                    action: 'failed',
                    error: error.message
                });
            }
        }
        
        return importResults;
    };
}

module.exports = new CatalogMaintenanceController();
