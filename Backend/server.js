require("dotenv").config({ path: require("node:path").join(__dirname, ".env"), quiet: true })
const app = require("./src/app")
const connectToDB = require("./src/config/database")

async function start() {
    if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
        throw new Error("Set JWT_SECRET to a random value of at least 32 characters in Backend/.env")
    }
    await connectToDB()
    const port = Number(process.env.PORT || 3000)
    const server = app.listen(port, process.env.HOST || "127.0.0.1", () => {
        console.log(`IntervueX API is running at http://localhost:${port}`)
        if (!process.env.GOOGLE_GENAI_API_KEY) {
            console.log("Gemini is not configured. Add GOOGLE_GENAI_API_KEY to Backend/.env to enable AI features.")
        }
    })
    server.on("error", () => {
        console.error("Unable to listen. Check HOST/PORT and whether the port is already in use.")
        process.exit(1)
    })
    for (const signal of ["SIGINT", "SIGTERM"]) {
        process.on(signal, () => server.close(async () => {
            await require("mongoose").disconnect()
            process.exit(0)
        }))
    }
}

start().catch(() => {
    console.error("IntervueX could not start. Check MONGO_URI, MongoDB availability, and JWT_SECRET in Backend/.env.")
    process.exit(1)
})
