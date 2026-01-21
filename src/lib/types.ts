export interface Profile {
    id: string;
    username: string;
    full_name: string;
    avatar_url: string | null;
    grade_level?: string;
    role?: 'student' | 'smartboard';
}

export interface Exam {
    id: string;
    subject_id: string;
    title: string;
    uploader_id: string;
    storage_path: string;
    file_name: string;
    created_at: string;
}

export interface ClassMaterial {
    id: string;
    uploader_id: string;
    subject_id: string;
    material_date: string;
    file_name: string;
    storage_path: string;
    lesson_hour?: number;
    grade_level: string; // '12' or '13'
    created_at: string;
    uploader?: Profile; // Joined data
}

export interface Topic {
    id: string;
    owner_id: string;
    subject_id: string;
    semester: string;
    title: string;
    index: number;
    created_at: string;
}

export interface TopicFile {
    id: string;
    topic_id: string;
    file_name: string;
    storage_path: string;
    created_at: string;
}

export interface ChatMessage {
    id: string;
    sender_id: string;
    receiver_id: string;
    content: string;
    message_type: 'text' | 'material_request';
    metadata?: {
        subject?: string;
        topic?: string;
    };
    is_read: boolean;
    created_at: string;
}
