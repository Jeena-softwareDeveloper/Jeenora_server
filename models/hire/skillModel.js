const mongoose = require("mongoose");

const skillSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    description: { type: String },
    users: [{ type: mongoose.Schema.Types.ObjectId, ref: "hireUser" }] 
  },
  { timestamps: true }
);

module.exports = mongoose.model("Skill", skillSchema);
