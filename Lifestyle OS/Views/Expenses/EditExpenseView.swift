//
//  EditExpenseView.swift
//  Lifestyle OS
//
//  Created by Le Ngo My Duyen on 26.12.25.
//

import SwiftUI
internal import Auth


struct EditExpenseView: View {
    @Environment(\.dismiss) private var dismiss
    let expense: Expense
    @ObservedObject var viewModel: ExpenseViewModel
    @EnvironmentObject var authViewModel: AuthViewModel    

    @State private var amount = ""
    @State private var currency = "EUR"
    @State private var expenseDate = Date()
    @State private var category = ""
    @State private var description = ""
    @State private var location = ""
    @State private var item = ""
    @State private var unit = ""
    @State private var unitPrice = ""
    @State private var expireDate = Date()
    @State private var paymentMethod = ""
    @State private var hasExpireDate = false
    @State private var showDuplicateAlert = false

    let currencies = ["EUR", "USD", "GBP", "JPY", "BGN", "CNY", "INR"]
    let categories = ["Food & Drink", "Home", "Rent & Utilities", "Gold/Silver", "ETFs", "Transport", "Telecom", "Crochet", "Fun", "Eating Out", "Work", "Garden", "Other"]
    let paymentMethods = ["Food Voucher", "T212", "Revolut", "UBB", "Paypal", "Curve", "VCB", "Cash", "Other"]

    // MARK: - Calculated Amount

    private var calculatedAmount: String {
        guard let unitInt = Decimal.fromString(unit),
              let unitPriceDecimal = Decimal.fromString(unitPrice),
              unitInt > 0.0 else {
            return "0.00"
        }

        let total = unitPriceDecimal * unitInt

        let formatter = NumberFormatter()
        formatter.numberStyle = .decimal
        formatter.minimumFractionDigits = 2
        formatter.maximumFractionDigits = 2

        return formatter.string(from: total as NSDecimalNumber) ?? "0.00"
    }

    var body: some View {
        NavigationView {
            Form {
                Section("Item Details") {
                    TextField("Item Name", text: $item)

                    HStack {
                        TextField("Quantity", text: $unit)
                            .keyboardType(.decimalPad)

                        Text("×")
                            .foregroundColor(.secondary)

                        TextField("Unit Price", text: $unitPrice)
                            .keyboardType(.decimalPad)
                    }

                    Toggle("Has Expiration Date", isOn: $hasExpireDate)

                    if hasExpireDate {
                        DatePicker(
                            "Expiration Date",
                            selection: $expireDate,
                            displayedComponents: .date
                        )
                    }
                }

                Section("Basic Information") {
                    HStack {
                        Text("Total Amount")
                        Spacer()
                        Text(calculatedAmount)
                            .foregroundColor(.secondary)
                            .font(.system(size: 16, weight: .semibold))
                    }

                    Picker("Currency", selection: $currency) {
                        ForEach(currencies, id: \.self) {
                            Text($0)
                        }
                    }

                    DatePicker(
                        "Date",
                        selection: $expenseDate,
                        displayedComponents: .date
                    )

                    Picker("Category", selection: $category) {
                        Text("Select Category").tag("")
                        ForEach(categories, id: \.self) {
                            Text($0).tag($0)
                        }
                    }
                }

                Section("Additional Information") {
                    TextField("Location", text: $location)

                    Picker("Payment Method", selection: $paymentMethod) {
                        Text("Select Method").tag("")
                        ForEach(paymentMethods, id: \.self) {
                            Text($0).tag($0)
                        }
                    }
                }

                Section("Description") {
                    TextEditor(text: $description)
                        .frame(minHeight: 100)
                }
                
                Section {
                    Button(action: {
                        showDuplicateAlert = true
                    }) {
                        HStack {
                            Image(systemName: "doc.on.doc")
                            Text("Duplicate to Next Month")
                        }
                        .foregroundColor(.blue)
                    }
                }
            }
            .navigationTitle("Edit Expense")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarLeading) {
                    Button("Cancel") {
                        dismiss()
                    }
                }

                ToolbarItem(placement: .navigationBarTrailing) {
                    Button("Save") {
                        updateExpense()
                        
                    }
                    .disabled(unit.isEmpty || unitPrice.isEmpty)
                    .foregroundColor(unit.isEmpty || unitPrice.isEmpty ? .gray : .blue)
                }
            }
            .onAppear {
                loadExpenseData()
            }
            .alert("Duplicate Expense", isPresented: $showDuplicateAlert) {
                Button("Cancel", role: .cancel) { }
                Button("Duplicate") {
                    duplicateToNextMonth()
                }
            } message: {
                Text("This will create a copy of this expense with the date set to next month.")
            }
        }
    }

    // MARK: - Load

    private func loadExpenseData() {
        currency = expense.currency
        expenseDate = expense.expense_date
        category = expense.category ?? ""
        description = expense.description ?? ""
        location = expense.location ?? ""
        item = expense.item ?? ""
        unit = expense.unit.map { String($0) } ?? ""
        unitPrice = expense.unit_price.map { String(format: "%.2f", $0) } ?? ""
        paymentMethod = expense.payment_method ?? ""

        if let expDate = expense.expire_date {
            hasExpireDate = true
            expireDate = expDate
        } else {
            hasExpireDate = false
            expireDate = Date()
        }
    }

    // MARK: - Save

    private func updateExpense() {
        guard let unitInt = Decimal.fromString(unit),
              let unitPriceDecimal = Decimal.fromString(unitPrice) else {
            print("Invalid unit or unit price")
            return
        }
        
        let amountDecimal = unitPriceDecimal * unitInt
        
        let calendar = Calendar.current

        let expenseDateSafe = calendar.noon(for: expenseDate)
        let expireDateSafe = hasExpireDate ? calendar.noon(for: expireDate) : nil

        Task {
            await viewModel.updateExpense(
                id: expense.id,
                amount: amountDecimal,
                currency: currency,
                expenseDate: expenseDateSafe,
                category: category.isEmpty ? nil : category,
                description: description.isEmpty ? nil : description,
                location: location.isEmpty ? nil : location,
                unit: unitInt,
                unitPrice: unitPriceDecimal,
                expireDate: expireDateSafe,
                paymentMethod: paymentMethod.isEmpty ? nil : paymentMethod,
                item: item.isEmpty ? nil : item
            )
                        
            dismiss()
        }
    }
    
    // MARK: - Duplicate
    
    private func duplicateToNextMonth() {
        guard let user = authViewModel.currentUser else {
            print("No current user")
            return
        }
        
        let accountId = user.id
        print("User ID: \(user.id)")
        
        // Parse numeric values
        guard let unitInt = Decimal.fromString(unit),
              let unitPriceDecimal = Decimal.fromString(unitPrice) else {
            print("Invalid unit or unit price")
            return
        }

        // Calculate total amount
        let amountDecimal = unitPriceDecimal * unitInt
        let calendar = Calendar.current
        
        // Add one month to the current expense date
        guard let nextMonthDate = calendar.date(byAdding: .month, value: 1, to: expenseDate) else {
            print("Failed to calculate next month date")
            return
        }
        
        // Create dates at noon to avoid timezone issues
        let nextMonthDateAtNoon = calendar.noon(for: nextMonthDate)
        
        // If there's an expiration date, also move it forward by one month
        let nextExpireDateAtNoon: Date? = {
            if hasExpireDate,
               let calculatedExpireDate = calendar.date(byAdding: .month, value: 1, to: expireDate) {
                return calendar.noon(for: calculatedExpireDate)
            }
            return nil
        }()

        Task {
            await viewModel.addExpense(
                accountId: accountId,
                amount: amountDecimal,
                currency: currency,
                expenseDate: nextMonthDateAtNoon,
                category: category.isEmpty ? nil : category,
                description: description.isEmpty ? nil : description,
                location: location.isEmpty ? nil : location,
                unit: unitInt,
                unitPrice: unitPriceDecimal,
                expireDate: nextExpireDateAtNoon,
                paymentMethod: paymentMethod.isEmpty ? nil : paymentMethod,
                item: item.isEmpty ? nil : item
            )
            
            dismiss()
        }
    }
}
