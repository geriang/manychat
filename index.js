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
const axios = require('axios');

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
const { initializeAgentExecutorWithOptions } = require("langchain/agents");
const {
    MessagesPlaceholder,
} = require("langchain/prompts");
// const { z } = require("zod")
const { BufferMemory, ChatMessageHistory } = require("langchain/memory");
const { HumanChatMessage, AIChatMessage } = require("langchain/schema");
const { Calculator } = require("langchain/tools/calculator");

const { SerpAPI, ChainTool, DynamicTool } = require("langchain/tools");
const { VectorDBQAChain } = require("langchain/chains");
const { HNSWLib } = require("langchain/vectorstores/hnswlib");
const { OpenAIEmbeddings } = require("langchain/embeddings/openai");
const { RecursiveCharacterTextSplitter } = require("langchain/text_splitter");
const fs = require('fs');



const { MongoClient } = require("mongodb");
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

// Whatsapp webhook
App.get('/webhook', (req, res) => {
    if (req.query['hub.mode'] === 'subscribe' &&
        req.query['hub.verify_token'] === WHATSAPP_WEBHOOK_TOKEN) {
        // console.log('Validating webhook');
        // res.sendStatus(200)
        res.status(200).send(req.query['hub.challenge']);
        // res.sendStatus(200)
    } else {
        console.error('Failed validation. Make sure the validation tokens match.');
        res.sendStatus(403);
    }
});

App.post('/webhook', async (req, res) => {
    // WhatsApp sends data as JSON in the body of the request
    let data = req.body;
    // Handle different types of messages
    if (data.entry &&
        data.entry[0].changes[0].value.messages &&
        data.entry[0].changes[0].value.contacts) {
        // Handle text message
        // data.entry[0].changes[0].value.messages = data.entry[0].changes[0].value.messages.filter((message) => message.timestamp > (Date.now() - 1000 * 60 * 5)/1000);
        let message = JSON.stringify(data.entry[0].changes[0].value.messages[0].text.body);
        let whatsapp_id = JSON.stringify(data.entry[0].changes[0].value.contacts[0].wa_id);
        let profile_name = JSON.stringify(data.entry[0].changes[0].value.contacts[0].profile.name);
        // console.log("contacts", data.entry[0].changes[0].value.contacts)
        // console.log("messages", data.entry[0].changes[0].value.messages)
        res.sendStatus(200);
        try {
            const data = {
                message,
                whatsapp_id,
                profile_name
            }
            await axios.post("https://geriang-manychat.onrender.com/chatgpt", data)

        } catch (err) {
            console.error("Error in POST /webhook:", err);
        }
    } else {
        res.sendStatus(400);
    }
    // if (data.errors) {
    //     // Loop through each error
    //     data.errors.forEach((error) => {
    //         console.log('Received error:', error);
    //     });
    // }
});
// whatsapp webhook end

App.post('/chatgpt', async (req, res) => {

    console.log("chatgpt req.body", req.body)
    let message = req.body.message
    let whatsapp_id = req.body.whatsapp_id
    console.log("message received by chatgpt", message)
    console.log("whatsappid received by chatgpt", whatsapp_id)

    const pastMessagesData = await retrieveChatHistory(whatsapp_id)
    // console.log("past messages data received by chatgpt", pastMessagesData)
    let pastMessages = []

    if (pastMessagesData) {
        pastMessages = [
            new HumanChatMessage((pastMessagesData.map((obj) => { return obj.client })).toString()),
            new AIChatMessage((pastMessagesData.map((obj) => { return obj.bot })).toString())
        ]
    }

    // console.log("past messages", pastMessages)

    // initiating the chatmodel - openai
    const llm = new ChatOpenAI({ temperature: 0 });

    //  to embed property listing information
    /* Load in the file we want to do question answering over */
    const text = fs.readFileSync("property.txt", "utf8");
    /* Split the text into chunks */
    const textSplitter = new RecursiveCharacterTextSplitter({ chunkSize: 1000 });
    const docs = await textSplitter.createDocuments([text]);
    /* Create the vectorstore */
    const vectorStore = await HNSWLib.fromDocuments(docs, new OpenAIEmbeddings());
    /* Create the chain */
    const chain = VectorDBQAChain.fromLLM(llm, vectorStore);

    // create new tool for searching property information
    const propertyDatabaseTool = new ChainTool({
        name: "property_listing_database",
        description:
            "property listing database- useful for when you need to find information on a particular property listed by Huttons Sales & Auction.",
        chain: chain,
        returnDirect: true,
    });

    // define the tools available
    const tools = [
        new Calculator(),
        new DynamicTool({
            name: "chatting_tool",
            description:
                "use this tool to simply chat with human.",
            func: async () =>{
                const chat = new ChatOpenAI();
                await chat.call([
                  new HumanChatMessage(
                    `${message}`
                  ),
                ]);
            },
            returnDirect: true
        }),
        // new SerpAPI(`${process.env.SERPAPI_API_KEY}`, {
        //     location: "Singapore",
        //     hl: "en",
        //     gl: "sg",
        // }),
        propertyDatabaseTool,
    ];

    // initialize the agent
    const executor = await initializeAgentExecutorWithOptions(tools, llm, {
        agentType: "structured-chat-zero-shot-react-description",
        verbose: true,
        maxIterations: 4,
        memory: new BufferMemory({
            chatHistory: new ChatMessageHistory(pastMessages),
            returnMessages: true,
            memoryKey: "chat_history",
        }),
        agentArgs: {
            inputVariables: ["input", "agent_scratchpad", "chat_history"],
            memoryPrompts: [new MessagesPlaceholder("chat_history")],
            prefix: "You are a chatbot that answers to enquires by using chatting_tool first.",
            suffix: "Remember to "
        }
    });

    try {
        const version = process.env.WHATSAPP_VERSION
        const phoneNumberID = process.env.WHATSAPP_PHONE_NUMBER_ID
        const response = await executor.call({ input: `${message}` });
        console.log("response", response)

        await axios.post(`https://graph.facebook.com/${version}/${phoneNumberID}/messages`, {

            "messaging_product": "whatsapp",
            "recipient_type": "individual",
            "to": `${whatsapp_id}`,
            "type": "text",
            "text": {
                "preview_url": true,
                "body": `${response.output}`,
            }
        }, {
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${process.env.WHATSAPP_BEARER_TOKEN} `
            }
        })
        // res.send(response)

        let data = {
            "client": `${message}`,
            "bot": `${response.output}`
        }

        await addChatData(whatsapp_id, data)
        res.sendStatus(200);

    } catch (err) {
        console.error("Error in POST /chatgpt:", err);
    }


})

App.listen(process.env.PORT || 3000, () => {
    console.log('server started')

});



