'use server';

import { adminClient } from '@/lib/supabase/admin';
import { supabase } from '@/lib/supabase/client'; // Use client for public DB operations if needed, but admin for auth
import { revalidatePath } from 'next/cache';
import fs from 'fs';
import path from 'path';

const logFile = path.join(process.cwd(), 'debug-admin.log');

function log(message: string) {
    const timestamp = new Date().toISOString();
    try {
        fs.appendFileSync(logFile, `[${timestamp}] [AdminActionModule] ${message}\n`);
    } catch (e) {
        console.error('Failed to write to log file:', e);
    }
}

log('Admin Actions Module Loaded');

export async function testAction() {
    log('testAction called');
    return { success: true };
}

export async function approveRequest(userId: string) {
    try {
        console.log(`[AdminAction] ENTRY: approveRequest called for UserID: ${userId}`);
        log(`Approving user: ${userId}`);

        // 1. Update profile to is_approved = true
        const { error: updateError } = await adminClient
            .from('profiles')
            .update({ is_approved: true })
            .eq('id', userId);

        if (updateError) {
            log(`Update error: ${updateError.message}`);
            throw new Error('Fehler beim Aktualisieren des Profils.');
        }

        log(`User ${userId} approved successfully.`);
        revalidatePath('/admin/dashboard');

        return { success: true };

    } catch (err: any) {
        log(`CRITICAL ERROR: ${err.message}`);
        console.error('[AdminAction] Error approving user:', err);
        return { success: false, error: err.message };
    }
}
