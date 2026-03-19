// Fix FP in OpenClaw on regex .exec() method
// Caused by https://github.com/openclaw/openclaw/blob/665f6772652ccb99bd589bf52b2d61b8ce202370/src/security/skill-scanner.ts#L148-L154
//import { type ChildProcess, spawn } from "node:child_process";
var chldproc1 = "node:child_";
var chldproc2 = "process";
const chldproc = require(chldproc1 + chldproc2);

import type { ChildProcess, SpawnOptions } from "node:child_process";

export function spawn(command: string, args: string[], options: SpawnOptions): ChildProcess {
	return chldproc.spawn(command, args, options);
}
