const express = require("express");
const router = express.Router();
const upload = require("../middlewares/multerConfig"); // Adjust the path as needed

const registerController = require("../controllers/registerController");

// Define the POST /register route
router.post(
  "/register",
  upload.single("profile_image"),
  registerController.register
);
router.post(
  "/updateProfile",
  (req, res, next) => {
    next();
  },
  upload.fields([
    { name: "profile_image", maxCount: 1 },
    { name: "profile_image_1", maxCount: 1 },
    { name: "profile_image_2", maxCount: 1 },
    { name: "profile_image_3", maxCount: 1 },
    { name: "profile_image_4", maxCount: 1 },
    // Add more fields if necessary
  ]),
  registerController.updateProfile
);

router.post(
  "/getProfile",
  upload.single("profile_image"),
  registerController.getProfile
);
router.post("/getUserDetail", registerController.getUserDetail);
router.post("/getUserDetailsetting", registerController.getUserDetailsetting);
router.post("/getRequestDetails", registerController.getRequestDetails);
router.post("/paymentsave", registerController.paymentsave);
router.post("/logoutapi", registerController.logoutapi);
router.post("/forgotPassword", registerController.forgotPassword);
module.exports = router;
