const express = require('express');
const router = express.Router();
const axios = require('axios');

const { ChatOpenAI } = require("langchain/chat_models/openai");
const {
    PromptTemplate,
    ChatPromptTemplate,
    SystemMessagePromptTemplate,
    HumanMessagePromptTemplate,
    MessagesPlaceholder,
} = require("langchain/prompts");
const { z } = require("zod")
const { ConversationChain, LLMRouterChain, MultiPromptChain, ConversationalRetrievalQAChain } = require("langchain/chains");
const { BufferMemory, ChatMessageHistory } = require("langchain/memory");
const { HumanChatMessage, AIChatMessage } = require("langchain/schema");
const { RouterOutputParser } = require('langchain/output_parsers');
// const { Calculator } = require("langchain/tools/calculator");
// const { WebBrowser } = require("langchain/tools/webbrowser");
// const { SerpAPI, ChainTool, DynamicTool, } = require("langchain/tools");
// const { VectorDBQAChain } = require("langchain/chains");
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


    const text = fs.readFileSync("property.txt", "utf8");
    const textSplitter = new RecursiveCharacterTextSplitter({ chunkSize: 1000 });
    const docs = await textSplitter.createDocuments([text]);
    const vectorStore = await HNSWLib.fromDocuments(docs, new OpenAIEmbeddings());

    let templates = [
        {
            name: 'property_enquiry',
            description: 'Good for replying when an indentified customer enquires on a particular property ',
            template: `Given the following conversation and a follow up question, return the conversation history excerpt that includes any relevant context to the question if it exists and rephrase the follow up question to be a standalone question.
            Chat History:
            {chat_history}
            Follow Up Input: {input}
            Your answer should follow the following format:
            \`\`\`
            Use the following pieces of context to answer the users question.
            If you don't know the answer, just say that you don't know, don't try to make up an answer.
            ----------------
            <Relevant chat history excerpt as context here>
            Standalone input: <Rephrased question here>
            \`\`\`
            Your answer:`
        }
    ];

    // Build an array of destination LLMChains and a list of the names with descriptions
    let destinationChains = {};


    /* Create the chain */
    const retrievalChain = ConversationalRetrievalQAChain.fromLLM(
        llm,
        vectorStore.asRetriever(),
        {
            memory: new BufferMemory({
                memoryKey: "chat_history", // Must be set to "chat_history"
            }),
        }
    );

    for (const item of templates) {
        let prompt = `${item.template}`
        let chain = ConversationalRetrievalQAChain.fromLLM(
            llm,
            vectorStore.asRetriever(),
            {
                memory: new BufferMemory({
                    memoryKey: "chat_history", // Must be set to "chat_history"
                    returnMessages: true
                }),
                questionGeneratorChainOptions: {
                    template: prompt
                }
            }
        );
        destinationChains[item.name] = chain;
    }

    let destinations = templates.map(item => (item.name + ': ' + item.description)).join('\n');

    // Create a default destination in case the LLM cannot decide
    const defaultPrompt = ChatPromptTemplate.fromPromptMessages([
        SystemMessagePromptTemplate.fromTemplate(
            `You are a friendly chatbot from Huttons Sales & Auction in Singapore.` +
            `Your job is to identify the customer by name.`
        ),
        new MessagesPlaceholder("chat_history"),
        HumanMessagePromptTemplate.fromTemplate("{input}"),
    ]);

    // initiating chain with memory function and chatprompt which introduces templates
    const defaultChain = new ConversationChain({
        prompt: defaultPrompt,
        memory: new BufferMemory({
            chatHistory: new ChatMessageHistory(pastMessages),
            returnMessages: true,
            memoryKey: "chat_history"
        }),
        llm: llm,
    });


    // Now set up the router and it's template
    let routerTemplate =
        `Based on the input question to an large language model take the following steps:` +
        `1) decide if the question can be answered by any of the destinations based on the destination descriptions.` +
        `2) If none of the destinations are a good fit use "DEFAULT" as the response, For example if the question is about pharmacology but there is no "health care" destination use DEFAULT.` +
        `3) Check is set to DEFAULT, if there is no match or set it to DEFAULT.` +
        `4) You may also revise the original input if you think that revising it will ultimately lead to a better response from the language model.` +
        `You ONLY have the following destinations to choose from:` +
        `<Destinations>` +
        `{destinations}` +
        `<Destinations>` +
        `This is the question provided:` +
        `<Input>` +
        `{input}` +
        `<Input>` +
        `When you respond be sure to use the following format:` +
        `<Formatting>` +
        `{format_instructions}` +
        `<Formatting>` +
        `IMPORTANT: "destination" MUST be one of the destination names provided OR it can be "DEFAULT" if there is no good match.` +
        `IMPORTANT: "next_inputs" can just be the original input if you don't think any modifications are needed.`

    // Now we can construct the router with the list of route names and descriptions
    routerTemplate = routerTemplate.replace('{destinations}', destinations);

    // ***
    let routerParser = RouterOutputParser.fromZodSchema(z.object({
        destination: z
            .string()
            .describe('name of the prompt to use or "DEFAULT"'),
        next_inputs: z.object({
            input: z
                .string()
                .describe('a potentially modified version of the original input')
        })
    }))

    let routerFormat = routerParser.getFormatInstructions();

    // Now we can construct the router with the list of route names and descriptions
    let routerPrompt = new PromptTemplate({
        template: routerTemplate,
        inputVariables: ['input'],
        outputParser: routerParser,
        partialVariables: {
            format_instructions: routerFormat
        }
    });

    let routerChain = LLMRouterChain.fromLLM(llm, routerPrompt);

    // Now we can bring all of the pieces together!
    let multiPromptChain = new MultiPromptChain({
        routerChain,
        destinationChains,
        defaultChain,
        verbose: true
    });


    try {
        const version = process.env.WHATSAPP_VERSION
        const phoneNumberID = process.env.WHATSAPP_PHONE_NUMBER_ID
        const response = await multiPromptChain.call({ input: `${message} ` });
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