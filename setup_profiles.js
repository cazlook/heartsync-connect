const BACKEND = "https://backend-production-76289.up.railway.app";

const profiles = [
  {
    email: "sofia.romano@test.com", password: "Test@1234!", name: "Sofia", age: 26,
    bio: "Amo la fotografia e i tramonti sul mare. Cerco qualcuno con cui condividere avventure e risate.",
    city: "Milano", gender: "female", interested_in: ["male"],
    interests: ["fotografia", "viaggi", "yoga", "cucina"],
    photos: ["https://randomuser.me/api/portraits/women/12.jpg"]
  },
  {
    email: "luca.ferrari@test.com", password: "Test@1234!", name: "Luca", age: 29,
    bio: "Musicista di giorno, sognatore di notte. Suono la chitarra e amo il jazz.",
    city: "Roma", gender: "male", interested_in: ["female"],
    interests: ["musica", "jazz", "lettura", "cinema"],
    photos: ["https://randomuser.me/api/portraits/men/22.jpg"]
  },
  {
    email: "chiara.bianchi@test.com", password: "Test@1234!", name: "Chiara", age: 24,
    bio: "Studentessa di medicina, appassionata di danza e cucina siciliana.",
    city: "Palermo", gender: "female", interested_in: ["male"],
    interests: ["danza", "cucina", "medicina", "mare"],
    photos: ["https://randomuser.me/api/portraits/women/33.jpg"]
  },
  {
    email: "marco.ricci@test.com", password: "Test@1234!", name: "Marco", age: 31,
    bio: "Runner incallito e fan del calcio. Cerco qualcuna che ami stare all'aria aperta.",
    city: "Firenze", gender: "male", interested_in: ["female"],
    interests: ["running", "calcio", "montagna", "fitness"],
    photos: ["https://randomuser.me/api/portraits/men/45.jpg"]
  },
  {
    email: "elena.conti@test.com", password: "Test@1234!", name: "Elena", age: 27,
    bio: "Architetta con la passione per l'arte moderna e i viaggi on the road.",
    city: "Torino", gender: "female", interested_in: ["male", "female"],
    interests: ["architettura", "arte", "viaggi", "design"],
    photos: ["https://randomuser.me/api/portraits/women/55.jpg"]
  },
  {
    email: "andrea.esposito@test.com", password: "Test@1234!", name: "Andrea", age: 28,
    bio: "Chef in un ristorante stellato. Ti cucinerò qualcosa di indimenticabile.",
    city: "Napoli", gender: "male", interested_in: ["female"],
    interests: ["cucina", "vino", "gastronomia", "cinema"],
    photos: ["https://randomuser.me/api/portraits/men/67.jpg"]
  },
  {
    email: "giulia.marino@test.com", password: "Test@1234!", name: "Giulia", age: 25,
    bio: "Insegno yoga e meditazione. Cerco una connessione autentica e profonda.",
    city: "Bologna", gender: "female", interested_in: ["male"],
    interests: ["yoga", "meditazione", "natura", "lettura"],
    photos: ["https://randomuser.me/api/portraits/women/68.jpg"]
  },
  {
    email: "davide.greco@test.com", password: "Test@1234!", name: "Davide", age: 33,
    bio: "Imprenditore digitale, amante del surf e della tecnologia.",
    city: "Milano", gender: "male", interested_in: ["female"],
    interests: ["surf", "tecnologia", "startup", "viaggi"],
    photos: ["https://randomuser.me/api/portraits/men/78.jpg"]
  },
  {
    email: "valentina.russo@test.com", password: "Test@1234!", name: "Valentina", age: 23,
    bio: "Illustratrice freelance. Il mio cuore batte più forte davanti a un tramonto o una tela bianca.",
    city: "Venezia", gender: "female", interested_in: ["male"],
    interests: ["illustrazione", "arte", "musica", "cinema"],
    photos: ["https://randomuser.me/api/portraits/women/90.jpg"]
  },
  {
    email: "matteo.villa@test.com", password: "Test@1234!", name: "Matteo", age: 30,
    bio: "Alpinista e fotografo naturalista. La montagna è la mia cattedrale.",
    city: "Trento", gender: "male", interested_in: ["female"],
    interests: ["montagna", "fotografia", "trekking", "natura"],
    photos: ["https://randomuser.me/api/portraits/men/91.jpg"]
  }
];

async function setup() {
  const tokens = {};

  // 1. Register all profiles
  console.log("=== Registrazione profili ===");
  for (const p of profiles) {
    const res = await fetch(`${BACKEND}/api/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: p.email, password: p.password, name: p.name, age: p.age,
        bio: p.bio, city: p.city, gender: p.gender, interested_in: p.interested_in,
        interests: p.interests, photos: p.photos
      })
    }).then(r => r.json());

    if (res.access_token) {
      tokens[p.email] = res.access_token;
      console.log(`✓ ${p.name} (${p.age}, ${p.city}) - ID: ${res.user.id}`);
    } else {
      // Already exists, login
      const login = await fetch(`${BACKEND}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: p.email, password: p.password })
      }).then(r => r.json());
      tokens[p.email] = login.access_token;
      console.log(`↩ ${p.name} già esistente, login OK`);
    }
  }

  // 2. Set cardiac baseline BPM for each profile
  console.log("\n=== Impostazione baseline cardiaco ===");
  const bpmValues = [68, 72, 65, 80, 70, 75, 62, 78, 67, 73];
  for (let i = 0; i < profiles.length; i++) {
    const token = tokens[profiles[i].email];
    if (!token) continue;
    const res = await fetch(`${BACKEND}/api/biometrics/heartrate`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
      body: JSON.stringify({ bpm: bpmValues[i], context: "resting" })
    }).then(r => r.json());
    console.log(`❤️  ${profiles[i].name}: ${bpmValues[i]} BPM - ${res.message || JSON.stringify(res)}`);
  }

  // 3. Simulate mutual swipes to create matches
  console.log("\n=== Simulazione match cardiaci ===");
  // Get all user IDs first
  const adminToken = (await fetch(`${BACKEND}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "superadmin@heartsync.app", password: "HeartSync@2026!" })
  }).then(r => r.json())).access_token;

  const allUsers = await fetch(`${BACKEND}/api/admin/users?limit=20`, {
    headers: { "Authorization": `Bearer ${adminToken}` }
  }).then(r => r.json());

  const userMap = {};
  for (const u of allUsers.users) {
    userMap[u.email] = u.id;
  }

  // Create matches: Sofia↔Luca, Chiara↔Marco, Elena↔Andrea, Giulia↔Davide, Valentina↔Matteo
  const pairs = [
    ["sofia.romano@test.com", "luca.ferrari@test.com"],
    ["chiara.bianchi@test.com", "marco.ricci@test.com"],
    ["elena.conti@test.com", "andrea.esposito@test.com"],
    ["giulia.marino@test.com", "davide.greco@test.com"],
    ["valentina.russo@test.com", "matteo.villa@test.com"]
  ];

  for (const [emailA, emailB] of pairs) {
    const tokenA = tokens[emailA];
    const tokenB = tokens[emailB];
    const idA = userMap[emailA];
    const idB = userMap[emailB];
    if (!tokenA || !tokenB || !idA || !idB) {
      console.log(`⚠ Skipping pair ${emailA} / ${emailB}`);
      continue;
    }
    // A likes B (with cardiac bonus)
    const r1 = await fetch(`${BACKEND}/api/discovery/swipe`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${tokenA}` },
      body: JSON.stringify({ profile_id: idB, direction: "like", cardiac_bonus: Math.floor(Math.random() * 30) + 10 })
    }).then(r => r.json());

    // B likes A (with cardiac bonus)
    const r2 = await fetch(`${BACKEND}/api/discovery/swipe`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${tokenB}` },
      body: JSON.stringify({ profile_id: idA, direction: "like", cardiac_bonus: Math.floor(Math.random() * 30) + 10 })
    }).then(r => r.json());

    const nameA = profiles.find(p => p.email === emailA)?.name;
    const nameB = profiles.find(p => p.email === emailB)?.name;
    const matched = r2.match ? "💕 MATCH!" : "↩ swipe OK";
    console.log(`${nameA} ↔ ${nameB}: ${matched}`);
  }

  // Also: superadmin swipes right on a few profiles to get matches when testing
  console.log("\n=== Match per superadmin ===");
  const adminTargets = ["sofia.romano@test.com", "elena.conti@test.com", "giulia.marino@test.com"];
  for (const targetEmail of adminTargets) {
    const targetId = userMap[targetEmail];
    const targetToken = tokens[targetEmail];
    if (!targetId || !targetToken) continue;

    // Target likes superadmin
    const adminId = userMap["superadmin@heartsync.app"];
    if (adminId) {
      await fetch(`${BACKEND}/api/discovery/swipe`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${targetToken}` },
        body: JSON.stringify({ profile_id: adminId, direction: "like", cardiac_bonus: 25 })
      }).then(r => r.json());
    }

    // Superadmin likes target (will create match)
    const r = await fetch(`${BACKEND}/api/discovery/swipe`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${adminToken}` },
      body: JSON.stringify({ profile_id: targetId, direction: "like", cardiac_bonus: 30 })
    }).then(r => r.json());

    const name = profiles.find(p => p.email === targetEmail)?.name;
    console.log(`SuperAdmin ↔ ${name}: ${r.match ? "💕 MATCH!" : "swipe OK"}`);
  }

  console.log("\n✅ Setup completato!");
}

setup().catch(console.error);
