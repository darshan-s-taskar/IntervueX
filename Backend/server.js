require("dotenv").config({ path: require("node:path").join(__dirname, ".env"), quiet: true })
const app = require("./src/app")
const connectToDB = require("./src/config/database")

async function start() {
    if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
        throw new Error("Set JWT_SECRET to a random value of at least 32 characters in Backend/.env")
    }
    if (process.env.NODE_ENV === "production") {
        const origin = new URL(process.env.FRONTEND_URL)
        if (origin.protocol !== "https:" || origin.origin !== process.env.FRONTEND_URL || /^(localhost|127\.0\.0\.1)$/.test(origin.hostname)) {
            throw new Error("FRONTEND_URL must be the exact HTTPS frontend origin")
        }
        if (!process.env.GOOGLE_GENAI_API_KEY) throw new Error("GOOGLE_GENAI_API_KEY is required in production")
    }
    await connectToDB()
    const port = Number(process.env.PORT || 3000)
    const host = process.env.HOST || (process.env.NODE_ENV === "production" ? "0.0.0.0" : "127.0.0.1")
    const server = app.listen(port, host, () => {
        console.log(`IntervueX API is running on ${host}:${port}`)
        if (!process.env.GOOGLE_GENAI_API_KEY) {
            console.log("Gemini is not configured. Add GOOGLE_GENAI_API_KEY to Backend/.env to enable AI features.")
        }
    })
    server.on("error", () => {
        console.error("Unable to listen. Check HOST/PORT and whether the port is already in use.")
        process.exit(1)
    })
    for (const signal of ["SIGINT", "SIGTERM"]) {
        process.on(signal, () => {
            setTimeout(() => process.exit(1), 20000).unref()
            server.close(async () => {
                await require("mongoose").disconnect()
                process.exit(0)
            })
        })
    }
}

start().catch(() => {
    console.error("IntervueX could not start. Check MONGO_URI, MongoDB access, JWT_SECRET, FRONTEND_URL and GOOGLE_GENAI_API_KEY in the backend environment.")
    process.exit(1)
})
