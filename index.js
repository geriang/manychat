const fetch = require('node-fetch');
global.Headers = require('node-fetch').Headers;
global.fetch = fetch;
global.Request = fetch.Request;
global.Response = fetch.Response;
global.Headers = fetch.Headers;

const express = require("express");
require('dotenv').config();
const cors = require('cors');
const bodyParser = require('body-parser');
// const axios = require('axios');

const App = express();

App.use(express.json()); // Middleware for parsing JSON bodies of incoming requests
App.use(bodyParser.json());
App.use(cors({
    origin: true
}))

App.use(express.urlencoded({
    extended: false
}))


const { ChatOpenAI } = require("langchain/chat_models/openai");
const {
    ChatPromptTemplate,
    MessagesPlaceholder,
    HumanMessagePromptTemplate,
    SystemMessagePromptTemplate,
} = require("langchain/prompts");
const { ConversationChain } = require("langchain/chains");
const { BufferMemory, ChatMessageHistory } = require("langchain/memory");
const { HumanChatMessage, AIChatMessage } = require("langchain/schema");


const { MongoClient } = require("mongodb");
const uri = process.env.MONGO_URI
const client = new MongoClient(uri);

// async function connectToMongoDB() {
//     try {
//         await client.connect();
//         console.log("Connected to MongoDB");
//     } catch (error) {
//         console.error("Failed to connect to MongoDB", error);
//     }
// }

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
            $push: { message: data },
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

App.post('/chatgpt', async (req, res) => {


    let message = req.body.data.message
    let whatsapp_id = req.body.data.whatsapp_id
    console.log("message received by chatgpt", message)
    console.log("whatsappid received by chatgpt", whatsapp_id)

    

    const pastMessagesData = await retrieveChatHistory(whatsapp_id)
    // console.log("past messages data received by chatgpt", pastMessagesData)
    let pastMessages = []

    if (pastMessagesData) {
        return pastMessages = [
            new HumanChatMessage((pastMessagesData.map((obj) => { return obj.client })).toString()),
            new AIChatMessage((pastMessagesData.map((obj) => { return obj.bot })).toString())
        ]

    }

    console.log("past messages", pastMessages)

    // initiating the chatmodel - openai
    const chat = new ChatOpenAI({ temperature: 0 });

    // initiating memory and past messages
    // let pastMessages = await pastMessagesData.map((obj) => {
    //     return [
    //         new HumanChatMessage((obj.client).toString()),
    //         new AIChatMessage((obj.bot).toString()),
    //     ];
    // });



    // defining the prompt templates
    const chatPrompt = ChatPromptTemplate.fromPromptMessages([
        SystemMessagePromptTemplate.fromTemplate(`You are a helpful real estate agent Bot from Huttons Sales & Auction.
         Your job is to answer to enquiries from both co-broke agents and prospective clients truthfully. 
         If there is any information that you cannot find, you have to refer the enquirer to contact Geri @ 84430486 for more information. 
         Always keep your reply to not more than 255 characters.
         At the start of an incoming enquiry, you need to determine the following:
         1. Who is the enquirer? Is the person a direct client or a co-broke agent?
         2. What is the nature of enquiry? Is it a sales enquiry, rental enquiry or general enquiry?
         3. Which property or property address is the enquirer enquirying on? 
         4. From where did the enquirer find the contact information to start the enquiry?
         `),
        new MessagesPlaceholder("chat_history"),
        HumanMessagePromptTemplate.fromTemplate("{input}"),
    ]);

    // initiating chain with memory function and chatprompt which introduces templates
    const chain = new ConversationChain({
        prompt: chatPrompt,
        memory: new BufferMemory({
            chatHistory: new ChatMessageHistory(pastMessages),
            returnMessages: true,
            memoryKey: "chat_history"
        }),
        llm: chat,
    });
    // console.log("chain", chain)
    try {
        const response = await chain.call({
            input: `${message}`
        })

        res.send(response)

        let data = {
            "client": `${message}`,
            "bot": `${response.response}`
        }

        await addChatData(whatsapp_id, data)

    } catch (err) {
        console.error("Error in POST /chatgpt:", err);
    }


})

App.listen(process.env.PORT || 3000, () => {
    console.log('server started')

});



