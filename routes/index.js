const express = require("express");
const router = express.Router();
const LoginRouter = require("./login");

router.use("/login", LoginRouter);

module.exports = router;
