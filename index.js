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


// const { OpenAI } = require("langchain/llms/openai");
const { ChatOpenAI } = require("langchain/chat_models/openai");
// const { HumanChatMessage, SystemChatMessage } = require("langchain/schema");
const {
    ChatPromptTemplate,
    HumanMessagePromptTemplate,
    PromptTemplate,
    MessagesPlaceholder,
    SystemMessagePromptTemplate,
} = require("langchain/prompts");
const { ConversationChain } = require("langchain/chains");
const { BufferMemory, BufferWindowMemory } = require("langchain/memory");



App.use(cors({
    origin: true
}))

App.use(express.urlencoded({
    extended: false
}))



App.post('/chatgpt', async (req, res) => {


    const message = req.body.message
    console.log("message received by chatgpt", message)

    // initiating the chatmodel - openai
    const chat = new ChatOpenAI({ temperature: 0 });

    // defining the prompt templates
    const chatPrompt = ChatPromptTemplate.fromPromptMessages([
        SystemMessagePromptTemplate.fromTemplate(`You are a helpful real estate agent bot from Huttons Sales & Auction.
         Your job is to answer to enquiries from both co-broke agents and prospective clients truthfully. 
         If there is any information that you cannot find, you have to refer the enquirer to contact Geri @ 84430486 for more information. 
         Always keep your reply to not more than 255 characters.
         At the start of an incoming enquiry, you need to determine the following:
         1. Who is the enquirer? Is the person a direct client or a co-broke agent?
         2. What is the nature of enquiry? Is it a sales enquiry, rental enquiry or general enquiry?
         3. Which property or property address is the enquirer enquirying on? 
         4. From where did the enquirer find the contact information to start the enquiry?`),
        // new MessagesPlaceholder("history"),
        HumanMessagePromptTemplate.fromTemplate("{input}"),
    ]);

    // initiating chain with memory function and chatprompt which introduces templates
    const chain = new ConversationChain({
        // memory: new BufferMemory({ returnMessages: true, memoryKey: "history" }),
        memory: new BufferWindowMemory({ k: 20 }),
        prompt: chatPrompt,
        llm: chat,
    });


    try {
        const response = await chain.call({
            input: `${message}`
        })

        res.send(response)

    } catch (err) {
        console.error("Error in POST /chatgpt:", err);
    }
})

App.listen(process.env.PORT || 3000, () => {
    console.log('server started')

});



