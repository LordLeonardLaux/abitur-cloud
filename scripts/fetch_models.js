require('dotenv').config({ path: '.env.local' });

async function checkModels() {
    const apiKey = process.env.GEMINI_API_KEY || process.env.NEXT_PUBLIC_GEMINI_API_KEY;
    console.log("Using API Key starting with:", apiKey?.substring(0, 10));
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
    const data = await res.json();
    console.log("Models:", data.models?.filter(m => m.name.includes("gemini")).map(m => m.name));
}

checkModels();
