const axios = require('axios')
const { addMessageSent } = require('./database')


const sendWhatsappMessage = async (whatsapp_id, response) => {

    try {
        const version = process.env.WHATSAPP_VERSION
        const phoneNumberID = process.env.WHATSAPP_PHONE_NUMBER_ID

        await axios.post(`https://graph.facebook.com/${version}/${phoneNumberID}/messages`, {

            "messaging_product": "whatsapp",
            "recipient_type": "individual",
            "to": whatsapp_id,
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

        let data = {
            "bot": `${response.response ? response.response : response.text}`,
            "timestamp": new Date()
        }
        await addMessageSent(whatsapp_id, data)

    } catch (err) {
        console.error("Error in POST /chatgpt:", err);
    }

}

module.exports = sendWhatsappMessage

