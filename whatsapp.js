const fetch = require('node-fetch');
global.Headers = require('node-fetch').Headers;
global.fetch = fetch;
global.Request = fetch.Request;
global.Response = fetch.Response;
global.Headers = fetch.Headers;

const express = require("express");
require('dotenv').config();
const cors = require('cors');
const bodyParser = require('body-parser');
const axios = require('axios');

const App = express();

App.use(express.json()); // Middleware for parsing JSON bodies of incoming requests
App.use(bodyParser.json());


const VERIFY_TOKEN = process.env.WHATSAPP_WEBHOOK_TOKEN;


App.use(cors({
    origin: true
}))

App.use(express.urlencoded({
    extended: false
}))


App.get('/webhook', (req, res) => {
    if (req.query['hub.mode'] === 'subscribe' &&
        req.query['hub.verify_token'] === VERIFY_TOKEN) {
        // console.log('Validating webhook');
        res.status(200).send(req.query['hub.challenge']);
    } else {
        console.error('Failed validation. Make sure the validation tokens match.');
        res.sendStatus(403);
    }
});

App.post('/webhook', async (req, res) => {
    // WhatsApp sends data as JSON in the body of the request
    let data = req.body;

    // Log received data for debugging
    console.log('Webhook received:', data);


    // Handle different types of messages
    // if (data.entry) {
    // Handle text message
    let message = JSON.stringify(data.entry[0].changes[0].value.messages[0].text.body)


    try {
        const data = { message }
        await axios.post("https://geriang-manychat.onrender.com/chatgpt", data)
        res.sendStatus(200);

    } catch (err) {
        console.error("Error in POST /webhook:", err);
        res.sendStatus(200);
    }

    // Add handling for other message types if needed

    // }

    if (data.errors) {
        // Loop through each error
        data.errors.forEach((error) => {
            console.log('Received error:', error);
        });

        res.sendStatus(200);
    }

});


App.post('/sendMessage', async (req, res) => {


    try {
        const sendMessage = async () => {
            const url = 'https://graph.facebook.com/v17.0/100199353129672/messages';

            const data = {
                messaging_product: 'whatsapp',
                to: '6584430486',
                type: 'text',
                text: {
                    "body": `${response.response}`
                }
            };

            const config = {
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${process.env.WHATSAPP_BEARER_TOKEN} `
                }
            };

            try {
                await axios.post(url, data, config);
                // console.log("whatsapp send message status", response.status);
                // console.log("whatsapp send message data", response.data);

            } catch (error) {
                console.error(error);
            }
        };

        sendMessage();

        console.log("ChatGPT Response", response)

    } catch (err) {
        console.error("Error in POST /chatgpt:", err);
    }
})

App.listen(process.env.PORT || 3000, () => {
    console.log('server started')

});



