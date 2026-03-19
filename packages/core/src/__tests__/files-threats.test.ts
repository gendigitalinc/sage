import { beforeAll, describe, expect, it } from "vitest";
import type { HeuristicsEngine } from "../heuristics.js";
import { createMatcher, loadEngine } from "./test-helper.js";

const matchFilePath = createMatcher("file_path");

describe("file path threats", () => {
	let engine: HeuristicsEngine;

	beforeAll(async () => {
		engine = await loadEngine();
	});

	// --- System authentication files (CLT-FILE-001) ---

	it("detects /etc/passwd", () => {
		expect(matchFilePath(engine, "/etc/passwd")).toContain("CLT-FILE-001");
	});

	it("detects /etc/shadow", () => {
		expect(matchFilePath(engine, "/etc/shadow")).toContain("CLT-FILE-001");
	});

	it("detects /etc/sudoers", () => {
		expect(matchFilePath(engine, "/etc/sudoers")).toContain("CLT-FILE-001");
	});

	// --- SSH authorized keys (CLT-FILE-002) ---

	it("detects .ssh/authorized_keys (absolute)", () => {
		expect(matchFilePath(engine, "/home/user/.ssh/authorized_keys")).toContain("CLT-FILE-002");
	});

	it("detects .ssh/authorized_keys (tilde)", () => {
		expect(matchFilePath(engine, "~/.ssh/authorized_keys")).toContain("CLT-FILE-002");
	});

	// --- SSH keys and config (CLT-FILE-003) ---

	it("detects .ssh/id_rsa", () => {
		expect(matchFilePath(engine, "/home/user/.ssh/id_rsa")).toContain("CLT-FILE-003");
	});

	it("detects .ssh/id_ed25519", () => {
		expect(matchFilePath(engine, "/home/user/.ssh/id_ed25519")).toContain("CLT-FILE-003");
	});

	it("detects .ssh/config", () => {
		expect(matchFilePath(engine, "/home/user/.ssh/config")).toContain("CLT-FILE-003");
	});

	// --- Shell RC files (CLT-FILE-004) ---

	it("detects .bashrc", () => {
		expect(matchFilePath(engine, "/home/user/.bashrc")).toContain("CLT-FILE-004");
	});

	it("detects .zshrc", () => {
		expect(matchFilePath(engine, "/home/user/.zshrc")).toContain("CLT-FILE-004");
	});

	it("detects .profile", () => {
		expect(matchFilePath(engine, "/home/user/.profile")).toContain("CLT-FILE-004");
	});

	it("detects .bash_profile", () => {
		expect(matchFilePath(engine, "/home/user/.bash_profile")).toContain("CLT-FILE-004");
	});

	it("detects .zprofile", () => {
		expect(matchFilePath(engine, "/home/user/.zprofile")).toContain("CLT-FILE-004");
	});

	it("detects .zshenv", () => {
		expect(matchFilePath(engine, "/home/user/.zshenv")).toContain("CLT-FILE-004");
	});

	// LaunchAgent/LaunchDaemon tests moved to mac-files-threats.test.ts (CLT-MAC-FILE-001)

	// --- Cron (CLT-FILE-006) ---

	it("detects cron.daily", () => {
		expect(matchFilePath(engine, "/etc/cron.daily/cleanup")).toContain("CLT-FILE-006");
	});

	it("detects cron.d", () => {
		expect(matchFilePath(engine, "/etc/cron.d/malicious")).toContain("CLT-FILE-006");
	});

	it("detects /var/spool/cron", () => {
		expect(matchFilePath(engine, "/var/spool/cron/root")).toContain("CLT-FILE-006");
	});

	// --- Systemd (CLT-FILE-007) ---

	it("detects systemd unit file", () => {
		expect(matchFilePath(engine, "/etc/systemd/system/evil.service")).toContain("CLT-FILE-007");
	});

	// --- Credential files (CLT-FILE-008) ---

	it("detects .env file", () => {
		expect(matchFilePath(engine, "/app/.env")).toContain("CLT-FILE-008");
	});

	it("detects .env.local file", () => {
		expect(matchFilePath(engine, "/app/.env.local")).toContain("CLT-FILE-008");
	});

	it("detects .env.production file", () => {
		expect(matchFilePath(engine, "/app/.env.production")).toContain("CLT-FILE-008");
	});

	it("detects .aws/credentials", () => {
		expect(matchFilePath(engine, "/home/user/.aws/credentials")).toContain("CLT-FILE-008");
	});

	it("detects .netrc", () => {
		expect(matchFilePath(engine, "/home/user/.netrc")).toContain("CLT-FILE-008");
	});

	it("detects .pgpass", () => {
		expect(matchFilePath(engine, "/home/user/.pgpass")).toContain("CLT-FILE-008");
	});

	// --- Git hooks (CLT-FILE-009) ---

	it("detects git hook", () => {
		expect(matchFilePath(engine, "/repo/.git/hooks/pre-commit")).toContain("CLT-FILE-009");
	});

	// --- Negative cases ---

	it("does not match normal tmp file", () => {
		const ids = matchFilePath(engine, "/tmp/notes.txt");
		expect(ids.filter((id) => id.startsWith("CLT-FILE"))).toEqual([]);
	});

	it("does not match normal source file", () => {
		const ids = matchFilePath(engine, "src/app.py");
		expect(ids.filter((id) => id.startsWith("CLT-FILE"))).toEqual([]);
	});

	it("does not match normal config file", () => {
		const ids = matchFilePath(engine, "/app/config/settings.json");
		expect(ids.filter((id) => id.startsWith("CLT-FILE"))).toEqual([]);
	});

	it("does not match README", () => {
		const ids = matchFilePath(engine, "/project/README.md");
		expect(ids.filter((id) => id.startsWith("CLT-FILE"))).toEqual([]);
	});

	it("does not match package.json", () => {
		const ids = matchFilePath(engine, "/project/package.json");
		expect(ids.filter((id) => id.startsWith("CLT-FILE"))).toEqual([]);
	});

	// --- FP coverage ---

	it("does not match /var/log/cron.log (006 FP)", () => {
		const ids = matchFilePath(engine, "/var/log/cron.log");
		expect(ids).not.toContain("CLT-FILE-006");
	});

	it("does not match /etc/crontab (006 FP)", () => {
		const ids = matchFilePath(engine, "/etc/crontab");
		expect(ids).not.toContain("CLT-FILE-006");
	});

	it("does not match .env.example (008 FP)", () => {
		const ids = matchFilePath(engine, "/app/.env.example");
		expect(ids).not.toContain("CLT-FILE-008");
	});

	it("does not match config.env.test (008 FP — not a dotfile)", () => {
		const ids = matchFilePath(engine, "/app/config.env.test");
		expect(ids).not.toContain("CLT-FILE-008");
	});

	it("detects .env.test (008 — test env may hold secrets)", () => {
		expect(matchFilePath(engine, "/app/.env.test")).toContain("CLT-FILE-008");
	});

	it("detects .env.prod (008)", () => {
		expect(matchFilePath(engine, "/app/.env.prod")).toContain("CLT-FILE-008");
	});

	it("detects .env.dev (008)", () => {
		expect(matchFilePath(engine, "/app/.env.dev")).toContain("CLT-FILE-008");
	});

	it("detects .env.stage (008)", () => {
		expect(matchFilePath(engine, "/app/.env.stage")).toContain("CLT-FILE-008");
	});

	it("does not match .git/config (009 FP)", () => {
		const ids = matchFilePath(engine, "/repo/.git/config");
		expect(ids).not.toContain("CLT-FILE-009");
	});

	// --- FN coverage ---

	it("detects /etc/cron.hourly (006)", () => {
		expect(matchFilePath(engine, "/etc/cron.hourly/task")).toContain("CLT-FILE-006");
	});

	it("detects /etc/cron.weekly (006)", () => {
		expect(matchFilePath(engine, "/etc/cron.weekly/report")).toContain("CLT-FILE-006");
	});

	it("detects /etc/cron.monthly (006)", () => {
		expect(matchFilePath(engine, "/etc/cron.monthly/cleanup")).toContain("CLT-FILE-006");
	});

	it("detects .env.staging (008)", () => {
		expect(matchFilePath(engine, "/app/.env.staging")).toContain("CLT-FILE-008");
	});

	it("detects .env.development (008)", () => {
		expect(matchFilePath(engine, "/app/.env.development")).toContain("CLT-FILE-008");
	});

	// --- Android signing files (CLT-FILE-010) ---

	it("detects key.properties (010)", () => {
		expect(matchFilePath(engine, "key.properties")).toContain("CLT-FILE-010");
	});

	it("detects release.keystore (010)", () => {
		expect(matchFilePath(engine, "release.keystore")).toContain("CLT-FILE-010");
	});

	it("detects app/my-release-key.jks (010)", () => {
		expect(matchFilePath(engine, "app/my-release-key.jks")).toContain("CLT-FILE-010");
	});

	it("does not match app/build.gradle (010 FP)", () => {
		expect(matchFilePath(engine, "app/build.gradle")).not.toContain("CLT-FILE-010");
	});

	// --- Firebase config (CLT-FILE-011) ---

	it("detects app/google-services.json (011)", () => {
		expect(matchFilePath(engine, "app/google-services.json")).toContain("CLT-FILE-011");
	});

	it("detects ios/GoogleService-Info.plist (011)", () => {
		expect(matchFilePath(engine, "ios/GoogleService-Info.plist")).toContain("CLT-FILE-011");
	});

	it("does not match google-analytics.json (011 FP)", () => {
		expect(matchFilePath(engine, "google-analytics.json")).not.toContain("CLT-FILE-011");
	});

	// --- Cloud provider creds (CLT-FILE-012) ---

	it("detects application_default_credentials.json (012)", () => {
		expect(
			matchFilePath(engine, "~/.config/gcloud/application_default_credentials.json"),
		).toContain("CLT-FILE-012");
	});

	it("detects ~/.azure/accessTokens.json (012)", () => {
		expect(matchFilePath(engine, "~/.azure/accessTokens.json")).toContain("CLT-FILE-012");
	});

	it("detects ~/.config/doctl/config.yaml (012)", () => {
		expect(matchFilePath(engine, "~/.config/doctl/config.yaml")).toContain("CLT-FILE-012");
	});

	it("does not match ~/.config/gcloud/logs/ (012 FP)", () => {
		expect(matchFilePath(engine, "~/.config/gcloud/logs/")).not.toContain("CLT-FILE-012");
	});

	// --- Package manager tokens (CLT-FILE-013) ---

	it("detects .npmrc (013)", () => {
		expect(matchFilePath(engine, ".npmrc")).toContain("CLT-FILE-013");
	});

	it("detects .pypirc (013)", () => {
		expect(matchFilePath(engine, ".pypirc")).toContain("CLT-FILE-013");
	});

	it("detects ~/.gem/credentials (013)", () => {
		expect(matchFilePath(engine, "~/.gem/credentials")).toContain("CLT-FILE-013");
	});

	it("detects ~/.cargo/credentials.toml (013)", () => {
		expect(matchFilePath(engine, "~/.cargo/credentials.toml")).toContain("CLT-FILE-013");
	});

	it("detects ~/.docker/config.json (013)", () => {
		expect(matchFilePath(engine, "~/.docker/config.json")).toContain("CLT-FILE-013");
	});

	it("does not match package.json (013 FP)", () => {
		expect(matchFilePath(engine, "package.json")).not.toContain("CLT-FILE-013");
	});

	// --- Terraform state (CLT-FILE-014) ---

	it("detects terraform.tfstate (014)", () => {
		expect(matchFilePath(engine, "terraform.tfstate")).toContain("CLT-FILE-014");
	});

	it("detects terraform.tfstate.backup (014)", () => {
		expect(matchFilePath(engine, "terraform.tfstate.backup")).toContain("CLT-FILE-014");
	});

	it("detects variables.tfvars (014)", () => {
		expect(matchFilePath(engine, "variables.tfvars")).toContain("CLT-FILE-014");
	});

	it("detects variables.tfvars.json (014)", () => {
		expect(matchFilePath(engine, "variables.tfvars.json")).toContain("CLT-FILE-014");
	});

	it("does not match main.tf (014 FP)", () => {
		expect(matchFilePath(engine, "main.tf")).not.toContain("CLT-FILE-014");
	});

	// --- Secrets/vault (CLT-FILE-015) ---

	it("detects config/master.key (015)", () => {
		expect(matchFilePath(engine, "config/master.key")).toContain("CLT-FILE-015");
	});

	it("detects config/credentials.yml.enc (015)", () => {
		expect(matchFilePath(engine, "config/credentials.yml.enc")).toContain("CLT-FILE-015");
	});

	it("detects config/secrets.yml (015)", () => {
		expect(matchFilePath(engine, "config/secrets.yml")).toContain("CLT-FILE-015");
	});

	it("detects group_vars/vault.yml (015)", () => {
		expect(matchFilePath(engine, "group_vars/vault.yml")).toContain("CLT-FILE-015");
	});

	it("detects .vault-pass (015)", () => {
		expect(matchFilePath(engine, ".vault-pass")).toContain("CLT-FILE-015");
	});

	it("detects .vault-token (015)", () => {
		expect(matchFilePath(engine, ".vault-token")).toContain("CLT-FILE-015");
	});

	it("does not match config/database.yml (015 FP)", () => {
		expect(matchFilePath(engine, "config/database.yml")).not.toContain("CLT-FILE-015");
	});

	// --- Private keys/certs (CLT-FILE-016) ---

	it("detects server.pem (016)", () => {
		expect(matchFilePath(engine, "server.pem")).toContain("CLT-FILE-016");
	});

	it("detects cert.p12 (016)", () => {
		expect(matchFilePath(engine, "cert.p12")).toContain("CLT-FILE-016");
	});

	it("detects signing.pfx (016)", () => {
		expect(matchFilePath(engine, "signing.pfx")).toContain("CLT-FILE-016");
	});

	it("detects AuthKey_ABC123.p8 (016)", () => {
		expect(matchFilePath(engine, "AuthKey_ABC123.p8")).toContain("CLT-FILE-016");
	});

	it("does not match cert.crt (016 FP)", () => {
		expect(matchFilePath(engine, "cert.crt")).not.toContain("CLT-FILE-016");
	});

	it("does not match data.json (016 FP)", () => {
		expect(matchFilePath(engine, "data.json")).not.toContain("CLT-FILE-016");
	});

	// --- Kubeconfig (CLT-FILE-017) ---

	it("detects ~/.kube/config (017)", () => {
		expect(matchFilePath(engine, "~/.kube/config")).toContain("CLT-FILE-017");
	});

	it("detects kubeconfig (017)", () => {
		expect(matchFilePath(engine, "kubeconfig")).toContain("CLT-FILE-017");
	});

	it("detects kubeconfig.yaml (017)", () => {
		expect(matchFilePath(engine, "kubeconfig.yaml")).toContain("CLT-FILE-017");
	});

	it("does not match kube-system.yaml (017 FP)", () => {
		expect(matchFilePath(engine, "kube-system.yaml")).not.toContain("CLT-FILE-017");
	});

	// --- Build system creds (CLT-FILE-018) ---

	it("detects ~/.m2/settings.xml (018)", () => {
		expect(matchFilePath(engine, "~/.m2/settings.xml")).toContain("CLT-FILE-018");
	});

	it("detects gradle.properties (018)", () => {
		expect(matchFilePath(engine, "gradle.properties")).toContain("CLT-FILE-018");
	});

	it("does not match local.properties (018 FP — too noisy for Android projects)", () => {
		expect(matchFilePath(engine, "local.properties")).not.toContain("CLT-FILE-018");
	});

	it("does not match build.gradle (018 FP)", () => {
		expect(matchFilePath(engine, "build.gradle")).not.toContain("CLT-FILE-018");
	});

	// --- Shell/REPL history (CLT-FILE-019) ---

	it("detects .bash_history (019)", () => {
		expect(matchFilePath(engine, ".bash_history")).toContain("CLT-FILE-019");
	});

	it("detects .zsh_history (019)", () => {
		expect(matchFilePath(engine, ".zsh_history")).toContain("CLT-FILE-019");
	});

	it("detects .mysql_history (019)", () => {
		expect(matchFilePath(engine, ".mysql_history")).toContain("CLT-FILE-019");
	});

	it("detects .python_history (019)", () => {
		expect(matchFilePath(engine, ".python_history")).toContain("CLT-FILE-019");
	});

	it("detects .node_repl_history (019)", () => {
		expect(matchFilePath(engine, ".node_repl_history")).toContain("CLT-FILE-019");
	});

	it("detects .psql_history (019)", () => {
		expect(matchFilePath(engine, ".psql_history")).toContain("CLT-FILE-019");
	});

	it("detects .irb_history (019)", () => {
		expect(matchFilePath(engine, ".irb_history")).toContain("CLT-FILE-019");
	});

	it("does not match .bash_profile (019 FP)", () => {
		expect(matchFilePath(engine, ".bash_profile")).not.toContain("CLT-FILE-019");
	});

	// --- JetBrains DB creds (CLT-FILE-020) ---

	it("detects .idea/dataSources.xml (020)", () => {
		expect(matchFilePath(engine, ".idea/dataSources.xml")).toContain("CLT-FILE-020");
	});

	it("detects .idea/dataSources/local.xml (020)", () => {
		expect(matchFilePath(engine, ".idea/dataSources/local.xml")).toContain("CLT-FILE-020");
	});

	it("does not match .idea/workspace.xml (020 FP)", () => {
		expect(matchFilePath(engine, ".idea/workspace.xml")).not.toContain("CLT-FILE-020");
	});
});
