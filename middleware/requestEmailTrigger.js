const sendWhatsappMessage = require("../sendMessage")
const { checkEmail } = require("../database")

const triggerEmailRequest = async (req, res, next) => {

    let whatsapp_id = req.body.whatsapp_id

    // need to check if email exists
    const clientEmail = await checkEmail(whatsapp_id)
    console.log("Client Email is", clientEmail)
    if (!clientEmail) {

        console.log('Setting up setTimeout.');
        
        const response = {
            response: `Would you be interested to join our exclusive mailing list for firsthand monthly updates on bank sale and auction properties? We promise to email only up to twice a month`
        }
        setTimeout(async () => {
            console.log('This runs one hour after the route is accessed.');
            // put your function here
            await sendWhatsappMessage(whatsapp_id, response)
        }, 450000); // 3600000 milliseconds = 1 hour


        // ******** Need to set the trigger only once. 
        // Need to make sure that it does trigger another send message after next()
        next();
        return;
    }
    next();
    res.sendStatus(200);

};


module.exports = triggerEmailRequest
