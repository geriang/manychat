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
const { z } = require("zod")
const { BufferMemory, ChatMessageHistory } = require("langchain/memory");
const { HumanChatMessage, AIChatMessage } = require("langchain/schema");
const { Calculator } = require("langchain/tools/calculator");

const { SerpAPI, ChainTool } = require("langchain/tools");
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
        res.status(200).send(req.query['hub.challenge']);
    } else {
        console.error('Failed validation. Make sure the validation tokens match.');
        res.sendStatus(403);
    }
});

App.post('/webhook', async (req, res) => {
    // WhatsApp sends data as JSON in the body of the request
    let data = req.body;
    // Log received data for debugging
    console.log('Webhook received:', data);

    // Handle different types of messages
    if (data.entry&&
        data.entry[0].changes[0].value.messages&&
        data.entry[0].changes[0].value.messages[0]) {
    // Handle text message
    let message = data.entry[0].changes[0].value.messages[0].text.body;
    let phone_number = data.entry[0].changes[0].value.metadata.phone_number_id;
    let from = data.entry[0].changes[0].value.message[0].from;
    console.log("message, phone_number, from", message, phone_number, from)

    try {
        const data = { message, "whatsapp_id": phone_number }
        await axios.post("https://geriang-manychat.onrender.com/chatgpt", data)
        res.sendStatus(200);

    } catch (err) {
        console.error("Error in POST /webhook:", err);
        res.sendStatus(200);
    }

    // Add handling for other message types if needed
    }

    if (data.errors) {
        // Loop through each error
        data.errors.forEach((error) => {
            console.log('Received error:', error);
        });

        res.sendStatus(200);
    }
});

// whatsapp webhook end


App.post('/chatgpt', async (req, res) => {

    let message = req.body.data.message
    let whatsapp_id = req.body.data.whatsapp_id
    console.log("req.body received by chatgpt", req.body)
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

    console.log("past messages", pastMessages)

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
        new Calculator(), // Older existing single input tools will still work
        propertyDatabaseTool,
        // greetingTool
        // new DynamicTool({
        //   name: "conversation etiquette",
        //   description:
        //     "You are a helpful real estate agent Bot from Huttons Sales & Auction that answers to queries. If there are no relevant tools to use, just greet and ask for the enquirer's name!.",
        //     func: () => "reply as you wish base on input"
        // }),
        // new DynamicStructuredTool({
        //   name: "property_listing_database",
        //   description: "a tool to search for available property listings by Huttons Sales & Auction.",
        //   schema: z.object({
        //     low: z.number().describe("The lower bound of the generated number"),
        //     high: z.number().describe("The upper bound of the generated number"),
        //   }),
        //   func: async ({ low, high }) =>
        //     (Math.random() * (high - low) + low).toString(), // Outputs still must be strings
        // }),
    ];


    // initialize the agent
    const executor = await initializeAgentExecutorWithOptions(tools, llm, {
        agentType: "structured-chat-zero-shot-react-description",
        verbose: true,
        memory: new BufferMemory({
            chatHistory: new ChatMessageHistory(pastMessages),
            returnMessages: true,
            memoryKey: "chat_history"
        }),
        agentArgs: {
            inputVariables: ["input", "agent_scratchpad", "chat_history"],
            memoryPrompts: [new MessagesPlaceholder("chat_history")],
            prefix: "you are a Real Estate Chatbot from Huttons Sales & Auction. Your priority is to chat with enquirers and use tools when necessary.",
        },

    });

    try {
        const response = await executor.call({ input: `${message}` });
        // const response = await multiPromptChain.call({
        //     input: `${message}`
        // })

        console.log("response", response)
        // console.log("response.output", response.output)
        res.send(response)

        let data = {
            "client": `${message}`,
            "bot": `${response.output}`
        }

        await addChatData(whatsapp_id, data)

    } catch (err) {
        console.error("Error in POST /chatgpt:", err);
    }


})

App.listen(process.env.PORT || 3000, () => {
    console.log('server started')

});



