const express = require("express")
const cookieParser = require("cookie-parser")
const cors = require("cors")

const app = express()

app.use(express.json())
app.use(cookieParser())
app.use(cors({
    origin: process.env.FRONTEND_URL || "http://localhost:5173",
    credentials: true
}))

/* require all the routes here */
const authRouter = require("./routes/auth.routes")
const interviewRouter = require("./routes/interview.routes")


/* using all the routes here */
app.use("/api/auth", authRouter)
app.use("/api/interview", interviewRouter)

app.get("/api/health", (req, res) => {
    const connected = require("mongoose").connection.readyState === 1
    res.status(connected ? 200 : 503).json({
        application: "IntervueX",
        database: connected ? "connected" : "disconnected",
        geminiConfigured: Boolean(process.env.GOOGLE_GENAI_API_KEY),
    })
})

app.use((err, req, res, next) => {
    if (res.headersSent) return next(err)
    if (err.code === "LIMIT_FILE_SIZE") return res.status(400).json({ message: "Resume must be a PDF no larger than 3 MB." })
    if (err.code === 11000) return res.status(409).json({ message: "Email or username already exists." })
    if (err.name === "CastError" || err.name === "ValidationError") return res.status(400).json({ message: "Please check the submitted fields or report ID." })
    if (err.type === "entity.parse.failed") return res.status(400).json({ message: "Invalid JSON request." })
    const status = Number(err.status) || 500
    const safeStatus = status >= 400 && status < 600 ? status : 500
    res.status(safeStatus).json({ message: err.publicMessage || "The request failed. Check your configuration and try again." })
})



module.exports = app
