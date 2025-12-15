const SubscriberCategory = require('../../models/Awareness/Subscriber/SubscriberCategory');
const Subscriber = require('../../models/Awareness/Subscriber/Subscriber');

// ---------------------- CATEGORY CRUD ---------------------- //
const addCategory = async (req, res) => {
  try {
    const { name, description } = req.body;
    
    if (!name) {
      return res.status(400).json({ error: 'Category name is required' });
    }

    // Check if category already exists
    const existingCategory = await SubscriberCategory.findOne({ name });
    if (existingCategory) {
      return res.status(400).json({ error: 'Category with this name already exists' });
    }

    const category = await SubscriberCategory.create({ name, description });
    res.status(201).json({ 
      message: 'Category created successfully', 
      category 
    });
  } catch (err) {
    console.error('Add category error:', err);
    res.status(500).json({ error: err.message });
  }
};

const getCategories = async (req, res) => {
  try {
    const categories = await SubscriberCategory.find().sort({ createdAt: -1 });
    res.json({
      success: true,
      count: categories.length,
      categories
    });
  } catch (err) {
    console.error('Get categories error:', err);
    res.status(500).json({ error: err.message });
  }
};

const getCategoryById = async (req, res) => {
  try {
    const category = await SubscriberCategory.findById(req.params.id);
    if (!category) {
      return res.status(404).json({ error: 'Category not found' });
    }
    res.json({ category });
  } catch (err) {
    console.error('Get category error:', err);
    res.status(500).json({ error: err.message });
  }
};

const updateCategory = async (req, res) => {
  try {
    const { name, description } = req.body;
    
    if (!name) {
      return res.status(400).json({ error: 'Category name is required' });
    }

    const updated = await SubscriberCategory.findByIdAndUpdate(
      req.params.id, 
      { name, description }, 
      { new: true, runValidators: true }
    );
    
    if (!updated) {
      return res.status(404).json({ error: 'Category not found' });
    }
    
    res.json({ 
      message: 'Category updated successfully', 
      category: updated 
    });
  } catch (err) {
    console.error('Update category error:', err);
    res.status(500).json({ error: err.message });
  }
};

const deleteCategory = async (req, res) => {
  try {
    // Check if category has subscribers
    const subscribersCount = await Subscriber.countDocuments({ category: req.params.id });
    if (subscribersCount > 0) {
      return res.status(400).json({ 
        error: `Cannot delete category. It has ${subscribersCount} subscriber(s) associated.` 
      });
    }

    const deleted = await SubscriberCategory.findByIdAndDelete(req.params.id);
    if (!deleted) {
      return res.status(404).json({ error: 'Category not found' });
    }
    
    res.json({ 
      message: 'Category deleted successfully',
      deletedCategory: deleted 
    });
  } catch (err) {
    console.error('Delete category error:', err);
    res.status(500).json({ error: err.message });
  }
};

// ---------------------- SUBSCRIBER CRUD ---------------------- //
const addSubscriber = async (req, res) => {
  try {
    const { name, email, phone, categoryId } = req.body;

    // Validation
    if (!name) {
      return res.status(400).json({ error: 'Subscriber name is required' });
    }

    if (!email && !phone) {
      return res.status(400).json({ error: 'Email or phone number is required' });
    }

    // Validate email format if provided
    if (email) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return res.status(400).json({ error: 'Invalid email format' });
      }
    }

    // Validate phone format if provided
    if (phone) {
      const phoneRegex = /^[0-9]{10,15}$/;
      if (!phoneRegex.test(phone)) {
        return res.status(400).json({ error: 'Invalid phone number format' });
      }
    }

    // Check if category exists
    if (categoryId) {
      const category = await SubscriberCategory.findById(categoryId);
      if (!category) {
        return res.status(400).json({ error: 'Category not found' });
      }
    }

    // Check for duplicate email
    if (email) {
      const existingSubscriber = await Subscriber.findOne({ email });
      if (existingSubscriber) {
        return res.status(400).json({ error: 'Subscriber with this email already exists' });
      }
    }

    // Check for duplicate phone
    if (phone) {
      const existingSubscriber = await Subscriber.findOne({ phone });
      if (existingSubscriber) {
        return res.status(400).json({ error: 'Subscriber with this phone number already exists' });
      }
    }

    const subscriber = await Subscriber.create({ 
      name, 
      email, 
      phone, 
      category: categoryId 
    });

    // Populate category in response
    await subscriber.populate('category');

    res.status(201).json({ 
      message: 'Subscriber added successfully', 
      subscriber 
    });
  } catch (err) {
    console.error('Add subscriber error:', err);
    res.status(500).json({ error: err.message });
  }
};

const getSubscribers = async (req, res) => {
  try {
    const { category, search, page = 1, limit = 10 } = req.query;
    
    let query = {};
    
    // Filter by category
    if (category) {
      query.category = category;
    }
    
    // Search by name, email, or phone
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { phone: { $regex: search, $options: 'i' } }
      ];
    }

    const options = {
      page: parseInt(page),
      limit: parseInt(limit),
      sort: { createdAt: -1 },
      populate: 'category'
    };

    const subscribers = await Subscriber.find(query)
      .populate('category')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Subscriber.countDocuments(query);

    res.json({
      success: true,
      total,
      page: parseInt(page),
      pages: Math.ceil(total / limit),
      subscribers
    });
  } catch (err) {
    console.error('Get subscribers error:', err);
    res.status(500).json({ error: err.message });
  }
};

const getSubscriberById = async (req, res) => {
  try {
    const subscriber = await Subscriber.findById(req.params.id).populate('category');
    if (!subscriber) {
      return res.status(404).json({ error: 'Subscriber not found' });
    }
    res.json({ subscriber });
  } catch (err) {
    console.error('Get subscriber error:', err);
    res.status(500).json({ error: err.message });
  }
};

const updateSubscriber = async (req, res) => {
  try {
    const { name, email, phone, categoryId } = req.body;

    // Check if subscriber exists
    const existingSubscriber = await Subscriber.findById(req.params.id);
    if (!existingSubscriber) {
      return res.status(404).json({ error: 'Subscriber not found' });
    }

    // Validate email if provided
    if (email) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return res.status(400).json({ error: 'Invalid email format' });
      }
      
      // Check for duplicate email (excluding current subscriber)
      const duplicateEmail = await Subscriber.findOne({ 
        email, 
        _id: { $ne: req.params.id } 
      });
      if (duplicateEmail) {
        return res.status(400).json({ error: 'Another subscriber with this email already exists' });
      }
    }

    // Validate phone if provided
    if (phone) {
      const phoneRegex = /^[0-9]{10,15}$/;
      if (!phoneRegex.test(phone)) {
        return res.status(400).json({ error: 'Invalid phone number format' });
      }
      
      // Check for duplicate phone (excluding current subscriber)
      const duplicatePhone = await Subscriber.findOne({ 
        phone, 
        _id: { $ne: req.params.id } 
      });
      if (duplicatePhone) {
        return res.status(400).json({ error: 'Another subscriber with this phone number already exists' });
      }
    }

    // Check if category exists
    if (categoryId) {
      const category = await SubscriberCategory.findById(categoryId);
      if (!category) {
        return res.status(400).json({ error: 'Category not found' });
      }
    }

    const updated = await Subscriber.findByIdAndUpdate(
      req.params.id,
      { name, email, phone, category: categoryId },
      { new: true, runValidators: true }
    ).populate('category');

    res.json({ 
      message: 'Subscriber updated successfully', 
      subscriber: updated 
    });
  } catch (err) {
    console.error('Update subscriber error:', err);
    res.status(500).json({ error: err.message });
  }
};

const deleteSubscriber = async (req, res) => {
  try {
    const deleted = await Subscriber.findByIdAndDelete(req.params.id);
    if (!deleted) {
      return res.status(404).json({ error: 'Subscriber not found' });
    }
    
    res.json({ 
      message: 'Subscriber deleted successfully',
      deletedSubscriber: deleted 
    });
  } catch (err) {
    console.error('Delete subscriber error:', err);
    res.status(500).json({ error: err.message });
  }
};

const getSubscribersByCategory = async (req, res) => {
  try {
    const { categoryId } = req.params;
    const { page = 1, limit = 10 } = req.query;

    // Check if category exists
    const category = await SubscriberCategory.findById(categoryId);
    if (!category) {
      return res.status(404).json({ error: 'Category not found' });
    }

    const subscribers = await Subscriber.find({ category: categoryId })
      .populate('category')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Subscriber.countDocuments({ category: categoryId });

    res.json({
      success: true,
      category,
      total,
      page: parseInt(page),
      pages: Math.ceil(total / limit),
      subscribers
    });
  } catch (err) {
    console.error('Get subscribers by category error:', err);
    res.status(500).json({ error: err.message });
  }
};

module.exports = {
  // Category CRUD
  addCategory,
  getCategories,
  getCategoryById,
  updateCategory,
  deleteCategory,
  
  // Subscriber CRUD
  addSubscriber,
  getSubscribers,
  getSubscriberById,
  updateSubscriber,
  deleteSubscriber,
  getSubscribersByCategory
};