const express = require('express');
const router = express.Router();
// const axios = require('axios');

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
const { HNSWLib } = require("langchain/vectorstores/hnswlib");
const { OpenAIEmbeddings } = require("langchain/embeddings/openai");
const { RecursiveCharacterTextSplitter } = require("langchain/text_splitter");
const fs = require('fs');

const { retrieveChatHistory, checkName, addName, checkEmail, addEmail } = require("../database")
const sendWhatsappMessage = require("../sendMessage")
const {findName, findEmail} = require("../infoRetrieval")
const createDestinations = require("../destinationChain")

router.post('/', async (req, res) => {

    console.log("chatgpt req.body", req.body)
    let message = req.body.message
    let whatsapp_id = req.body.whatsapp_id
    console.log("message received by chatgpt", message)
    console.log("whatsappid received by chatgpt", whatsapp_id)

    const pastMessagesData = await retrieveChatHistory(whatsapp_id)
    // console.log("past messages data received by chatgpt", pastMessagesData)
    let pastMessages = []
    let stringPastMessages = []

    if (pastMessagesData) {
        for (let i = 0; i < pastMessagesData.length; i++) {
            if (pastMessagesData[i].client) {
                let humanMessage = new HumanChatMessage((pastMessagesData[i].client).toString());
                pastMessages.push(humanMessage)
                stringPastMessages.push(`client: ${pastMessagesData[i].client}`)
            };

            if (pastMessagesData[i].bot) {
                let aiMessage = new AIChatMessage((pastMessagesData[i].bot).toString());
                pastMessages.push(aiMessage)
                stringPastMessages.push(`bot: ${pastMessagesData[i].bot}`)
            };
        }
    }

    const clientName = await checkName(whatsapp_id)
    console.log("client name", clientName)
    if (!clientName) {
        let chatHistory = stringPastMessages.join(" ")
        const name = await findName(chatHistory)
        const nameCheck = name.includes("<")
        if (nameCheck) {
            // console.log("FIND NAME EXTRACTED", name)
            const modifiedName = name.replace(/^\s*<([^>]+)>$/, '$1');
            // console.log("modified name", modifiedName)
            await addName(whatsapp_id, modifiedName)
        }
    }

    const clientEmail = await checkEmail(whatsapp_id)
    console.log("client name", clientEmail)
    if (!clientEmail) {
        let chatHistory = stringPastMessages.join(" ")
        const email = await findEmail(chatHistory)
        const emailCheck = email.includes("<")
        if (emailCheck) {
            // console.log("FIND NAME EXTRACTED", name)
            const modifiedEmail = email.replace(/<|>|\s/g, "");
            // console.log("modified email address is", modifiedEmail)
            await addEmail(whatsapp_id, modifiedEmail)
        }
    }

    // initiating the chatmodel - openai
    const llm = new ChatOpenAI({ modelName: process.env.GPT_MODEL_VERSION, temperature: 0.0, verbose: true });

    const listingText = fs.readFileSync("./docs/property.txt", "utf8");
    const listingTextSplitter = new RecursiveCharacterTextSplitter({ chunkSize: 1500 });
    const listingDocs = await listingTextSplitter.createDocuments([listingText]);
    const listingVectorStore = await HNSWLib.fromDocuments(listingDocs, new OpenAIEmbeddings());

    const stampdutyText = fs.readFileSync("./docs/stampduty.txt", "utf8");
    const stampdutyTextSplitter = new RecursiveCharacterTextSplitter({ chunkSize: 1500 });
    const stampdutyDocs = await stampdutyTextSplitter.createDocuments([stampdutyText]);
    const stampdutyVectorStore = await HNSWLib.fromDocuments(stampdutyDocs, new OpenAIEmbeddings());

    const auctionScheduleText = fs.readFileSync("./docs/auctionschedule.txt", "utf8");
    const auctionScheduleTextSplitter = new RecursiveCharacterTextSplitter({ chunkSize: 1500 });
    const auctionScheduleDocs = await auctionScheduleTextSplitter.createDocuments([auctionScheduleText]);
    const auctionScheduleVectorStore = await HNSWLib.fromDocuments(auctionScheduleDocs, new OpenAIEmbeddings());

    let destinationObj = createDestinations(listingVectorStore,stampdutyVectorStore,auctionScheduleVectorStore, llm, pastMessages)
    let destinations = destinationObj.destinations
    let destinationChains = destinationObj.destinationChains

    // Create a default destination in case the LLM cannot decide
    const defaultPrompt = ChatPromptTemplate.fromPromptMessages([
        SystemMessagePromptTemplate.fromTemplate(
            `You are a chat bot from Huttons Sales & Auction in Singapore.` +
            `Your job is to greet customers by their name and answer questions that customers have accurately. If you don't know the answer, just say that you don't know, don't try to make up an answer. Alternatively, you can get them to contact Geri at 84430486 for assistance.` +
            `You should always try to ask for their email address so that we could send our monthly auction property listings to them.`+
            `All email addresses given by customers need to be properly validated.` 
        ),
        new MessagesPlaceholder("chat_history"),
        HumanMessagePromptTemplate.fromTemplate("{question}"),
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
        `{question}` +
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
            question: z
                .string()
                .describe('a potentially modified version of the original input')
        })
    }))

    let routerFormat = routerParser.getFormatInstructions();

    // Now we can construct the router with the list of route names and descriptions
    let routerPrompt = new PromptTemplate({
        template: routerTemplate,
        inputVariables: ['question'],
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

    const response = await multiPromptChain.call({ question: `${message}` });
    await sendWhatsappMessage(whatsapp_id, response)
    res.sendStatus(200);

});

module.exports = router
