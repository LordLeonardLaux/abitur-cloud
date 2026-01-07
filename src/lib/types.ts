export interface Profile {
    id: string;
    username: string;
    full_name: string;
    avatar_url: string | null;
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
