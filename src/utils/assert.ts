export function assert (cond: any, message: string = undefined) {
	if (!cond) {
		throw message || "Assertion Failed!";
	}
};