const { ConversationalRetrievalQAChain } = require("langchain/chains");
const { BufferMemory, ChatMessageHistory } = require("langchain/memory");

const createDestinations = (listingVectorStore, stampdutyVectorStore, auctionScheduleVectorStore, llm, pastMessages) => {
    
    const now = new Date();
    const localeString = now.toLocaleDateString('en-US', { timeZone: 'Asia/Singapore' });  // Asia/Singapore is in the GMT+8 timezone
    
    let templates = [
        {
            name: 'property_enquiry',
            description: 'Good for replying enquiry on a particular property. For example enquiry on property prices and property specifications ',
            vector: listingVectorStore,
            template: `Given the following conversation and a follow up question, return the conversation history excerpt that includes any relevant context to the question if it exists and rephrase the follow up question to be a standalone question.
            Chat History:
            {chat_history}
            Follow Up Input: {question}
            Your answer should follow the following format:
            \`\`\`
            Use the following pieces of context to answer the users question.
            If you don't know the answer, just say that you don't know, don't try to make up an answer.
            ----------------
            <Relevant chat history excerpt as context here>
            Standalone question: <Rephrased question here>
            \`\`\`
            Your answer:`
        },
        {
            name: 'stamp_duty_enquiry',
            description: 'Good for replying enquiry on Additional Buyers Stamp Duty (ABSD) payable when a buyer wants to buy a residential property in Singapore ',
            vector: stampdutyVectorStore,
            template: `You are a calculator good at calculating monthly loan repayment figures. Given the following conversation and a follow up question, return the conversation history excerpt that includes any relevant context to the question if it exists and rephrase the follow up question to be a standalone question.
            Chat History:
            {chat_history}
            Follow Up Input: {question}
            Your answer should follow the following format:
            \`\`\`
            Use the following pieces of context to answer the users question.
            If you don't know the answer, just say that you don't know, don't try to make up an answer.
            ----------------
            <Relevant chat history excerpt as context here>
            Standalone question: <Rephrased question here>
            \`\`\`
            Your answer:`
        },
        {
            name: 'auction_schedule_enquiry',
            description: 'Good for replying on the date and venue of auction event, such as when and where is the next auction',
            vector: auctionScheduleVectorStore,
            template: `Given today's date: ${localeString}, the following conversation and a follow up question, return the conversation history excerpt that includes any relevant context to the question if it exists and rephrase the follow up question to be a standalone question.
            Chat History:
            {chat_history}
            Follow Up Input: {question}
            Your answer should follow the following format:
            \`\`\`
            Use the following pieces of context to answer the users question.
            If you don't know the answer, just say that you don't know, don't try to make up an answer.
            ----------------
            <Relevant chat history excerpt as context here>
            Standalone question: <Rephrased question here>
            \`\`\`
            Your answer:`
        }
    ];
    
    // Build an array of destination LLMChains and a list of the names with descriptions
    let destinationChains = {};
    
    
    for (const item of templates) {
        let prompt = `${item.template}`
        let chain = ConversationalRetrievalQAChain.fromLLM(
            llm,
            item.vector.asRetriever(),
            {
                memory: new BufferMemory({
                    memoryKey: "chat_history", // Must be set to "chat_history"
                    returnMessages: true,
                    chatHistory: new ChatMessageHistory(pastMessages),
                }),
                questionGeneratorChainOptions: {
                    template: prompt
                }
            }
        );
        destinationChains[item.name] = chain;
    }
    
    let destinations = templates.map(item => (item.name + ': ' + item.description)).join('\n');

    const destinationObj = {
        destinationChains,
        destinations
    }

    return destinationObj
}

module.exports = createDestinations


