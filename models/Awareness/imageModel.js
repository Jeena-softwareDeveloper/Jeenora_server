
const mongoose = require('mongoose')

const imageSchema = new mongoose.Schema(
  {
    heading: {
      type: String,
      required: true,
      trim: true,
    },
    slug: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    description: {
      type: String,
      required: true,
      trim: true,
    },
    miniDescription: {
      type: String,
      required: true,
      trim: true,
    },
    image: {
      type: String,
      required: true,
    },
    isActive: {
        type: Boolean,
        default: true
    }
  },
  {
    timestamps: true, 
  }
)

module.exports = mongoose.model('AwarenessImage', imageSchema)
