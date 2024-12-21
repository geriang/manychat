const express = require('express');
const router = express.Router();
const { OpenAI } = require('openai'); 

const fs = require('fs');

const { retrieveChatHistory, checkName, addName, checkEmail, addEmail } = require("../database")
const sendWhatsappMessage = require("../sendMessage")
// const {findName, findEmail} = require("../infoRetrieval")

const openai = new OpenAI({
    apiKey: process.env['OPENAI_API_KEY'], // This is the default and can be omitted
  })

router.post('/', async (req, res) => {

    console.log("chatgpt req.body", req.body)
    let message = req.body.message
    let whatsapp_id = req.body.whatsapp_id
    console.log("message received by chatgpt", message)
    console.log("whatsappid received by chatgpt", whatsapp_id)

    const pastMessagesData = await retrieveChatHistory(whatsapp_id)
    console.log("past messages data received by chatgpt", pastMessagesData)
    let pastMessages = []
    let stringPastMessages = []

    // if (pastMessagesData) {
    //     for (let i = 0; i < pastMessagesData.length; i++) {
    //         if (pastMessagesData[i].client) {
    //             let humanMessage = new HumanChatMessage((pastMessagesData[i].client).toString());
    //             pastMessages.push(humanMessage)
    //             stringPastMessages.push(`client: ${pastMessagesData[i].client}`)
    //         };

    //         if (pastMessagesData[i].bot) {
    //             let aiMessage = new AIChatMessage((pastMessagesData[i].bot).toString());
    //             pastMessages.push(aiMessage)
    //             stringPastMessages.push(`bot: ${pastMessagesData[i].bot}`)
    //         };
    //     }
    // }

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

    
    const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
            { role: "developer", content: "You are a helpful assistant." },
            {
                role: "user",
                content: `${message}`,
            },
        ],
    });

    console.log(completion.choices[0].message);

    await sendWhatsappMessage(whatsapp_id, response)
    res.sendStatus(200);

});

module.exports = router
