#!/usr/bin/env node

import { argv, exit } from "node:process";
import { install } from "../src/installer.js";
import { update } from "../src/updater.js";

const command = argv[2];
const flags = argv.slice(3);

const HELP = `
agreement-system — Convergence layer between product, implementation, and code.

Usage:
  npx agreement-system init     Install the Agreement System in the current project
  npx agreement-system update   Update commands without touching existing agreements
  npx agreement-system help     Show this help message

Options (init):
  --skip-bmad       Skip BMAD integration even if detected
  --force-bmad      Install BMAD integration even if not detected
  --yes             Skip confirmation prompts
`;

switch (command) {
  case "init":
    install(flags);
    break;
  case "update":
    update(flags);
    break;
  case "help":
  case "--help":
  case "-h":
  case undefined:
    console.log(HELP);
    break;
  default:
    console.error(`Unknown command: ${command}`);
    console.log(HELP);
    exit(1);
}
