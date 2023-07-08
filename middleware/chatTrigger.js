const { ChatOpenAI } = require("langchain/chat_models/openai");
const { ConversationSummaryMemory, ChatMessageHistory } = require("langchain/memory");
const { HumanChatMessage, AIChatMessage } = require("langchain/schema");
const { LLMChain } = require("langchain/chains");
const { PromptTemplate } = require("langchain/prompts");

let functionTriggerTimestamp = null;

const triggerChat = async (req, res, next) => {
    const currentTime = Date.now();
    const sixHoursInMilliseconds = 6 * 60 * 60 * 1000;

    // If functionTriggerTimestamp is null or 6 hours have passed since the last trigger
    if (!functionTriggerTimestamp || currentTime - functionTriggerTimestamp >= sixHoursInMilliseconds) {
        // Trigger the function here
        console.log("The function is triggered!");
        console.log("chatgpt req.body", req.body)
        let message = req.body.message
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

        const memory = new ConversationSummaryMemory({
            memoryKey: "chat_history",
            chatHistory: new ChatMessageHistory(pastMessages),
            llm: llm,
        });

        const prompt =
            PromptTemplate.fromTemplate(`The following is a friendly conversation between a human and an AI. Your task is to identify the name of the human and greet the human by name. If no name is found, ask for a name."
        
          Current conversation:
          {chat_history}
          Human: {input}
          AI:`);

        const chain = new LLMChain({ llm: llm, prompt, memory });

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
                    "body": `${response.response ? response.response : response.text}`,
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
                "bot": `${response.response ? response.response : response.text}`
            }

            await addChatData(whatsapp_id, data)
            res.sendStatus(200);

        } catch (err) {
            console.error("Error in POST /chatgpt:", err);
        }

        functionTriggerTimestamp = currentTime;

    } else {
        next();
    }
};




module.exports = triggerChat
