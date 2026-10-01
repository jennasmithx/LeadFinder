// Loads .env when running on your own computer (Vercel sets variables itself).
export function loadEnv() {
  try {
    process.loadEnvFile();
  } catch {
    // no .env file — fine if the keys are already in the environment
  }
}
