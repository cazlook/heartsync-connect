const BACKEND = "https://backend-production-76289.up.railway.app";
const email = "superadmin@heartsync.app";
const password = "HeartSync@2026!";
const name = "SuperAdmin";

async function run() {
  // Register
  console.log("Registering...");
  const reg = await fetch(`${BACKEND}/api/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password, name, age: 30, gender: "other", interested_in: ["all"], city: "Milano", interests: ["admin"] })
  }).then(r => r.json());
  console.log("Register:", JSON.stringify(reg));

  // Bootstrap
  console.log("\nBootstrapping superadmin...");
  const boot = await fetch(`${BACKEND}/api/bootstrap/superadmin`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, secret: "heartsync_bootstrap_2026" })
  }).then(r => r.json());
  console.log("Bootstrap:", JSON.stringify(boot));

  // Login
  console.log("\nLogging in...");
  const login = await fetch(`${BACKEND}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password })
  }).then(r => r.json());
  console.log("Full login response:", JSON.stringify(login, null, 2));

  console.log("\n╔══════════════════════════════════════════════════╗");
  console.log("║            CREDENZIALI SUPERADMIN                ║");
  console.log("╠══════════════════════════════════════════════════╣");
  console.log(`║  Email:    ${email}`);
  console.log(`║  Password: ${password}`);
  console.log(`║  Role:     ${login.user?.role || login.role || "superadmin"}`);
  console.log(`║  User ID:  ${login.user?.id || login.id || boot.user_id}`);
  console.log("╠══════════════════════════════════════════════════╣");
  console.log("║  JWT Token:");
  console.log(login.access_token || login.token || "Vedi sopra");
  console.log("╚══════════════════════════════════════════════════╝");
}

run().catch(console.error);
