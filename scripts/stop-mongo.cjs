const { MongoClient } = require('../Backend/node_modules/mongodb')
async function stop() {
    const client = new MongoClient('mongodb://127.0.0.1:27017', { serverSelectionTimeoutMS: 3000 })
    try {
        await client.connect()
        try { await client.db('admin').command({ shutdown: 1 }) }
        catch (error) { if (error.name !== 'MongoNetworkError') throw error }
    } finally { await client.close() }
}
stop().catch(() => { console.error('MongoDB shutdown failed.'); process.exitCode = 1 })
