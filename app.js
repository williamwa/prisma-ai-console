#!/usr/bin/env node
const repl = require("pretty-repl");
const path = require("path");
const { options } = require("./setupCLI");
const { createAIFunction } = require("./aiHelper");

// Resolve client path (handle both absolute and relative paths)
const clientPath = path.isAbsolute(options?.client)
  ? options?.client
  : path.join(process.cwd(), options?.client);

const { PrismaClient } = require(clientPath);

const prisma = new PrismaClient();

// workaround for https://github.com/prisma/prisma/issues/18292
prisma[Symbol.for('nodejs.util.inspect.custom')] = 'PrismaClient';

const replServer = repl.start({
  prompt: "◭ > ",
  useColors: true,
});

replServer.context.prisma = prisma;

// Inject AI functions
const { ai, run } = createAIFunction(replServer, options?.schema);
replServer.context.ai = ai;
replServer.context.run = run;
