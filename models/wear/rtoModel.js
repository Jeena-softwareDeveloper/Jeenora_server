const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const RTOSchema = new Schema({
  // Order & Supplier References
  orderId: { 
    type: Schema.Types.ObjectId, 
    ref: 'authOrder',
    required: true 
  },
  supplierId: { 
    type: Schema.Types.ObjectId, 
    ref: 'Supplier',
    required: true 
  },
  
  // RTO Details
  rtoId: { 
    type: String, 
    unique: true,
    required: true 
  },
  reason: { 
    type: String, 
    enum: [
      'address_incorrect',
      'customer_unavailable',
      'customer_refused',
      'damaged_in_transit',
      'out_of_delivery_area',
      'security_concern',
      'holiday',
      'other'
    ],
    required: true
  },
  reasonDescription: String,
  
  // Status Tracking
  status: { 
    type: String, 
    enum: [
      'initiated',        // RTO initiated by courier
      'acknowledged',     // Supplier acknowledged RTO
      'in_transit',       // Product in transit back
      'received',         // Supplier received product
      'qc_pending',       // Waiting for QC
      'qc_completed',     // QC completed
      'restocked',        // Product restocked
      'disposed',         // Product disposed (damaged)
      'lost',             // Product lost in transit
      'closed'            // RTO case closed
    ],
    default: 'initiated'
  },
  
  // Courier & Logistics
  courierPartner: { 
    type: String, 
    required: true 
  },
  trackingId: { 
    type: String, 
    required: true 
  },
  awbNumber: String,
  
  // Delivery Details
  originalDeliveryAttempts: Number,
  lastDeliveryAttemptDate: Date,
  rtoInitiatedDate: Date,
  estimatedDelivery: Date,
  actualDelivery: Date,
  
  // QC Details
  qcStatus: { 
    type: String, 
    enum: ['pending', 'passed', 'failed', 'partial_damage'] 
  },
  qcNotes: String,
  qcDate: Date,
  qcBy: { type: Schema.Types.ObjectId, ref: 'Supplier' },
  qcImages: [String],
  
  // Product Condition
  productCondition: { 
    type: String, 
    enum: [
      'new',
      'like_new', 
      'minor_damage',
      'major_damage',
      'sealed',
      'opened',
      'used',
      'damaged'
    ]
  },
  damageDescription: String,
  isResalable: Boolean,
  
  // Financial Impact
  shippingCost: Number,
  rtoCharges: Number,
  penaltyAmount: Number,
  refundToCustomer: Number,
  netLoss: Number,
  
  // Restocking Details
  restockLocation: String,
  restockDate: Date,
  newSkuId: String, // If repackaged with new SKU
  disposalMethod: { 
    type: String, 
    enum: ['donated', 'recycled', 'destroyed', 'sold_as_seconds'] 
  },
  
  // Communication
  customerNotified: Boolean,
  customerNotificationDate: Date,
  supplierNotified: Boolean,
  supplierNotificationDate: Date,
  
  // Timestamps
  createdAt: { type: Date, default: Date.now },
  acknowledgedAt: Date,
  inTransitAt: Date,
  receivedAt: Date,
  qcCompletedAt: Date,
  restockedAt: Date,
  closedAt: Date,
  
  // Metadata
  priority: { 
    type: String, 
    enum: ['low', 'medium', 'high', 'critical'],
    default: 'medium'
  },
  tags: [String],
  notes: String,
  
  // Audit Trail
  createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
  updatedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  updatedAt: { type: Date, default: Date.now }
});

// Indexes for faster queries
RTOSchema.index({ supplierId: 1, status: 1 });
RTOSchema.index({ orderId: 1 });
RTOSchema.index({ rtoId: 1 });
RTOSchema.index({ trackingId: 1 });
RTOSchema.index({ createdAt: -1 });
RTOSchema.index({ estimatedDelivery: 1 });

// Pre-save middleware to update updatedAt and generate RTO ID
RTOSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  
  // Generate RTO ID if not present
  if (!this.rtoId) {
    const timestamp = Date.now().toString().slice(-6);
    const random = Math.random().toString(36).substring(2, 5).toUpperCase();
    this.rtoId = `RTO-${timestamp}-${random}`;
  }
  
  next();
});

// Static method to get RTO statistics for supplier
RTOSchema.statics.getSupplierStats = async function(supplierId) {
  const stats = await this.aggregate([
    { $match: { supplierId: new mongoose.Types.ObjectId(supplierId) } },
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 },
        totalCharges: { $sum: { $add: ['$shippingCost', '$rtoCharges', '$penaltyAmount'] } },
        avgTransitDays: { 
          $avg: { 
            $cond: [
              { $and: ['$inTransitAt', '$receivedAt'] },
              { $divide: [{ $subtract: ['$receivedAt', '$inTransitAt'] }, 1000 * 60 * 60 * 24] },
              null
            ]
          }
        }
      }
    }
  ]);
  
  return stats.reduce((acc, stat) => {
    acc[stat._id] = {
      count: stat.count,
      totalCharges: stat.totalCharges || 0,
      avgTransitDays: stat.avgTransitDays ? Math.round(stat.avgTransitDays * 10) / 10 : 0
    };
    return acc;
  }, {});
};

// Static method to get RTO trends (last 30 days)
RTOSchema.statics.getSupplierTrends = async function(supplierId) {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  
  const trends = await this.aggregate([
    { 
      $match: { 
        supplierId: new mongoose.Types.ObjectId(supplierId),
        createdAt: { $gte: thirtyDaysAgo }
      } 
    },
    {
      $group: {
        _id: {
          $dateToString: { format: '%Y-%m-%d', date: '$createdAt' }
        },
        count: { $sum: 1 },
        totalCharges: { $sum: { $add: ['$shippingCost', '$rtoCharges', '$penaltyAmount'] } }
      }
    },
    { $sort: { '_id': 1 } }
  ]);
  
  return trends;
};

// Instance method to update status with validation
RTOSchema.methods.updateStatus = async function(newStatus, userId, notes = '') {
  const validTransitions = {
    initiated: ['acknowledged', 'lost'],
    acknowledged: ['in_transit', 'lost'],
    in_transit: ['received', 'lost'],
    received: ['qc_pending', 'lost'],
    qc_pending: ['qc_completed'],
    qc_completed: ['restocked', 'disposed'],
    restocked: ['closed'],
    disposed: ['closed'],
    lost: ['closed']
  };

  const currentStatus = this.status;
  
  if (!validTransitions[currentStatus] || !validTransitions[currentStatus].includes(newStatus)) {
    throw new Error(`Invalid RTO status transition from ${currentStatus} to ${newStatus}`);
  }

  this.status = newStatus;
  this.updatedBy = userId;
  
  // Set appropriate timestamps
  const timestampMap = {
    acknowledged: 'acknowledgedAt',
    in_transit: 'inTransitAt',
    received: 'receivedAt',
    qc_completed: 'qcCompletedAt',
    restocked: 'restockedAt',
    disposed: 'closedAt',
    closed: 'closedAt',
    lost: 'closedAt'
  };

  if (timestampMap[newStatus]) {
    this[timestampMap[newStatus]] = new Date();
  }

  // Auto-set QC date if status is qc_completed
  if (newStatus === 'qc_completed' && !this.qcDate) {
    this.qcDate = new Date();
  }

  if (notes) {
    this.notes = this.notes ? `${this.notes}\n${new Date().toISOString()}: ${notes}` : notes;
  }

  return this.save();
};

// Instance method to calculate financial impact
RTOSchema.methods.calculateFinancialImpact = function() {
  const totalCharges = (this.shippingCost || 0) + (this.rtoCharges || 0) + (this.penaltyAmount || 0);
  const refundAmount = this.refundToCustomer || 0;
  
  this.netLoss = totalCharges + refundAmount;
  return this.netLoss;
};

const RTO = mongoose.model('RTO', RTOSchema);
module.exports = RTO;