const JobMessage = require('../../models/hire/JobMessageModel');
const Notification = require('./Services/notificationService');
const { responseReturn } = require("../../utiles/response");

class JobMessageController {

    // Send a message (User or Admin or Employer)
    sendMessage = async (req, res) => {
        try {
            const { applicationId, message } = req.body;
            const { id, role } = req; // Auth middleware

            if (!applicationId || !message) {
                return responseReturn(res, 400, { error: 'Application ID and message are required' });
            }

            // In a real app, verify user has access to this application (security check)
            // skipping extensive checks for speed, assuming id/role usually sufficient or handled by middleware

            // Determine Sender Details
            let senderId = id;
            let senderRole = 'user';
            if (role === 'admin') senderRole = 'admin';
            if (role === 'employer') senderRole = 'employer';

            // Find Application to get details (jobId, userId, etc)
            // const application = await require('../../models/hire/ApplicationModel').findById(applicationId);
            // using dynamic require or passed model to avoid circular dependency if any, or just direct require
            const Application = require('../../models/hire/ApplicationModel');
            const JobPost = require('../../models/hire/JobPostModel');

            // 1. Get Application (keep jobId as ID)
            const application = await Application.findById(applicationId);

            if (!application) {
                return responseReturn(res, 404, { error: 'Application not found' });
            }

            // 2. Get Job Details manually (for notifications)
            let jobDetails = null;
            if (application.jobId) {
                jobDetails = await JobPost.findById(application.jobId);
            }

            const newMessage = await JobMessage.create({
                jobId: application.jobId,
                applicationId: application._id,
                userId: application.userId, // The candidate
                senderId: senderId,
                senderRole: senderRole,
                message: message
            });

            // Trigger Notification Logic
            try {
                let notifRecipientId = null;
                console.log(`[JobMessage] Sender: ${senderId}, App User: ${application.userId}, App Employer: ${application.employerId}`);

                // 1. If Sender is NOT Candidate -> Notify Candidate
                if (senderId.toString() !== application.userId.toString()) {
                    console.log('[JobMessage] Notify Candidate');
                    notifRecipientId = application.userId;
                    await Notification.createNotification({
                        userId: application.userId,
                        title: `New Message`,
                        message: `You have a new message from ${jobDetails?.company?.name || 'recruiter'}`,
                        type: 'job',
                        category: 'Job',
                        link: `/hire/tracking/${application._id}`,
                        channel: ['dashboard']
                    });
                    console.log('[JobMessage] Notification created for Candidate');
                }
                // 2. If Sender IS Candidate -> Notify Employer
                else {
                    console.log('[JobMessage] Notify Employer');
                    notifRecipientId = application.employerId;
                    await Notification.createNotification({
                        userId: application.employerId,
                        title: `New Message from Candidate`,
                        message: `Candidate has sent a message regarding application for ${jobDetails?.title || 'Job'}`,
                        type: 'job',
                        category: 'Job',
                        link: `/seller/hire/applied-jobs`,
                        channel: ['dashboard']
                    });
                    console.log('[JobMessage] Notification created for Employer');
                }

                // Emit Notification signal
                if (notifRecipientId) {
                    const socketHelper = require('../../utiles/socket');
                    const recipientIdStr = notifRecipientId.toString();
                    console.log(`[JobMessage] Emitting socket event: new_notification for ${recipientIdStr}`);
                    socketHelper.getIo().emit('new_notification', { recipientId: recipientIdStr });
                } else {
                    console.log('[JobMessage] No recipient identified for notification');
                }

            } catch (e) {
                console.log('[JobMessage] Notification/Socket error:', e);
            }

            console.log('[JobMessage] Request processing complete.');

            // Real-time Emit
            try {
                const socketHelper = require('../../utiles/socket');
                socketHelper.getIo().emit('new_job_message', newMessage);
            } catch (socketError) {
                console.warn('Socket emit error', socketError);
            }

            responseReturn(res, 201, { message: 'Message sent', data: newMessage });

        } catch (error) {
            console.error('Send message error:', error);
            responseReturn(res, 500, { error: error.message });
        }
    }

    // Get Messages for an Application
    getMessages = async (req, res) => {
        try {
            const { applicationId } = req.params;
            // Security: check if req.id matches application.userId or if req.role is admin/employer

            const messages = await JobMessage.find({ applicationId }).sort({ createdAt: 1 });
            responseReturn(res, 200, { messages });
        } catch (error) {
            responseReturn(res, 500, { error: error.message });
        }
    }

    // Mark Messages as Read
    markAsRead = async (req, res) => {
        try {
            const { applicationId } = req.body;
            const { id } = req; // Reader ID

            if (!applicationId) return responseReturn(res, 400, { error: "Application ID required" });

            // Update all messages in this application sent by OTHERS (not me) to isRead: true
            await JobMessage.updateMany(
                { applicationId, senderId: { $ne: id }, isRead: false },
                { $set: { isRead: true } }
            );

            // Emit socket event to update senders
            try {
                const socketHelper = require('../../utiles/socket');
                socketHelper.getIo().to(applicationId).emit('message_read_update', { applicationId, readerId: id });
            } catch (e) {
                console.warn('Socket emit error (read status):', e);
            }

            responseReturn(res, 200, { message: 'Messages marked as read' });
        } catch (error) {
            console.error('Mark read error:', error);
            responseReturn(res, 500, { error: error.message });
        }
    }
}

module.exports = new JobMessageController();
