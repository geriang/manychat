const express = require('express');
const router = express.Router();
const axios = require('axios');

const { ChatOpenAI } = require("langchain/chat_models/openai");
const { initializeAgentExecutorWithOptions } = require("langchain/agents");
const {
    MessagesPlaceholder,
} = require("langchain/prompts");
// const { z } = require("zod")
const { BufferMemory, ChatMessageHistory } = require("langchain/memory");
const { HumanChatMessage, AIChatMessage } = require("langchain/schema");
const { Calculator } = require("langchain/tools/calculator");
const { WebBrowser } = require("langchain/tools/webbrowser");
const { SerpAPI, ChainTool, DynamicTool, } = require("langchain/tools");
const { VectorDBQAChain } = require("langchain/chains");
const { HNSWLib } = require("langchain/vectorstores/hnswlib");
const { OpenAIEmbeddings } = require("langchain/embeddings/openai");
const { RecursiveCharacterTextSplitter } = require("langchain/text_splitter");
const fs = require('fs');

const { retrieveChatHistory, addChatData } = require("../database")

router.post('/', async (req, res) => {

    console.log("chatgpt req.body", req.body)
    let message = req.body.message
    // let urlRegex = /(https?:\/\/[^\s]+)/g;
    // let message = received_message.replace(urlRegex, '');
    let whatsapp_id = req.body.whatsapp_id
    console.log("message received by chatgpt", message)
    console.log("whatsappid received by chatgpt", whatsapp_id)

    const pastMessagesData = await retrieveChatHistory(whatsapp_id)
    // console.log("past messages data received by chatgpt", pastMessagesData)
    let pastMessages = []

    if (pastMessagesData) {

        // pastMessages = [
        //     new HumanChatMessage((pastMessagesData.map((obj) => { return obj.client })).toString()),
        // ]

        for (let i = 0; i < pastMessagesData.length; i++) {
            let humanMessage = new HumanChatMessage((pastMessagesData[i].client).toString());
            let aiMessage = new AIChatMessage((pastMessagesData[i].bot).toString());
            pastMessages.push(humanMessage);
            pastMessages.push(aiMessage);
        }
    }

    // console.log("past messages", pastMessages)

    // initiating the chatmodel - openai
    const llm = new ChatOpenAI({ modelName: "gpt-3.5-turbo-0613", temperature: 0.0 });
    const embeddings = new OpenAIEmbeddings();

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
    });

    // define the tools available
    const tools = [
        // new Calculator(),
        new DynamicTool({
            name: "chatting_tool",
            description:
                "use this tool to simply chat with human, or when other tools are not found to be suitable.",
            func: async (input) => `${input}`,
            returnDirect: true
        }),
        // new SerpAPI(`${process.env.SERPAPI_API_KEY}`, {
        //     location: "Singapore",
        //     hl: "en",
        //     gl: "sg",
        // }),
        new WebBrowser({ llm, embeddings }),
        propertyDatabaseTool,
    ];

    // initialize the agent
    const executor = await initializeAgentExecutorWithOptions(tools, llm, {
        agentType: "chat-conversational-react-description",
        verbose: true,
        maxIterations: 5,
        // earlyStoppingMethod: "force",
        // returnIntermediateSteps: false,
        memory: new BufferMemory({
            chatHistory: new ChatMessageHistory(pastMessages),
            memoryKey: "chat_history",
            returnMessages: true,
        }),
        agentArgs: {
            inputVariables: ["input", "agent_scratchpad", "chat_history"],
            memoryPrompts: [new MessagesPlaceholder({ variableName: "chat_history" })],
            // prefix: "You are a chatbot that answers to enquires. Ask for the person's name if it is unknown. If the name is known, greet the person by name.",
            // prefix: "Remember to STRICTLY use the following format: Question, Thought, Action, Auction Input, Observation, Thought, Final Answer. DO NOT SKIP ANY OF THE STEPS AT ALL TIMES",
            // suffix: "You are a chatbot that answers to enquires. Always ask for the name if it is not found in chat history. If a name is found, greet the person by name.",
        }
    });

    try {
        const version = process.env.WHATSAPP_VERSION
        const phoneNumberID = process.env.WHATSAPP_PHONE_NUMBER_ID
        const response = await executor.call({ input: `${message} ` });
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


});

module.exports = router 