const { ChatOpenAI } = require("langchain/chat_models/openai");
const { initializeAgentExecutorWithOptions } = require("langchain/agents");
const { SerpAPI } = require ("langchain/tools");
const { Calculator } = require("langchain/tools/calculator");
require('dotenv').config();


const { BufferMemory, ChatMessageHistory } = require("langchain/memory");
const { HumanChatMessage, AIChatMessage } = require("langchain/schema");

const run = async () => {
  process.env.LANGCHAIN_HANDLER = "langchain";
  const model = new ChatOpenAI({ temperature: 0 });
  const tools = [
    new SerpAPI(process.env.SERPAPI_API_KEY, {
      location: "Austin,Texas,United States",
      hl: "en",
      gl: "us",
    }),
    new Calculator(),
  ];

  // Passing "chat-conversational-react-description" as the agent type
  // automatically creates and uses BufferMemory with the executor.
  // If you would like to override this, you can pass in a custom
  // memory option, but the memoryKey set on it must be "chat_history".
  const executor = await initializeAgentExecutorWithOptions(tools, model, {
    agentType: "chat-conversational-react-description",
    verbose: true,
    memory: new BufferMemory({
        // chatHistory: new ChatMessageHistory(pastMessages),
        returnMessages: true,
        memoryKey: "chat_history",
    }),
  });
  

  const input = ""

  const result = await executor.call({ input });

  console.log(result)

  
};

run()