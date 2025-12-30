const JobMessage = require('../../models/hire/JobMessageModel');
const Notification = require('./Services/notificationService');
const { responseReturn } = require("../../utiles/response");
const HireUser = require('../../models/hire/hireUserModel');
const CreditSetting = require('../../models/hire/creditSettingModel');

class JobMessageController {

    // Send a message (User or Admin or Employer)
    sendMessage = async (req, res) => {
        try {
            const { applicationId, message } = req.body;
            const { id, role } = req; // Auth middleware

            if (!applicationId || !message) {
                return responseReturn(res, 400, { error: 'Application ID and message are required' });
            }

            // Determine Sender Details
            let senderId = id;
            let senderRole = 'user';
            if (role === 'admin') senderRole = 'admin';
            if (role === 'employer') senderRole = 'employer';

            const Application = require('../../models/hire/applicationModel');
            const JobPost = require('../../models/hire/JobPostModel');

            // 1. Get Application
            const application = await Application.findById(applicationId);

            if (!application) {
                return responseReturn(res, 404, { error: 'Application not found' });
            }

            // CREDIT LOGIC: Only deduct for CANDIDATES (hireuser role)
            if (senderRole === 'user') {
                const user = await HireUser.findById(id);
                if (!user) return responseReturn(res, 404, { error: 'User not found' });

                const settings = await CreditSetting.getSettings();
                const cost = settings.messageSendCost || 0;

                if (cost > 0) {
                    if (user.creditBalance < cost) {
                        return responseReturn(res, 403, {
                            error: 'Insufficient credits to send message',
                            required: cost,
                            available: user.creditBalance
                        });
                    }
                    user.creditBalance -= cost;
                    await user.save();
                }
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
                    let msgContent = `You have a new message from ${jobDetails?.company?.name || 'recruiter'}`;
                    if (senderRole === 'admin') {
                        msgContent = 'New message from Application';
                    }

                    await Notification.createNotification({
                        userId: application.userId,
                        title: `New Message`,
                        message: msgContent,
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

                    // Determine message for socket payload
                    let socketMsg = 'You have a new notification';
                    if (senderId.toString() !== application.userId.toString()) {
                        // Was sent to Candidate
                        socketMsg = (senderRole === 'admin') ? 'New message from Application' : `You have a new message from ${jobDetails?.company?.name || 'recruiter'}`;
                    } else {
                        // Was sent to Employer
                        socketMsg = `Candidate has sent a message regarding application for ${jobDetails?.title || 'Job'}`;
                    }

                    socketHelper.getIo().emit('new_notification', {
                        recipientId: recipientIdStr,
                        message: socketMsg
                    });
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
