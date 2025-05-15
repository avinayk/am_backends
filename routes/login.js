const express = require("express");
const router = express.Router();
const loginController = require("../controllers/loginController");

// Define the POST /login route
router.post("/", loginController.login);
router.post("/checkloginOTP", loginController.checkloginOTP);
router.post("/checkUsersubscription", loginController.checkUsersubscription);

module.exports = router;
