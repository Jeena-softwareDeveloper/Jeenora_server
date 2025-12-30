const Application = require('../../models/hire/applicationModel');
const Notification = require('../hire/Services/notificationService');
const socketHelper = require('../../utiles/socket');
const JobMessage = require('../../models/hire/JobMessageModel');

exports.update_application_status = async (req, res) => {
    try {
        const { id } = req.params;
        const { status, note, triggeredBy, communicationMode = 'notification' } = req.body;

        // Auto-enable notifications as per requirement
        const sendEmail = true;
        const sendWhatsapp = true;

        const application = await Application.findById(id).populate('jobId userId');
        if (!application) {
            return res.status(404).json({ error: 'Application not found' });
        }

        // status validation
        const validStatuses = [
            'applied', 'viewed', 'shortlisted', 'interview_scheduled', 'interview_completed',
            'offer_extended', 'offer_accepted', 'offer_rejected', 'rejected', 'withdrawn'
        ];

        if (!validStatuses.includes(status)) {
            return res.status(400).json({ error: 'Invalid status' });
        }

        // Update status history using findByIdAndUpdate to bypass validation of existing invalid fields (e.g. legacy resumeId)
        await Application.findByIdAndUpdate(
            id,
            {
                $set: { currentStatus: status },
                $push: {
                    statusHistory: {
                        status: status,
                        date: new Date(),
                        triggeredBy: triggeredBy || 'admin',
                        notes: note || ''
                    }
                }
            },
            { runValidators: false }
        );

        // Update local object for response consistency (optional, but good for response)
        application.currentStatus = status;
        application.statusHistory.push({
            status,
            date: new Date(),
            triggeredBy: triggeredBy || 'admin',
            notes: note || ''
        });

        const messageContent = note || `Your application status has been updated to: ${status.replace('_', ' ')}`;

        // --- 1. HANDLE DIRECT MESSAGE (Chat) ---
        if ((communicationMode === 'chat' || communicationMode === 'both') && application.jobId && application.userId) {
            try {
                await JobMessage.create({
                    jobId: application.jobId._id,
                    applicationId: application._id,
                    userId: application.userId._id,
                    senderId: req.id, // Admin ID from auth middleware
                    senderRole: 'admin',
                    message: messageContent
                });
            } catch (chatError) {
                console.warn('⚠️ JobMessage creation failed:', chatError.message);
            }
        }

        // --- 2. REAL-TIME GATEWAY (WebSocket) ---
        try {
            const io = socketHelper.getIo();
            // Emitting to all clients, frontend should filter by userId
            if (application.userId) {
                io.emit('application_status_update', {
                    applicationId: application._id,
                    userId: application.userId._id,
                    status: status,
                    jobTitle: application.jobId?.title || 'Job',
                    message: `Your application for ${application.jobId?.title || 'Job'} is now ${status.replace('_', ' ')}`
                });
                console.log(`📡 WebSocket event emitted for application ${id}`);
            }
        } catch (socketError) {
            console.warn('⚠️ WebSocket emit failed:', socketError.message);
        }

        // --- 3. NOTIFICATION QUEUE (Email, WhatsApp, Dashboard) ---
        // Always create a notification record, regardless of mode (provides consistent history)
        // If 'chat' mode, it's still an alert.
        try {
            if (application.userId) {
                const channels = ['dashboard'];
                if (sendEmail) channels.push('email');
                if (sendWhatsapp) channels.push('whatsapp');

                await Notification.createNotification({
                    userId: application.userId._id,
                    title: `Application Update: ${status.replace('_', ' ')}`,
                    message: `The status of your application for ${application.jobId?.title || 'Job'} has been updated to ${status.replace('_', ' ')}.`,
                    type: 'job',
                    category: 'Job',
                    link: `/hire/tracking/${application._id}`,
                    channel: channels
                });
            }
        } catch (notifyError) {
            console.warn('⚠️ Notification creation failed:', notifyError.message);
        }

        return res.status(200).json({
            message: 'Application status updated successfully',
            application
        });

    } catch (error) {
        console.error('SERVER ERROR: update_application_status', error);
        return res.status(500).json({
            error: 'Internal Server Error',
            details: error.message // Expose details for debugging
        });
    }
};
