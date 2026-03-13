const ChatSupportTicket = require('../../models/ChatSupportTicket');
const HireUser = require('../../models/hire/hireUserModel');
const { getIo } = require('../../utiles/socket');

// --- Get All Tickets (Admin) ---
exports.getAllTickets = async (req, res) => {
    try {
        const tickets = await ChatSupportTicket.find()
            .populate('userId', 'name email profileImageUrl')
            .sort({ lastMessageAt: -1 });
        res.status(200).json(tickets);
    } catch (error) {
        console.error("Error fetching tickets:", error);
        res.status(500).json({ error: "Failed to fetch tickets" });
    }
};

// --- Get Ticket by ID ---
exports.getTicketById = async (req, res) => {
    try {
        const ticket = await ChatSupportTicket.findById(req.params.id)
            .populate('userId', 'name email profileImageUrl');

        if (!ticket) {
            return res.status(404).json({ error: "Ticket not found" });
        }
        res.status(200).json(ticket);
    } catch (error) {
        console.error("Error fetching ticket:", error);
        res.status(500).json({ error: "Failed to fetch ticket" });
    }
};

// --- Create New Ticket (User) ---
exports.createTicket = async (req, res) => {
    try {
        const { userId, subject, message, priority, department } = req.body;
        const CreditSetting = require('../../models/hire/creditSettingModel');
        const HireUser = require('../../models/hire/hireUserModel');

        // Check if user has already submitted a ticket
        const existingTicketCount = await ChatSupportTicket.countDocuments({ userId });

        if (existingTicketCount >= 3) {
            return res.status(400).json({ error: "Maximum limit of 3 support inquiries reached. Please delete old logs to start a new one." });
        }

        const user = await HireUser.findById(userId);

        if (!user) {
            return res.status(404).json({ error: "User not found" });
        }

        let cost = 0;
        let isFree = true;

        if (existingTicketCount > 0) {
            isFree = false;
            const settings = await CreditSetting.getSettings();
            cost = settings.supportInquiryCost || 0; // Default to 0 if not set, though model defaults to 0
        }

        if (!isFree && cost > 0) {
            if (user.creditBalance < cost) {
                return res.status(400).json({ error: `Insufficient credits. This inquiry costs ${cost} credits.` });
            }
            user.creditBalance -= cost;
            await user.save();
        }

        const newTicket = new ChatSupportTicket({
            userId,
            subject,
            priority: priority || 'medium',
            department: department || 'Technical Support',
            messages: [{
                senderId: userId,
                senderModel: 'HireUser',
                message
            }]
        });

        await newTicket.save();

        // Notify admin about new ticket
        try {
            const io = getIo();
            io.emit('new_ticket_alert', {
                ticketId: newTicket._id,
                subject: newTicket.subject,
                userId
            });
        } catch (e) { }

        // Return updated user balance if cost was deducted to update frontend
        res.status(201).json({ ticket: newTicket, message: isFree ? "Ticket created successfully (Free)" : "Ticket created successfully", deducted: cost, remainingCredits: user.creditBalance });
    } catch (error) {
        console.error("Error creating ticket:", error);
        res.status(500).json({ error: "Failed to create ticket" });
    }
};

// --- Add Message (Admin or User) ---
exports.addMessage = async (req, res) => {
    try {
        const ticketId = req.params.id;
        const { senderId, senderModel, message } = req.body;

        const ticket = await ChatSupportTicket.findById(ticketId).populate('userId');
        if (!ticket) {
            return res.status(404).json({ error: "Ticket not found" });
        }

        const newMessage = {
            senderId,
            senderModel,
            message,
            timestamp: new Date()
        };

        ticket.messages.push(newMessage);
        ticket.lastMessageAt = Date.now();
        ticket.updatedAt = Date.now();

        if (senderModel === 'admins' && ticket.status === 'pending') {
            ticket.status = 'open';
        }

        await ticket.save();

        // Notify real-time
        try {
            const io = getIo();
            // Emit to both (room logic would be better but let's use global emit for now or specific targets)
            io.emit('ticket_message_received', {
                ticketId,
                message: newMessage,
                userId: ticket.userId._id
            });
        } catch (e) { }

        res.status(200).json(ticket);
    } catch (error) {
        console.error("Error adding message:", error);
        res.status(500).json({ error: "Failed to add message" });
    }
};

// --- Close Ticket ---
exports.closeTicket = async (req, res) => {
    try {
        const ticketId = req.params.id;
        const ticket = await ChatSupportTicket.findByIdAndUpdate(
            ticketId,
            { status: 'closed', updatedAt: Date.now() },
            { new: true }
        );

        // Notify real-time
        try {
            const io = getIo();
            io.emit('ticket_status_closed', { ticketId });
        } catch (e) { }

        res.status(200).json(ticket);
    } catch (error) {
        console.error("Error closing ticket:", error);
        res.status(500).json({ error: "Failed to close ticket" });
    }
};

// --- Delete Ticket ---
exports.deleteTicket = async (req, res) => {
    try {
        const ticketId = req.params.id;
        await ChatSupportTicket.findByIdAndDelete(ticketId);
        res.status(200).json({ message: "Ticket deleted successfully", ticketId });
    } catch (error) {
        console.error("Error deleting ticket:", error);
        res.status(500).json({ error: "Failed to delete ticket" });
    }
};
