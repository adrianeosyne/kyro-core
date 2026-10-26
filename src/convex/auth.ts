// THIS FILE IS READ ONLY. Do not touch this file unless you are correctly adding a new auth provider in accordance to the vly auth documentation

import { convexAuth } from "@convex-dev/auth/server";
import { Anonymous } from "@convex-dev/auth/providers/Anonymous";
import { Password } from "@convex-dev/auth/providers/Password";
import { emailOtp } from "./auth/emailOtp";


export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  // `Password` gives Kyro email + password sign-in and sign-up with no email
  // verification step (no `verify` provider configured). Sign-up creates the
  // account from users/createAccount.ts so the handle can be reserved
  // server-side; the password provider only authenticates afterwards.
  providers: [Password(), emailOtp, Anonymous],
});