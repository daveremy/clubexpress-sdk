# ClubExpress SDK

A TypeScript SDK for interacting with the ClubExpress platform, with a focus on court booking functionality.

## Features

- **HTTP-First Approach**: Uses direct HTTP requests to interact with ClubExpress
- **Authentication**: Login, logout, and session management
- **Court Booking**: Find and book courts (coming soon)
- **Booking Management**: View and cancel bookings (coming soon)

## Installation

```bash
npm install clubexpress-sdk
```

## Usage

### Basic Usage

```typescript
import ClubExpressSDK from 'clubexpress-sdk';

// Initialize with your club ID
const sdk = ClubExpressSDK.client.setClubId('YOUR_CLUB_ID');

// Login
const loginResult = await ClubExpressSDK.auth.login({
  username: 'your-username',
  password: 'your-password',
});

if (loginResult.success) {
  console.log('Logged in successfully!');
  console.log('User:', loginResult.user);
} else {
  console.error('Login failed:', loginResult.error);
}

// Logout
const logoutResult = await ClubExpressSDK.auth.logout();
if (logoutResult.success) {
  console.log('Logged out successfully!');
}
```

### Custom Configuration

```typescript
import { ClubExpressClient, AuthModule } from 'clubexpress-sdk';

// Create a custom client
const client = new ClubExpressClient({
  clubId: 'YOUR_CLUB_ID',
  baseUrl: 'https://www.clubexpress.com',
  debug: true,
  timeout: 10000,
  maxRetries: 3,
});

// Create modules
const auth = new AuthModule(client);

// Use the modules
const loginResult = await auth.login({
  username: 'your-username',
  password: 'your-password',
});
```

## Environment Variables

You can use environment variables to configure the SDK:

```
# .env file
CLUBEXPRESS_USERNAME=your-username
CLUBEXPRESS_PASSWORD=your-password
CLUB_ID=your-club-id
DEBUG=true
```

## Development

### Prerequisites

- Node.js 14+
- npm or yarn

### Setup

1. Clone the repository
2. Install dependencies: `npm install`
3. Create a `.env` file with your credentials (see example above)
4. Build the project: `npm run build`
5. Run tests: `npm test`

## Project Structure

```
clubexpress-sdk/
├── src/
│   ├── core/           # Core functionality
│   │   ├── client.ts   # HTTP client
│   │   └── types.ts    # Core types
│   ├── modules/        # Feature modules
│   │   ├── auth/       # Authentication module
│   │   └── ...         # Other modules
│   └── index.ts        # Main entry point
├── tests/              # Test files
├── docs/               # Documentation
└── ...                 # Configuration files
```

## License

MIT 