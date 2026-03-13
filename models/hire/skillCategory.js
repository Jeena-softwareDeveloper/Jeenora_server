// models/SkillsCategory.js
const mongoose = require('mongoose');

const skillsCategorySchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Category name is required'],
    unique: true,
    trim: true,
    maxlength: [100, 'Category name cannot exceed 100 characters']
  },
  description: {
    type: String,
    trim: true,
    maxlength: [500, 'Description cannot exceed 500 characters']
  },
  icon: {
    type: String,
    default: '📊'
  },
  isActive: {
    type: Boolean,
    default: true
  },
  skillCount: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true
});

// Update skill count when skills are added/removed
skillsCategorySchema.methods.updateSkillCount = async function() {
  const skillCount = await mongoose.model('Skill').countDocuments({ 
    category: this._id, 
    isActive: true 
  });
  this.skillCount = skillCount;
  await this.save();
};

module.exports = mongoose.model('SkillsCategory', skillsCategorySchema);