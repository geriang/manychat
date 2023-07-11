const express = require('express');
const router = express.Router();
const axios = require('axios');
const { addMessageReceived } = require('../database')


router.get('/webhook', (req, res) => {

    if (req.query['hub.mode'] === 'subscribe' &&
        req.query['hub.verify_token'] === process.env.WHATSAPP_WEBHOOK_TOKEN) {
        // console.log('Validating webhook');
        // res.sendStatus(200)
        res.status(200).send(req.query['hub.challenge']);
        // res.sendStatus(200)
    } else {
        console.error('Failed validation. Make sure the validation tokens match.');
        res.sendStatus(403);
    }
});

router.post('/webhook', async (req, res) => {
    // WhatsApp sends data as JSON in the body of the request
    let data = req.body;
    // Handle different types of messages
    if (data.entry &&
        data.entry[0].changes[0].value.messages &&
        data.entry[0].changes[0].value.contacts) {
        // Handle text message
        // data.entry[0].changes[0].value.messages = data.entry[0].changes[0].value.messages.filter((message) => message.timestamp > (Date.now() - 1000 * 60 * 5)/1000);
        let message = JSON.stringify(data.entry[0].changes[0].value.messages[0].text.body);
        let whatsapp_id = JSON.stringify(data.entry[0].changes[0].value.contacts[0].wa_id);
        let profile_name = JSON.stringify(data.entry[0].changes[0].value.contacts[0].profile.name);
        let timestamp = JSON.stringify(data.entry[0].changes[0].value.messages[0].timestamp);
        // console.log("contacts", data.entry[0].changes[0].value.contacts)
        // console.log("messages", data.entry[0].changes[0].value.messages)
        let messageData = {
            "client": `${message}`,
            timestamp
        }
        // add received message to database first
        await addMessageReceived(whatsapp_id, messageData, profile_name) 

        res.sendStatus(200);
        try {
            const data = {
                message,
                whatsapp_id,
                // profile_name
            }
            await axios.post("https://geriang-manychat.onrender.com/chatgpt", data)

        } catch (err) {
            console.error("Error in POST /webhook:", err);
        }
    } else {
        res.sendStatus(400);
    }

});

module.exports = router

