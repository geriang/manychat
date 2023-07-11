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

    const lookUpNameTemplate = "You are tasked to extract information from a given data source. Are you able to accurately identify the client's name from the following {chat_history}?"

    const lookUpNamepromptTemplate = new PromptTemplate({
        lookUpNameTemplate, inputVariables: ["chat_history"],
    });

    const lookUpNamechain = new LLMChain({ llm, prompt: lookUpNamepromptTemplate });

    const extractNameTemplate = "Given the following observation {observation}, if you are able to identify the client's name, please extract out the name by wrapping the name with <>. For example, <Mary>. Otherwise say no name is found "

    const extractNamePromptTemplate = new PromptTemplate({
        extractNameTemplate, inputVariables: ["observation"]
    })

    const extractNameChain = new LLMChain({ llm, prompt: extractNamePromptTemplate });

    const chain = new SimpleSequentialChain({
        chains: [lookUpNamechain, extractNameChain],
        verbose: true,
    });

    const result = await overallChain.run(chatHistory);

    return result

};


module.exports = findName



// // This is an LLMChain to write a synopsis given a title of a play.
// const llm = new OpenAI({ temperature: 0 });
// const template = `You are a playwright. Given the title of play, it is your job to write a synopsis for that title.
 
//   Title: {title}
//   Playwright: This is a synopsis for the above play:`;
// const promptTemplate = new PromptTemplate({
//     template,
//     inputVariables: ["title"],
// });
// const synopsisChain = new LLMChain({ llm, prompt: promptTemplate });

// // This is an LLMChain to write a review of a play given a synopsis.
// const reviewLLM = new OpenAI({ temperature: 0 });
// const reviewTemplate = `You are a play critic from the New York Times. Given the synopsis of play, it is your job to write a review for that play.
 
//   Play Synopsis:
//   {synopsis}
//   Review from a New York Times play critic of the above play:`;
// const reviewPromptTemplate = new PromptTemplate({
//     template: reviewTemplate,
//     inputVariables: ["synopsis"],
// });
// const reviewChain = new LLMChain({
//     llm: reviewLLM,
//     prompt: reviewPromptTemplate,
// });

// const overallChain = new SimpleSequentialChain({
//     chains: [synopsisChain, reviewChain],
//     verbose: true,
// });
// const review = await overallChain.run("Tragedy at sunset on the beach");
// console.log(review);
