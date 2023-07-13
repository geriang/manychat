const Queue = require("bull")
const askEmailQueue = new Queue("askEmailQueue")
const sendWhatsappMessage = require("../sendMessage")
const { checkEmail } = require("../database")


const triggerEmailRequest = async (req, res, next) => {

    let whatsapp_id = req.body.whatsapp_id

    // need to check if email exists
    const clientEmail = await checkEmail(whatsapp_id)
    console.log("Client Email is", clientEmail)
    if (!clientEmail) {

        askEmailQueue.add({ whatsapp_id }, { delay: 450000 });
        next();
        return;
    }
    next();
    res.sendStatus(200);

};

askEmailQueue.process(async (job) => {
    console.log('This runs one hour after the route is accessed.');
    // put your function here

    const response = `Would you be interested to join our exclusive mailing list for firsthand monthly updates on bank sale and auction properties? We promise to email only up to twice a month`
    await sendWhatsappMessage(job.data.whatsapp_id, response)


});


module.exports = triggerEmailRequest
