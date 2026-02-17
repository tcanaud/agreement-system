import { existsSync, copyFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const TEMPLATES = join(__dirname, "..", "templates");

function copyTemplate(src, dest) {
  const destDir = dirname(dest);
  if (!existsSync(destDir)) {
    mkdirSync(destDir, { recursive: true });
  }
  copyFileSync(src, dest);
}

export function update(flags = []) {
  const projectRoot = process.cwd();

  console.log("\n  agreement-system update\n");

  if (!existsSync(join(projectRoot, ".agreements"))) {
    console.error("  Error: .agreements/ not found. Run 'agreement-system init' first.");
    process.exit(1);
  }

  // Update commands only — never touch agreements, index, or config
  console.log("  Updating Claude Code commands...");

  const commandMappings = [
    ["commands/agreement.create.md", ".claude/commands/agreement.create.md"],
    ["commands/agreement.sync.md", ".claude/commands/agreement.sync.md"],
    ["commands/agreement.check.md", ".claude/commands/agreement.check.md"],
    ["commands/agreement.doctor.md", ".claude/commands/agreement.doctor.md"],
  ];

  for (const [src, dest] of commandMappings) {
    copyTemplate(join(TEMPLATES, src), join(projectRoot, dest));
    console.log(`    update ${dest}`);
  }

  // Update doc
  copyTemplate(
    join(TEMPLATES, "core", "agreement.md"),
    join(projectRoot, ".agreements", "agreement.md")
  );
  console.log("    update .agreements/agreement.md");

  // Update template
  copyTemplate(
    join(TEMPLATES, "core", "agreement.tpl.yaml"),
    join(projectRoot, ".agreements", "_templates", "agreement.tpl.yaml")
  );
  console.log("    update .agreements/_templates/agreement.tpl.yaml");

  // Update BMAD integration if present (_bmad or .bmad)
  const bmadDir = existsSync(join(projectRoot, "_bmad")) ? "_bmad"
    : existsSync(join(projectRoot, ".bmad")) ? ".bmad"
    : null;

  if (bmadDir) {
    const bmadCustomizeDir = join(projectRoot, bmadDir, "_config", "agents");
    if (existsSync(bmadCustomizeDir)) {
      console.log(`  Updating BMAD integration (${bmadDir}/)...`);
      for (const file of ["core-bmad-master.customize.yaml", "bmm-pm.customize.yaml"]) {
        copyTemplate(
          join(TEMPLATES, "bmad", file),
          join(bmadCustomizeDir, file)
        );
        console.log(`    update ${bmadDir}/_config/agents/${file}`);
      }
    }
  }

  console.log();
  console.log("  Done! Commands and templates updated.");
  console.log("  Your existing agreements and config are untouched.\n");
}
