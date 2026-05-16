const Supplier = require('../../models/wear/Supplier');
const { responseReturn } = require('../../utils/response');
const mongoose = require('mongoose');

class SupportCommunicationController {
    
    // ==================== SUPPORT TICKET SYSTEM ====================
    
    // 1. Create support ticket
    create_support_ticket = async (req, res) => {
        const { id } = req; // supplier user ID
        const { 
            type, 
            subject, 
            description, 
            priority = 'medium',
            attachments = [],
            orderId,
            productId 
        } = req.body;
        
        try {
            const supplier = await Supplier.findOne({ user: id });
            if (!supplier) {
                return responseReturn(res, 404, { error: 'Supplier not found' });
            }
            
            // Validate required fields
            if (!type || !subject || !description) {
                return responseReturn(res, 400, { 
                    error: 'Type, subject, and description are required' 
                });
            }
            
            // Validate ticket type
            const validTypes = [
                'order_issue', 'payment_issue', 'catalog_issue', 
                'technical_issue', 'account_issue', 'general_query'
            ];
            
            if (!validTypes.includes(type)) {
                return responseReturn(res, 400, { 
                    error: `Invalid ticket type. Valid types: ${validTypes.join(', ')}` 
                });
            }
            
            // Create ticket
            const ticket = {
                ticketId: `TKT-${Date.now()}-${supplier._id.toString().slice(-6)}`,
                sellerId: supplier._id,
                supplierName: supplier.businessDetails?.shopName || 'Unknown',
                type,
                subject,
                description,
                priority,
                status: 'open',
                createdAt: new Date(),
                updatedAt: new Date(),
                attachments,
                metadata: {
                    orderId,
                    productId,
                    supplierTier: supplier.tier || 'basic'
                },
                conversations: [
                    {
                        sender: 'supplier',
                        senderId: supplier._id,
                        message: description,
                        timestamp: new Date(),
                        attachments
                    }
                ]
            };
            
            // In a real system, save to database
            // For now, return success
            
            responseReturn(res, 200, {
                success: true,
                message: 'Support ticket created successfully',
                ticket,
                estimatedResponse: 'Within 24 hours',
                ticketNumber: ticket.ticketId
            });
            
        } catch (error) {
            console.error('Create Support Ticket Error:', error);
            responseReturn(res, 500, { error: error.message });
        }
    };
    
    // 2. Get support tickets
    get_support_tickets = async (req, res) => {
        const { id } = req;
        let { 
            page = 1, 
            limit = 20, 
            status, 
            type, 
            priority,
            startDate,
            endDate 
        } = req.query;
        
        try {
            const supplier = await Supplier.findOne({ user: id });
            if (!supplier) {
                return responseReturn(res, 404, { error: 'Supplier not found' });
            }
            
            page = parseInt(page);
            limit = parseInt(limit);
            const skip = (page - 1) * limit;
            
            // Mock tickets data
            const mockTickets = this.generateMockTickets(supplier._id);
            
            // Apply filters
            let filteredTickets = mockTickets;
            
            if (status) {
                filteredTickets = filteredTickets.filter(t => t.status === status);
            }
            
            if (type) {
                filteredTickets = filteredTickets.filter(t => t.type === type);
            }
            
            if (priority) {
                filteredTickets = filteredTickets.filter(t => t.priority === priority);
            }
            
            if (startDate) {
                const start = new Date(startDate);
                filteredTickets = filteredTickets.filter(t => new Date(t.createdAt) >= start);
            }
            
            if (endDate) {
                const end = new Date(endDate);
                filteredTickets = filteredTickets.filter(t => new Date(t.createdAt) <= end);
            }
            
            // Sort by latest first
            filteredTickets.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
            
            // Paginate
            const total = filteredTickets.length;
            const paginatedTickets = filteredTickets.slice(skip, skip + limit);
            
            // Calculate stats
            const stats = {
                total: filteredTickets.length,
                open: filteredTickets.filter(t => t.status === 'open').length,
                in_progress: filteredTickets.filter(t => t.status === 'in_progress').length,
                resolved: filteredTickets.filter(t => t.status === 'resolved').length,
                closed: filteredTickets.filter(t => t.status === 'closed').length,
                byPriority: {
                    high: filteredTickets.filter(t => t.priority === 'high').length,
                    medium: filteredTickets.filter(t => t.priority === 'medium').length,
                    low: filteredTickets.filter(t => t.priority === 'low').length
                }
            };
            
            responseReturn(res, 200, {
                success: true,
                tickets: paginatedTickets,
                pagination: {
                    page,
                    limit,
                    total,
                    pages: Math.ceil(total / limit)
                },
                stats
            });
            
        } catch (error) {
            console.error('Get Support Tickets Error:', error);
            responseReturn(res, 500, { error: error.message });
        }
    };
    
    // 3. Get ticket details
    get_ticket_details = async (req, res) => {
        const { id } = req;
        const { ticketId } = req.params;
        
        try {
            const supplier = await Supplier.findOne({ user: id });
            if (!supplier) {
                return responseReturn(res, 404, { error: 'Supplier not found' });
            }
            
            // Mock ticket details
            const ticket = {
                ticketId,
                sellerId: supplier._id,
                supplierName: supplier.businessDetails?.shopName || 'Unknown',
                type: 'order_issue',
                subject: 'Order delivery delay',
                description: 'My order #ORD-12345 has been delayed by 3 days. Need urgent assistance.',
                priority: 'high',
                status: 'in_progress',
                createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), // 2 days ago
                updatedAt: new Date(Date.now() - 6 * 60 * 60 * 1000), // 6 hours ago
                assignedTo: {
                    agentId: 'AGENT001',
                    agentName: 'Support Agent',
                    department: 'Order Support'
                },
                metadata: {
                    orderId: 'ORD-12345',
                    productId: 'PROD-67890',
                    supplierTier: supplier.tier || 'basic'
                },
                conversations: [
                    {
                        id: 'conv1',
                        sender: 'supplier',
                        senderId: supplier._id,
                        senderName: supplier.businessDetails?.shopName || 'Supplier',
                        message: 'My order #ORD-12345 has been delayed by 3 days. Need urgent assistance.',
                        timestamp: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
                        attachments: []
                    },
                    {
                        id: 'conv2',
                        sender: 'support',
                        senderId: 'AGENT001',
                        senderName: 'Support Agent',
                        message: 'We have escalated your issue to the logistics team. They will contact you within 24 hours.',
                        timestamp: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
                        attachments: []
                    },
                    {
                        id: 'conv3',
                        sender: 'supplier',
                        senderId: supplier._id,
                        senderName: supplier.businessDetails?.shopName || 'Supplier',
                        message: 'Thank you for the update. Please keep me posted.',
                        timestamp: new Date(Date.now() - 12 * 60 * 60 * 1000),
                        attachments: []
                    },
                    {
                        id: 'conv4',
                        sender: 'support',
                        senderId: 'AGENT001',
                        senderName: 'Support Agent',
                        message: 'The logistics team has confirmed your order will be delivered by tomorrow. We apologize for the delay.',
                        timestamp: new Date(Date.now() - 6 * 60 * 60 * 1000),
                        attachments: []
                    }
                ],
                resolution: {
                    status: 'pending',
                    estimatedResolution: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
                    notes: 'Awaiting delivery confirmation'
                }
            };
            
            responseReturn(res, 200, {
                success: true,
                ticket
            });
            
        } catch (error) {
            console.error('Get Ticket Details Error:', error);
            responseReturn(res, 500, { error: error.message });
        }
    };
    
    // 4. Add message to ticket
    add_ticket_message = async (req, res) => {
        const { id } = req;
        const { ticketId } = req.params;
        const { message, attachments = [] } = req.body;
        
        try {
            const supplier = await Supplier.findOne({ user: id });
            if (!supplier) {
                return responseReturn(res, 404, { error: 'Supplier not found' });
            }
            
            if (!message || message.trim().length === 0) {
                return responseReturn(res, 400, { error: 'Message cannot be empty' });
            }
            
            // In a real system, update ticket in database
            // For now, return success
            
            const newMessage = {
                id: `MSG-${Date.now()}`,
                sender: 'supplier',
                senderId: supplier._id,
                senderName: supplier.businessDetails?.shopName || 'Supplier',
                message: message.trim(),
                timestamp: new Date(),
                attachments
            };
            
            responseReturn(res, 200, {
                success: true,
                message: 'Message added to ticket successfully',
                newMessage,
                ticket: {
                    ticketId,
                    updatedAt: new Date(),
                    status: 'in_progress'
                }
            });
            
        } catch (error) {
            console.error('Add Ticket Message Error:', error);
            responseReturn(res, 500, { error: error.message });
        }
    };
    
    // 5. Close support ticket
    close_support_ticket = async (req, res) => {
        const { id } = req;
        const { ticketId } = req.params;
        const { resolutionNotes, satisfactionRating } = req.body;
        
        try {
            const supplier = await Supplier.findOne({ user: id });
            if (!supplier) {
                return responseReturn(res, 404, { error: 'Supplier not found' });
            }
            
            // In a real system, update ticket status in database
            // For now, return success
            
            responseReturn(res, 200, {
                success: true,
                message: 'Support ticket closed successfully',
                ticket: {
                    ticketId,
                    status: 'closed',
                    closedAt: new Date(),
                    resolutionNotes,
                    satisfactionRating,
                    closedBy: {
                        id: supplier._id,
                        name: supplier.businessDetails?.shopName || 'Supplier',
                        type: 'supplier'
                    }
                }
            });
            
        } catch (error) {
            console.error('Close Support Ticket Error:', error);
            responseReturn(res, 500, { error: error.message });
        }
    };
    
    // ==================== NOTIFICATION SYSTEM ====================
    
    // 6. Get notifications
    get_notifications = async (req, res) => {
        const { id } = req;
        let { 
            page = 1, 
            limit = 50, 
            type, 
            read, 
            startDate,
            endDate 
        } = req.query;
        
        try {
            const supplier = await Supplier.findOne({ user: id });
            if (!supplier) {
                return responseReturn(res, 404, { error: 'Supplier not found' });
            }
            
            page = parseInt(page);
            limit = parseInt(limit);
            const skip = (page - 1) * limit;
            
            // Mock notifications
            const mockNotifications = this.generateMockNotifications(supplier._id);
            
            // Apply filters
            let filteredNotifications = mockNotifications;
            
            if (type) {
                filteredNotifications = filteredNotifications.filter(n => n.type === type);
            }
            
            if (read !== undefined) {
                const isRead = read === 'true';
                filteredNotifications = filteredNotifications.filter(n => n.read === isRead);
            }
            
            if (startDate) {
                const start = new Date(startDate);
                filteredNotifications = filteredNotifications.filter(n => new Date(n.timestamp) >= start);
            }
            
            if (endDate) {
                const end = new Date(endDate);
                filteredNotifications = filteredNotifications.filter(n => new Date(n.timestamp) <= end);
            }
            
            // Sort by latest first
            filteredNotifications.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
            
            // Paginate
            const total = filteredNotifications.length;
            const paginatedNotifications = filteredNotifications.slice(skip, skip + limit);
            
            // Calculate unread count
            const unreadCount = filteredNotifications.filter(n => !n.read).length;
            
            responseReturn(res, 200, {
                success: true,
                notifications: paginatedNotifications,
                pagination: {
                    page,
                    limit,
                    total,
                    pages: Math.ceil(total / limit)
                },
                summary: {
                    total: filteredNotifications.length,
                    unread: unreadCount,
                    read: filteredNotifications.length - unreadCount
                }
            });
            
        } catch (error) {
            console.error('Get Notifications Error:', error);
            responseReturn(res, 500, { error: error.message });
        }
    };
    
    // 7. Mark notification as read
    mark_notification_read = async (req, res) => {
        const { id } = req;
        const { notificationId } = req.params;
        
        try {
            const supplier = await Supplier.findOne({ user: id });
            if (!supplier) {
                return responseReturn(res, 404, { error: 'Supplier not found' });
            }
            
            // In a real system, update notification in database
            // For now, return success
            
            responseReturn(res, 200, {
                success: true,
                message: 'Notification marked as read',
                notification: {
                    id: notificationId,
                    read: true,
                    readAt: new Date()
                }
            });
            
        } catch (error) {
            console.error('Mark Notification Read Error:', error);
            responseReturn(res, 500, { error: error.message });
        }
    };
    
    // 8. Mark all notifications as read
    mark_all_notifications_read = async (req, res) => {
        const { id } = req;
        
        try {
            const supplier = await Supplier.findOne({ user: id });
            if (!supplier) {
                return responseReturn(res, 404, { error: 'Supplier not found' });
            }
            
            // In a real system, update all notifications for this supplier
            // For now, return success
            
            responseReturn(res, 200, {
                success: true,
                message: 'All notifications marked as read',
                count: 15, // Mock count
                timestamp: new Date()
            });
            
        } catch (error) {
            console.error('Mark All Notifications Read Error:', error);
            responseReturn(res, 500, { error: error.message });
        }
    };
    
    // ==================== COMMUNICATION PREFERENCES ====================
    
    // 9. Get communication preferences
    get_communication_preferences = async (req, res) => {
        const { id } = req;
        
        try {
            const supplier = await Supplier.findOne({ user: id });
            if (!supplier) {
                return responseReturn(res, 404, { error: 'Supplier not found' });
            }
            
            // Mock preferences
            const preferences = {
                email: {
                    enabled: true,
                    orderUpdates: true,
                    paymentUpdates: true,
                    marketing: false,
                    newsletter: true
                },
                push: {
                    enabled: true,
                    orderUpdates: true,
                    paymentUpdates: true,
                    catalogUpdates: false,
                    supportUpdates: true
                },
                sms: {
                    enabled: false,
                    orderUpdates: false,
                    paymentUpdates: true,
                    urgentAlerts: true
                },
                frequency: {
                    dailyDigest: true,
                    weeklyReport: true,
                    monthlyStatement: true
                },
                quietHours: {
                    enabled: false,
                    start: '22:00',
                    end: '08:00'
                }
            };
            
            responseReturn(res, 200, {
                success: true,
                preferences
            });
            
        } catch (error) {
            console.error('Get Communication Preferences Error:', error);
            responseReturn(res, 500, { error: error.message });
        }
    };
    
    // 10. Update communication preferences
    update_communication_preferences = async (req, res) => {
        const { id } = req;
        const { preferences } = req.body;
        
        try {
            const supplier = await Supplier.findOne({ user: id });
            if (!supplier) {
                return responseReturn(res, 404, { error: 'Supplier not found' });
            }
            
            if (!preferences || typeof preferences !== 'object') {
                return responseReturn(res, 400, { error: 'Invalid preferences data' });
            }
            
            // In a real system, save preferences to database
            // For now, return success
            
            responseReturn(res, 200, {
                success: true,
                message: 'Communication preferences updated successfully',
                preferences,
                updatedAt: new Date()
            });
            
        } catch (error) {
            console.error('Update Communication Preferences Error:', error);
            responseReturn(res, 500, { error: error.message });
        }
    };
    
    // ==================== HELPER METHODS ====================
    
    // Helper: Generate mock tickets
    generateMockTickets = (sellerId) => {
        const ticketTypes = ['order_issue', 'payment_issue', 'catalog_issue', 'technical_issue', 'account_issue', 'general_query'];
        const statuses = ['open', 'in_progress', 'resolved', 'closed'];
        const priorities = ['low', 'medium', 'high'];
        
        const tickets = [];
        
        for (let i = 0; i < 15; i++) {
            const type = ticketTypes[Math.floor(Math.random() * ticketTypes.length)];
            const status = statuses[Math.floor(Math.random() * statuses.length)];
            const priority = priorities[Math.floor(Math.random() * priorities.length)];
            
            const daysAgo = Math.floor(Math.random() * 30);
            const createdAt = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000);
            const updatedAt = new Date(createdAt.getTime() + Math.floor(Math.random() * 3) * 24 * 60 * 60 * 1000);
            
            tickets.push({
                ticketId: `TKT-${Date.now() - i * 86400000}-${sellerId.toString().slice(-6)}`,
                sellerId,
                type,
                subject: this.getMockSubject(type),
                description: this.getMockDescription(type),
                priority,
                status,
                createdAt,
                updatedAt,
                lastMessage: `Last updated ${Math.floor(Math.random() * 24)} hours ago`
            });
        }
        
        return tickets;
    };
    
    // Helper: Generate mock notifications
    generateMockNotifications = (sellerId) => {
        const notificationTypes = ['order', 'payment', 'catalog', 'support', 'system', 'marketing'];
        const notifications = [];
        
        for (let i = 0; i < 25; i++) {
            const type = notificationTypes[Math.floor(Math.random() * notificationTypes.length)];
            const hoursAgo = Math.floor(Math.random() * 168); // Up to 7 days
            const timestamp = new Date(Date.now() - hoursAgo * 60 * 60 * 1000);
            const read = Math.random() > 0.3; // 70% chance of being read
            
            notifications.push({
                id: `NOTIF-${Date.now() - i * 3600000}-${sellerId.toString().slice(-6)}`,
                sellerId,
                type,
                title: this.getMockNotificationTitle(type),
                message: this.getMockNotificationMessage(type),
                timestamp,
                read,
                actionUrl: `/supplier/${type === 'order' ? 'orders' : 'dashboard'}`,
                metadata: {
                    orderId: type === 'order' ? `ORD-${Math.floor(Math.random() * 10000)}` : null,
                    amount: type === 'payment' ? Math.floor(Math.random() * 5000) + 1000 : null
                }
            });
        }
        
        return notifications;
    };
    
    // Helper: Get mock subject based on type
    getMockSubject = (type) => {
        const subjects = {
            order_issue: 'Order delivery delay',
            payment_issue: 'Payment not received',
            catalog_issue: 'Product listing rejected',
            technical_issue: 'Unable to upload catalog',
            account_issue: 'Account verification pending',
            general_query: 'Question about commission rates'
        };
        return subjects[type] || 'Support Request';
    };
    
    // Helper: Get mock description based on type
    getMockDescription = (type) => {
        const descriptions = {
            order_issue: 'My order has been delayed by several days. Need urgent assistance with delivery.',
            payment_issue: 'The payment for last month\'s settlement has not been credited to my account.',
            catalog_issue: 'My product listing was rejected without proper explanation. Need clarification.',
            technical_issue: 'I\'m unable to upload new catalog items. Getting error 500.',
            account_issue: 'My account verification has been pending for over a week.',
            general_query: 'Can you explain the commission structure for premium suppliers?'
        };
        return descriptions[type] || 'Need assistance with an issue.';
    };
    
    // Helper: Get mock notification title
    getMockNotificationTitle = (type) => {
        const titles = {
            order: 'New Order Received',
            payment: 'Payment Processed',
            catalog: 'Catalog Update Required',
            support: 'Support Ticket Update',
            system: 'System Maintenance',
            marketing: 'New Promotion Available'
        };
        return titles[type] || 'Notification';
    };
    
    // Helper: Get mock notification message
    getMockNotificationMessage = (type) => {
        const messages = {
            order: 'You have received a new order #ORD-12345. Please process within 24 hours.',
            payment: 'Your payment of ₹12,500 has been processed and will be credited within 3-5 business days.',
            catalog: '3 of your products need attention. Please update stock levels.',
            support: 'Your support ticket TKT-12345 has been updated with a new response.',
            system: 'Scheduled maintenance on Sunday, 2 AM - 4 AM. System may be unavailable.',
            marketing: 'New promotion: Get featured on homepage for 50% off this week only!'
        };
        return messages[type] || 'You have a new notification.';
    };
}

module.exports = new SupportCommunicationController();
