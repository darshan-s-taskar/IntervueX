const mongoose = require("mongoose")



async function connectToDB() {

    if (!process.env.MONGO_URI) throw new Error("MONGO_URI is required")
    await mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 5000 })
    console.log("Connected to MongoDB")
}

module.exports = connectToDB
