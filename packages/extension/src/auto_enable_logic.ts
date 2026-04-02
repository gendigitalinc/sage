/** Prevents auto-enable from racing a window reload that follows a manual disable. */
export const DISABLE_GRACE_MS = 1_000;

export function disabledUntilKey(hostName: string, scope: string): string {
	return `sage.disabledUntil.${hostName}.${scope}`;
}

export function shouldAutoEnable(disabledAt: number | undefined, now: number): boolean {
	return !(disabledAt !== undefined && now - disabledAt < DISABLE_GRACE_MS);
}
