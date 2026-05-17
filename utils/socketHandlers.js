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
        io.emit("activePartner", allAdminUsers); // Updated compatibility
    };

    io.on("connection", (soc) => {
        console.log("🔌 New socket connection:", soc.id);

        soc.on("add_user", (customerId, userInfo) => {
            addCustomer(customerId, soc.id, userInfo);
            broadcastActiveAdmins();
        });

        // Admin User (Dashboard) connecting
        soc.on("add_admin_support", (adminUserId, userInfo) => {
            addAdminUser(adminUserId, soc.id, userInfo);
            broadcastActiveAdmins();
        });

        // Updated connection names
        soc.on("add_partner", (adminUserId, userInfo) => {
            addAdminUser(adminUserId, soc.id, userInfo);
            broadcastActiveAdmins();
        });

        soc.on("add_hireuser", (adminUserId, userInfo) => {
            addAdminUser(adminUserId, soc.id, userInfo);
            broadcastActiveAdmins();
        });

        // Superadmin connecting
        soc.on("add_admin", (adminInfo) => {
            delete adminInfo.email;
            delete adminInfo.password;
            superadmin = { ...adminInfo, socketId: soc.id };
            broadcastActiveAdmins();
        });

        // --- CHAT MESSAGING EVENTS ---

        // 1. Admin User -> Customer
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

        // 2. Customer -> Admin User
        soc.on("send_customer_message", (msg) => {
            const adminUser = findAdminUser(msg.receverId);
            if (adminUser) {
                soc.to(adminUser.socketId).emit("customer_message", msg);
            }
        });

        // 3. Superadmin -> Admin User
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

        // 4. Admin User -> Superadmin
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

        // 5. Customer <-> Superadmin direct
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

        // Application Chat Rooms
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

module.exports = { initHandlers };
