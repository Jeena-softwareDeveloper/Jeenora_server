const Location = require("../../models/hire/locationModel");
const { responseReturn } = require("../../utiles/response");

class LocationController {

  // CREATE STATE + DISTRICTS
  addLocation = async (req, res) => {
    try {
      let { state, districts } = req.body;

      if (!state || !districts) {
        return responseReturn(res, 400, { error: "State and districts required" });
      }

      if (typeof districts === "string") {
        districts = [districts];
      }

      const formattedDistricts = districts.map(d => ({ name: d, users: [] }));

      const exists = await Location.findOne({ state });
      if (exists) return responseReturn(res, 400, { error: "State already exists" });

      const location = await Location.create({
        state,
        districts: formattedDistricts
      });

      responseReturn(res, 201, {
        message: "Location created",
        location
      });
    } catch (err) {
      responseReturn(res, 500, { error: err.message });
    }
  };


  // GET ALL STATES
  getAllLocations = async (req, res) => {
    try {
      const locations = await Location.find();
      responseReturn(res, 200, { locations });
    } catch (err) {
      responseReturn(res, 500, { error: err.message });
    }
  };

  // GET DISTRICTS BY STATE
  getDistrictsByState = async (req, res) => {
    try {
      const { state } = req.params;

      const location = await Location.findOne({ state }).select("districts");

      if (!location) return responseReturn(res, 404, { error: "State not found" });

      responseReturn(res, 200, {
        state,
        districts: location.districts  // includes _id
      });
    } catch (err) {
      responseReturn(res, 500, { error: err.message });
    }
  };

  addUserToDistrict = async (req, res) => {
    try {
      const { districtId } = req.params;
      const { userId } = req.body;

      const location = await Location.findOne({ "districts._id": districtId });

      if (!location) return responseReturn(res, 404, { error: "District not found" });

      // Add user to district
      await Location.updateOne(
        { "districts._id": districtId },
        { $addToSet: { "districts.$.users": userId } }
      );

      responseReturn(res, 200, { message: "User added to district" });

    } catch (err) {
      responseReturn(res, 500, { error: err.message });
    }
  };

  getUsersByDistrict = async (req, res) => {
    try {
      const { districtId } = req.params;

      const location = await Location.findOne({ "districts._id": districtId })
        .populate("districts.users", "name phone experience profileImageUrl email");

      if (!location) return responseReturn(res, 404, { error: "District not found" });

      const district = location.districts.id(districtId);

      responseReturn(res, 200, {
        district: district.name,
        users: district.users
      });

    } catch (err) {
      responseReturn(res, 500, { error: err.message });
    }
  };

  // UPDATE STATE OR DISTRICTS
  updateLocation = async (req, res) => {
    try {
      const { state } = req.params;
      let { newState, districts } = req.body;

      const updateData = {};

      if (newState) updateData.state = newState;

      if (districts) {
        if (typeof districts === "string") {
          districts = [districts];
        }

        updateData.districts = districts.map(d => ({ name: d }));
      }

      const updated = await Location.findOneAndUpdate(
        { state },
        updateData,
        { new: true }
      );

      if (!updated) {
        return responseReturn(res, 404, { error: "State not found" });
      }

      responseReturn(res, 200, {
        message: "Location updated",
        updated
      });

    } catch (err) {
      responseReturn(res, 500, { error: err.message });
    }
  };

  // DELETE STATE
  deleteLocation = async (req, res) => {
    try {
      const { state } = req.params;

      const deleted = await Location.findOneAndDelete({ state });

      if (!deleted) {
        return responseReturn(res, 404, { error: "State not found" });
      }

      responseReturn(res, 200, { message: "State deleted" });

    } catch (err) {
      responseReturn(res, 500, { error: err.message });
    }
  };
}

module.exports = new LocationController();
