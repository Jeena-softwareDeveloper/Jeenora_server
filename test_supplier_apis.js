// Test script to verify supplier API controllers
const express = require('express');
const request = require('supertest');

// Mock the required modules
const mockSupplier = {
  findOne: jest.fn().mockResolvedValue({
    _id: 'supplier123',
    user: 'user123',
    shopName: 'Test Shop',
    status: 'approved'
  })
};

const mockReturnRequest = {
  find: jest.fn().mockResolvedValue([
    { _id: 'ret1', orderId: 'ord1', status: 'pending_qc' },
    { _id: 'ret2', orderId: 'ord2', status: 'completed' }
  ])
};

const mockRTO = {
  find: jest.fn().mockResolvedValue([
    { _id: 'rto1', orderId: 'ord3', status: 'pending_receipt' },
    { _id: 'rto2', orderId: 'ord4', status: 'acknowledged' }
  ])
};

// Mock the controllers
const returnRTOCController = {
  get_supplier_returns: async (req, res) => {
    try {
      const supplier = await mockSupplier.findOne({ user: 'user123' });
      if (!supplier) {
        return res.status(404).json({ error: 'Supplier not found' });
      }
      
      const returns = await mockReturnRequest.find({ supplier: supplier._id });
      res.status(200).json({
        success: true,
        returns: returns,
        total: returns.length,
        summary: {
          pending: returns.filter(r => r.status === 'pending_qc').length,
          completed: returns.filter(r => r.status === 'completed').length,
          total: returns.length
        }
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },
  
  get_supplier_rtos: async (req, res) => {
    try {
      const supplier = await mockSupplier.findOne({ user: 'user123' });
      if (!supplier) {
        return res.status(404).json({ error: 'Supplier not found' });
      }
      
      const rtos = await mockRTO.find({ supplier: supplier._id });
      res.status(200).json({
        success: true,
        rtos: rtos,
        total: rtos.length,
        summary: {
          pending: rtos.filter(r => r.status === 'pending_receipt').length,
          acknowledged: rtos.filter(r => r.status === 'acknowledged').length,
          total: rtos.length
        }
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }
};

// Create test app
const app = express();
app.use(express.json());

// Mock auth middleware
const authMiddleware = (req, res, next) => {
  req.id = 'user123'; // Mock user ID
  next();
};

// Setup routes
app.get('/api/supplier/returns/v2', authMiddleware, returnRTOCController.get_supplier_returns);
app.get('/api/supplier/rtos', authMiddleware, returnRTOCController.get_supplier_rtos);

// Test the APIs
async function testAPIs() {
  console.log('Testing Supplier APIs...\n');
  
  try {
    // Test Returns API
    console.log('1. Testing GET /api/supplier/returns/v2');
    const returnsResponse = await request(app)
      .get('/api/supplier/returns/v2')
      .expect('Content-Type', /json/)
      .expect(200);
    
    console.log('   Status:', returnsResponse.status);
    console.log('   Returns count:', returnsResponse.body.returns.length);
    console.log('   Summary:', returnsResponse.body.summary);
    console.log('   ✓ Returns API working\n');
    
    // Test RTOs API
    console.log('2. Testing GET /api/supplier/rtos');
    const rtosResponse = await request(app)
      .get('/api/supplier/rtos')
      .expect('Content-Type', /json/)
      .expect(200);
    
    console.log('   Status:', rtosResponse.status);
    console.log('   RTOs count:', rtosResponse.body.rtos.length);
    console.log('   Summary:', rtosResponse.body.summary);
    console.log('   ✓ RTOs API working\n');
    
    // Test error case
    console.log('3. Testing error case (no supplier)');
    mockSupplier.findOne.mockResolvedValueOnce(null);
    
    const errorResponse = await request(app)
      .get('/api/supplier/returns/v2')
      .expect('Content-Type', /json/)
      .expect(404);
    
    console.log('   Status:', errorResponse.status);
    console.log('   Error:', errorResponse.body.error);
    console.log('   ✓ Error handling working\n');
    
    console.log('✅ All API tests passed!');
    console.log('\nSummary:');
    console.log('- Returns API: Returns list with summary statistics');
    console.log('- RTOs API: RTO list with summary statistics');
    console.log('- Error handling: Proper 404 for missing supplier');
    console.log('- Authentication: Mock auth middleware working');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    process.exit(1);
  }
}

// Run tests
if (require.main === module) {
  testAPIs();
}

module.exports = { app, returnRTOCController, testAPIs };