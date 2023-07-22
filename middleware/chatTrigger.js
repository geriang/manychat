const { ChatOpenAI } = require("langchain/chat_models/openai");
const { BufferMemory, ChatMessageHistory } = require("langchain/memory");
const { HumanChatMessage, AIChatMessage } = require("langchain/schema");
const { LLMChain } = require("langchain/chains");
const { PromptTemplate } = require("langchain/prompts");
const { retrieveChatHistory } = require("../database")
const sendWhatsappMessage = require("../sendMessage")
const { checkEmail, checkName } = require("../database")

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

        // const pastMessagesData = await retrieveChatHistory(whatsapp_id)
        // // console.log("past messages data received by chatgpt", pastMessagesData)
        // let pastMessages = []

        // if (pastMessagesData) {

        //     for (let i = 0; i < pastMessagesData.length; i++) {
        //         // console.log(`passMessageData[${i}]`, pastMessagesData[i].client, pastMessagesData[i].bot )
        //         if (pastMessagesData[i].client) {
        //             let humanMessage = new HumanChatMessage((pastMessagesData[i].client).toString());
        //             pastMessages.push(humanMessage)
        //         };

        //         if (pastMessagesData[i].bot) {
        //             let aiMessage = new AIChatMessage((pastMessagesData[i].bot).toString());
        //             pastMessages.push(aiMessage)
        //         };
        //     }
        // }

        const name = await checkName(whatsapp_id)

        // initiating the chatmodel - openai
        const llm = new ChatOpenAI({ modelName: "gpt-3.5-turbo-0613", temperature: 0.0, verbose: true });

        // const memory = new BufferMemory({
        //     memoryKey: "chat_history",
        //     chatHistory: new ChatMessageHistory(pastMessages),
        // });

        const prompt =
            PromptTemplate.fromTemplate(`The following is a past conversation between a client and you. Your task is to greet client by name: {name}. If the name is not found, greet and ask for the client's name politely.

        =
          AI:`);

        const chain = new LLMChain({ llm: llm, prompt });

        const response = await chain.call({ name: `My name is ${name}.` });
        await sendWhatsappMessage(whatsapp_id, response)
        res.sendStatus(200);

        functionTriggerTimestamp = currentTime;

        // email request trigger
        const clientEmail = await checkEmail(whatsapp_id)
        console.log("Client Email is", clientEmail)
        if (!clientEmail) {

            console.log('Setting up setTimeout.');

            const response = {
                response: `Would you be interested to join our exclusive mailing list for firsthand monthly updates on bank sale and auction properties? We promise to email only up to twice a month`
            }
            setTimeout(async () => {
                console.log('This runs 7.5 minutes after the route is accessed.');
                // put your function here
                const clientEmail = await checkEmail(whatsapp_id)
                if (!clientEmail) {
                    await sendWhatsappMessage(whatsapp_id, response)
                }

            }, 450000); // 3600000 milliseconds = 1 hour


            return;
        }

    } else {
        next();
    }
    // next();
};


module.exports = triggerChat
