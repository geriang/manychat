const { initializeAgentExecutorWithOptions } = require("langchain/agents");
const { ChatOpenAI } = require("langchain/chat_models/openai");
const { SerpAPI } = require("langchain/tools");
const { Calculator } = require("langchain/tools/calculator");
require('dotenv').config();

const run = async () => {

  const apiKey = process.env.OPENAI_API_KEY;
  console.log(apiKey);


  const model = new ChatOpenAI({ temperature: 0, openAIApiKey: apiKey });
  const tools = [
    new SerpAPI(`${process.env.SERPAPI_API_KEY}`, {
      location: "Singapore",
      hl: "en",
      gl: "sg",
    }),
    new Calculator(),
  ];

  const executor = await initializeAgentExecutorWithOptions(tools, model, {
    agentType: "chat-zero-shot-react-description",
    returnIntermediateSteps: true,
  });
  console.log("Loaded agent.");

  const input = `Do you know what is the formular for velocity?`;

  console.log(`Executing with input "${input}"...`);

  const result = await executor.call({ input });

  console.log(`Got output ${result.output}`);

  console.log(
    `Got intermediate steps ${JSON.stringify(
      result.intermediateSteps,
      null,
      2
    )}`
  );
};

run()