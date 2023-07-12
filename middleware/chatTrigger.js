const { ChatOpenAI } = require("langchain/chat_models/openai");
const { BufferMemory, ChatMessageHistory } = require("langchain/memory");
const { HumanChatMessage, AIChatMessage } = require("langchain/schema");
const { LLMChain } = require("langchain/chains");
const { PromptTemplate } = require("langchain/prompts");
const { retrieveChatHistory } = require("../database")
const sendWhatsappMessage = require("../sendMessage")

let functionTriggerTimestamp = null;

const triggerChat = async (req, res, next) => {
    const currentTime = Date.now();
    const sixHoursInMilliseconds = 6 * 60 * 60 * 1000;

    // If functionTriggerTimestamp is null or 6 hours have passed since the last trigger
    if (!functionTriggerTimestamp || currentTime - functionTriggerTimestamp >= sixHoursInMilliseconds) {
        // Trigger the function here
        console.log("The first session chat function is triggered!");
        // let message = req.body.message
        let whatsapp_id = req.body.whatsapp_id

        const pastMessagesData = await retrieveChatHistory(whatsapp_id)
        // console.log("past messages data received by chatgpt", pastMessagesData)
        let pastMessages = []

        if (pastMessagesData) {

            for (let i = 0; i < pastMessagesData.length; i++) {
                // console.log(`passMessageData[${i}]`, pastMessagesData[i].client, pastMessagesData[i].bot )
                if (pastMessagesData[i].client) {
                    let humanMessage = new HumanChatMessage((pastMessagesData[i].client).toString());
                    pastMessages.push(humanMessage)
                };

                if (pastMessagesData[i].bot) {
                    let aiMessage = new AIChatMessage((pastMessagesData[i].bot).toString());
                    pastMessages.push(aiMessage)
                };
            }
        }

        // initiating the chatmodel - openai
        const llm = new ChatOpenAI({ modelName: "gpt-3.5-turbo-0613", temperature: 0.3, verbose: true });

        const memory = new BufferMemory({
            memoryKey: "chat_history",
            chatHistory: new ChatMessageHistory(pastMessages),
        });

        const prompt =
            PromptTemplate.fromTemplate(`The following is a friendly conversation between a human and an AI. Your task is to identify the name of the human and greet the human by name. If the name is not found greet and ask for the name politely."
        
          Current conversation:
          {chat_history}
          Human: {input}
          AI:`);

        const chain = new LLMChain({ llm: llm, prompt, memory });

        const response = await chain.call({ input: `Greet me by my name. Remember, Geri Ang is the person you are assisting to answer any enquires received.` });
        await sendWhatsappMessage(whatsapp_id, response)
        res.sendStatus(200);

        functionTriggerTimestamp = currentTime;

    } else {
        next();
    }
    // next();
};


module.exports = triggerChat
