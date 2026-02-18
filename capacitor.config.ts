import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
    appId: 'com.lordleonardlaux.abiturcloud.app',
    appName: 'Abitur Cloud',
    webDir: 'out',
    server: {
        androidScheme: 'https'
    },
    ios: {
        contentInset: 'never'
    },
    plugins: {
        Keyboard: {
            resize: 'body',
            style: 'dark',
            resizeOnFullScreen: true,
        },
    },
};

export default config;
