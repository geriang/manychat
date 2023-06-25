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
    PromptTemplate,
    ChatPromptTemplate,
    MessagesPlaceholder,
    HumanMessagePromptTemplate,
    SystemMessagePromptTemplate,
} = require("langchain/prompts");
const { LLMChain, LLMRouterChain, MultiPromptChain } = require("langchain/chains");
const { RouterOutputParser } = require('langchain/output_parsers');
const { ConversationChain } = require("langchain/chains");
const { BufferMemory, ChatMessageHistory } = require("langchain/memory");
const { HumanChatMessage, AIChatMessage } = require("langchain/schema");


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

App.post('/chatgpt', async (req, res) => {


    let message = req.body.data.message
    let whatsapp_id = req.body.data.whatsapp_id
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


    // defining the prompt templates

    let templates = [
        {
            name: 'agent',
            description: 'Good for replying enquiry made by a real estate agent who wants to co-broke and wants information on a particular property',
            template: `You are a helpful real estate agent Bot from Huttons Sales & Auction.` +
                `Your job is to answer to enquiries of co-broke agents truthfully.` +
                `If there is any information that you cannot find, you have to refer the enquirer to contact Geri @ 84430486 for more information.` +
                `Always keep your reply to not more than 150 characters.` +
                `At the start of an incoming enquiry, you need to determine the following:` +
                `1. If the enquirer is a co-broke agent. If the enquirer is not, please switch to the clientTemplate as prompt.` +
                `2. One of the ways to discern a co-broke agent is that the enquirer asks to co-broke or mentioned that they have a client who is interested in the property.`

        },
        {
            name: 'client',
            description: 'Good for replying enquiries made by non real estate agents who wants information on a particular property',
            template: `You are a helpful real estate agent Bot from Huttons Sales & Auction.` +
                `Your job is to answer to enquiries of direct clients(non - real estate agent) truthfully.` +
                `If there is any information that you cannot find, you have to refer the enquirer to contact Geri @ 84430486 for more information.` +
                `Always keep your reply to not more than 200 characters.` +
                `At the start of an incoming enquiry, you need to determine the following:` +
                `1. If the enquirer is a real estate agent, please switch to the agentTemplate as prompt.` +
                `2. Ask for the enquirer's name and address the enquirer by his/her name if there is no record of his/her name.` +
                `3. Ask for the enquirer's email address so that you could send more information to him/her regarding the property.`
        },
        {
            name: 'general',
            description: 'Good for replying generic enquiries',
            template: `You are a helpful real estate agent Bot from Huttons Sales & Auction.` +
                `Your job is to answer to enquiries from both co-broke agents and prospective clients truthfully.` +
                `If there is any information that you cannot find, you have to refer the enquirer to contact Geri @ 84430486 for more information.` +
                `Always keep your reply to not more than 255 characters.` +
                `At the start of an incoming enquiry, you need to determine the following:` +
                `1. Who is the enquirer? Is the person a direct client or a co-broke agent?` +
                `2. What is the nature of enquiry? Is it a sales enquiry, rental enquiry or general enquiry?` +
                `3. Which property or property address is the enquirer enquirying on?` +
                `4. From where did the enquirer find the contact information to start the enquiry?`
        }
    ];


    // Build an array of destination LLMChains and a list of the names with descriptions
    let destinationChains = {};

    for (const item of templates) {
        let prompt = ChatPromptTemplate.fromPromptMessages([SystemMessagePromptTemplate.fromTemplate(`${item.template}`),
        new MessagesPlaceholder("chat_history"),
        HumanMessagePromptTemplate.fromTemplate("{input}")]);
        let chain = new ConversationChain({
            prompt: prompt,
            memory: new BufferMemory({
                chatHistory: new ChatMessageHistory(pastMessages),
                returnMessages: true,
                memoryKey: "chat_history"
            }),
            llm: llm
        });
        destinationChains[item.name] = chain;
    }

    let destinations = templates.map(item => (item.name + ': ' + item.description)).join('\n');

    // Create a default destination in case the LLM cannot decide
    const defaultPrompt = ChatPromptTemplate.fromPromptMessages([
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

    let defaultChain = new ConversationChain({ llm: llm, 
        prompt: defaultPrompt, 
        memory: new BufferMemory({
        chatHistory: new ChatMessageHistory(pastMessages),
        returnMessages: true,
        memoryKey: "chat_history"
    }) });

    // Now set up the router and it's template
    let routerTemplate = 'Given a raw text input to a ' +
        'language model select the model prompt best suited for the input. ' +
        'You will be given the names of the available prompts and a ' +
        'description of what the prompt is best suited for. ' +
        'You may also revise the original input if you think that revising ' +
        'it will ultimately lead to a better response from the language model.\n\n' +
        '<< FORMATTING >>\n' +
        'Return a markdown code snippet with a JSON object formatted to look like:\n' +
        '```json\n' +
        '{{\n' +
        '    "destination": string, // name of the prompt to use or "DEFAULT"\n' +
        '    "next_inputs": string // a potentially modified version of the original input\n' +
        '}}\n' +
        '```\n\n' +
        'REMEMBER: "destination" MUST be one of the candidate prompt ' +
        'names specified below OR it can be "DEFAULT" if the input is not ' +
        'well suited for any of the candidate prompts. ' +
        'REMEMBER: "next_inputs" can just be the original input ' +
        'if you don\'t think any modifications are needed.\n\n' +
        '<< CANDIDATE PROMPTS >>\n' +
        '{destinations}\n\n' +
        '<< INPUT >>\n' +
        '{input}\n\n' +
        '<< OUTPUT (remember to include the ```json)>>';


    // 
    let routerParser = RouterOutputParser.fromNamesAndDescriptions({
        destination: 'name of the prompt to use or "DEFAULT"',
        next_inputs: 'a potentially modified version of the original input',
    });

    // let routerFormat = routerParser.getFormatInstructions();
    // console.log("router format",routerFormat);

    // let result = routerParser.parse('```json\n{\n' +
    //     '    "destination": "physics",\n' +
    //     '    "next_inputs": "What is black body radiation?"\n' +
    //     '}\n```');

    //   

    // Now we can construct the router with the list of route names and descriptions
    routerTemplate = routerTemplate.replace('{destinations}', destinations);

    let routerPrompt = new PromptTemplate({
        template: routerTemplate,
        inputVariables: ['input'],
        outputParser: routerParser
    });

    let routerChain = LLMRouterChain.fromLLM(llm, routerPrompt);

    // Now we can bring all of the pieces together!
    let multiPromptChain = new MultiPromptChain({
        routerChain,
        destinationChains,
        defaultChain,
        verbose: true
    });

    console.log("multiPromptChain", multiPromptChain)


    // const promptTemplates = [physicsTemplate, mathTemplate, historyTemplate];

    // const multiPromptChain = MultiPromptChain.fromLLMAndPrompts(llm, {
    //     promptNames,
    //     promptDescriptions,
    //     promptTemplates,
    // });


    // initiating chain with memory function and chatprompt which introduces templates
    // const chain = new ConversationChain({
    //     prompt: chatPrompt,
    //     memory: new BufferMemory({
    //         chatHistory: new ChatMessageHistory(pastMessages),
    //         returnMessages: true,
    //         memoryKey: "chat_history"
    //     }),
    //     llm: llm,
    // });

    // console.log("chain", chain)
    
    try {
        // const response = await chain.call({
        //     input: `${message}`
        const response = await multiPromptChain.run({
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



