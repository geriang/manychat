// const axios = require('axios');
// const { ChatOpenAI } = require("langchain/chat_models/openai");
const { OpenAI } = require("langchain/llms/openai");
// const { BufferMemory, ChatMessageHistory } = require("langchain/memory");
// const { HumanChatMessage, AIChatMessage } = require("langchain/schema");
const { SimpleSequentialChain, LLMChain } = require("langchain/chains");
const { PromptTemplate } = require("langchain/prompts");
// const { checkName } = require("./database")

const findName = async (chatHistory) => {

    // initiating the chatmodel - openai
    const llm = new OpenAI({ temperature: 0.0, verbose: true });

    const lookUpNameTemplate = `You are tasked to extract information from a given data source. Are you able to accurately identify the client's name from the following chat history?
    Chat History: {chat_history}
    Observation: This is your observation on the task given:`

    const lookUpNamePromptTemplate = new PromptTemplate({
        inputVariables: ["chat_history"],
        template: lookUpNameTemplate, 
    });

    const lookUpNamechain = new LLMChain({ llm: llm, prompt: lookUpNamePromptTemplate });

    const extractNameTemplate = `Given the observation, if you are able to identify the client's name, please extract out the name by wrapping the name with <>. For example, <Mary>. Otherwise say no name is found.
    Observation: {observation}
    Name: This is the name extracted:`

    const extractNamePromptTemplate = new PromptTemplate({
        inputVariables: ["observation"],
        template: extractNameTemplate, 
    })

    const extractNameChain = new LLMChain({ llm: llm, prompt: extractNamePromptTemplate });

    const chain = new SimpleSequentialChain({
        chains: [lookUpNamechain, extractNameChain],
        verbose: true,
    });

    const result = await chain.run(chatHistory);

    return result

};

module.exports = findName

