const { MongoClient, Timestamp } = require("mongodb");
const uri = process.env.MONGO_URI
const client = new MongoClient(uri);


async function retrieveChatHistory(id) {
    try {
        await client.connect();
        const db = client.db("project"); // Replace with your database name
        const collection = db.collection("chat_history"); // Replace with your collection name
        const chatHistory = await collection.findOne({ whatsapp_id: id });
        // console.log("Chat History:", chatHistory.message);
        return chatHistory.message
    } catch (error) {
        console.error("Failed to retrieve chat history", error);
    } finally {
        await client.close();
        console.log("Disconnected from MongoDB");
    }
}

async function addChatData(id, data) {
    try {
        await client.connect();
        const collection = client.db("project").collection("chat_history"); // replace "test" and "users" with your database and collection name
        const query = { whatsapp_id: id };
        const update = {
            $setOnInsert: { whatsapp_id: id },
            $push: {
                message: data,
    
            }
        };
        const options = { upsert: true };
        const result = await collection.updateOne(query, update, options);
        console.log(`A document was ${result.upsertedCount === 1 ? 'inserted' : 'updated'}.`);
    } catch (err) {
        console.error(err);
    } finally {
        await client.close();
    }
}

async function addMessageReceived(id, data, profile_name) {
    try {
        await client.connect();
        const collection = client.db("project").collection("chat_history"); // replace "test" and "users" with your database and collection name
        const query = { whatsapp_id: id };
        const update = {
            $setOnInsert: { whatsapp_id: id, profile_name },
            $push: {
                "message": data,
            }
        };
        const options = { upsert: true };
        const result = await collection.updateOne(query, update, options);
        console.log(`A document was ${result.upsertedCount === 1 ? 'inserted' : 'updated'}.`);
    } catch (err) {
        console.error(err);
    } finally {
        await client.close();
    }
}

module.exports = { retrieveChatHistory, addChatData, addMessageReceived }