const socketHelper = require('./socket');

const initHandlers = (io) => {
    let allCustomer = [];
    let allAdminUsers = [];
    let superadmin = {};

    const addCustomer = (customerId, socketId, userInfo) => {
        if (!allCustomer.some((u) => u.customerId === customerId)) {
            allCustomer.push({ customerId, socketId, userInfo });
        }
    };

    const addAdminUser = (adminUserId, socketId, userInfo) => {
        const existing = allAdminUsers.find((u) => u.adminUserId === adminUserId || u.partnerId === adminUserId);
        if (existing) {
            existing.socketId = socketId;
            existing.userInfo = userInfo;
        } else {
            allAdminUsers.push({ adminUserId, partnerId: adminUserId, socketId, userInfo });
        }
    };

    const findCustomer = (customerId) =>
        allCustomer.find((c) => c.customerId === customerId);
    
    const findAdminUser = (adminUserId) => 
        allAdminUsers.find((c) => c.adminUserId === adminUserId || c.partnerId === adminUserId);

    const removeSocket = (socketId) => {
        allCustomer = allCustomer.filter((c) => c.socketId !== socketId);
        allAdminUsers = allAdminUsers.filter((c) => c.socketId !== socketId);
        if (superadmin.socketId === socketId) {
            superadmin = {};
        }
    };

    const broadcastActiveAdmins = () => {
        io.emit("activeAdmin", allAdminUsers);
        io.emit("activePartner", allAdminUsers);
    };

    io.on("connection", (soc) => {
        console.log("🔌 New socket connection:", soc.id);

        soc.on("add_user", (customerId, userInfo) => {
            addCustomer(customerId, soc.id, userInfo);
            broadcastActiveAdmins();
        });

        soc.on("add_admin_support", (adminUserId, userInfo) => {
            addAdminUser(adminUserId, soc.id, userInfo);
            broadcastActiveAdmins();
        });

        soc.on("add_partner", (adminUserId, userInfo) => {
            addAdminUser(adminUserId, soc.id, userInfo);
            broadcastActiveAdmins();
        });

        soc.on("add_hireuser", (adminUserId, userInfo) => {
            addAdminUser(adminUserId, soc.id, userInfo);
            broadcastActiveAdmins();
        });

        soc.on("add_admin", (adminInfo) => {
            delete adminInfo.email;
            delete adminInfo.password;
            superadmin = { ...adminInfo, socketId: soc.id };
            soc.join('admin_room');
            broadcastActiveAdmins();
        });

        // ─── REAL-TIME ORDER ROOMS ────────────────────────────────────────────
        // Supplier joins private room on login — receives new_order, order_status_changed, etc.
        soc.on("join_supplier_room", (supplierId) => {
            if (supplierId) {
                soc.join(`supplier_${supplierId}`);
                console.log(`[SOCKET] Supplier ${supplierId} joined room supplier_${supplierId}`);
            }
        });

        // Customer joins private room — receives order_shipped, order_delivered, tracking updates
        soc.on("join_customer_room", (customerId) => {
            if (customerId) {
                soc.join(`customer_${customerId}`);
                console.log(`[SOCKET] Customer ${customerId} joined room customer_${customerId}`);
            }
        });

        // Admin dashboard joins admin room
        soc.on("join_admin_room", () => {
            soc.join('admin_room');
        });
        // ─────────────────────────────────────────────────────────────────────

        // --- CHAT MESSAGING EVENTS ---

        soc.on("send_admin_user_message", (msg) => {
            const customer = findCustomer(msg.receverId);
            if (customer) {
                soc.to(customer.socketId).emit("partner_message", msg);
                soc.to(customer.socketId).emit("admin_user_message", msg);
            }
        });

        soc.on("send_partner_message", (msg) => {
            const customer = findCustomer(msg.receverId);
            if (customer) {
                soc.to(customer.socketId).emit("partner_message", msg);
                soc.to(customer.socketId).emit("admin_user_message", msg);
            }
        });

        soc.on("send_customer_message", (msg) => {
            const adminUser = findAdminUser(msg.receverId);
            if (adminUser) {
                soc.to(adminUser.socketId).emit("customer_message", msg);
            }
        });

        soc.on("send_message_superadmin_to_admin", (msg) => {
            const adminUser = findAdminUser(msg.receverId);
            if (adminUser) {
                soc.to(adminUser.socketId).emit("receved_superadmin_message", msg);
                soc.to(adminUser.socketId).emit("receved_admin_message", msg);
            }
        });

        soc.on("send_message_admin_to_partner", (msg) => {
            const adminUser = findAdminUser(msg.receverId);
            if (adminUser) {
                soc.to(adminUser.socketId).emit("receved_superadmin_message", msg);
                soc.to(adminUser.socketId).emit("receved_admin_message", msg);
            }
        });

        soc.on("send_message_admin_to_hire", (msg) => {
            const adminUser = findAdminUser(msg.receverId);
            if (adminUser) {
                soc.to(adminUser.socketId).emit("receved_superadmin_message", msg);
                soc.to(adminUser.socketId).emit("receved_admin_message", msg);
            }
        });

        soc.on("send_message_admin_user_to_superadmin", (msg) => {
            if (superadmin.socketId) {
                soc.to(superadmin.socketId).emit("receved_admin_user_message", msg);
                soc.to(superadmin.socketId).emit("receved_partner_message", msg);
            }
        });

        soc.on("send_message_partner_to_admin", (msg) => {
            if (superadmin.socketId) {
                soc.to(superadmin.socketId).emit("receved_admin_user_message", msg);
                soc.to(superadmin.socketId).emit("receved_partner_message", msg);
            }
        });

        soc.on("send_message_hire_to_admin", (msg) => {
            if (superadmin.socketId) {
                soc.to(superadmin.socketId).emit("receved_admin_user_message", msg);
                soc.to(superadmin.socketId).emit("receved_partner_message", msg);
            }
        });

        soc.on("send_message_admin_to_user", (msg) => {
            const user = findCustomer(msg.receiverId);
            if (user) {
                soc.to(user.socketId).emit("received_admin_message", msg);
            }
        });

        soc.on("send_message_user_to_admin", (msg) => {
            if (msg.receiverId) {
                const adminUser = findAdminUser(msg.receiverId);
                if (adminUser) {
                    soc.to(adminUser.socketId).emit("received_user_message", msg);
                    return;
                }
            }
            if (superadmin.socketId) {
                soc.to(superadmin.socketId).emit("received_user_message", msg);
            }
        });

        soc.on('join_application_chat', ({ applicationId, userId, role }) => {
            soc.join(applicationId);
            soc.to(applicationId).emit('chat_partner_status', { applicationId, status: 'online', userId, role });
        });

        soc.on('leave_application_chat', ({ applicationId, userId, role }) => {
            soc.leave(applicationId);
            soc.to(applicationId).emit('chat_partner_status', { applicationId, status: 'offline', userId, role });
        });

        soc.on('message_read_signal', ({ applicationId, readerId }) => {
            soc.to(applicationId).emit('message_read_update', { applicationId, readerId });
        });

        soc.on("disconnect", () => {
            console.log("🚫 Socket disconnected:", soc.id);
            removeSocket(soc.id);
            broadcastActiveAdmins();
        });
    });
};

// ─── Emit helpers for use in controllers ──────────────────────────────────────
/**
 * Emit a real-time event to a specific supplier's private room
 * @param {string} supplierId - The Supplier._id (not user._id)
 */
const emitToSupplier = (supplierId, event, data) => {
    try {
        const { getIo } = require('./socket');
        getIo().to(`supplier_${supplierId}`).emit(event, data);
    } catch (err) {
        console.warn(`[SOCKET] emitToSupplier(${supplierId}, ${event}) failed:`, err.message);
    }
};

/**
 * Emit a real-time event to a specific customer's private room
 * @param {string} customerId
 */
const emitToCustomer = (customerId, event, data) => {
    try {
        const { getIo } = require('./socket');
        getIo().to(`customer_${customerId}`).emit(event, data);
    } catch (err) {
        console.warn(`[SOCKET] emitToCustomer(${customerId}, ${event}) failed:`, err.message);
    }
};

module.exports = { initHandlers, emitToSupplier, emitToCustomer };
