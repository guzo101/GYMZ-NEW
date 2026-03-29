# Gymz

React Native mobile application for gym members built with Expo. Gymz allows members to access all their gym features on their Android devices.

## Features

- **Dashboard**: View stats, upcoming classes, achievements, and workout logging
- **Profile**: Manage profile, view QR code for check-in, membership information
- **Payments**: Submit payments, view payment history, transaction verification
- **Classes**: View available classes and book classes
- **Calendar**: View class schedules and events
- **AI Chat**: Chat with AI assistant
- **Notice Board**: Community chat room
- **Settings**: App settings and preferences

## Prerequisites

- Node.js (v18 or higher)
- npm or yarn
- Expo CLI
- Android Studio (for Android development)
- Expo Go app (for testing on physical device)

## Installation

1. Navigate to the Gymz project directory:
```bash
cd Gymz
```

2. Install dependencies:
```bash
npm install
```

## Running the App

### Development Mode

Start the Expo development server:
```bash
npm start
```

### Android

Run on Android emulator or device:
```bash
npm run android
```

### iOS (requires macOS)

Run on iOS simulator or device:
```bash
npm run ios
```

## Building for Production

### Android APK

Build an APK for Android:
```bash
npx expo build:android
```

Or use EAS Build (recommended):
```bash
npx eas build --platform android
```

## Project Structure

```
Gymz/
├── app.json              # Expo configuration
├── App.tsx               # Main app component
├── index.ts              # Entry point
├── navigation/           # Navigation setup
│   └── AppNavigator.tsx
├── screens/              # Screen components
│   ├── LoginScreen.tsx
│   ├── DashboardScreen.tsx
│   ├── ProfileScreen.tsx
│   ├── PaymentsScreen.tsx
│   ├── ClassesScreen.tsx
│   ├── CalendarScreen.tsx
│   ├── AIChatScreen.tsx
│   ├── NoticeBoardScreen.tsx
│   └── SettingsScreen.tsx
├── services/             # API services
│   └── supabase.ts
├── hooks/                # Custom hooks
│   └── useAuth.tsx
├── components/           # Reusable components
├── types/                # TypeScript types
│   ├── auth.ts
│   └── database.ts
└── utils/                # Utility functions
```

## Configuration

The app connects to the same Supabase backend as the web application. The Supabase configuration is in `services/supabase.ts`.

## Dependencies

- **@supabase/supabase-js**: Supabase client
- **@react-navigation/native**: Navigation library
- **react-native-paper**: UI components
- **react-native-vector-icons**: Icons
- **expo-camera**: Camera access for QR scanning
- **expo-notifications**: Push notifications
- **date-fns**: Date formatting

## Notes

- The app is currently configured for Android. iOS support can be added later.
- Make sure to configure push notifications in `app.json` for production use.
- The QR code feature requires camera permissions.

