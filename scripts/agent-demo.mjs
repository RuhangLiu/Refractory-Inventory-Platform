import { runInventoryAgent } from "../agent/assistant.mjs";

const question =
  process.argv.slice(2).join(" ") || "Should we replenish MCB-001 at Chicago, and why?";
const result = await runInventoryAgent(question, { forceLocal: true, persistTrace: false });

console.log("QUESTION");
console.log(question);
console.log("\nANSWER");
console.log(result.answer);
console.log("\nSOURCES");
console.log(JSON.stringify(result.sources, null, 2));
console.log("\nTOOL CALL");
console.log(JSON.stringify(result.tool_call, null, 2));
console.log("\nAUDITABLE TRACE");
console.log(JSON.stringify(result.trace, null, 2));
