import { config } from './config';

type GoogleModule = typeof import('@react-native-google-signin/google-signin');

let mod: GoogleModule | null | undefined;

// The native module is missing in Expo Go; requiring it lazily keeps phone login working there.
const load = (): GoogleModule | null => {
  if (mod !== undefined) return mod;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    mod = require('@react-native-google-signin/google-signin') as GoogleModule;
    mod.GoogleSignin.configure({
      webClientId: config.googleWebClientId,
      iosClientId: config.googleIosClientId,
    });
  } catch {
    mod = null;
  }
  return mod;
};

export const isGoogleConfigured = () => Boolean(config.googleWebClientId);

/** Returns an ID token for the API, or null if the user cancelled. */
export const getGoogleIdToken = async (): Promise<string | null> => {
  const m = load();
  if (!m) throw new Error('Google sign-in needs a development build of the app.');
  await m.GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
  const res = await m.GoogleSignin.signIn();
  if (!m.isSuccessResponse(res)) return null;
  if (!res.data.idToken) throw new Error('Google did not return an ID token. Check the web client ID.');
  return res.data.idToken;
};

export const googleSignOut = async () => {
  try {
    await load()?.GoogleSignin.signOut();
  } catch {
    // Not signed in with Google on this device.
  }
};
