import { Redirect } from 'expo-router';

export default function Index() {
  // Always redirect the bare root URL to the auth flow.
  return <Redirect href="/login" />;
}

