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

    // console.log("Check template", executor.agent.llmChain.prompt.promptMessages[0].prompt.template)
    let prompt =
        `Answer the following questions truthfully and as best you can.` +
        `You have access to the following tools.` +
        `You must format your inputs to these tools to match their "JSON schema" definitions below.` +

        `"JSON Schema" is a declarative language that allows you to annotate and validate JSON documents.` +

        `For example, the example "JSON Schema" instance {{"properties": {{"foo": {{"description": "a list of test words", "type": "array", "items": {{"type": "string"}}}}}}, "required": ["foo"]}}` +
        `would match an object with one required property, "foo". The "type" property specifies "foo" must be an "array", and the "description" property semantically describes it as "a list of test words". The items within "foo" must be strings.` +
        `Thus, the object {{"foo": ["bar", "baz"]}} is a well-formatted instance of this example "JSON Schema". The object {{"properties": {{"foo": ["bar", "baz"]}}}} is not well-formatted.` +

        `Here are the JSON Schema instances for the tools you have access to:` +

        `{tool_schemas}` +

        `The way you use the tools is as follows:` +

        `------------------------` +

        `Output a JSON markdown code snippet containing a valid JSON blob (denoted below by $JSON_BLOB).` +
        `This $JSON_BLOB must have a "action" key (with the name of the tool to use) and an "action_input" key (tool input).` +

        `Valid "action" values: "Final Answer" (which you must use when giving your final response to the user), or one of [{tool_names}].` +

        `The $JSON_BLOB must be valid, parseable JSON and only contain a SINGLE action. Here is an example of an acceptable output:` +

        `\`\`\`json` +
        `{{` +
        `"action": $TOOL_NAME,` +
        `"action_input": $INPUT` +
        `}}` +
        `\`\`\`` +

        `Remember to include the surrounding markdown code snippet delimiters (begin with "\`\`\`" json and close with "\`\`\`")!` +

        `If you are using a tool, "action_input" must adhere to the tool's input schema, given above.` +

        `------------------------` +

        `ALWAYS use the following format:` +

        `Question: the input question you must answer` +
        `Thought: you should always think about what to do` +
        `Action:` +
        `\`\`\`json` +
        `$JSON_BLOB` +
        `\`\`\`` +
        `Observation: the result of the action` +
        `... (this Thought/Action/Observation can repeat N times)` +
        `Thought: I now know the final answer` +
        `Action:` +
        `\`\`\`json` +
        `{{` +
        `"action": "Final Answer",` +
        `"action_input": "Final response to human"` +
        `}}` +
        `\`\`\`` +

        `Begin! Reminder to ALWAYS use the above format, and to use tools if appropriate.`;

    executor.agent.llmChain.prompt.promptMessages[0].prompt.template = prompt

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