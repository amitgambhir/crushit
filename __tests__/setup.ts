import { cleanup } from '@testing-library/react-native';

// Silence console.error for expected test errors
const originalConsoleError = console.error;
beforeAll(() => {
  console.error = (...args: unknown[]) => {
    // Suppress React act() warnings and known RN warnings in tests
    const msg = args[0];
    if (
      typeof msg === 'string' &&
      (msg.includes('act(') || msg.includes('Warning:'))
    ) return;
    originalConsoleError(...args);
  };
});
afterAll(() => {
  console.error = originalConsoleError;
});

// Clear all mocks between tests
afterEach(() => {
  cleanup();
  jest.clearAllMocks();
});
