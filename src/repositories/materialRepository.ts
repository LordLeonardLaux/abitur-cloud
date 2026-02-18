/**
 * Material Repository
 * ====================
 * Data Access Layer - Handles teacher materials and class materials.
 */

import { TeacherMaterial, ClassMaterial } from '@/lib/types';
import { supabaseFetch, supabase } from './baseRepository';

// ============================================================================
// TEACHER MATERIALS
// ============================================================================

/**
 * Fetches teacher materials by teacher ID.
 */
export async function getTeacherMaterialsByTeacherId(
    teacherId: string,
    limit: number = 10
): Promise<TeacherMaterial[]> {
    const materials = await supabaseFetch<TeacherMaterial[]>(
        `teacher_materials?teacher_id=eq.${teacherId}&order=created_at.desc&limit=${limit}`
    );
    return materials || [];
}

/**
 * Fetches teacher materials by subject and semester.
 */
export async function getTeacherMaterialsBySubject(
    subjectId: string,
    semester?: string
): Promise<TeacherMaterial[]> {
    let query = `teacher_materials?subject_id=eq.${subjectId}&order=created_at.desc`;

    if (semester) {
        query += `&semester=eq.${semester}`;
    }

    const materials = await supabaseFetch<TeacherMaterial[]>(query);
    return materials || [];
}

/**
 * Fetches teacher materials with joined teacher profile.
 */
export async function getTeacherMaterialsWithProfile(
    subjectId: string,
    semester: string
): Promise<TeacherMaterial[]> {
    const { data, error } = await supabase
        .from('teacher_materials')
        .select('*, teacher:profiles(*)')
        .eq('subject_id', subjectId)
        .eq('semester', semester)
        .order('created_at', { ascending: false });

    if (error) {
        console.error('[MaterialRepository] Error fetching materials with profile:', error);
        return [];
    }

    return data || [];
}

/**
 * Fetches teacher materials for a specific date (calendar view).
 */
export async function getTeacherMaterialsByDate(
    subjectId: string,
    date: string,
    gradeLevel?: string
): Promise<TeacherMaterial[]> {
    let query = `teacher_materials?subject_id=eq.${subjectId}&material_date=eq.${date}&order=lesson_hour.asc`;

    if (gradeLevel) {
        query += `&grade_level=eq.${gradeLevel}`;
    }

    const materials = await supabaseFetch<TeacherMaterial[]>(query);
    return materials || [];
}

// ============================================================================
// CLASS MATERIALS (Student uploads)
// ============================================================================

/**
 * Fetches class materials by date and subject.
 */
export async function getClassMaterialsByDate(
    subjectId: string,
    date: string,
    gradeLevel: string
): Promise<ClassMaterial[]> {
    const materials = await supabaseFetch<ClassMaterial[]>(
        `class_materials?subject_id=eq.${subjectId}&material_date=eq.${date}&grade_level=eq.${gradeLevel}&order=lesson_hour.asc`
    );
    return materials || [];
}

// ============================================================================
// STORAGE OPERATIONS
// ============================================================================

/**
 * Uploads a file to teacher-materials bucket.
 */
export async function uploadTeacherMaterialFile(
    file: File,
    storagePath: string
): Promise<{ path: string; error: Error | null }> {
    const { data, error } = await supabase.storage
        .from('teacher-materials')
        .upload(storagePath, file);

    if (error) {
        return { path: '', error };
    }

    return { path: data.path, error: null };
}

/**
 * Creates a teacher material record in the database.
 */
export async function createTeacherMaterial(
    material: Omit<TeacherMaterial, 'id' | 'created_at' | 'teacher'>
): Promise<TeacherMaterial | null> {
    const { data, error } = await supabase
        .from('teacher_materials')
        .insert(material)
        .select()
        .single();

    if (error) {
        console.error('[MaterialRepository] Error creating material:', error);
        return null;
    }

    return data;
}

/**
 * Gets a signed URL for a material file.
 */
export async function getMaterialSignedUrl(
    storagePath: string,
    bucket: string = 'teacher-materials'
): Promise<string | null> {
    const { data, error } = await supabase.storage
        .from(bucket)
        .createSignedUrl(storagePath, 3600); // 1 hour expiry

    if (error) {
        console.error('[MaterialRepository] Error creating signed URL:', error);
        return null;
    }

    return data.signedUrl;
}
