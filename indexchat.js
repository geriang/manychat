const { ChatOpenAI } = require("langchain/chat_models/openai");
const { initializeAgentExecutorWithOptions } = require("langchain/agents");
const { SerpAPI, ChainTool } = require("langchain/tools");

const { VectorDBQAChain } = require("langchain/chains");
const { HNSWLib } = require("langchain/vectorstores/hnswlib");
const { OpenAIEmbeddings } = require("langchain/embeddings/openai");
const { RecursiveCharacterTextSplitter } = require("langchain/text_splitter");
const fs = require('fs');

const { Calculator } = require("langchain/tools/calculator");
require('dotenv').config();


const { BufferMemory, ChatMessageHistory } = require("langchain/memory");
const { HumanChatMessage, AIChatMessage } = require("langchain/schema");
const {
  MessagesPlaceholder,
} = require("langchain/prompts");

const run = async () => {


  let pastMessages = []

  process.env.LANGCHAIN_HANDLER = "langchain";
  const llm = new ChatOpenAI({ temperature: 0 });

  //  to embed property listing information
  /* Load in the file we want to do question answering over */
  const text = fs.readFileSync("property.txt", "utf8");
  const textSplitter = new RecursiveCharacterTextSplitter({ chunkSize: 1000 });
  const docs = await textSplitter.createDocuments([text]);
  const vectorStore = await HNSWLib.fromDocuments(docs, new OpenAIEmbeddings());
  const chain = VectorDBQAChain.fromLLM(llm, vectorStore);

  // create new tool for searching property information
  const propertyDatabaseTool = new ChainTool({
    name: "property_listing_database",
    description:
      "property listing database- useful for when you need to find information on a particular property listed by Huttons Sales & Auction.",
    chain: chain,
    returnDirect: true,
  });

  const tools = [
    new SerpAPI(process.env.SERPAPI_API_KEY, {
      location: "Austin,Texas,United States",
      hl: "en",
      gl: "us",
    }),
    new Calculator(),
    propertyDatabaseTool
  ];

  // Passing "chat-conversational-react-description" as the agent type
  // automatically creates and uses BufferMemory with the executor.
  // If you would like to override this, you can pass in a custom
  // memory option, but the memoryKey set on it must be "chat_history".
  const executor = await initializeAgentExecutorWithOptions(tools, llm, {
    agentType: "chat-conversational-react-description",
    verbose: true,
    memory: new BufferMemory({
      chatHistory: new ChatMessageHistory(pastMessages),
      returnMessages: true,
      memoryKey: "chat_history",
    }),
    agentArgs: {
      memoryPrompts: [new MessagesPlaceholder({ variableName: "chat_history" })],
      // prefix: "You are a chatbot that answers to enquires. Always ask for the name if it is not found in chat history. If a name is found, greet the person by name."
    }
  });


  const input = "how much is kaki bukit place?"

  const result = await executor.call({ input });

  console.log(result)


};

run()