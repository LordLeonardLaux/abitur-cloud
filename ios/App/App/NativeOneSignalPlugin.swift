import Foundation
import Capacitor
import OneSignalFramework

@objc(NativeOneSignalPlugin)
public class NativeOneSignalPlugin: CAPPlugin {
    
    @objc func login(_ call: CAPPluginCall) {
        guard let externalId = call.getString("externalId") else {
            call.reject("Must provide an externalId")
            return
        }
        
        OneSignal.login(externalId)
        print("[NativeOneSignalPlugin] Logged in with externalId: \(externalId)")
        call.resolve()
    }
    
    @objc func addTags(_ call: CAPPluginCall) {
        guard let tags = call.getObject("tags") as? [String: String] else {
            call.reject("Must provide tags object")
            return
        }
        
        OneSignal.User.addTags(tags)
        print("[NativeOneSignalPlugin] Added tags: \(tags)")
        call.resolve()
    }
    
    @objc func removeTags(_ call: CAPPluginCall) {
        guard let tags = call.getArray("tags", String.self) else {
            call.reject("Must provide array of tag keys")
            return
        }
        
        OneSignal.User.removeTags(tags)
        print("[NativeOneSignalPlugin] Removed tags: \(tags)")
        call.resolve()
    }
}
