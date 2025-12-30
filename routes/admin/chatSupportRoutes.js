const express = require('express');
const router = express.Router();
const chatSupportController = require('../../controllers/admin/chatSupportController');

// Define routes for Chat Support
router.get('/tickets', chatSupportController.getAllTickets);
router.get('/tickets/:id', chatSupportController.getTicketById);
router.post('/tickets', chatSupportController.createTicket); // Can be used by admin to manually start or user
router.post('/tickets/:id/message', chatSupportController.addMessage);
router.put('/tickets/:id/close', chatSupportController.closeTicket);
router.delete('/tickets/:id', chatSupportController.deleteTicket);

module.exports = router;
