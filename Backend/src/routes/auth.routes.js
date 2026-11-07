const { Router } = require('express')
const authController = require("../controllers/auth.controller")
const authMiddleware = require("../middlewares/auth.middleware")
const { authLimiter } = require("../middlewares/limits.middleware")

const authRouter = Router()

/**
 * @route POST /api/auth/register
 * @description Register a new user
 * @access Public
 */
authRouter.post("/register", authLimiter, authController.registerUserController)


/**
 * @route POST /api/auth/login
 * @description login user with email and password
 * @access Public
 */
authRouter.post("/login", authLimiter, authController.loginUserController)


/**
 * @route POST /api/auth/logout
 * @description clear token from user cookie and add the token in blacklist
 * @access private
 */
authRouter.post("/logout", authMiddleware.authUser, authController.logoutUserController)


/**
 * @route GET /api/auth/get-me
 * @description get the current logged in user details
 * @access private
 */
authRouter.get("/get-me", authMiddleware.authUser, authController.getMeController)


module.exports = authRouter
