const express = require('express');
const router = express.Router();
const axios = require('axios');

const { ChatOpenAI } = require("langchain/chat_models/openai");
const { initializeAgentExecutorWithOptions } = require("langchain/agents");
const {
    ChatPromptTemplate,
    SystemMessagePromptTemplate,
    HumanMessagePromptTemplate,
    MessagesPlaceholder,
} = require("langchain/prompts");
// const { z } = require("zod")
const { ConversationChain } = require("langchain/chains");
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

        for (let i = 0; i < pastMessagesData.length; i++) {
            let humanMessage = new HumanChatMessage((pastMessagesData[i].client).toString());
            let aiMessage = new AIChatMessage((pastMessagesData[i].bot).toString());
            pastMessages.push(humanMessage);
            pastMessages.push(aiMessage);
        }
    }

    // initiating the chatmodel - openai
    const llm = new ChatOpenAI({ modelName: "gpt-3.5-turbo-0613", temperature: 0.0, verbose: true });

    // defining the prompt templates
    const chatPrompt = ChatPromptTemplate.fromPromptMessages([
        SystemMessagePromptTemplate.fromTemplate(`
        1) You are a friendly chatbot answering property sales and rental queries for Huttons Sales & Auction in Singapore.
        2) Your task is to answer queries that customers and co-broke agents have regarding a particular property.
        3) Do you know the name of the customer? If you know the name, please reply yes.
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
        llm: llm,
    });


    try {
        const version = process.env.WHATSAPP_VERSION
        const phoneNumberID = process.env.WHATSAPP_PHONE_NUMBER_ID
        const response = await chain.call({ input: `${message} ` });
        console.log("response", response)

        await axios.post(`https://graph.facebook.com/${version}/${phoneNumberID}/messages`, {

            "messaging_product": "whatsapp",
            "recipient_type": "individual",
            "to": `${whatsapp_id}`,
            "type": "text",
            "text": {
                "preview_url": true,
                "body": `${response.response}`,
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
            "bot": `${response.response}`
        }

        await addChatData(whatsapp_id, data)
        res.sendStatus(200);

    } catch (err) {
        console.error("Error in POST /chatgpt:", err);
    }


});

module.exports = router 



// 1) You are a friendly chatbot answering property sales and rental queries for Huttons Sales & Auction in Singapore.
// 2) Your task is to answer queries that customers and co-broke agents have regarding a particular property.
// 3) The steps to complete the tasks are:
//     -Find the name of the customer in previous chat conversation or {chat_history}. 
//     -If a name is found, greet the customer by name.
//     -If the name is not found, ask for the customer's name.
//     -Look up for the property information that the customer is enquiring
//     -Reply to customer accordingly base on the property infomation.
// 4) Your replies should be concise and not more than 150 words.
// 5) If there is any information you cannot find, ask the customer or co-broke agent to contact Geri 84430486.