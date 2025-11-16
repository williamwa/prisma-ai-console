# @prismatools/console

Run Prisma Queries in a REPL style console. Heavily inspired by the Rails Console

## Screenshot

![Screenshot](./docs/screenshot.png)

## Usage

- From your project directory, run:

```bash
npx @prismatools/console@latest
```

- For setting a Prisma client path explicitly, use the `--client` or the `-c` flag

```bash
npx @prismatools/console@latest -c ./node_modules/@prisma/client
```

## AI-Powered Query Generation 🤖

Generate Prisma queries using natural language! The console now includes an `ai()` function that understands your database schema and generates the appropriate Prisma commands.

### Setup

Set your API key as an environment variable:

```bash
# For OpenAI
export OPENAI_API_KEY=your-api-key-here

# Or for Anthropic Claude
export ANTHROPIC_API_KEY=your-api-key-here

# Or for OpenRouter (supports multiple models)
export OPENROUTER_API_KEY=your-api-key-here
export OPENROUTER_MODEL=anthropic/claude-3.5-sonnet  # Optional, defaults to claude-3.5-sonnet
```

### Examples

```javascript
// 1. ai(query) - Generate a Prisma command (returns text)
await ai('find all users with gmail addresses')
// Returns: "await prisma.user.findMany({ where: { email: { contains: '@gmail.com' } } })"

// 2. run() - Execute the last generated command
run()
// Executes the command from the previous ai() call

// 3. aiRun(query) - Generate and execute in one step
await aiRun('get the top 10 most played songs with their artist names')
// Generates the command and runs it immediately

// Workflow example:
await ai('find users created in last 7 days')  // Generate command
run()                                           // Execute it
```

### Example

```javascript
◭ > await ai('find all users created in the last 7 days')
🤖 Generating Prisma command...

✨ Generated command:
await prisma.user.findMany({ where: { createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } } })

💡 Copy and paste to execute, or assign to a variable
```

### Features

Three powerful commands:

- **`ai(query)`** - Generate Prisma commands from natural language
- **`run()`** - Execute the last generated command
- **`aiRun(query)`** - Generate and execute in one step

The AI automatically:

- Reads your Prisma schema
- Understands your database structure
- Generates accurate Prisma Client queries
- Supports complex queries with relations, filters, and aggregations

### Forget Prisma Studio! 🤣

![Screenshot 2](./docs/screenshot2.png)
