//
//  README.md
//  Lifestyle OS
//
//  Created by Le Ngo My Duyen on 23.12.25.
//

# Kitchen Inventory App

A comprehensive SwiftUI iOS app for managing kitchen inventory, shopping lists, and expenses with Supabase backend.

## Features

- **Inventory Management**: Track food items, quantities, and units
- **Shopping Lists**: Create and manage multiple shopping lists with item tracking
- **Expense Tracking**: Record and categorize kitchen-related expenses
- **Multi-Account Support**: Share inventory with household members
- **Real-time Sync**: All data synced via Supabase

## Project Structure

```
KitchenInventory/
├── KitchenInventoryApp.swift          # App entry point
├── Config/
│   └── SupabaseConfig.swift           # Supabase configuration
├── Models/
│   ├── Account.swift                  # Account models
│   ├── InventoryItem.swift            # Inventory item model
│   ├── ShoppingList.swift             # Shopping list models
│   ├── Expense.swift                  # Expense model
│   └── Enums.swift                    # Shared enums
├── Services/
│   ├── SupabaseService.swift          # Supabase client setup
│   ├── AuthService.swift              # Authentication
│   ├── InventoryService.swift         # Inventory CRUD
│   ├── ShoppingListService.swift      # Shopping list CRUD
│   └── ExpenseService.swift           # Expense CRUD
├── ViewModels/
│   ├── AuthViewModel.swift            # Auth state management
│   ├── InventoryViewModel.swift       # Inventory state
│   ├── ShoppingListViewModel.swift    # Shopping list state
│   └── ExpenseViewModel.swift         # Expense state
└── Views/
    ├── ContentView.swift              # Main view
    ├── Auth/
    │   ├── LoginView.swift            # Login screen
    │   └── SignUpView.swift           # Registration
    ├── Inventory/
    │   ├── InventoryListView.swift    # List all items
    │   ├── InventoryDetailView.swift  # Item details
    │   └── AddInventoryItemView.swift # Add new item
    ├── ShoppingList/
    │   ├── ShoppingListsView.swift    # All lists
    │   ├── ShoppingListDetailView.swift # List items
    │   └── AddShoppingListItemView.swift # Add item
    └── Expenses/
        ├── ExpenseListView.swift      # All expenses
        └── AddExpenseView.swift       # Add expense
```

## Setup Instructions

### 1. Install Dependencies

Add the Supabase Swift package to your Xcode project:

1. Open your project in Xcode
2. Go to File → Add Package Dependencies
3. Enter: `https://github.com/supabase/supabase-swift.git`
4. Select "Up to Next Major Version" with version 2.0.0

### 2. Configure Supabase

1. Create a Supabase project at https://supabase.com
2. Run the provided SQL schema in your Supabase SQL editor
3. Update `Config/SupabaseConfig.swift` with your credentials:

```swift
struct SupabaseConfig {
    static let url = URL(string: "YOUR_SUPABASE_PROJECT_URL")!
    static let anonKey = "YOUR_SUPABASE_ANON_KEY"
}
```

### 3. Firebase AI Logic (Receipt Scanning)

Receipt scanning sends OCR text to Gemini through Firebase AI Logic (`Services/ReceiptScannerService.swift`).

- **Google account:** `lengomyduyen@gmail.com`
- **Firebase project ID:** `lifestyleos` (from `GoogleService-Info.plist`)
- **API provider:** Gemini Developer API (`FirebaseAI.firebaseAI(backend: .googleAI())`)

Dashboards:

| What | URL |
|------|-----|
| Firebase AI Logic | https://console.firebase.google.com/project/lifestyleos/ailogic |
| Project overview | https://console.firebase.google.com/project/lifestyleos/overview |
| App Check | https://console.firebase.google.com/project/lifestyleos/appcheck |
| Gemini API quotas (Google Cloud) | https://console.cloud.google.com/apis/api/generativelanguage.googleapis.com/quotas?project=lifestyleos |

If you see a link saying you have no access, switch to the account above using the avatar in the top-right corner.

#### App Check

App Check makes Firebase reject requests that don't come from your real app. Enforcement is on for Firebase AI Logic, so requests without a valid token fail with `401 "Firebase App Check token is invalid."`

The app sets App Check up in `Lifestyle_OSApp.swift` (`LifestyleAppCheckProviderFactory`). The provider is registered before `FirebaseApp.configure()`:
- **Debug builds (simulator and devices run from Xcode):** `AppCheckDebugProvider`. On first launch, the Xcode console prints `Firebase App Check debug token: <uuid>`. Add that token in the App Check dashboard → Apps → iOS app → ⋮ → *Manage debug tokens*. Each simulator or device has its own token.
- **Release / TestFlight / App Store:** `AppAttestProvider`. This needs the **App Attest** capability on the target (Signing & Capabilities) and the App Attest provider registered for the iOS app in the App Check dashboard.

### 4. Database Setup

The SQL schema includes:

- **accounts**: User account/household management
- **account_users**: User-account relationships with roles
- **inventory_items**: Kitchen inventory tracking
- **shopping_lists**: Shopping list management
- **shopping_list_items**: Individual items in lists
- **expenses**: Expense tracking
- **audit_logs**: Change history
- Row Level Security (RLS) policies for data protection

### 5. Build and Run

1. Select your target device/simulator
2. Press Cmd+R to build and run
3. Create an account using the sign-up screen
4. Start managing your kitchen inventory!

## Key Features Implementation

### Authentication
- Email/password authentication via Supabase Auth
- Automatic account creation on signup
- Session management

### Inventory Management
- Add items with name, quantity, unit, description
- Update item quantities
- Soft delete (items marked as deleted, not removed)
- Search functionality

### Shopping Lists
- Create multiple shopping lists
- Add items with quantities
- Toggle purchased status
- Track completion progress

### Data Sync
- All data stored in Supabase PostgreSQL
- Automatic sync on app launch
- Pull-to-refresh support
- Offline-first architecture (can be enhanced)

## Architecture

The app follows MVVM (Model-View-ViewModel) architecture:

- **Models**: Data structures matching Supabase schema
- **Services**: API communication layer
- **ViewModels**: Business logic and state management
- **Views**: SwiftUI user interface

## Requirements

- iOS 16.0+
- Xcode 15.0+
- Swift 5.9+
- Supabase account

## Future Enhancements

- [ ] Expense analytics and charts
- [ ] Recipe management
- [ ] Barcode scanning for items
- [ ] Expiration date tracking
- [ ] Meal planning
- [ ] Share lists with household members
- [ ] Push notifications for low stock
- [ ] Export data to CSV
- [ ] Dark mode support
- [ ] iPad optimization

## License

MIT License - feel free to use this project as a starting point for your own applications.

## Support

For issues related to:
- **Supabase**: Check [Supabase documentation](https://supabase.com/docs)
- **Swift/SwiftUI**: Check [Apple Developer documentation](https://developer.apple.com/documentation/)
- **supabase-swift**: Check the [GitHub repository](https://github.com/supabase/supabase-swift)
