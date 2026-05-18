const express = require('express');
const router = express.Router();
const supplierController = require('../../controllers/partner/supplierController');
const returnRTOCController = require('../../controllers/customer/returnRTOCController');
const settlementController = require('../../controllers/partner/settlementController');
const catalogMaintenanceController = require('../../controllers/admin/catalogMaintenanceController');
const supportCommunicationController = require('../../controllers/admin/supportCommunicationController');
const securityController = require('../../controllers/admin/securityController');
const supplierStockController = require('../../controllers/partner/supplierStockController');
const b2bOrderController = require('../../controllers/partner/b2bOrderController');
const { authMiddleware } = require('../../middlewares/authMiddleware');

// ==================== B2B ORDER ROUTES ====================
router.get('/b2b/orders', authMiddleware, b2bOrderController.get_partner_b2b_orders);
router.get('/b2b/orders/:orderId', authMiddleware, b2bOrderController.get_partner_b2b_order);
router.post('/b2b/orders/:orderId/accept', authMiddleware, b2bOrderController.accept_order);
router.post('/b2b/orders/:orderId/reject', authMiddleware, b2bOrderController.reject_order);
router.patch('/b2b/orders/:orderId/status', authMiddleware, b2bOrderController.update_b2b_status);
router.get('/b2b/rejection-reasons', b2bOrderController.get_rejection_reasons);

// ==================== SUPPLIER STOCK (ERP) ROUTES ====================
router.get('/stock/hsn-gst', supplierStockController.get_hsn_gst); // Public — no auth needed
router.get('/stock/list', authMiddleware, supplierStockController.get_stock_list);
router.get('/stock/alerts', authMiddleware, supplierStockController.get_inventory_alerts);
router.get('/stock/:id', authMiddleware, supplierStockController.get_stock_detail);
router.post('/stock/add', authMiddleware, supplierStockController.add_stock);
router.patch('/stock/:id', authMiddleware, supplierStockController.update_stock);
router.post('/stock/:id/request-listing', authMiddleware, supplierStockController.request_listing);
router.patch('/stock/:id/stock-update', authMiddleware, supplierStockController.update_variant_stock);
router.patch('/stock/:id/bulk-stock-update', authMiddleware, supplierStockController.bulk_update_variant_stock);
router.patch('/stock/:id/warehouse', authMiddleware, supplierStockController.update_warehouse_location);

router.post('/apply', authMiddleware, supplierController.apply_supplier);
router.post('/add', authMiddleware, supplierController.add_supplier);
router.get('/status', authMiddleware, (req, res, next) => {
    next();
}, supplierController.get_my_status);
router.post('/verify-bank', authMiddleware, supplierController.verify_bank);
router.post('/verify-ifsc', authMiddleware, supplierController.verify_ifsc);
router.post('/verify-pincode', authMiddleware, supplierController.verify_pincode);
router.post('/send-email-otp', authMiddleware, supplierController.send_verification_email);
router.post('/verify-email-otp', authMiddleware, supplierController.verify_email_otp);
router.post('/mark-congrats', authMiddleware, supplierController.mark_congrats_shown);

router.get('/dashboard-stats', authMiddleware, supplierController.get_supplier_dashboard_data);
router.get('/orders', authMiddleware, supplierController.get_supplier_orders);
router.put('/order-status/:orderId', authMiddleware, supplierController.update_order_status);
router.get('/order/:orderId', authMiddleware, supplierController.get_order_details);
router.get('/payouts', authMiddleware, supplierController.get_supplier_payouts);
router.get('/returns', authMiddleware, supplierController.get_supplier_returns);

// ==================== RETURN & RTO MANAGEMENT ROUTES ====================
// Returns Management
router.get('/returns/v2', authMiddleware, returnRTOCController.get_supplier_returns);
router.get('/returns/:returnId', authMiddleware, returnRTOCController.get_return_details);
router.put('/returns/:returnId/qc', authMiddleware, returnRTOCController.update_return_qc);
router.put('/returns/:returnId/status', authMiddleware, returnRTOCController.update_return_status);
router.get('/returns-stats/dashboard', authMiddleware, returnRTOCController.get_return_stats);

// RTO Management
router.get('/rtos', authMiddleware, returnRTOCController.get_supplier_rtos);
router.get('/rtos/:rtoId', authMiddleware, returnRTOCController.get_rto_details);
router.post('/rtos/:rtoId/acknowledge', authMiddleware, returnRTOCController.acknowledge_rto_receipt);
router.put('/rtos/:rtoId/qc', authMiddleware, returnRTOCController.update_rto_qc);
router.put('/rtos/:rtoId/status', authMiddleware, returnRTOCController.update_rto_status);
router.get('/rtos-stats/dashboard', authMiddleware, returnRTOCController.get_rto_stats);

// Combined Dashboard Stats
router.get('/returns-rtos/combined-stats', authMiddleware, returnRTOCController.get_combined_dashboard_stats);

// ==================== SETTLEMENT & PAYOUT ROUTES ====================
// Settlement Calculation & Statements
router.post('/settlements/calculate', authMiddleware, settlementController.calculate_settlement);
router.post('/settlements/generate-statement', authMiddleware, settlementController.generate_settlement_statement);
router.get('/settlements/history', authMiddleware, settlementController.get_settlement_history);
router.get('/settlements/payout/:payoutId', authMiddleware, settlementController.get_payout_details);
router.post('/settlements/request-payout', authMiddleware, settlementController.request_payout);
router.get('/settlements/financial-dashboard', authMiddleware, settlementController.get_financial_dashboard);

// ==================== CATALOG MAINTENANCE & SYNC ROUTES ====================
// Catalog Sync & Maintenance
router.get('/catalog/sync-status', authMiddleware, catalogMaintenanceController.get_catalog_sync_status);
router.post('/catalog/sync', authMiddleware, catalogMaintenanceController.sync_catalog);
router.post('/catalog/bulk-update', authMiddleware, catalogMaintenanceController.bulk_update_catalog);
router.get('/catalog/analytics', authMiddleware, catalogMaintenanceController.get_catalog_analytics);
router.get('/catalog/export', authMiddleware, catalogMaintenanceController.export_catalog_data);
router.post('/catalog/import', authMiddleware, catalogMaintenanceController.import_catalog_data);

// ==================== SUPPORT & COMMUNICATION ROUTES ====================
// Support Ticket System
router.post('/support/tickets', authMiddleware, supportCommunicationController.create_support_ticket);
router.get('/support/tickets', authMiddleware, supportCommunicationController.get_support_tickets);
router.get('/support/tickets/:ticketId', authMiddleware, supportCommunicationController.get_ticket_details);
router.post('/support/tickets/:ticketId/messages', authMiddleware, supportCommunicationController.add_ticket_message);
router.post('/support/tickets/:ticketId/close', authMiddleware, supportCommunicationController.close_support_ticket);

// Notification System
router.get('/notifications', authMiddleware, supportCommunicationController.get_notifications);
router.put('/notifications/:notificationId/read', authMiddleware, supportCommunicationController.mark_notification_read);
router.put('/notifications/read-all', authMiddleware, supportCommunicationController.mark_all_notifications_read);

// Communication Preferences
router.get('/communication/preferences', authMiddleware, supportCommunicationController.get_communication_preferences);
router.put('/communication/preferences', authMiddleware, supportCommunicationController.update_communication_preferences);

// ==================== SECURITY & SESSION MANAGEMENT ROUTES ====================
// Session Management
router.get('/security/sessions', authMiddleware, securityController.get_active_sessions);
router.delete('/security/sessions/:sessionId', authMiddleware, securityController.terminate_session);
router.delete('/security/sessions/terminate-others', authMiddleware, securityController.terminate_all_other_sessions);

// Password Management
router.post('/security/change-password', authMiddleware, securityController.change_password);
router.get('/security/password-strength', authMiddleware, securityController.get_password_strength);

// Two-Factor Authentication
router.get('/security/2fa/status', authMiddleware, securityController.get_2fa_status);
router.post('/security/2fa/enable', authMiddleware, securityController.enable_2fa);
router.post('/security/2fa/disable', authMiddleware, securityController.disable_2fa);

// Login Activity
router.get('/security/login-activity', authMiddleware, securityController.get_login_activity);

// Security Settings
router.get('/security/settings', authMiddleware, securityController.get_security_settings);
router.put('/security/settings', authMiddleware, securityController.update_security_settings);

const wearCatalogController = require('../../controllers/partner/wearCatalogController');
// Admin: Supplier Stock AI Summary
router.get('/stock/admin/ai-summary', authMiddleware, supplierStockController.admin_get_ai_summary);
router.get('/stock/admin/b2b-summary', authMiddleware, b2bOrderController.get_admin_b2b_summary);

const aiMasterController = require('../../controllers/admin/aiMasterController');
router.get('/catalog/list', wearCatalogController.get_public_catalogs); // Public
router.post('/catalog/add', authMiddleware, wearCatalogController.add_catalog);
router.post('/ai-recommend', authMiddleware, aiMasterController.generate_ai_recommendation);
router.post('/ai-advise-price', authMiddleware, aiMasterController.advise_price);
router.post('/ai-seo-tags', authMiddleware, aiMasterController.generate_seo_tags);
router.post('/ai-smart-reply', authMiddleware, aiMasterController.smart_review_reply);
router.get('/catalog/my-list', authMiddleware, wearCatalogController.get_my_catalogs);
router.get('/catalog/manual-list', authMiddleware, wearCatalogController.get_supplier_catalogs); // NEW: Dashboard specific list
router.get('/catalog/hsn-data', wearCatalogController.get_hsn_tax_data); // Public - must be BEFORE :catalogId
router.get('/catalog/scan/:skuId', authMiddleware, wearCatalogController.scan_catalog_product); // Scanner Route
router.get('/catalog/:catalogId', authMiddleware, wearCatalogController.get_catalog_by_id);
router.put('/catalog/supplier-edit/:catalogId', authMiddleware, wearCatalogController.supplier_edit_catalog);
router.put('/catalog/update/:productId', authMiddleware, wearCatalogController.update_catalog);
router.patch('/catalog/status/:productId', authMiddleware, wearCatalogController.update_catalog_status);
router.delete('/catalog/delete/:productId', authMiddleware, wearCatalogController.delete_catalog);

router.get('/list', authMiddleware, supplierController.get_suppliers);
router.get('/detail/:supplierId', authMiddleware, supplierController.get_supplier_by_id);
router.get('/catalog/all', authMiddleware, wearCatalogController.get_all_catalogs);
router.put('/update-status/:supplierId', authMiddleware, supplierController.update_status);
router.put('/update/:supplierId', authMiddleware, supplierController.update_supplier);
router.delete('/delete/:supplierId', authMiddleware, supplierController.delete_supplier);

// ==================== PRICING MANAGEMENT ROUTES ====================
router.get('/pricing/data', authMiddleware, supplierController.get_pricing_data);
router.get('/pricing/dashboard', authMiddleware, supplierController.get_pricing_data);
router.put('/pricing/update-price', authMiddleware, supplierController.update_product_price);

// ==================== WAREHOUSE MANAGEMENT ROUTES ====================
router.get('/warehouse/data', authMiddleware, supplierController.get_warehouse_data);

// ==================== PROMOTIONS MANAGEMENT ROUTES ====================
router.get('/promotions/data', authMiddleware, supplierController.get_promotions_data);
router.post('/promotions/create', authMiddleware, supplierController.create_promotion);

// ==================== OFFER ZONE ROUTES ====================
router.get('/offer-zone/data', authMiddleware, supplierController.get_offer_zone_data);

// ==================== PRICE RECOMMENDATION ROUTES ====================
router.get('/price-recommendations', authMiddleware, supplierController.get_price_recommendations);

// ==================== QUALITY DASHBOARD ROUTES ====================
router.get('/quality-dashboard/data', authMiddleware, supplierController.get_quality_dashboard_data);

// ── Final Cleanup ──
module.exports = router;

