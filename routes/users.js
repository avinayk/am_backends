const express = require("express");
const router = express.Router();

const usersController = require("../controllers/usersController");

// Define the POST /register route

router.post("/getSearchAddfriend", usersController.getSearchAddfriend);
router.post("/getUserdetail", usersController.getUserdetail);
router.post("/getAddfriend", usersController.getAddfriend);
router.post("/requestSent", usersController.requestSent);
module.exports = router;
