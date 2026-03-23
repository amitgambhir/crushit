import { Redirect } from 'expo-router';

// Root index just redirects — the auth guard in _layout.tsx handles actual routing.
export default function Index() {
  return <Redirect href="/(auth)/welcome" />;
}
