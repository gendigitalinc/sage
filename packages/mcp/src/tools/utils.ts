export function textResult(text: string, isError?: boolean) {
	const result: { content: { type: "text"; text: string }[]; isError?: boolean } = {
		content: [{ type: "text" as const, text }],
	};
	if (isError) result.isError = true;
	return result;
}
