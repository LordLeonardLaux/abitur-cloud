import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

export function formatGrade(grade: string | number) {
    const numericGrade = typeof grade === 'string' ? parseInt(grade, 10) : grade;
    if (isNaN(numericGrade)) return grade.toString();

    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth(); // 0-indexed

    // School year ends in summer (roughly month 7/August)
    const schoolYearEndingYear = currentMonth < 7 ? currentYear : currentYear + 1;

    // Grade 13 graduates in schoolYearEndingYear
    // Grade 12 graduates in schoolYearEndingYear + 1
    const graduationYear = schoolYearEndingYear + (13 - numericGrade);

    const birthYearStart = (graduationYear - 20) % 100;
    const birthYearEnd = (graduationYear - 19) % 100;

    const pad = (n: number) => n.toString().padStart(2, '0');

    return `${numericGrade} (${pad(birthYearStart)}/${pad(birthYearEnd)})`;
}
