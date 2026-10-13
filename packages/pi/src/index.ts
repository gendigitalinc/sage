/**
 * Sage pi connector — extension entry point.
 *
 * pi loads the default-exported factory (via `pi install`, `pi -e`, or an
 * extensions directory) and calls it with its `ExtensionAPI`.
 */

import { resolve } from "node:path";
import {
	createOperationalLogger,
	loadConfigSync,
	registerHookHandlers,
	resolveBranding,
} from "@gendigital/sage-core";
import { mapToolCall } from "./extractors.js";
import type { ExtensionFactory } from "./pi-types.js";

/**
 * esbuild bundles this file into `dist/index.cjs`, so `__dirname` is `dist/`
 * and the package root (holding `resources/`, synced at build time) sits one
 * level up — however the host loaded the package.
 */
const packageRoot = resolve(__dirname, "..");

const factory: ExtensionFactory = (pi) => {
	const config = loadConfigSync();
	const logger = createOperationalLogger(config.operational_logging, "pi").forComponent(
		"extension",
	);
	// Resolve branding at registration time so the first verdict is branded.
	const branding = resolveBranding(config.brand_key, logger);

	registerHookHandlers(pi, {
		agentRuntime: "pi",
		adapter: { mapToolCall },
		packageRoot,
		logger,
		branding,
	});

	logger.debug(`${branding.name} extension registered`, { packageRoot });
};

export default factory;
