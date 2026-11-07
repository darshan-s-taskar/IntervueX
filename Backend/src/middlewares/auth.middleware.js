const jwt = require("jsonwebtoken")
const tokenBlacklistModel = require("../models/blacklist.model")



async function authUser(req, res, next) {

    const token = req.cookies.token

    if (!token) {
        return res.status(401).json({
            message: "Token not provided."
        })
    }

    let decoded
    try {
        decoded = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ["HS256"] })
        if (typeof decoded.id !== "string" || !/^[a-f0-9]{24}$/i.test(decoded.id)) throw new Error("Invalid subject")
    } catch {
        return res.status(401).json({ message: "Invalid token." })
    }

    const isTokenBlacklisted = await tokenBlacklistModel.findOne({
        token
    })

    if (isTokenBlacklisted) {
        return res.status(401).json({
            message: "token is invalid"
        })
    }

    req.user = decoded
    next()

}


module.exports = { authUser }
