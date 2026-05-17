const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const ReturnRequestSchema = new Schema({
  // Order & Product References
  orderId: { 
    type: Schema.Types.ObjectId, 
    ref: 'authOrder',
    required: true 
  },
  catalogId: { 
    type: String, 
    required: true 
  },
  productId: { 
    type: Schema.Types.ObjectId, 
    ref: 'WearProduct',
    required: true 
  },
  
  // Supplier & Customer References
  partnerId: { 
    type: Schema.Types.ObjectId, 
    ref: 'Partner',
    required: true 
  },
  customerId: { 
    type: Schema.Types.ObjectId, 
    ref: 'wearBuyerModel',
    required: true 
  },
  
  // Return Details
  reason: { 
    type: String, 
    enum: [
      'damaged', 
      'wrong_item', 
      'size_issue', 
      'quality_issue', 
      'color_mismatch',
      'delivery_delay',
      'not_as_described',
      'other'
    ],
    required: true
  },
  reasonDescription: String,
  
  // Status Tracking
  status: { 
    type: String, 
    enum: [
      'requested',           // Customer requested return
      'approved',            // Admin approved return
      'rejected',            // Admin rejected return
      'pickup_scheduled',    // Pickup scheduled
      'picked_up',           // Product picked up
      'qc_pending',          // Waiting for supplier QC
      'qc_in_progress',      // Supplier doing QC
      'qc_passed',           // QC passed - product acceptable
      'qc_failed',           // QC failed - product damaged
      'refund_initiated',    // Refund process started
      'refund_completed',    // Refund completed
      'exchange_initiated',  // Exchange process started
      'exchange_completed',  // Exchange completed
      'closed'               // Case closed
    ],
    default: 'requested'
  },
  
  // QC Details (filled by supplier)
  qcNotes: String,
  qcDate: Date,
  qcBy: { type: Schema.Types.ObjectId, ref: 'Partner' },
  qcResult: { 
    type: String, 
    enum: ['pass', 'fail', 'partial_damage', 'missing_parts'] 
  },
  qcImages: [String], // Images taken during QC
  
  // Refund/Exchange Details
  refundAmount: Number,
  exchangeProductId: { type: Schema.Types.ObjectId, ref: 'WearProduct' },
  refundTransactionId: String,
  refundDate: Date,
  
  // Customer Uploads
  customerImages: [String], // Images uploaded by customer
  customerComments: String,
  
  // Logistics
  pickupAddress: {
    addressLine: String,
    city: String,
    state: String,
    pincode: String,
    phone: String
  },
  pickupDate: Date,
  pickupSlot: String,
  courierPartner: String,
  trackingId: String,
  
  // RTO Tracking (if applicable)
  isRTO: { type: Boolean, default: false },
  rtoTrackingId: String,
  rtoStatus: { 
    type: String, 
    enum: ['initiated', 'in_transit', 'delivered', 'failed', 'lost'] 
  },
  rtoDeliveryDate: Date,
  
  // Timestamps
  requestedAt: { type: Date, default: Date.now },
  approvedAt: Date,
  pickedUpAt: Date,
  qcCompletedAt: Date,
  refundInitiatedAt: Date,
  closedAt: Date,
  
  // Metadata
  priority: { 
    type: String, 
    enum: ['low', 'medium', 'high', 'critical'],
    default: 'medium'
  },
  tags: [String],
  notes: String, // Internal notes
  
  // Audit Trail
  createdBy: { type: Schema.Types.ObjectId, ref: 'wearBuyerModel' },
  updatedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// Indexes for faster queries
ReturnRequestSchema.index({ partnerId: 1, status: 1 });
ReturnRequestSchema.index({ orderId: 1 });
ReturnRequestSchema.index({ catalogId: 1 });
ReturnRequestSchema.index({ createdAt: -1 });
ReturnRequestSchema.index({ isRTO: 1, rtoStatus: 1 });

// Pre-save middleware to update updatedAt
ReturnRequestSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

// Static method to get return statistics for supplier
ReturnRequestSchema.statics.getSupplierStats = async function(partnerId) {
  const stats = await this.aggregate([
    { $match: { partnerId: new mongoose.Types.ObjectId(partnerId) } },
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 },
        totalAmount: { $sum: '$refundAmount' }
      }
    }
  ]);
  
  return stats.reduce((acc, stat) => {
    acc[stat._id] = {
      count: stat.count,
      totalAmount: stat.totalAmount || 0
    };
    return acc;
  }, {});
};

// Instance method to update status with validation
ReturnRequestSchema.methods.updateStatus = async function(newStatus, userId, notes = '') {
  const validTransitions = {
    requested: ['approved', 'rejected'],
    approved: ['pickup_scheduled', 'rejected'],
    pickup_scheduled: ['picked_up', 'cancelled'],
    picked_up: ['qc_pending'],
    qc_pending: ['qc_in_progress'],
    qc_in_progress: ['qc_passed', 'qc_failed'],
    qc_passed: ['refund_initiated', 'exchange_initiated'],
    qc_failed: ['refund_initiated', 'exchange_initiated'],
    refund_initiated: ['refund_completed'],
    exchange_initiated: ['exchange_completed'],
    refund_completed: ['closed'],
    exchange_completed: ['closed']
  };

  const currentStatus = this.status;
  
  if (!validTransitions[currentStatus] || !validTransitions[currentStatus].includes(newStatus)) {
    throw new Error(`Invalid status transition from ${currentStatus} to ${newStatus}`);
  }

  this.status = newStatus;
  this.updatedBy = userId;
  
  // Set appropriate timestamps
  const timestampMap = {
    approved: 'approvedAt',
    picked_up: 'pickedUpAt',
    qc_in_progress: 'qcDate',
    qc_passed: 'qcCompletedAt',
    qc_failed: 'qcCompletedAt',
    refund_initiated: 'refundInitiatedAt',
    refund_completed: 'closedAt',
    exchange_completed: 'closedAt',
    closed: 'closedAt'
  };

  if (timestampMap[newStatus]) {
    this[timestampMap[newStatus]] = new Date();
  }

  if (notes) {
    this.notes = this.notes ? `${this.notes}\n${new Date().toISOString()}: ${notes}` : notes;
  }

  return this.save();
};

const ReturnRequest = mongoose.model('ReturnRequest', ReturnRequestSchema);
module.exports = ReturnRequest;