import { execSync } from "node:child_process";

/**
 * Vercel build entry point.
 *
 * When the project has a Convex deploy key (the `kyro-core` Vercel project
 * does), deploy the backend functions as part of the same build. That keeps
 * the deployed Convex functions in lockstep with the frontend, so new public
 * functions such as `files:registerUpload` can never be missing again.
 *
 * Projects without the key (for example a static preview project) just build
 * the frontend, exactly as before.
 */
const hasConvexDeployKey = Boolean(process.env.CONVEX_DEPLOY_KEY);

if (hasConvexDeployKey) {
  console.log(
    "[vercel-build] CONVEX_DEPLOY_KEY found — deploying Convex functions, then building the frontend.",
  );
  execSync('npx convex deploy --cmd "npm run build"', { stdio: "inherit" });
} else {
  console.log(
    "[vercel-build] No CONVEX_DEPLOY_KEY — building the frontend only.",
  );
  execSync("npm run build", { stdio: "inherit" });
}
