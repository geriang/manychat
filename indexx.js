const { z } = require("zod");
const { ChatOpenAI } = require("langchain/chat_models/openai");
const { initializeAgentExecutorWithOptions } = require("langchain/agents");
const { Calculator } = require("langchain/tools/calculator");
const { DynamicTool } = require ("langchain/tools");
const { DynamicStructuredTool } = require("langchain/tools");
const { BufferMemory, ChatMessageHistory } = require("langchain/memory");
const {
  PromptTemplate,
  ChatPromptTemplate,
  MessagesPlaceholder,
  HumanMessagePromptTemplate,
  SystemMessagePromptTemplate,
} = require("langchain/prompts");

const { SerpAPI, ChainTool } = require("langchain/tools");
const { VectorDBQAChain } = require("langchain/chains");
const { HNSWLib } = require("langchain/vectorstores/hnswlib");
const { OpenAIEmbeddings } = require("langchain/embeddings/openai");
const { RecursiveCharacterTextSplitter } = require("langchain/text_splitter");
const fs = require('fs');

require('dotenv').config();

const run = async () => {


  const model = new ChatOpenAI({ temperature: 0 });

  //  to embed property listing information
  /* Load in the file we want to do question answering over */
  const text = fs.readFileSync("property.txt", "utf8");
  /* Split the text into chunks */
  const textSplitter = new RecursiveCharacterTextSplitter({ chunkSize: 1000 });
  const docs = await textSplitter.createDocuments([text]);
  /* Create the vectorstore */
  const vectorStore = await HNSWLib.fromDocuments(docs, new OpenAIEmbeddings());
  /* Create the chain */
  const chain = VectorDBQAChain.fromLLM(model, vectorStore);

  /* Load in the file we want to do question answering over */
  // const text2 = fs.readFileSync("greeting.txt", "utf8");
  // const textSplitter2 = new RecursiveCharacterTextSplitter({ chunkSize: 1000 });
  // const docs2 = await textSplitter2.createDocuments([text2]);
  // const vectorStore2 = await HNSWLib.fromDocuments(docs2, new OpenAIEmbeddings());
  // const chain2 = VectorDBQAChain.fromLLM(model, vectorStore2);
  // const promptNames = ["property"];
  // const promptDescriptions = [
  //   "Good for answering property enquiries"
  // ];
  // const propertyTemplate = `You are a helpful real estate agent Bot from Huttons Sales & Auction`+
  // `At the start of an incoming enquiry, you need to :` +
  // `1. Extract the property being enquired. if there is such information, ask what kind of property information does the enquirer need?` +
  // `2. Ask if the enquirer is enquiring for himself/herself or for his/her client.` +
  // `3. If the enquiry is for self, ask for the name and greet the enquirer by name.` 

  // const serviceTemplate = `You are a helpful real estate agent Bot from Huttons Sales & Auction`+
  // `At the start of an incoming enquiry, you need to :` +
  // `1. Extract the type of service being enquired. if there is such information, ask what kind of service does the enquirer need?` +
  // `2. Ask if the enquirer is enquiring for himself/herself or for his/her client.` +
  // `3. If the enquiry is for self, ask for the name and greet the enquirer by name.` 
  
  // const promptTemplates = [propertyTemplate]

  // const multiPromptChain = MultiPromptChain.fromLLMAndPrompts(model, {
  //   promptNames,
  //   promptDescriptions,
  //   promptTemplates,
  // });

  // create new tool for searching property information
  const propertyDatabaseTool = new ChainTool({
    name: "property_listing_database",
    description:
      "property listing database- useful for when you need to find information on a particular property listed by Huttons Sales & Auction.",
    chain: chain,
    returnDirect: true,
  });

  // const greetingTool = new ChainTool({
  //   name: "how_to_greet",
  //   description:
  //     "conversation etiquette- useful for when you don't seem to need any tools and just converse to find out more.",
  //   chain: multiPromptChain,
  //   returnDirect: true,
  // });

  const tools = [
    new Calculator(), // Older existing single input tools will still work
    propertyDatabaseTool,
    // greetingTool
    // new DynamicTool({
    //   name: "conversation etiquette",
    //   description:
    //     "You are a helpful real estate agent Bot from Huttons Sales & Auction that answers to queries. If there are no relevant tools to use, just greet and ask for the enquirer's name!.",
    //     func: () => "reply as you wish base on input"
    // }),
    // new DynamicStructuredTool({
    //   name: "property_listing_database",
    //   description: "a tool to search for available property listings by Huttons Sales & Auction.",
    //   schema: z.object({
    //     low: z.number().describe("The lower bound of the generated number"),
    //     high: z.number().describe("The upper bound of the generated number"),
    //   }),
    //   func: async ({ low, high }) =>
    //     (Math.random() * (high - low) + low).toString(), // Outputs still must be strings
    // }),
  ];


  // const model = new ChatOpenAI({ temperature: 0, openAIApiKey: apiKey });
  // const tools = [
  //   new SerpAPI(`${process.env.SERPAPI_API_KEY}`, {
  //     location: "Singapore",
  //     hl: "en",
  //     gl: "sg",
  //   }),
  //   new Calculator(),
  // ];

  const executor = await initializeAgentExecutorWithOptions(tools, model, {
    agentType: "structured-chat-zero-shot-react-description",
    verbose: true,
    memory: new BufferMemory({
      memoryKey: "chat_history",
      returnMessages: true,
    }),
    agentArgs: {
      inputVariables: ["input", "agent_scratchpad", "chat_history"],
      memoryPrompts: [new MessagesPlaceholder("chat_history")],
      prefix: "you are a Real Estate Chatbot from Huttons Sales & Auction. Your priority is to chat with enquirers and use tools when necessary.",
    },

  });

  const result = await executor.call({ input: `How much is branksome Road?` });

  console.log(result);

  // const result2 = await executor.call({
  //   input: `how much is branksome road selling for?`,
  // });

  // console.log(result2);


};

run()