import Foundation
import Capacitor
import VisionKit
import PDFKit

@objc(DocumentScannerPlugin)
public class DocumentScannerPlugin: CAPPlugin, VNDocumentCameraViewControllerDelegate {
    
    private var savedCall: CAPPluginCall?
    
    @objc func scanDocument(_ call: CAPPluginCall) {
        self.savedCall = call
        
        DispatchQueue.main.async {
            guard VNDocumentCameraViewController.isSupported else {
                call.reject("Document scanning is not available on this device")
                return
            }
            
            let scannerVC = VNDocumentCameraViewController()
            scannerVC.delegate = self
            
            if let viewController = self.bridge?.viewController {
                viewController.present(scannerVC, animated: true)
            } else {
                call.reject("Unable to present scanner")
            }
        }
    }
    
    // MARK: - VNDocumentCameraViewControllerDelegate
    
    public func documentCameraViewController(_ controller: VNDocumentCameraViewController, didFinishWith scan: VNDocumentCameraScan) {
        controller.dismiss(animated: true)
        
        guard let call = self.savedCall else { return }
        
        // Create a PDF from all scanned pages with compression and proper A4 sizing
        let tempDir = FileManager.default.temporaryDirectory
        let fileName = "scan_\(Int(Date().timeIntervalSince1970)).pdf"
        let fileURL = tempDir.appendingPathComponent(fileName)

        // A4 size in points (72 points per inch): 8.27 x 11.69 inches -> ~595 x 842 points
        let a4Size = CGSize(width: 595.2, height: 841.8)
        let pageRect = CGRect(origin: .zero, size: a4Size)
        let format = UIGraphicsPDFRendererFormat()
        let renderer = UIGraphicsPDFRenderer(bounds: pageRect, format: format)

        do {
            try renderer.writePDF(to: fileURL) { context in
                for pageIndex in 0..<scan.pageCount {
                    context.beginPage()
                    let image = scan.imageOfPage(at: pageIndex)
                    
                    // Keep aspect ratio
                    let widthRatio = a4Size.width / image.size.width
                    let heightRatio = a4Size.height / image.size.height
                    let scaleFactor = min(widthRatio, heightRatio)
                    
                    let scaledSize = CGSize(
                        width: image.size.width * scaleFactor,
                        height: image.size.height * scaleFactor
                    )
                    
                    // Center image on A4
                    let xOffset = (a4Size.width - scaledSize.width) / 2.0
                    let yOffset = (a4Size.height - scaledSize.height) / 2.0
                    let drawRect = CGRect(origin: CGPoint(x: xOffset, y: yOffset), size: scaledSize)
                    
                    // Compress image specifically to reduce PDF bloat
                    if let jpegData = image.jpegData(compressionQuality: 0.7),
                       let compressedImage = UIImage(data: jpegData) {
                        compressedImage.draw(in: drawRect)
                    } else {
                        image.draw(in: drawRect)
                    }
                }
            }
            
            let pdfData = try Data(contentsOf: fileURL)
            let base64String = pdfData.base64EncodedString()
            
            call.resolve([
                "filePath": fileURL.absoluteString,
                "fileName": fileName,
                "pageCount": scan.pageCount,
                "base64Data": base64String,
                "mimeType": "application/pdf"
            ])
        } catch {
            call.reject("Failed to create or save scanned PDF: \(error.localizedDescription)")
        }
        
        self.savedCall = nil
    }
    
    public func documentCameraViewControllerDidCancel(_ controller: VNDocumentCameraViewController) {
        controller.dismiss(animated: true)
        self.savedCall?.reject("User cancelled scanning")
        self.savedCall = nil
    }
    
    public func documentCameraViewController(_ controller: VNDocumentCameraViewController, didFailWithError error: Error) {
        controller.dismiss(animated: true)
        self.savedCall?.reject("Scanning failed: \(error.localizedDescription)")
        self.savedCall = nil
    }
}
