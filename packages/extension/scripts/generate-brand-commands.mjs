import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const extensionRoot = resolve(__dirname, "..");

// 1. Read branded-commands.json
const brandedCommandsPath = resolve(extensionRoot, "branded-commands.json");
const brandedCommandsContent = readFileSync(brandedCommandsPath, "utf8");
const { commands: baseCommands, brands } = JSON.parse(brandedCommandsContent);

// 2. Read package.json
const packageJsonPath = resolve(extensionRoot, "package.json");
const packageJsonContent = readFileSync(packageJsonPath, "utf8");
const packageJson = JSON.parse(packageJsonContent);

// 3. Generate contributes.commands
const commands = [];
for (const cmd of baseCommands) {
  commands.push({
    command: `sage.${cmd.id}`,
    title: `Sage: ${cmd.title}`
  });
}
for (const brand of brands) {
  for (const cmd of baseCommands) {
    commands.push({
      command: `sage.${cmd.id}.${brand.id}`,
      title: `${cmd.title}`,
      category: brand.category
    });
  }
}

// 4. Generate contributes.menus.commandPalette
const commandPalette = [];
for (const cmd of baseCommands) {
  commandPalette.push({
    command: `sage.${cmd.id}`,
    when: "!sage.brandKey"
  });
}
for (const brand of brands) {
  for (const cmd of baseCommands) {
    commandPalette.push({
      command: `sage.${cmd.id}.${brand.id}`,
      // Format parsed by extractKnownBrandsFromManifest() in shared_extension.ts
      when: `sage.brandKey == '${brand.id}'`
    });
  }
}

// 5. Generate activationEvents
const activationEvents = ["onStartupFinished"];
for (const cmd of baseCommands) {
  activationEvents.push(`onCommand:sage.${cmd.id}`);
}
for (const brand of brands) {
  for (const cmd of baseCommands) {
    activationEvents.push(`onCommand:sage.${cmd.id}.${brand.id}`);
  }
}

// 6. Patch package.json (preserve all other fields)
packageJson.activationEvents = activationEvents;
packageJson.contributes.commands = commands;
if (!packageJson.contributes.menus) {
  packageJson.contributes.menus = {};
}
packageJson.contributes.menus.commandPalette = commandPalette;

// 7. Write package.json back
writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2) + "\n");

// Print summary
const totalCommands = commands.length;
const baseCount = baseCommands.length;
const brandCount = brands.length;
console.log(
  `Generated ${totalCommands} commands (${baseCount} base × ${brandCount + 1} variants) in package.json`
);
