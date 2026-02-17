import { existsSync, mkdirSync, copyFileSync, readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createInterface } from "node:readline";

const __dirname = dirname(fileURLToPath(import.meta.url));
const TEMPLATES = join(__dirname, "..", "templates");

function detect(projectRoot) {
  const hasBmad = existsSync(join(projectRoot, "_bmad"));
  const hasSpeckit = existsSync(join(projectRoot, ".specify"));
  const hasClaudeCommands = existsSync(join(projectRoot, ".claude", "commands"));
  const hasAgreements = existsSync(join(projectRoot, ".agreements"));

  return { hasBmad, hasSpeckit, hasClaudeCommands, hasAgreements };
}

function copyTemplate(src, dest) {
  const destDir = dirname(dest);
  if (!existsSync(destDir)) {
    mkdirSync(destDir, { recursive: true });
  }
  copyFileSync(src, dest);
}

function ask(question) {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim().toLowerCase());
    });
  });
}

export async function install(flags = []) {
  const projectRoot = process.cwd();
  const skipBmad = flags.includes("--skip-bmad");
  const forceBmad = flags.includes("--force-bmad");
  const autoYes = flags.includes("--yes");

  console.log("\n  agreement-system v1.0.0\n");

  // ── Detect environment ──────────────────────────────
  const env = detect(projectRoot);

  console.log("  Environment detected:");
  console.log(`    BMAD:           ${env.hasBmad ? "yes" : "no"}`);
  console.log(`    Spec Kit:       ${env.hasSpeckit ? "yes" : "no"}`);
  console.log(`    Claude commands: ${env.hasClaudeCommands ? "yes" : "no"}`);
  console.log(`    Agreements:     ${env.hasAgreements ? "already installed" : "not found"}`);
  console.log();

  if (env.hasAgreements && !autoYes) {
    const answer = await ask("  .agreements/ already exists. Overwrite templates? (y/N) ");
    if (answer !== "y" && answer !== "yes") {
      console.log("  Skipping core templates (existing agreements preserved).");
      console.log("  Use 'agreement-system update' to update commands only.\n");
      return;
    }
  }

  // ── Step 1: Core ────────────────────────────────────
  console.log("  [1/3] Installing core...");

  const coreMappings = [
    ["core/agreement.tpl.yaml", ".agreements/_templates/agreement.tpl.yaml"],
    ["core/index.yaml", ".agreements/index.yaml"],
    ["core/agreement.md", ".agreements/agreement.md"],
    ["core/config.yaml", ".agreements/config.yaml"],
  ];

  for (const [src, dest] of coreMappings) {
    const destPath = join(projectRoot, dest);
    // Don't overwrite index.yaml if it already has agreements
    if (dest === ".agreements/index.yaml" && existsSync(destPath)) {
      const content = readFileSync(destPath, "utf-8");
      if (content.includes("feature_id:")) {
        console.log(`    skip ${dest} (has existing agreements)`);
        continue;
      }
    }
    // Don't overwrite config if it already exists
    if (dest === ".agreements/config.yaml" && existsSync(destPath)) {
      console.log(`    skip ${dest} (already configured)`);
      continue;
    }
    copyTemplate(join(TEMPLATES, src), destPath);
    console.log(`    write ${dest}`);
  }

  // ── Step 2: Claude Code commands ────────────────────
  console.log("  [2/3] Installing Claude Code commands...");

  if (!env.hasClaudeCommands) {
    mkdirSync(join(projectRoot, ".claude", "commands"), { recursive: true });
    console.log("    create .claude/commands/");
  }

  const commandMappings = [
    ["commands/agreement.create.md", ".claude/commands/agreement.create.md"],
    ["commands/agreement.sync.md", ".claude/commands/agreement.sync.md"],
    ["commands/agreement.check.md", ".claude/commands/agreement.check.md"],
    ["commands/agreement.doctor.md", ".claude/commands/agreement.doctor.md"],
  ];

  for (const [src, dest] of commandMappings) {
    copyTemplate(join(TEMPLATES, src), join(projectRoot, dest));
    console.log(`    write ${dest}`);
  }

  // ── Step 3: BMAD integration (optional) ─────────────
  const shouldInstallBmad =
    !skipBmad && (forceBmad || env.hasBmad);

  if (shouldInstallBmad) {
    console.log("  [3/3] Installing BMAD integration...");

    const bmadCustomizeDir = join(projectRoot, "_bmad", "_config", "agents");
    const bmadMemoryDir = join(projectRoot, "_bmad", "_memory", "agreements-sidecar");

    if (!existsSync(bmadCustomizeDir)) {
      console.log("    warn: _bmad/_config/agents/ not found, skipping customize.yaml");
    } else {
      // Only write customize.yaml if it's still the default (empty) version
      for (const file of ["core-bmad-master.customize.yaml", "bmm-pm.customize.yaml"]) {
        const destPath = join(bmadCustomizeDir, file);
        if (existsSync(destPath)) {
          const content = readFileSync(destPath, "utf-8");
          const hasAgreementMenu = content.includes("agreement");
          if (hasAgreementMenu) {
            console.log(`    skip ${file} (already has Agreement integration)`);
            continue;
          }
        }
        copyTemplate(join(TEMPLATES, "bmad", file), destPath);
        console.log(`    write _bmad/_config/agents/${file}`);
      }
    }

    if (!existsSync(bmadMemoryDir)) {
      mkdirSync(bmadMemoryDir, { recursive: true });
    }
    copyTemplate(
      join(TEMPLATES, "bmad", "active-agreements.md"),
      join(bmadMemoryDir, "active-agreements.md")
    );
    console.log("    write _bmad/_memory/agreements-sidecar/active-agreements.md");
  } else if (env.hasBmad && skipBmad) {
    console.log("  [3/3] BMAD integration skipped (--skip-bmad).");
  } else {
    console.log("  [3/3] No BMAD detected, skipping integration.");
  }

  // ── Done ────────────────────────────────────────────
  console.log();
  console.log("  Done! Agreement System installed.");
  console.log();
  console.log("  Available commands:");
  console.log("    /agreement.create <feature>   Create a new Agreement");
  console.log("    /agreement.sync <feature_id>  Sync with BMAD/Spec Kit artifacts");
  console.log("    /agreement.check <feature_id> Check code drift against Agreement");
  console.log("    /agreement.doctor <feature_id> Generate fix tasks from check FAIL");
  console.log();

  if (env.hasSpeckit) {
    console.log("  Spec Kit detected: /agreement.doctor will generate tasks compatible");
    console.log("  with /speckit.implement.");
    console.log();
  }
}
