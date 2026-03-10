const { GoogleGenerativeAI } = require("@google/generative-ai");
require("dotenv").config({ path: ".env.local" });
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || process.env.NEXT_PUBLIC_GEMINI_API_KEY);
async function run() {
    try {
        const models = await genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
        console.log("Model initialized");
    } catch(e) {
        console.error(e);
    }
}
run();
