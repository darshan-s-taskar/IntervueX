const multer = require("multer")


const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 3 * 1024 * 1024, // 3MB
        files: 1,
        fields: 2,
        parts: 3,
        fieldSize: 50000,
    }
})


module.exports = upload
