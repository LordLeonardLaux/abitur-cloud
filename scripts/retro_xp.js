const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env' });

const supabaseUrl = process.env.SUPABASE_PUBLIC_URL || 'https://api.abiturcloud.com';
const supabaseKey = process.env.SERVICE_ROLE_KEY;

if (!supabaseKey) {
    console.error("❌ SERVICE_ROLE_KEY fehlt in .env. Abbruch.");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
    console.log("🚀 Starte Retroaktive XP-Berechnung...");

    try {
        const userXpMap = {}; // { userId: { uploads: 0, newXp: 0 } }

        // 1. Topic Files (Individuelle Fächer)
        console.log("Lade Topic Files...");
        const { data: topicFiles, error: tfError } = await supabase.from('topic_files').select('storage_path');
        if (tfError) throw tfError;

        let topicFileCount = 0;
        for (const file of topicFiles) {
            if (!file.storage_path) continue;
            const parts = file.storage_path.split('/');
            if (parts.length > 0) {
                // UID is usually the first part
                const userId = parts[0];
                // simple validation to check if it looks like a uuid
                if (userId.length === 36 && userId.includes('-')) {
                    userXpMap[userId] = userXpMap[userId] || { uploads: 0, newXp: 0 };
                    userXpMap[userId].uploads++;
                    userXpMap[userId].newXp += 5;
                    topicFileCount++;
                }
            }
        }
        console.log(`✅ ${topicFileCount} Topic Files für User zugeordnet.`);

        // 2. Class Materials (Klassen Uploads)
        console.log("Lade Class Materials...");
        const { data: classMaterials, error: cmError } = await supabase.from('class_materials').select('uploader_id');
        if (cmError) throw cmError;

        let classMatCount = 0;
        for (const material of classMaterials) {
            if (!material.uploader_id) continue;
            const userId = material.uploader_id;
            userXpMap[userId] = userXpMap[userId] || { uploads: 0, newXp: 0 };
            userXpMap[userId].uploads++;
            userXpMap[userId].newXp += 5;
            classMatCount++;
        }
        console.log(`✅ ${classMatCount} Class Materials für User zugeordnet.`);

        // 3. User updaten
        const userIds = Object.keys(userXpMap);
        console.log(`\nEs wurden ${userIds.length} Nutzer gefunden, die Materialien hochgeladen haben.\n`);

        for (const userId of userIds) {
            const stats = userXpMap[userId];
            console.log(`- User ${userId.substring(0, 8)}... bekommt ${stats.newXp} XP für ${stats.uploads} Uploads.`);

            // Get current XP just to be safe (if they already have some)
            const { data: profile } = await supabase.from('profiles').select('xp').eq('id', userId).single();
            const currentXp = profile?.xp || 0;

            const { error: updateError } = await supabase
                .from('profiles')
                .update({ xp: currentXp + stats.newXp })
                .eq('id', userId);

            if (updateError) {
                console.error(`Fehler beim Update von User ${userId}:`, updateError.message);
            }
        }

        console.log("\n🎉 Alle XP wurden erfolgreich vergeben!");

    } catch (err) {
        console.error("❌ Schwerer Fehler:", err);
    }
}

run();
