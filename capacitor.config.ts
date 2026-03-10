import { CapacitorConfig } from '@capacitor/cli';
import { KeyboardResize, KeyboardStyle } from '@capacitor/keyboard';

const config: CapacitorConfig = {
    appId: 'com.lordleonardlaux.abiturcloud.app',
    appName: 'Abitur Cloud',
    webDir: 'out',
    server: {
        androidScheme: 'https',
        cleartext: true,
        allowNavigation: ['api.abiturcloud.com', '*.abiturcloud.com'],
    },
    ios: {
        contentInset: 'never',
    },
    // Removed includePlugins to allow auto-discovery
    plugins: {
        Keyboard: {
            resize: KeyboardResize.Body,
            style: KeyboardStyle.Dark,
            resizeOnFullScreen: true,
        },
    },
};

export default config;
