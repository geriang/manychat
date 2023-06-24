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


const { OpenAI } = require("langchain/llms/openai")
const { ChatOpenAI } = require("langchain/chat_models/openai");
const {
    ChatPromptTemplate,
    HumanMessagePromptTemplate,
    PromptTemplate,
    SystemMessagePromptTemplate,
} = require("langchain/prompts");
const { ConversationChain, LLMChain } = require("langchain/chains");
// import { VectorStoreRetrieverMemory } from "langchain/memory";
// const { VectorStoreRetrieverMemory } = require("langchain/memory");
const { MemoryVectorStore } = require("langchain/vectorstores/memory");
const { OpenAIEmbeddings } = require("langchain/embeddings/openai");

const { MongoClient } = require("mongodb");
const uri = process.env.MONGO_URI
const client = new MongoClient(uri);

async function connectToMongoDB() {
    try {
        await client.connect();
        console.log("Connected to MongoDB");
    } catch (error) {
        console.error("Failed to connect to MongoDB", error);
    }
}

async function retrieveChatHistory(id) {
    try {
        const db = client.db("project"); // Replace with your database name
        const collection = db.collection("chat_history"); // Replace with your collection name
        const whatsappId = id
        const chatHistory = await collection.findOne({whatsapp_id: whatsappId});
        console.log("Chat History:", chatHistory.message);
    } catch (error) {
        console.error("Failed to retrieve chat history", error);
    } finally {
        await client.close();
        console.log("Disconnected from MongoDB");
    }
}






App.use(cors({
    origin: true
}))

App.use(express.urlencoded({
    extended: false
}))



App.post('/chatgpt', async (req, res) => {


    let message = req.body.data.message
    let whatsapp_id = req.body.data.whatsapp_id
    console.log("message received by chatgpt", message)
    console.log("whatsappid received by chatgpt", whatsapp_id)
    await connectToMongoDB()
    await retrieveChatHistory("6588454340")


    // *** initializing vector store and memory
    // const vectorStore = new MemoryVectorStore(new OpenAIEmbeddings());
    // const memory = new VectorStoreRetrieverMemory({
    //     // 1 is how many documents to return, you might want to return more, eg. 4
    //     vectorStoreRetriever: vectorStore.asRetriever(10),
    //     memoryKey: "history",
    // });



    // initiating the chatmodel - openai
    const chat = new ChatOpenAI({ temperature: 0 });

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
         
         Relevant pieces of previous conversation:
         {history}
         (You do not need to use these pieces of information if not relevant)

         `),
        // new MessagesPlaceholder("history"),
        HumanMessagePromptTemplate.fromTemplate("{input}"),
    ]);

    // initiating chain with memory function and chatprompt which introduces templates
    const chain = new LLMChain({
        prompt: chatPrompt,
        llm: chat,
    });


    try {
        const response = await chain.call({
            input: `${message}`
        })

        await memory.saveContext(
            { input: `${message}` },
            { output: `${response}` }
        );

        res.send(response)

    } catch (err) {
        console.error("Error in POST /chatgpt:", err);
    }


})

App.listen(process.env.PORT || 3000, () => {
    console.log('server started')

});



