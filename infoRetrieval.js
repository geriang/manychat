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

    const lookUpNameTemplate = `You are tasked to extract a client's name from a given data source. Any name mentioned after client: can potentially be the client's name. Are you able to identify the client's name from the following chat history?
    Chat History: {chat_history}
    Observation: This is your observation on the task given:`

    const lookUpNamePromptTemplate = new PromptTemplate({
        inputVariables: ["chat_history"],
        template: lookUpNameTemplate, 
    });

    const lookUpNamechain = new LLMChain({ llm: llm, prompt: lookUpNamePromptTemplate });

    const extractNameTemplate = `Given the observation, if you are able to identify the client's name, please extract out the name by wrapping the name with "<" ">". For example,<Mary>. Otherwise say no name is found.
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

const findEmail = async (chatHistory) => {

    // initiating the chatmodel - openai
    const llm = new OpenAI({ temperature: 0.0, verbose: true });

    const lookUpEmailTemplate = `You are tasked to extract a client's email address from a given data source. An email address should contain "@" and "." for example, mary@abc.com and must be validated. Are you able to identify the client's email address from the following chat history?
    Chat History: {chat_history}
    Observation: This is your observation on the task given:`

    const lookUpEmailPromptTemplate = new PromptTemplate({
        inputVariables: ["chat_history"],
        template: lookUpEmailTemplate, 
    });

    const lookUpEmailchain = new LLMChain({ llm: llm, prompt: lookUpEmailPromptTemplate });

    const extractEmailTemplate = `Given the observation, if you are able to identify the client's email address, please extract out the email address by wrapping it with "<" ">". For example,<mary@abc.com>. Otherwise say no email is found.
    Observation: {observation}
    Email: This is the email address extracted:`

    const extractEmailPromptTemplate = new PromptTemplate({
        inputVariables: ["observation"],
        template: extractEmailTemplate, 
    })

    const extractEmailChain = new LLMChain({ llm: llm, prompt: extractEmailPromptTemplate });

    const chain = new SimpleSequentialChain({
        chains: [lookUpEmailchain, extractEmailChain],
        verbose: true,
    });

    const result = await chain.run(chatHistory);

    return result

};
// need to write find email

module.exports = {findName, findEmail}

