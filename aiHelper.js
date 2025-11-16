const fs = require("fs");
const path = require("path");

/**
 * Reads the Prisma schema file from the project
 * @param {string} clientPath - Path to the Prisma client
 * @returns {string|null} - Schema content or null if not found
 */
function readPrismaSchema(clientPath) {
  try {
    // Try common schema locations
    const possiblePaths = [
      path.join(process.cwd(), "prisma", "schema.prisma"),
      path.join(process.cwd(), "prisma", "schema", "schema.prisma"),
      path.join(clientPath, "..", "..", "prisma", "schema.prisma"),
    ];

    for (const schemaPath of possiblePaths) {
      if (fs.existsSync(schemaPath)) {
        return fs.readFileSync(schemaPath, "utf-8");
      }
    }

    return null;
  } catch (error) {
    console.error("Error reading Prisma schema:", error.message);
    return null;
  }
}

/**
 * Generates a prompt for the LLM with schema context
 * @param {string} schema - Prisma schema content
 * @param {string} userQuery - User's natural language query
 * @returns {string} - Formatted prompt
 */
function generatePrompt(schema, userQuery) {
  return `You are a Prisma ORM expert. Given the following Prisma schema, generate the exact Prisma Client command to accomplish the user's request.

PRISMA SCHEMA:
\`\`\`prisma
${schema}
\`\`\`

USER REQUEST: ${userQuery}

INSTRUCTIONS:
- Return ONLY the Prisma command, no explanations
- Use the prisma client instance (already available as 'prisma')
- Format as executable JavaScript code
- Include necessary options like 'include', 'select', 'where', etc.
- Use async/await syntax with 'await'

EXAMPLE OUTPUT FORMAT:
await prisma.user.findMany({ where: { email: { contains: '@example.com' } } })

Generate the command:`;
}

/**
 * Calls an LLM API to generate Prisma commands
 * @param {string} prompt - The formatted prompt
 * @returns {Promise<string>} - Generated Prisma command
 */
async function callLLM(prompt) {
  // Check for API key
  const apiKey = process.env.OPENAI_API_KEY || process.env.ANTHROPIC_API_KEY || process.env.OPENROUTER_API_KEY;
  
  if (!apiKey) {
    throw new Error(
      "No API key found. Please set OPENAI_API_KEY, ANTHROPIC_API_KEY, or OPENROUTER_API_KEY environment variable."
    );
  }

  // Use OpenRouter if available
  if (process.env.OPENROUTER_API_KEY) {
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`,
        "HTTP-Referer": "https://github.com/prisma-console",
        "X-Title": "Prisma Console AI",
      },
      body: JSON.stringify({
        model: process.env.OPENROUTER_MODEL || "anthropic/claude-3.5-sonnet",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.3,
        max_tokens: 500,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`OpenRouter API error: ${error}`);
    }

    const data = await response.json();
    return data.choices[0].message.content.trim();
  }

  // Use OpenAI if available
  if (process.env.OPENAI_API_KEY) {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.3,
        max_tokens: 500,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`OpenAI API error: ${error}`);
    }

    const data = await response.json();
    return data.choices[0].message.content.trim();
  }

  // Use Anthropic if available
  if (process.env.ANTHROPIC_API_KEY) {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-3-5-sonnet-20241022",
        max_tokens: 500,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Anthropic API error: ${error}`);
    }

    const data = await response.json();
    return data.content[0].text.trim();
  }

  throw new Error("No supported LLM API key found");
}

/**
 * Main AI function that generates Prisma commands
 * @param {string} clientPath - Path to the Prisma client
 * @param {object} replServer - REPL server instance for accessing context
 * @returns {object} - Object with ai, run, and aiRun functions
 */
function createAIFunction(clientPath, replServer) {
  const schema = readPrismaSchema(clientPath);

  if (!schema) {
    return {
      ai: function ai() {
        console.error(
          "❌ Could not find Prisma schema. Please ensure schema.prisma exists in your project."
        );
      },
      run: function run() {
        console.error("❌ Schema not loaded");
      },
      aiRun: async function aiRun() {
        console.error("❌ Schema not loaded");
      },
    };
  }

  // Store last command
  let lastCommand = null;

  const ai = async function ai(query) {
    if (!query || typeof query !== "string") {
      console.log("Usage: ai('your natural language query')");
      console.log("Example: ai('find all users with gmail addresses')");
      return;
    }

    try {
      console.log("🤖 Generating Prisma command...");
      const prompt = generatePrompt(schema, query);
      const command = await callLLM(prompt);

      // Clean up the response (remove code fences if present)
      let cleanCommand = command
        .replace(/```javascript\n?/g, "")
        .replace(/```js\n?/g, "")
        .replace(/```\n?/g, "")
        .trim();

      console.log("\n✨ Generated command:");
      console.log(cleanCommand);
      console.log("\n💡 Copy and paste to execute, or assign to a variable\n");

      lastCommand = cleanCommand;
      return cleanCommand;
    } catch (error) {
      console.error("❌ Error generating command:", error.message);
      return null;
    }
  };

  const run = function run() {
    if (!lastCommand) {
      console.error("❌ No command to run. Use ai('query') first.");
      return;
    }

    try {
      console.log(`🚀 Running: ${lastCommand}\n`);
      // Use eval to execute the last command in the REPL context
      return eval(lastCommand);
    } catch (error) {
      console.error("❌ Error running command:", error.message);
      return null;
    }
  };

  const aiRun = async function aiRun(query) {
    if (!query || typeof query !== "string") {
      console.log("Usage: aiRun('your natural language query')");
      console.log("Example: aiRun('find all users with gmail addresses')");
      return;
    }

    try {
      console.log("🤖 Generating and running Prisma command...");
      const prompt = generatePrompt(schema, query);
      const command = await callLLM(prompt);

      // Clean up the response
      let cleanCommand = command
        .replace(/```javascript\n?/g, "")
        .replace(/```js\n?/g, "")
        .replace(/```\n?/g, "")
        .trim();

      console.log(`\n✨ Generated: ${cleanCommand}`);
      console.log("🚀 Executing...\n");

      lastCommand = cleanCommand;
      
      // Execute the command
      const result = eval(cleanCommand);
      return result;
    } catch (error) {
      console.error("❌ Error:", error.message);
      return null;
    }
  };

  return { ai, run, aiRun };
}

module.exports = { createAIFunction };
