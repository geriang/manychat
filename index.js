const fetch = require('node-fetch');
global.Headers = require('node-fetch').Headers;
global.fetch = fetch;
global.Request = fetch.Request;
global.Response = fetch.Response;
global.Headers = fetch.Headers;
require('dotenv').config();

const express = require("express");
const cors = require('cors');
const bodyParser = require('body-parser');

const App = express();
const whatsappEndpoint = require("./api/whatsapp")
const chatEndpoint = require("./api/chat")
const triggerChat = require("./middleware/chatTrigger")
const triggerEmailRequest = require("./middleware/requestEmailTrigger")

App.use(express.json()); // Middleware for parsing JSON bodies of incoming requests
App.use(bodyParser.json());
App.use(cors({
    origin: true
}))

App.use(express.urlencoded({
    extended: false
}))



App.use('/whatsapp', whatsappEndpoint);
App.use('/chatgpt', triggerChat, triggerEmailRequest, chatEndpoint)


App.listen(process.env.PORT || 3000, () => {
    console.log('server started')

});





