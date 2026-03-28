// ReceiptScannerViewModel.swift

import Foundation
import UIKit
import SwiftUI
import Combine

@MainActor
class ReceiptScannerViewModel: ObservableObject {
    @Published var scannedReceipt: ScannedReceipt?
    @Published var isScanning = false
    @Published var isSaving = false
    @Published var errorMessage: String?
    @Published var showSuccess = false
    
    private let scannerService = ReceiptScannerService()
    private let expenseService = ExpenseService()
    
    func scanReceipt(from image: UIImage) async {
        isScanning = true
        errorMessage = nil
        
        do {
            // Gemini API now handles OCR + translation in one call
            let receipt = try await scannerService.scanReceipt(from: image)
            scannedReceipt = receipt
            
            print("✅ Receipt scanned and translated by Gemini")
            print("   Store: \(receipt.storeName ?? "Unknown")")
            print("   Items: \(receipt.items.count)")
            print("   Total: \(receipt.total) \(receipt.currency)")
            
        } catch {
            print("❌ Scanning error: \(error.localizedDescription)")
            errorMessage = error.localizedDescription
        }
        
        isScanning = false
    }
    
    func updateItem(at index: Int, name: String?, amount: String?, category: String?) {
        guard var receipt = scannedReceipt, index < receipt.items.count else { return }
        
        if let name = name {
            receipt.items[index].translatedName = name
        }
        
        if let amountStr = amount, let amountValue = Decimal(string: amountStr) {
            receipt.items[index].amount = amountValue
        }
        
        if let category = category {
            receipt.items[index].category = category
        }
        
        // Recalculate total
        receipt.total = receipt.items.reduce(0) { $0 + $1.amount }
        
        scannedReceipt = receipt
    }
    
    func removeItem(at index: Int) {
        guard var receipt = scannedReceipt, index < receipt.items.count else { return }
        receipt.items.remove(at: index)
        
        // Recalculate total
        receipt.total = receipt.items.reduce(0) { $0 + $1.amount }
        
        scannedReceipt = receipt
    }
    
    func saveToExpenses(accountId: UUID) async {
        print("inside saveToExpenses")
        
        guard let receipt = scannedReceipt else { return }
        
        isSaving = true
        errorMessage = nil
        
        do {
            _ = try await expenseService.createExpensesFromReceipt(
                accountId: accountId,
                receipt: receipt,
                items: receipt.items
            )
            
            showSuccess = true
            
            // Reset after short delay
            try? await Task.sleep(nanoseconds: 1_000_000_000)
            scannedReceipt = nil
            
        } catch {
            errorMessage = error.localizedDescription
        }
        
        isSaving = false
    }
    
    func reset() {
        scannedReceipt = nil
        errorMessage = nil
        showSuccess = false
    }
}
