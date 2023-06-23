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
    SystemMessagePromptTemplate,
} = require("langchain/prompts");
const { ConversationChain } = require("langchain/chains");
const { BufferWindowMemory } = require("langchain/memory");



const VERIFY_TOKEN = process.env.WHATSAPP_WEBHOOK_TOKEN;


App.use(cors({
    origin: true
}))

App.use(express.urlencoded({
    extended: false
}))


// App.get('/webhook', (req, res) => {
//     if (req.query['hub.mode'] === 'subscribe' &&
//         req.query['hub.verify_token'] === VERIFY_TOKEN) {
//         // console.log('Validating webhook');
//         res.status(200).send(req.query['hub.challenge']);
//     } else {
//         console.error('Failed validation. Make sure the validation tokens match.');
//         res.sendStatus(403);
//     }
// });

App.post('/webhook', (req, res) => {
    // WhatsApp sends data as JSON in the body of the request
    let data = req.body;
    let message = "";

    // Log received data for debugging
    console.log('Webhook received:', data);

    // Handle different types of messages
    if (data.entry) {
        // Loop through each message
        data.entry.forEach(async (event) => {
            if (event.changes) {
                // Handle text message
                console.log('Received text:', event.changes);
                message = JSON.stringify(event.change[0].value.messages[0].text.body)
                // event.changes.forEach((obj)=>{
                //     message = JSON.stringify(obj.value.messages[0].text.body)
                //     console.log("object", obj)
                //     console.log("message", message)
                // })
                // Respond with a 200 to acknowledge receipt of the message
                res.sendStatus(200);

                try {
                    // console.log("Whatsapp message", message)
                    const data = { message }
                    await axios.post("https://geriang-manychat.onrender.com/chatgpt", data)
                    // console.log("Response:", response);
                    
                } catch (err) {
                    console.error("Error in POST /webhook:", err);
                }
            }
            // Add handling for other message types if needed
        });
    }

    if (data.errors) {
        // Loop through each error
        data.errors.forEach((error) => {
            console.log('Received error:', error);
        });
    }



});


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
        HumanMessagePromptTemplate.fromTemplate("{input}"),
    ]);

    // initiating chain with memory function and chatprompt which introduces templates
    const chain = new ConversationChain({
        memory: new BufferWindowMemory({ k: 20 }),
        prompt: chatPrompt,
        llm: chat,
    });


    try {
        const response = await chain.call({
            input: `${message}`
        })

        const sendMessage = async () => {
            const url = 'https://graph.facebook.com/v17.0/100199353129672/messages';

            const data = {
                messaging_product: 'whatsapp',
                to: '6584430486',
                type: 'text',
                text: {
                    "body": `${response.response}`
                }
            };

            const config = {
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${process.env.WHATSAPP_BEARER_TOKEN} `
                }
            };

            try {
                await axios.post(url, data, config);
                // console.log("whatsapp send message status", response.status);
                // console.log("whatsapp send message data", response.data);

            } catch (error) {
                console.error(error);
            }
        };

        sendMessage();

        // console.log("ChatGPT Response", response)

    } catch (err) {
        console.error("Error in POST /chatgpt:", err);
    }
})

App.listen(process.env.PORT || 3000, () => {
    console.log('server started')

});



