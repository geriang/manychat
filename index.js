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

App.use(express.json()); // Middleware for parsing JSON bodies of incoming requests
App.use(bodyParser.json());
App.use(cors({
    origin: true
}))

App.use(express.urlencoded({
    extended: false
}))



App.use('/whatsapp', whatsappEndpoint);
App.use('/chatgpt', triggerChat, chatEndpoint)


App.listen(process.env.PORT || 3000, () => {
    console.log('server started')

});



// const express = require('express');
// const app = express();

// // In-memory store for the last function call timestamp.
// let lastFunctionCallTimestamp = null;

// // Your middleware function.
// const rateLimit = (req, res, next) => {
//     const currentTime = Date.now();
//     const sixHoursInMilliseconds = 6 * 60 * 60 * 1000;

//     if (lastFunctionCallTimestamp && currentTime - lastFunctionCallTimestamp < sixHoursInMilliseconds) {
//         return res.status(429).send("You can only trigger this function once every 6 hours.");
//     }

//     lastFunctionCallTimestamp = currentTime;
//     next();
// };

// app.use(rateLimit);

// app.get('/', function (req, res) {
//     res.send('This function is called!');
// });

// app.listen(3000, function () {
//     console.log('App is listening on port 3000');
// });



