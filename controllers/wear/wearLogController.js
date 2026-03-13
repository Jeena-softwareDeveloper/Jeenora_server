const WearLog = require('../../models/wear/wearLogModel');
const WearBuyer = require('../../models/wear/wearBuyerModel');
const { responseReturn } = require('../../utiles/response');
const fs = require('fs');
const path = require('path');
const logFile = path.join(__dirname, 'wear_debug.log');

const debugLog = (msg) => {
    const time = new Date().toISOString();
    fs.appendFileSync(logFile, `[${time}] ${msg}\n`);
};

class wearLogController {

    // Log user activity (called from mobile)
    logActivity = async (req, res) => {
        const { action, details, device } = req.body;
        const userId = req.id;
        debugLog(`Log Request: Action=${action}, DeviceID=${device?.deviceId}`);

        try {
            if (!device || !device.deviceId) {
                debugLog(`Log Skipped: Missing DeviceID for action ${action}`);
                return responseReturn(res, 201, { success: false, message: 'DeviceId required' });
            }

            let phone = null;
            if (userId) {
                let userFetch = await WearBuyer.findById(userId);
                if (!userFetch) {
                    const customerModel = require('../../models/wear/customerModel');
                    userFetch = await customerModel.findById(userId);
                }
                if (userFetch) phone = userFetch.phone;
            }

            // Calculate duration of previous log if same device
            const lastLog = await WearLog.findOne({ 'device.deviceId': device.deviceId }).sort({ createdAt: -1 });
            if (lastLog) {
                const diff = Math.floor((new Date() - lastLog.createdAt) / 1000);
                if (diff < 1800) {
                    await WearLog.findByIdAndUpdate(lastLog._id, { duration: diff });
                }
            }

            const newLog = await WearLog.create({
                user: userId || null,
                phone: phone,
                action: action || 'PAGE_VIEW',
                details: details || {},
                device: {
                    ...device,
                    ip: req.ip || req.connection.remoteAddress,
                    userAgent: req.headers['user-agent']
                }
            });

            responseReturn(res, 201, { success: true, logId: newLog._id });
        } catch (error) {
            console.error('Logging Error:', error);
            responseReturn(res, 500, { error: error.message });
        }
    }

    // Get logs for admin dashboard
    // Get logs for admin dashboard
    getLogs = async (req, res) => {
        const { page = 1, limit = 50, search = '', type = 'all' } = req.query;
        const skip = (parseInt(page) - 1) * parseInt(limit);

        try {
            if (type === 'all') {
                // 1. Fetch all registered buyers
                let buyerQuery = {};
                if (search) {
                    buyerQuery = {
                        $or: [
                            { name: { $regex: search, $options: 'i' } },
                            { phone: { $regex: search, $options: 'i' } }
                        ]
                    };
                }
                const buyers = await WearBuyer.find(buyerQuery).sort({ updatedAt: -1 });

                const allEntries = [];

                // 2. Map buyers to current activity state
                for (const buyer of buyers) {
                    const latestLog = await WearLog.findOne({ user: buyer._id }).sort({ createdAt: -1 });
                    const lastDevice = (buyer.devices && buyer.devices.length > 0) ? buyer.devices[buyer.devices.length - 1] : null;

                    allEntries.push({
                        _id: latestLog?._id || `temp-id-${buyer._id}`,
                        user: { _id: buyer._id, name: buyer.name, phone: buyer.phone },
                        action: latestLog?.action || 'REGISTERED',
                        details: latestLog?.details || { page: 'Dashboard' },
                        duration: latestLog?.duration || 0,
                        device: latestLog?.device || {
                            deviceId: lastDevice?.deviceId || 'Unknown',
                            ip: lastDevice?.ip || 'N/A',
                            userAgent: lastDevice?.userAgent || 'N/A',
                            platform: 'Mobile'
                        },
                        createdAt: latestLog?.createdAt || buyer.updatedAt || buyer.createdAt,
                        isPlaceholder: !latestLog
                    });
                }

                // 3. Add Guest users (unique device IDs from logs with no user)
                const guestPipeline = [
                    { $match: { user: { $exists: false } } },
                    { $sort: { createdAt: -1 } },
                    {
                        $group: {
                            _id: "$device.deviceId",
                            latestLog: { $first: "$$ROOT" }
                        }
                    },
                    { $replaceRoot: { newRoot: "$latestLog" } }
                ];

                const guestLogs = await WearLog.aggregate(guestPipeline);
                guestLogs.forEach(log => {
                    allEntries.push({ ...log, isGuest: true });
                });

                // 4. Final Sort and Paginate
                allEntries.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
                const paginatedLogs = allEntries.slice(skip, skip + parseInt(limit));

                return responseReturn(res, 200, { logs: paginatedLogs, total: allEntries.length });
            }

            // Standard stream mode
            let query = {};
            if (search) {
                query = {
                    $or: [
                        { phone: { $regex: search, $options: 'i' } },
                        { action: { $regex: search, $options: 'i' } }
                    ]
                };
            }

            const logs = await WearLog.find(query)
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(parseInt(limit))
                .populate('user', 'name phone');

            const total = await WearLog.countDocuments(query);
            responseReturn(res, 200, { logs, total });
        } catch (error) {
            console.error('getLogs error:', error);
            responseReturn(res, 500, { error: error.message });
        }
    }

    // Get more details for a specific user/device
    getUserDetails = async (req, res) => {
        const { deviceId } = req.params;
        try {
            const userLogs = await WearLog.find({ 'device.deviceId': deviceId })
                .sort({ createdAt: -1 })
                .limit(100);

            // Calculate totals
            const totalTime = userLogs.reduce((acc, curr) => acc + (curr.duration || 0), 0);
            const totalVisits = await WearLog.countDocuments({ 'device.deviceId': deviceId });

            // Group by page
            const pageStats = {};
            userLogs.forEach(log => {
                const page = log.details?.page || 'Unknown';
                if (!pageStats[page]) pageStats[page] = 0;
                pageStats[page] += (log.duration || 0);
            });

            responseReturn(res, 200, {
                logs: userLogs,
                stats: {
                    totalTimeSpent: totalTime,
                    totalVisits,
                    pageEngagement: pageStats,
                    isReturning: totalVisits > 1
                }
            });
        } catch (error) {
            responseReturn(res, 500, { error: error.message });
        }
    }

    // Delete log
    deleteLog = async (req, res) => {
        try {
            await WearLog.findByIdAndDelete(req.params.id);
            responseReturn(res, 200, { message: 'Log deleted successfully' });
        } catch (error) {
            responseReturn(res, 500, { error: error.message });
        }
    }

    // Delete all logs (Reset)
    clearLogs = async (req, res) => {
        try {
            await WearLog.deleteMany({});
            responseReturn(res, 200, { message: 'All logs cleared successfully' });
        } catch (error) {
            responseReturn(res, 500, { error: error.message });
        }
    }

    // Get stats for dashboard
    getStats = async (req, res) => {
        try {
            const totalUsers = await WearBuyer.countDocuments();
            const totalLogs = await WearLog.countDocuments();
            debugLog(`Stats Requested: Users=${totalUsers}, Logs=${totalLogs}`);
            const uniqueVisitorsToday = await WearLog.distinct('device.deviceId', {
                createdAt: { $gte: new Date(new Date().setHours(0, 0, 0, 0)) }
            });

            responseReturn(res, 200, {
                totalUsers,
                totalLogs,
                activeToday: uniqueVisitorsToday.length
            });
        } catch (error) {
            responseReturn(res, 500, { error: error.message });
        }
    }
}

module.exports = new wearLogController();
