import { beforeAll, describe, expect, it } from "vitest";
import type { HeuristicsEngine } from "../heuristics.js";
import { createMatcher, loadEngine } from "./test-helper.js";

const matchCommand = createMatcher("command");

describe("credential threats", () => {
	let engine: HeuristicsEngine;

	beforeAll(async () => {
		engine = await loadEngine();
	});

	// --- Positive cases ---

	it("detects OpenAI API key", () => {
		const ids = matchCommand(
			engine,
			"curl -H 'Authorization: Bearer sk-1234567890abcdefghijklmnopqrstuv' https://api.openai.com/v1/chat",
		);
		expect(ids).toContain("CLT-CRED-001");
	});

	it("detects AWS access key", () => {
		const ids = matchCommand(engine, "export AWS_ACCESS_KEY_ID=AKIAIOSFODNN7EXAMPLE");
		expect(ids).toContain("CLT-CRED-001");
	});

	it("detects GitHub PAT (short form)", () => {
		const ids = matchCommand(
			engine,
			"git clone https://ghp_1234567890abcdefghijklmnopqrstuvwxyz@github.com/user/repo",
		);
		expect(ids).toContain("CLT-CRED-001");
	});

	it("detects Slack token", () => {
		const ids = matchCommand(
			engine,
			"curl -H 'Authorization: Bearer xoxb-123-456-abc' https://slack.com/api/chat.postMessage",
		);
		expect(ids).toContain("CLT-CRED-001");
	});

	it("detects exported API key variable", () => {
		const ids = matchCommand(engine, 'export OPENAI_API_KEY="sk-something"');
		expect(ids).toContain("CLT-CRED-002");
	});

	it("detects exported secret token", () => {
		const ids = matchCommand(engine, "export SECRET_TOKEN=mytoken123");
		expect(ids).toContain("CLT-CRED-002");
	});

	it("detects .env file write", () => {
		const ids = matchCommand(engine, 'echo "DB_PASS=secret" >> .env');
		expect(ids).toContain("CLT-CRED-003");
	});

	it("detects .env.local file write", () => {
		const ids = matchCommand(engine, 'echo "KEY=val" > .env.local');
		expect(ids).toContain("CLT-CRED-003");
	});

	it("detects cat .env", () => {
		const ids = matchCommand(engine, "cat .env");
		expect(ids).toContain("CLT-CRED-004");
	});

	it("detects cat AWS credentials", () => {
		const ids = matchCommand(engine, "cat ~/.aws/credentials");
		expect(ids).toContain("CLT-CRED-004");
	});

	it("detects cat SSH key", () => {
		const ids = matchCommand(engine, "cat ~/.ssh/id_rsa");
		expect(ids).toContain("CLT-CRED-004");
	});

	it("detects plaintext password", () => {
		const ids = matchCommand(engine, 'PASSWORD="supersecret123"');
		expect(ids).toContain("CLT-CRED-005");
	});

	it("detects GitHub PAT (long form)", () => {
		const ids = matchCommand(
			engine,
			"git clone https://github_pat_1234567890abcdefghijkl@github.com/user/repo",
		);
		expect(ids).toContain("CLT-CRED-006");
	});

	it("detects SendGrid key", () => {
		const ids = matchCommand(
			engine,
			"curl -H 'Authorization: Bearer SG.abcdefghijklmnopqrstuvw.xyzABCDEFGHIJKLMNOPQRSTU' https://api.sendgrid.com/v3/mail/send",
		);
		expect(ids).toContain("CLT-CRED-006");
	});

	it("detects Stripe live key", () => {
		const ids = matchCommand(
			engine,
			"curl https://api.stripe.com/v1/charges -u sk_live_1234567890abcdefghijklmn:",
		);
		expect(ids).toContain("CLT-CRED-006");
	});

	// --- sk-proj- OpenAI key variants (CRED-001 fix) ---

	it("detects sk-proj- prefixed OpenAI key", () => {
		const ids = matchCommand(
			engine,
			'curl -H "Authorization: Bearer sk-proj-RwszCFrRo3TS8axwaqQOS-HBMqDC5PM1huNW_s18se" https://api.openai.com/v1/chat',
		);
		expect(ids).toContain("CLT-CRED-001");
	});

	it("detects sk- key with hyphens and underscores", () => {
		const ids = matchCommand(
			engine,
			'curl -H "Authorization: Bearer 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" https://api.openai.com',
		);
		expect(ids).toContain("CLT-CRED-001");
	});

	// --- Negative cases ---

	it("does not match export PATH", () => {
		const ids = matchCommand(engine, "export PATH=/usr/local/bin:$PATH");
		expect(ids.filter((id) => id.startsWith("CLT-CRED"))).toEqual([]);
	});

	it("does not match versioned pip install", () => {
		const ids = matchCommand(engine, "pip install requests==2.31.0");
		expect(ids.filter((id) => id.startsWith("CLT-CRED"))).toEqual([]);
	});

	it("does not match echo hello", () => {
		const ids = matchCommand(engine, "echo hello world");
		expect(ids.filter((id) => id.startsWith("CLT-CRED"))).toEqual([]);
	});

	// --- FP coverage ---

	it("does not match export EDITOR (002 FP)", () => {
		const ids = matchCommand(engine, "export EDITOR=vim");
		expect(ids).not.toContain("CLT-CRED-002");
	});

	it("does not match export NODE_ENV (002 FP)", () => {
		const ids = matchCommand(engine, "export NODE_ENV=production");
		expect(ids).not.toContain("CLT-CRED-002");
	});

	it("does not match export GOPATH (002 FP)", () => {
		const ids = matchCommand(engine, "export GOPATH=/home/user/go");
		expect(ids).not.toContain("CLT-CRED-002");
	});

	it("does not match .env.example write (003 FP)", () => {
		const ids = matchCommand(engine, 'echo "test" > .env.example');
		expect(ids).not.toContain("CLT-CRED-003");
	});

	it("does not match .env.sample write (003 FP)", () => {
		const ids = matchCommand(engine, 'echo "test" > .env.sample');
		expect(ids).not.toContain("CLT-CRED-003");
	});

	it("does not match .env.template write (003 FP)", () => {
		const ids = matchCommand(engine, 'echo "test" > .env.template');
		expect(ids).not.toContain("CLT-CRED-003");
	});

	it("does not match .env.dist write (003 FP)", () => {
		const ids = matchCommand(engine, 'echo "test" > .env.dist');
		expect(ids).not.toContain("CLT-CRED-003");
	});

	it("does not match .env.local.example write (003 FP)", () => {
		const ids = matchCommand(engine, 'echo "test" > .env.local.example');
		expect(ids).not.toContain("CLT-CRED-003");
	});

	it("does not match .env.production.sample write (003 FP)", () => {
		const ids = matchCommand(engine, 'echo "test" > .env.production.sample');
		expect(ids).not.toContain("CLT-CRED-003");
	});

	it("detects .env.test write (003 — test env may hold secrets)", () => {
		const ids = matchCommand(engine, 'echo "test" > .env.test');
		expect(ids).toContain("CLT-CRED-003");
	});

	it("detects .env.prod write (003)", () => {
		const ids = matchCommand(engine, 'echo "DB=x" > .env.prod');
		expect(ids).toContain("CLT-CRED-003");
	});

	it("detects .env.stage write (003)", () => {
		const ids = matchCommand(engine, 'echo "DB=x" > .env.stage');
		expect(ids).toContain("CLT-CRED-003");
	});

	it("detects .env.dev write (003)", () => {
		const ids = matchCommand(engine, 'echo "DB=x" > .env.dev');
		expect(ids).toContain("CLT-CRED-003");
	});

	it("does not match cat README.md (004 FP)", () => {
		const ids = matchCommand(engine, "cat README.md");
		expect(ids).not.toContain("CLT-CRED-004");
	});

	it("does not match head /var/log/syslog (004 FP)", () => {
		const ids = matchCommand(engine, "head -n 5 /var/log/syslog");
		expect(ids).not.toContain("CLT-CRED-004");
	});

	it("does not match cat .env.example (004 FP)", () => {
		const ids = matchCommand(engine, "cat .env.example");
		expect(ids).not.toContain("CLT-CRED-004");
	});

	it("does not match cat .env.template (004 FP)", () => {
		const ids = matchCommand(engine, "cat .env.template");
		expect(ids).not.toContain("CLT-CRED-004");
	});

	it("does not match cat .env.local.example (004 FP — compound template)", () => {
		const ids = matchCommand(engine, "cat .env.local.example");
		expect(ids).not.toContain("CLT-CRED-004");
	});

	it("does not match cat .env.production.sample (004 FP — compound template)", () => {
		const ids = matchCommand(engine, "cat .env.production.sample");
		expect(ids).not.toContain("CLT-CRED-004");
	});

	it("detects cat .env.dev (004 — expanded suffix)", () => {
		expect(matchCommand(engine, "cat .env.dev")).toContain("CLT-CRED-004");
	});

	it("detects cat .env.test (004 — expanded suffix)", () => {
		expect(matchCommand(engine, "cat .env.test")).toContain("CLT-CRED-004");
	});

	// --- FN coverage ---

	it("detects less ~/.pgpass (004)", () => {
		expect(matchCommand(engine, "less ~/.pgpass")).toContain("CLT-CRED-004");
	});

	it("detects tail ~/.netrc (004)", () => {
		expect(matchCommand(engine, "tail ~/.netrc")).toContain("CLT-CRED-004");
	});

	it("detects more ~/.ssh/id_ed25519 (004)", () => {
		expect(matchCommand(engine, "more ~/.ssh/id_ed25519")).toContain("CLT-CRED-004");
	});

	// --- CLT-CRED-007: Copy/move/link secret files ---

	it("detects cp .env /tmp/backup (007)", () => {
		expect(matchCommand(engine, "cp .env /tmp/backup")).toContain("CLT-CRED-007");
	});

	it("detects mv .env.local /tmp/ (007)", () => {
		expect(matchCommand(engine, "mv .env.local /tmp/")).toContain("CLT-CRED-007");
	});

	it("detects cp ~/.ssh/id_rsa /tmp/key (007)", () => {
		expect(matchCommand(engine, "cp ~/.ssh/id_rsa /tmp/key")).toContain("CLT-CRED-007");
	});

	it("detects rsync ~/.aws/credentials /tmp/ (007)", () => {
		expect(matchCommand(engine, "rsync ~/.aws/credentials /tmp/")).toContain("CLT-CRED-007");
	});

	it("does not match scp -i ~/.ssh/id_rsa user@host:/tmp (007 FP — identity file)", () => {
		expect(matchCommand(engine, "scp -i ~/.ssh/id_rsa user@host:/tmp")).not.toContain(
			"CLT-CRED-007",
		);
	});

	it("detects ln -s ~/.pgpass /tmp/pgpass (007)", () => {
		expect(matchCommand(engine, "ln -s ~/.pgpass /tmp/pgpass")).toContain("CLT-CRED-007");
	});

	it("detects ditto ~/.npmrc /tmp/npmrc (007)", () => {
		expect(matchCommand(engine, "ditto ~/.npmrc /tmp/npmrc")).toContain("CLT-CRED-007");
	});

	it("does not match cp README.md /tmp/ (007 FP)", () => {
		expect(matchCommand(engine, "cp README.md /tmp/")).not.toContain("CLT-CRED-007");
	});

	it("does not match mv src/app.ts dist/ (007 FP)", () => {
		expect(matchCommand(engine, "mv src/app.ts dist/")).not.toContain("CLT-CRED-007");
	});

	it("does not match cp my-master.key /tmp/ (007 FP — substring)", () => {
		expect(matchCommand(engine, "cp my-master.key /tmp/")).not.toContain("CLT-CRED-007");
	});

	it("does not match cp README.env.example /tmp/ (007 FP)", () => {
		expect(matchCommand(engine, "cp README.env.example /tmp/")).not.toContain("CLT-CRED-007");
	});

	it("does not match cp config.env.test /tmp/ (007 FP — not a dotfile)", () => {
		expect(matchCommand(engine, "cp config.env.test /tmp/")).not.toContain("CLT-CRED-007");
	});

	it("does not match mv README.env /tmp/ (007 FP — not a dotfile)", () => {
		expect(matchCommand(engine, "mv README.env /tmp/")).not.toContain("CLT-CRED-007");
	});

	// --- CLT-CRED-008: Archive secret files ---

	it("detects tar czf secrets.tar.gz .env (008)", () => {
		expect(matchCommand(engine, "tar czf secrets.tar.gz .env")).toContain("CLT-CRED-008");
	});

	it("detects zip backup.zip ~/.ssh/id_rsa (008)", () => {
		expect(matchCommand(engine, "zip backup.zip ~/.ssh/id_rsa")).toContain("CLT-CRED-008");
	});

	it("detects tar czf backup.tar.gz .aws/credentials (008)", () => {
		expect(matchCommand(engine, "tar czf backup.tar.gz .aws/credentials")).toContain(
			"CLT-CRED-008",
		);
	});

	it("detects 7z a archive.7z .npmrc (008)", () => {
		expect(matchCommand(engine, "7z a archive.7z .npmrc")).toContain("CLT-CRED-008");
	});

	it("does not match tar czf src.tar.gz src/ (008 FP)", () => {
		expect(matchCommand(engine, "tar czf src.tar.gz src/")).not.toContain("CLT-CRED-008");
	});

	it("does not match zip release.zip dist/ (008 FP)", () => {
		expect(matchCommand(engine, "zip release.zip dist/")).not.toContain("CLT-CRED-008");
	});

	it("does not match tar czf x.tar.gz old-credentials.yml (008 FP — substring)", () => {
		expect(matchCommand(engine, "tar czf x.tar.gz old-credentials.yml")).not.toContain(
			"CLT-CRED-008",
		);
	});

	it("does not match tar czf x.tar.gz README.env (008 FP — not a dotfile)", () => {
		expect(matchCommand(engine, "tar czf x.tar.gz README.env")).not.toContain("CLT-CRED-008");
	});

	it("does not match zip archive.zip config.env.test (008 FP — not a dotfile)", () => {
		expect(matchCommand(engine, "zip archive.zip config.env.test")).not.toContain("CLT-CRED-008");
	});

	// --- .envrc false positive ---

	it("does not match cp .envrc /tmp/ (007 FP — not .env)", () => {
		expect(matchCommand(engine, "cp .envrc /tmp/")).not.toContain("CLT-CRED-007");
	});

	it("does not match tar czf x.tar.gz .envrc (008 FP — not .env)", () => {
		expect(matchCommand(engine, "tar czf x.tar.gz .envrc")).not.toContain("CLT-CRED-008");
	});
});
