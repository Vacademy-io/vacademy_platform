# Frontend Learner Dashboard App

A modern, cross-platform learner dashboard application built with React, TypeScript, and Vite. This application supports web, mobile (Android/iOS via Capacitor), and desktop (Electron) platforms.

## Tech Stack

- **Framework**: React 19 with TypeScript
- **Build Tool**: Vite
- **Routing**: TanStack Router
- **State Management**: Zustand
- **UI Components**: Radix UI, Tailwind CSS
- **Mobile**: Capacitor (Android/iOS)
- **Desktop**: Electron
- **Package Manager**: pnpm

## Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js** (v18 or higher recommended)
- **pnpm** (v8 or higher)
- **Git**

### Installing pnpm

If you don't have pnpm installed, you can install it globally using:

```bash
npm install -g pnpm
```

## Installation

1. **Clone the repository**

```bash
git clone <repository-url>
cd frontend-learner-dashboard-app
```

2. **Install dependencies**

```bash
pnpm install
```

3. **Set up environment variables**

Create a `.env` file in the root directory and add the following environment variables:

```env
# Core URLs
VITE_API_BASE_URL=your_api_base_url
VITE_BACKEND_URL=your_backend_url
VITE_CODE_CIRCLE_INSTITUTE_ID=your_institute_id
VITE_HIDE_MODE_CHANGE_BUTTON=true_or_false
VITE_INSTITUTE_ID=your_institute_id
VITE_LEARNER_DASHBOARD_URL=your_learner_dashboard_url
VITE_TEACHER_DASHBOARD_URL=your_teacher_dashboard_url
VITE_AMPLITUDE_API_KEY=your_amplitude_api_key
```

**Note**: Replace the placeholder values with your actual environment-specific values. Do not commit the `.env` file to version control.

4. **Start the development server**

```bash
pnpm dev
```

The application will be available at `http://localhost:5173` (or the next available port).

## Available Scripts

### Development

- `pnpm dev` - Start the development server
- `pnpm preview` - Preview the production build locally

### Building

- `pnpm build` - Build for production (web)
- `pnpm build:tsc` - Type check and build
- `pnpm build:web:seven_cs` - Build web version for seven_cs flavor
- `pnpm build:web:ssdc` - Build web version for ssdc flavor

### Mobile (Android)

- `pnpm android:assemble:seven_cs:debug` - Build Android debug APK for seven_cs
- `pnpm android:assemble:seven_cs:release` - Build Android release APK for seven_cs
- `pnpm android:assemble:ssdc:debug` - Build Android debug APK for ssdc
- `pnpm android:assemble:ssdc:release` - Build Android release APK for ssdc

### Desktop (Electron)

- `pnpm electron:build:seven_cs:win` - Build Electron app for Windows (seven_cs)
- `pnpm electron:build:seven_cs:mac` - Build Electron app for macOS (seven_cs)
- `pnpm electron:build:ssdc:win` - Build Electron app for Windows (ssdc)
- `pnpm electron:build:ssdc:mac` - Build Electron app for macOS (ssdc)

### Utilities

- `pnpm lint` - Run ESLint
- `pnpm clear-cache` - Clear build cache and node_modules
- `pnpm fresh-start` - Clear cache, reinstall dependencies, and start dev server

## Environment Variables

The application requires the following environment variables to be set:

| Variable | Description | Required |
|----------|-------------|----------|
| `VITE_API_BASE_URL` | Base URL for API requests | Yes |
| `VITE_BACKEND_URL` | Backend service URL | Yes |
| `VITE_CODE_CIRCLE_INSTITUTE_ID` | Code Circle Institute ID | Yes |
| `VITE_HIDE_MODE_CHANGE_BUTTON` | Hide mode change button (true/false) | No |
| `VITE_INSTITUTE_ID` | Institute ID | Yes |
| `VITE_LEARNER_DASHBOARD_URL` | Learner dashboard URL | Yes |
| `VITE_TEACHER_DASHBOARD_URL` | Teacher dashboard URL | Yes |
| `VITE_AMPLITUDE_API_KEY` | Amplitude analytics API key | Yes |

All environment variables must be prefixed with `VITE_` to be accessible in the application code.

## Project Structure

```
frontend-learner-dashboard-app/
├── src/
│   ├── components/      # Reusable React components
│   ├── routes/          # Application routes
│   ├── services/        # API services
│   ├── stores/          # Zustand state management
│   ├── hooks/           # Custom React hooks
│   ├── lib/             # Utility libraries
│   ├── types/           # TypeScript type definitions
│   └── utils/           # Helper functions
├── android/             # Android native code
├── ios/                 # iOS native code
├── electron/            # Electron configuration
├── public/              # Static assets
└── dist/                # Build output
```

## Building for Production

### Web

```bash
pnpm build
```

The production build will be generated in the `dist/` directory.

### Mobile

For Android builds, ensure you have:
- Android Studio installed
- Android SDK configured
- Proper signing keys configured (for release builds)

```bash
pnpm android:assemble:seven_cs:release
```

### Desktop

For Electron builds, ensure you have the required dependencies installed for your target platform.

```bash
pnpm electron:build:seven_cs:win  # Windows
pnpm electron:build:seven_cs:mac  # macOS
```

## Development Tips

- Use `pnpm fresh-start` if you encounter caching issues
- The application supports multiple flavors (seven_cs, ssdc) - use the appropriate build commands
- Environment variables are loaded from `.env` file in the root directory
- Hot module replacement (HMR) is enabled during development

## Troubleshooting

### Build Memory Issues

If you encounter memory issues during build, the build script is already configured with increased memory limit. If issues persist, try:

```bash
pnpm clear-cache
pnpm install
```

### Environment Variables Not Loading

Ensure:
- Variables are prefixed with `VITE_`
- `.env` file is in the root directory
- Development server is restarted after adding new variables

## Contributing

1. Create a feature branch
2. Make your changes
3. Ensure linting passes: `pnpm lint`
4. Test your changes thoroughly
5. Submit a pull request

## License

[Add your license information here]

