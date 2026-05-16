const ORDER_STATUS = Object.freeze({
    PENDING_PAYMENT: 'pending_payment',
    PENDING: 'pending',
    CONFIRMED: 'confirmed',
    PROCESSING: 'processing',
    SHIPPED: 'shipped',
    DELIVERED: 'delivered',
    CANCELLED: 'cancelled',
    RETURNED: 'returned'
});

// B2B statuses
const B2B_STATUS = Object.freeze({
    NEW: 'new',
    PAID: 'paid',
    ACCEPTED: 'accepted',
    PACKED: 'packed',
    SHIPPED: 'shipped',
    DELIVERED: 'delivered',
    CANCELLED: 'cancelled',
    REJECTED: 'rejected'
});

// B2C valid transitions
const B2C_TRANSITIONS = {
    [ORDER_STATUS.PENDING_PAYMENT]: [ORDER_STATUS.PENDING, ORDER_STATUS.CANCELLED],
    [ORDER_STATUS.PENDING]: [ORDER_STATUS.CONFIRMED, ORDER_STATUS.CANCELLED],
    [ORDER_STATUS.CONFIRMED]: [ORDER_STATUS.PROCESSING, ORDER_STATUS.SHIPPED, ORDER_STATUS.CANCELLED],
    [ORDER_STATUS.PROCESSING]: [ORDER_STATUS.SHIPPED, ORDER_STATUS.CANCELLED],
    [ORDER_STATUS.SHIPPED]: [ORDER_STATUS.DELIVERED, ORDER_STATUS.CANCELLED, ORDER_STATUS.RETURNED],
    [ORDER_STATUS.DELIVERED]: [ORDER_STATUS.RETURNED],
    [ORDER_STATUS.CANCELLED]: [],
    [ORDER_STATUS.RETURNED]: []
};

// B2B valid transitions
const B2B_TRANSITIONS = {
    [B2B_STATUS.NEW]: [B2B_STATUS.PAID, B2B_STATUS.CANCELLED],
    [B2B_STATUS.PAID]: [B2B_STATUS.ACCEPTED, B2B_STATUS.REJECTED, B2B_STATUS.CANCELLED], // Accept OR Reject
    [B2B_STATUS.ACCEPTED]: [B2B_STATUS.PACKED, B2B_STATUS.CANCELLED],
    [B2B_STATUS.PACKED]: [B2B_STATUS.SHIPPED, B2B_STATUS.CANCELLED],
    [B2B_STATUS.SHIPPED]: [B2B_STATUS.DELIVERED, B2B_STATUS.CANCELLED],
    [B2B_STATUS.DELIVERED]: [],
    [B2B_STATUS.CANCELLED]: [],
    [B2B_STATUS.REJECTED]: []
};

/**
 * Validates if a status transition is allowed for B2C orders
 */
const isValidTransition = (from, to) => {
    const transitions = B2C_TRANSITIONS[from];
    return transitions ? transitions.includes(to) : false;
};

/**
 * Validates if a B2B status transition is allowed
 */
const isValidB2BTransition = (from, to) => {
    const transitions = B2B_TRANSITIONS[from];
    return transitions ? transitions.includes(to) : false;
};

/**
 * Returns the next status in the B2C flow
 */
const getNextStatus = (current) => {
    const flow = [
        ORDER_STATUS.PENDING,
        ORDER_STATUS.CONFIRMED,
        ORDER_STATUS.PROCESSING,
        ORDER_STATUS.SHIPPED,
        ORDER_STATUS.DELIVERED
    ];
    const idx = flow.indexOf(current);
    return idx >= 0 && idx < flow.length - 1 ? flow[idx + 1] : null;
};

/**
 * Returns the next status in the B2B flow
 */
const getNextB2BStatus = (current) => {
    const flow = [
        B2B_STATUS.ACCEPTED,
        B2B_STATUS.PACKED,
        B2B_STATUS.SHIPPED,
        B2B_STATUS.DELIVERED
    ];
    const idx = flow.indexOf(current);
    return idx >= 0 && idx < flow.length - 1 ? flow[idx + 1] : null;
};

module.exports = {
    ORDER_STATUS,
    B2B_STATUS,
    isValidTransition,
    isValidB2BTransition,
    getNextStatus,
    getNextB2BStatus
};