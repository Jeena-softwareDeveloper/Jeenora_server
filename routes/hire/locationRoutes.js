const express = require("express");
const router = express.Router();
const locationController = require("../../controllers/hire/locationController");
const { authMiddleware } = require("../../middlewares/authMiddleware");


router.post("/", authMiddleware, locationController.addLocation);


router.put("/:state", authMiddleware, locationController.updateLocation);


router.delete("/:state", authMiddleware, locationController.deleteLocation);


router.get("/", locationController.getAllLocations);


router.get("/state/:state", locationController.getDistrictsByState);


router.post(
  "/district/:districtId/add-user",
  authMiddleware,
  locationController.addUserToDistrict
);

router.get(
  "/district/:districtId/users",
  authMiddleware,
  locationController.getUsersByDistrict
);

module.exports = router;
