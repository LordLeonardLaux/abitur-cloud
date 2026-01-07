export interface Subject {
    id: string;
    name: string;
    allowedTypes?: string[];
}

// Removed 'type' property to treat all subjects equally as requested
export const SUBJECTS: Subject[] = [
    { id: 'mathe', name: 'Mathematik', allowedTypes: ['LK', 'GK'] },
    { id: 'deutsch', name: 'Deutsch', allowedTypes: ['LK', 'GK', 'M'] },
    { id: 'englisch', name: 'Englisch', allowedTypes: ['LK', 'GK', 'M'] },
    { id: 'biologie', name: 'Biologie', allowedTypes: ['LK', 'GK', 'A', 'M'] },
    { id: 'geschichte', name: 'Geschichte', allowedTypes: ['LK', 'GK'] },
    { id: 'kunst', name: 'Kunst', allowedTypes: ['LK', 'A'] },
    { id: 'franzoesisch', name: 'Französisch', allowedTypes: ['LK', 'GK', 'M'] },
    { id: 'geographie', name: 'Geographie', allowedTypes: ['LK', 'GK'] },
];

export const SEMESTERS = ['Q1', 'Q2', 'Q3', 'Q4'];

export const SUBJECT_COLORS: Record<string, string> = {
    // Default color for everything since categories are gone
    'default': 'bg-blue-500',
};
