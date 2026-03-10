#import <Foundation/Foundation.h>
#import <Capacitor/Capacitor.h>

CAP_PLUGIN(DocumentScannerPlugin, "DocumentScanner",
    CAP_PLUGIN_METHOD(scanDocument, CAPPluginReturnPromise);
)
