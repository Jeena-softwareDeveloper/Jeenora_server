const mongoose = require("mongoose");

const DistrictSchema = new mongoose.Schema({
  name: { type: String, required: true },
  users: [{ type: mongoose.Schema.Types.ObjectId, ref: "HireUser" }]
});

const LocationSchema = new mongoose.Schema({
  state: { type: String, required: true },
  districts: [DistrictSchema]
});

module.exports = mongoose.model("Location", LocationSchema);
