const express = require("express");
require('dotenv').config();
const cors = require('cors');
const bodyParser = require('body-parser');
const crypto = require('crypto');

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
const APP_SECRET = process.env.APP_SECRET;

// const message = "do you know anything about Singapore Property?"

// const reply = async () => {


//     // initiating the chatmodel - openai
//     const chat = new ChatOpenAI({ temperature: 0 });

//     // defining the prompt templates
//     const chatPrompt = ChatPromptTemplate.fromPromptMessages([
//         SystemMessagePromptTemplate.fromTemplate(`You are a helpful real estate agent bot from Huttons Sales & Auction.
//         Your job is to answer to enquiries from both co-broke agents and prospective clients truthfully. 
//         If there is any information that you cannot find, you have to refer the enquirer to contact Geri @ 84430486 for more information. 
//         Always keep your reply to not more than 255 characters.
//         At the start of an incoming enquiry, you need to determine the following:
//         1. Who is the enquirer? Is the person a direct client or a co-broke agent?
//         2. What is the nature of enquiry? Is it a sales enquiry, rental enquiry or general enquiry?
//         3. Which property or property address is the enquirer enquirying on? 
//         4. From where did the enquirer find the contact information to start the enquiry?`),
//         HumanMessagePromptTemplate.fromTemplate("{input}"),
//     ]);

//     // initiating chain with memory function and chatprompt which introduces templates
//     const chain = new ConversationChain({
//         memory: new BufferWindowMemory({ k: 20 }),
//         prompt: chatPrompt,
//         llm: chat,
//     });


//     const response = await chain.call({
//         input: "do you know anything about Singapore Property?",
//     });

//     console.log("response", response);
// }

// const startTemplate = `At the start of an incoming enquiry, you need to determine the following:
// 1. Who is the enquirer? Is the person a direct client or a co-broke agent?
// 2. What is the nature of enquiry? Is it a sales enquiry, rental enquiry or general enquiry?
// 3. Which property or property address is the enquirer enquirying on? 
// 4. From where did the enquirer find the contact information to start the enquiry?`

// reply()



App.use(cors({
    origin: true
}))

App.use(express.urlencoded({
    extended: false
}))


// Handle verification
App.get('/webhook', (req, res) => {
    if (req.query['hub.mode'] === 'subscribe' &&
        req.query['hub.verify_token'] === VERIFY_TOKEN) {
        console.log("Validating webhook");
        res.status(200).send(req.query['hub.challenge']);
    } else {
        console.error("Failed validation. Make sure the validation tokens match.");
        res.sendStatus(403);          
    }  
});

// Handle events
app.post('/webhook', (req, res) => {
    var data = req.body;
    var signature = req.headers['x-hub-signature-256'];

    // Verify the payload
    var hash = crypto.createHmac('sha256', APP_SECRET)
                     .update(JSON.stringify(data))
                     .digest('hex');

    if (hash === signature.substring(7)) {
        // Process the webhook data
        data.entry.forEach(function(pageEntry) {
            var pageID = pageEntry.id;
            var timeOfEvent = pageEntry.time;

            // Iterate over each messaging event
            pageEntry.changes.forEach(function(change) {
                console.log("Webhook received: ", change);
            });
        });
    } else {
        console.error("Failed payload validation. Signature mismatch.");
    }

    res.sendStatus(200);
});


App.post('/chatgpt', async (req, res) => {
    const message = req.body

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


    const response = await chain.call({
        input: `${message}`,
    });

    res.send(response)
})

// whatsapp webhook

App.post('/webhook', (req, res) => {
    console.log('Received a POST request');
    console.log(req.body); // Logs the body of the request to the console
  
    res.sendStatus(200); // Responds to the request with a 200 OK status code
  });
  

App.listen(process.env.PORT || 3000, () => {
    console.log('server started')

});



