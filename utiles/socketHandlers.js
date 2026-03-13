
const socketHelper = require('./socket');

const initHandlers = (io) => {
    let allCustomer = [];
    let allSeller = [];
    let admin = {};

    const addUser = (customerId, socketId, userInfo) => {
        if (!allCustomer.some((u) => u.customerId === customerId)) {
            allCustomer.push({ customerId, socketId, userInfo });
        }
    };

    const addSeller = (sellerId, socketId, userInfo) => {
        const checkSeller = allSeller.find((u) => u.sellerId === sellerId);
        if (checkSeller) {
            checkSeller.socketId = socketId;
            checkSeller.userInfo = userInfo;
        } else {
            allSeller.push({ sellerId, socketId, userInfo });
        }
    };

    const findCustomer = (customerId) =>
        allCustomer.find((c) => c.customerId === customerId);
    
    const findSeller = (sellerId) => 
        allSeller.find((c) => c.sellerId === sellerId);

    const remove = (socketId) => {
        allCustomer = allCustomer.filter((c) => c.socketId !== socketId);
        allSeller = allSeller.filter((c) => c.socketId !== socketId);
    };

    io.on("connection", (soc) => {
        console.log("🔌 New socket connection");

        soc.on("add_user", (customerId, userInfo) => {
            addUser(customerId, soc.id, userInfo);
            io.emit("activeSeller", allSeller);
        });

        soc.on("add_seller", (sellerId, userInfo) => {
            addSeller(sellerId, soc.id, userInfo);
            io.emit("activeSeller", allSeller);
        });

        soc.on("add_hireuser", (sellerId, userInfo) => {
            addSeller(sellerId, soc.id, userInfo);
            io.emit("activeSeller", allSeller);
        });

        soc.on("send_seller_message", (msg) => {
            const customer = findCustomer(msg.receverId);
            if (customer) {
                soc.to(customer.socketId).emit("seller_message", msg);
            }
        });

        soc.on("send_customer_message", (msg) => {
            const seller = findSeller(msg.receverId);
            if (seller) {
                soc.to(seller.socketId).emit("customer_message", msg);
            }
        });

        soc.on("send_message_admin_to_seller", (msg) => {
            const seller = findSeller(msg.receverId);
            if (seller) {
                soc.to(seller.socketId).emit("receved_admin_message", msg);
            }
        });

        soc.on("send_message_seller_to_admin", (msg) => {
            if (admin.socketId) {
                soc.to(admin.socketId).emit("receved_seller_message", msg);
            }
        });

        soc.on("send_message_hire_to_admin", (msg) => {
            if (admin.socketId) {
                soc.to(admin.socketId).emit("receved_seller_message", msg);
            }
        });

        soc.on("send_message_admin_to_hire", (msg) => {
            const seller = findSeller(msg.receverId);
            if (seller) {
                soc.to(seller.socketId).emit("receved_admin_message", msg);
            }
        });

        soc.on("send_message_admin_to_user", (msg) => {
            const user = allCustomer.find((c) => c.customerId === msg.receiverId);
            if (user) {
                soc.to(user.socketId).emit("received_admin_message", msg);
            }
        });

        soc.on("send_message_user_to_admin", (msg) => {
            if (msg.receiverId) {
                const seller = findSeller(msg.receiverId);
                if (seller) {
                    soc.to(seller.socketId).emit("received_user_message", msg);
                    return;
                }
            }
            if (admin.socketId) {
                soc.to(admin.socketId).emit("received_user_message", msg);
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

        soc.on("add_admin", (adminInfo) => {
            delete adminInfo.email;
            delete adminInfo.password;
            admin = { ...adminInfo, socketId: soc.id };
            io.emit("activeSeller", allSeller);
        });

        soc.on("disconnect", () => {
            console.log("🚫 Socket disconnected");
            remove(soc.id);
            io.emit("activeSeller", allSeller);
        });
    });
};

module.exports = { initHandlers };
