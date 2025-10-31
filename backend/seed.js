// seed.js
const admin = require("./config/firebase"); // import your initialized admin

const db = admin.firestore(); // <-- define db here

// Sample data
const police_stations = [
  { 
    name: "Police Station 1", 
    location: "City Hall", 
    contact_number: "0917-8439327", 
    position: new admin.firestore.GeoPoint(8.474777326566851, 124.64807471954167)
  },
  { 
    name: "Police Station 2", 
    location: "Cogon Market", 
    contact_number: "0926-592-2662", 
    position: new admin.firestore.GeoPoint(8.477901965591558, 124.65184018743768)
  },
  { 
    name: "Police Station 3", 
    location: "IBT Terminal, Agora", 
    contact_number: "0905-214-9550", 
    position: new admin.firestore.GeoPoint(8.488516228690575, 124.6571432134514)
  },
  { 
    name: "Police Station 4", 
    location: "Carmen Market", 
    contact_number: "0997-380-7386", 
    position: new admin.firestore.GeoPoint(8.483633115114168, 124.64047691008437)
  },
  { 
    name: "Police Station 5", 
    location: "Macabalan", 
    contact_number: "0997-380-7386", 
    position: new admin.firestore.GeoPoint(8.498533923917492, 124.66028822606434)
  },
  { 
    name: "Police Station 6", 
    location: "Puerto", 
    contact_number: "0998-598-6987", 
    position: new admin.firestore.GeoPoint(8.499807600484443, 124.74943034087161)
  },
  { 
    name: "Police Station 7", 
    location: "Bulua", 
    contact_number: "0905-482-2050", 
    position: new admin.firestore.GeoPoint(8.504541378451831, 124.61370990331727)
  },
  { 
    name: "Police Station 8", 
    location: "Lumbia", 
    contact_number: "0916-901-6552", 
    position: new admin.firestore.GeoPoint(8.397680512540495, 124.59424667949705)
  },
  { 
    name: "Police Station 9", 
    location: "Macasandig", 
    contact_number: "0977-012-8666", 
    position: new admin.firestore.GeoPoint(8.468659962705427, 124.64893064087131)
  },
  { 
    name: "Police Station 10", 
    location: "Cugman", 
    contact_number: "0917-118-3995", 
    position: new admin.firestore.GeoPoint(8.469988880696977, 124.70428471785645)
  },
];

// Seeder function
async function seedPoliceStations() {
  const policeCollection = db.collection("police_stations");

  // Optional: Clear existing data
  const snapshot = await policeCollection.get();
  snapshot.forEach(doc => doc.ref.delete());

  // Add new sample data
  for (const police_station of police_stations) {
    await policeCollection.add(police_station);
    console.log(`Added police station: ${police_station.name}`);
  }

  console.log("Seeding complete!");
}

// Run the seeder
seedPoliceStations().catch(console.error);
