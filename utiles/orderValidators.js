const ORDER_STATUS = {
    PENDING: 'pending',
    CONFIRMED: 'confirmed',
    PROCESSING: 'processing',
    SHIPPED: 'shipped',
    DELIVERED: 'delivered',
    CANCELLED: 'cancelled',
    RETURNED: 'returned'
};

const VALID_TRANSITIONS = {
    [ORDER_STATUS.PENDING]: [ORDER_STATUS.CONFIRMED, ORDER_STATUS.CANCELLED],
    [ORDER_STATUS.CONFIRMED]: [ORDER_STATUS.PROCESSING, ORDER_STATUS.SHIPPED, ORDER_STATUS.CANCELLED],
    [ORDER_STATUS.PROCESSING]: [ORDER_STATUS.SHIPPED, ORDER_STATUS.CANCELLED],
    [ORDER_STATUS.SHIPPED]: [ORDER_STATUS.DELIVERED],
    [ORDER_STATUS.DELIVERED]: [ORDER_STATUS.RETURNED],
    [ORDER_STATUS.CANCELLED]: [],
    [ORDER_STATUS.RETURNED]: []
};

const isValidTransition = (currentStatus, nextStatus) => {
    if (!nextStatus) return false;
    const normalizedNext = nextStatus.toLowerCase();

    // Check if next status is even a valid status
    const isValidStatus = Object.values(ORDER_STATUS).includes(normalizedNext);
    if (!isValidStatus) return false;

    const allowed = VALID_TRANSITIONS[currentStatus] || [];
    return allowed.includes(normalizedNext);
};

module.exports = {
    ORDER_STATUS,
    isValidTransition
};
