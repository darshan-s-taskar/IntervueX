const { rateLimit } = require("express-rate-limit")

const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 30,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    message: { message: "Too many authentication attempts. Try again in 15 minutes." },
})

const aiLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    limit: 10,
    keyGenerator: req => req.user.id,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    message: { message: "AI request limit reached. Try again in an hour." },
})

// Bound memory/Chromium use on small Render instances, including aborted HTTP requests.
let activeGeneration = false
function generationSlot(handler) {
    return async (req, res) => {
        if (activeGeneration) return res.status(503).json({ message: "Generation is busy. Try again shortly." })
        activeGeneration = true
        try { await handler(req, res) } finally { activeGeneration = false }
    }
}

module.exports = { authLimiter, aiLimiter, generationSlot }
