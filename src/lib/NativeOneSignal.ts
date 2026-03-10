import { registerPlugin } from '@capacitor/core';

export interface NativeOneSignalPlugin {
    login(options: { externalId: string }): Promise<void>;
    addTags(options: { tags: Record<string, string> }): Promise<void>;
    removeTags(options: { tags: string[] }): Promise<void>;
}

const NativeOneSignal = registerPlugin<NativeOneSignalPlugin>('NativeOneSignal');

export default NativeOneSignal;
