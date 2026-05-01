const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const bodyParser = require('body-parser');

const app = express();
const PORT = 5000;
const DB_FILE = path.join(__dirname, 'database.json');

app.use(cors());
app.use(bodyParser.json());

// Root Route
app.get('/', (req, res) => {
  res.send('<h1>🚀 ROVE AI Backend is Active</h1><p>Visit <b>/api/admin/db</b> to see the database.</p>');
});

// Initialize "Database" file if it doesn't exist
if (!fs.existsSync(DB_FILE)) {
  fs.writeFileSync(DB_FILE, JSON.stringify({ users: [], trips: [] }, null, 2));
}

// Helper to read DB
const readDB = () => JSON.parse(fs.readFileSync(DB_FILE));
// Helper to write DB
const writeDB = (data) => fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));

// --- API ROUTES ---

// 1. User Registration
app.post('/api/register', (req, res) => {
  const { name, email, password } = req.body;
  const db = readDB();
  
  if (db.users.find(u => u.email === email)) {
    return res.status(400).json({ error: 'User already exists' });
  }

  const newUser = { id: Date.now(), name, email, password };
  db.users.push(newUser);
  writeDB(db);
  
  res.json({ success: true, user: { name, email } });
});

// 2. User Login
app.post('/api/login', (req, res) => {
  const { email, password } = req.body;
  const db = readDB();

  // Special Admin Logic
  if (email === 'Nihar' && password === '12345') {
    return res.json({ success: true, user: { name: 'Nihar', email: 'admin@rove.ai', role: 'admin' } });
  }

  const user = db.users.find(u => u.email === email && u.password === password);

  if (!user) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }

  res.json({ success: true, user: { name: user.name, email: user.email, role: 'user' } });
});

// 3. Save Trip
app.post('/api/save-trip', (req, res) => {
  const { email, destination, date } = req.body;
  const db = readDB();
  
  const newTrip = { id: Date.now(), email, destination, date: date || new Date().toISOString() };
  db.trips.push(newTrip);
  writeDB(db);
  
  res.json({ success: true, trip: newTrip });
});

// 4. Get Trips for User
app.get('/api/trips/:email', (req, res) => {
  const { email } = req.params;
  const db = readDB();
  const userTrips = db.trips.filter(t => t.email === email);
  res.json(userTrips);
});

// 5. Admin: See Everything (The "Database" View)
app.get('/api/admin/db', (req, res) => {
  res.json(readDB());
});

app.listen(PORT, () => {
  console.log(`🚀 Backend Server running at http://localhost:${PORT}`);
  console.log(`📂 Database visible at: ${DB_FILE}`);
});
