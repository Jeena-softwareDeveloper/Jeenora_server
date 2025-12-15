const EcommerceProductView = require('../../models/analytics/Ecommerce/ProductView');
const EcommerceCart = require('../../models/analytics/Ecommerce/Cart');
const EcommerceCheckout = require('../../models/analytics/Ecommerce/Checkout');
const EcommerceTransaction = require('../../models/analytics/Ecommerce/Transaction');
const AnalyticsEvent = require('../../models/analytics/Core/Event');

class EcommerceAnalyticsController {
  
  // Track product view
  async trackProductView(req, res) {
    try {
      const productData = req.body;
      
      // Validate required fields
      if (!productData.user_id || !productData.session_id || !productData.product_id) {
        return res.status(400).json({
          error: 'user_id, session_id, and product_id are required'
        });
      }
      
      // Generate view ID
      productData.view_id = `pview_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      productData.timestamp = new Date(productData.timestamp || Date.now());
      
      // Create product view
      const productView = new EcommerceProductView(productData);
      await productView.save();
      
      // Also capture as core event
      await AnalyticsEvent.create({
        event_type: 'custom',
        event_name: 'product_view',
        user_id: productData.user_id,
        session_id: productData.session_id,
        website_type: 'ecommerce',
        timestamp: productData.timestamp,
        properties: productData
      });
      
      res.status(201).json({
        status: 'success',
        view_id: productData.view_id
      });
      
    } catch (error) {
      console.error('Product view tracking error:', error);
      res.status(500).json({
        error: 'Failed to track product view'
      });
    }
  }
  
  // Track cart actions
  async trackCartAction(req, res) {
    try {
      const cartData = req.body;
      
      // Validate required fields
      if (!cartData.user_id || !cartData.session_id || !cartData.action || !cartData.products) {
        return res.status(400).json({
          error: 'user_id, session_id, action, and products are required'
        });
      }
      
      // Generate cart ID if not provided
      if (!cartData.cart_id) {
        cartData.cart_id = `cart_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      }
      
      cartData.timestamp = new Date(cartData.timestamp || Date.now());
      
      // Create cart action
      const cartAction = new EcommerceCart(cartData);
      await cartAction.save();
      
      // Also capture as core event
      await AnalyticsEvent.create({
        event_type: 'add_to_cart',
        event_name: `cart_${cartData.action}`,
        user_id: cartData.user_id,
        session_id: cartData.session_id,
        website_type: 'ecommerce',
        timestamp: cartData.timestamp,
        properties: cartData
      });
      
      res.status(201).json({
        status: 'success',
        cart_id: cartData.cart_id
      });
      
    } catch (error) {
      console.error('Cart action tracking error:', error);
      res.status(500).json({
        error: 'Failed to track cart action'
      });
    }
  }
  
  // Track checkout steps
  async trackCheckoutStep(req, res) {
    try {
      const checkoutData = req.body;
      
      // Validate required fields
      if (!checkoutData.user_id || !checkoutData.session_id || !checkoutData.funnel_step || !checkoutData.step_name) {
        return res.status(400).json({
          error: 'user_id, session_id, funnel_step, and step_name are required'
        });
      }
      
      // Generate checkout ID if not provided
      if (!checkoutData.checkout_id) {
        checkoutData.checkout_id = `checkout_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      }
      
      checkoutData.timestamp = new Date(checkoutData.timestamp || Date.now());
      checkoutData.step_start_time = new Date(checkoutData.step_start_time || Date.now());
      
      // Create checkout step
      const checkoutStep = new EcommerceCheckout(checkoutData);
      await checkoutStep.save();
      
      res.status(201).json({
        status: 'success',
        checkout_id: checkoutData.checkout_id
      });
      
    } catch (error) {
      console.error('Checkout step tracking error:', error);
      res.status(500).json({
        error: 'Failed to track checkout step'
      });
    }
  }
  
  // Track transaction/purchase
  async trackTransaction(req, res) {
    try {
      const transactionData = req.body;
      
      // Validate required fields
      if (!transactionData.user_id || !transactionData.session_id || !transactionData.order_id || !transactionData.revenue) {
        return res.status(400).json({
          error: 'user_id, session_id, order_id, and revenue are required'
        });
      }
      
      // Generate transaction ID if not provided
      if (!transactionData.transaction_id) {
        transactionData.transaction_id = `txn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      }
      
      transactionData.timestamp = new Date(transactionData.timestamp || Date.now());
      
      // Create transaction
      const transaction = new EcommerceTransaction(transactionData);
      await transaction.save();
      
      // Also capture as core event
      await AnalyticsEvent.create({
        event_type: 'purchase',
        event_name: 'purchase_completed',
        user_id: transactionData.user_id,
        session_id: transactionData.session_id,
        website_type: 'ecommerce',
        timestamp: transactionData.timestamp,
        properties: transactionData
      });
      
      // Update session to mark as conversion
      await this.updateSessionConversion(transactionData.session_id, transactionData.revenue);
      
      res.status(201).json({
        status: 'success',
        transaction_id: transactionData.transaction_id
      });
      
    } catch (error) {
      console.error('Transaction tracking error:', error);
      res.status(500).json({
        error: 'Failed to track transaction'
      });
    }
  }
  
  // Update session conversion data
  async updateSessionConversion(sessionId, conversionValue) {
    try {
      await AnalyticsSession.updateOne(
        { session_id: sessionId },
        { 
          has_conversion: true,
          conversion_value: conversionValue
        }
      );
    } catch (error) {
      console.error('Session conversion update error:', error);
    }
  }
  
  // Get e-commerce analytics
  async getEcommerceAnalytics(req, res) {
    try {
      const { startDate, endDate } = req.query;
      
      const dateFilter = {};
      if (startDate && endDate) {
        dateFilter.timestamp = {
          $gte: new Date(startDate),
          $lte: new Date(endDate)
        };
      }
      
      // Get e-commerce metrics
      const [
        totalRevenue,
        totalTransactions,
        totalProductViews,
        totalAddToCart,
        conversionRate,
        topProducts,
        revenueByCategory
      ] = await Promise.all([
        // Total revenue
        EcommerceTransaction.aggregate([
          { $match: dateFilter },
          { $group: { _id: null, total: { $sum: '$revenue' } } }
        ]),
        
        // Total transactions
        EcommerceTransaction.countDocuments(dateFilter),
        
        // Total product views
        EcommerceProductView.countDocuments(dateFilter),
        
        // Total add to cart
        EcommerceCart.countDocuments({ ...dateFilter, action: 'add' }),
        
        // Conversion rate
        this.calculateConversionRate(dateFilter),
        
        // Top products
        EcommerceProductView.aggregate([
          { $match: dateFilter },
          { $group: { _id: '$product_id', name: { $first: '$product_name' }, views: { $sum: 1 } } },
          { $sort: { views: -1 } },
          { $limit: 10 }
        ]),
        
        // Revenue by category
        EcommerceTransaction.aggregate([
          { $match: dateFilter },
          { $unwind: '$products' },
          { $group: { _id: '$products.category', revenue: { $sum: '$products.price' } } },
          { $sort: { revenue: -1 } }
        ])
      ]);
      
      res.json({
        status: 'success',
        data: {
          total_revenue: totalRevenue[0]?.total || 0,
          total_transactions: totalTransactions,
          total_product_views: totalProductViews,
          total_add_to_cart: totalAddToCart,
          conversion_rate: conversionRate,
          top_products: topProducts,
          revenue_by_category: revenueByCategory
        }
      });
      
    } catch (error) {
      console.error('E-commerce analytics error:', error);
      res.status(500).json({
        error: 'Failed to fetch e-commerce analytics'
      });
    }
  }
  
  // Calculate conversion rate
  async calculateConversionRate(dateFilter) {
    try {
      const [sessionsWithPurchase, totalSessions] = await Promise.all([
        AnalyticsSession.countDocuments({ ...dateFilter, has_conversion: true }),
        AnalyticsSession.countDocuments(dateFilter)
      ]);
      
      return totalSessions > 0 ? (sessionsWithPurchase / totalSessions) * 100 : 0;
    } catch (error) {
      return 0;
    }
  }
}

module.exports = new EcommerceAnalyticsController();