import type { AgentRuntime } from "./types.js";

export type SageProxyOs = "WINDOWS" | "MACOS" | "LINUX" | string;

export function mapSageProxyOs(platform: NodeJS.Platform): SageProxyOs {
	switch (platform) {
		case "win32":
			return "WINDOWS";
		case "darwin":
			return "MACOS";
		case "linux":
			return "LINUX";
		default:
			return platform;
	}
}

export function mapSageProxyArchitecture(arch: NodeJS.Architecture): string {
	return arch.toUpperCase();
}

export interface SageProxyEnvelope {
	identity: {
		uuid: string;
	};
	product: {
		version_app: string;
	};
	platform: {
		os: SageProxyOs;
		architecture: string;
	};
	agent: {
		agent_runtime: AgentRuntime | string;
		agent_runtime_version: string | undefined;
	};
}

export function buildSageProxyEnvelope(args: {
	iid: string;
	versionApp: string;
	agentRuntime: AgentRuntime | string;
	agentRuntimeVersion?: string;
	platformOs?: SageProxyOs;
	platformArchitecture?: string;
}): SageProxyEnvelope {
	return {
		identity: { uuid: args.iid },
		product: { version_app: args.versionApp },
		platform: {
			os: args.platformOs ?? mapSageProxyOs(process.platform),
			architecture: args.platformArchitecture ?? mapSageProxyArchitecture(process.arch),
		},
		agent: {
			agent_runtime: args.agentRuntime,
			agent_runtime_version: args.agentRuntimeVersion,
		},
	};
}
