import fs from "node:fs";

const opts = { recursive: true, force: true, maxRetries: 10, retryDelay: 100 };

for (const target of process.argv.slice(2)) {
	fs.rmSync(target, opts);
}
