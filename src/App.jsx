import React, { useState, useEffect } from 'react';
import { Search, MapPin, Calendar, DollarSign, Cloud, Navigation, Sparkles, Map as MapIcon, User, Lock, Mail, ArrowRight, X, Info, Maximize2, Minimize2, Eye, EyeOff, Landmark, Mountain, Users, Ticket, Layers, Globe, Zap, Compass, Navigation2, ChevronRight, Activity, TrendingUp, Star, ShieldCheck, Heart, Share2, Camera, Database, LayoutDashboard, LogOut } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { MapContainer, TileLayer, Marker, Popup, useMap, Polyline } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

const API_BASE = "http://localhost:5000/api";

// Leaflet fix
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

const MAP_VIEWS = {
  satellite: { name: 'Satellite', url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', attribution: 'Esri' },
  standard: { name: 'Street', url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', attribution: 'OSM' },
  dark: { name: 'Dark', url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', attribution: 'Carto' }
};

function MapController({ coords, isExpanded }) {
  const map = useMap();
  useEffect(() => {
    if (coords && !isNaN(coords[0]) && !isNaN(coords[1])) {
      map.setView(coords, isExpanded ? 16 : 13, { animate: true });
    }
  }, [coords, map, isExpanded]);
  useEffect(() => {
    const timer = setTimeout(() => map.invalidateSize(), 600);
    return () => clearTimeout(timer);
  }, [isExpanded, map]);
  return null;
}

function App() {
  const [view, setView] = useState('auth');
  const [isLogin, setIsLogin] = useState(true);
  const [userData, setUserData] = useState(null);
  const [authForm, setAuthForm] = useState({ name: '', email: '', password: '' });
  const [adminDB, setAdminDB] = useState(null);
  const [destination, setDestination] = useState('');
  const [currentData, setCurrentData] = useState({ coords: [20, 0], nearby: [], itinerary: [] });
  const [loading, setLoading] = useState(false);
  const [mapOpen, setMapOpen] = useState(false);
  const [mapType, setMapType] = useState('satellite');
  const [navMode, setNavMode] = useState(false);
  const [activePoiIndex, setActivePoiIndex] = useState(0);

  const handleAuth = async (e) => {
    e.preventDefault();
    setLoading(true);
    const endpoint = isLogin ? "/login" : "/register";
    try {
      const res = await fetch(API_BASE + endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(authForm)
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setUserData(data.user);
      if (data.user.role === 'admin') fetchAdminDB();
      setView('discovery');
    } catch (err) { alert(err.message); } finally { setLoading(false); }
  };

  const fetchAdminDB = async () => {
    try {
      const res = await fetch(API_BASE + "/admin/db");
      const data = await res.json();
      setAdminDB(data);
    } catch (err) { console.error(err); }
  };

  const handleDiscovery = async (destName = destination) => {
    const target = destName || destination;
    if (!target) return;
    setLoading(true);
    try {
      const geoRes = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(target)}`);
      const geoData = await geoRes.json();
      if (!geoData || geoData.length === 0) throw new Error("Location not found.");
      const lat = parseFloat(geoData[0].lat);
      const lon = parseFloat(geoData[0].lon);
      
      const overpassQuery = `[out:json];(node(around:10000,${lat},${lon})["tourism"~"attraction|viewpoint|museum"];node(around:10000,${lat},${lon})["amenity"="place_of_worship"];);out 30;`;
      const poiRes = await fetch(`https://overpass-api.de/api/interpreter?data=${encodeURIComponent(overpassQuery)}`);
      const poiData = await poiRes.json();

      const nearbyPlaces = (poiData.elements || [])
        .filter(el => el.tags && el.tags.name && !isNaN(el.lat) && !isNaN(el.lon))
        .map(el => {
          const elLat = parseFloat(el.lat);
          const elLon = parseFloat(el.lon);
          const dist = L.latLng(lat, lon).distanceTo(L.latLng(elLat, elLon));
          return { name: el.tags.name, coords: [elLat, elLon], type: el.tags.tourism || el.tags.amenity || 'Point', distance: (dist / 1000).toFixed(1) + ' km' };
        }).sort((a, b) => parseFloat(a.distance) - parseFloat(b.distance)).slice(0, 12);

      if (userData && userData.role !== 'admin') {
        await fetch(API_BASE + "/save-trip", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: userData.email, destination: target })
        });
      }

      setCurrentData({ coords: [lat, lon], nearby: nearbyPlaces, itinerary: [{ day: 1, title: "Adventure Start", activities: [`Arrive in ${target}`, `Visit ${nearbyPlaces[0]?.name || 'City Center'}`] }] });
      setDestination(target);
      setView('planner');
      setNavMode(true);
    } catch (err) { alert(err.message); } finally { setLoading(false); }
  };

  const routePath = currentData.nearby.length > 0 ? [currentData.coords, ...currentData.nearby.map(p => p.coords)] : [];

  if (view === 'auth') {
    return (
      <div className="auth-fullscreen-container">
        <div className="auth-video-bg"><img src="https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1?q=80&w=2070&auto=format&fit=crop" alt="Cinematic" /></div>
        <div className="auth-black-overlay"></div>
        <motion.div className="auth-premium-card glass-v4" initial={{ opacity: 0, y: 50 }} animate={{ opacity: 1, y: 0 }}>
          <div className="auth-brand-area">
            <Globe size={48} color="#6366f1" style={{ marginBottom: '1rem' }} />
            <h1 className="auth-title">ROVE <span>AI</span></h1>
            <p className="auth-subtitle">AI-POWERED EXPLORATION</p>
          </div>
          <form className="auth-modern-form" onSubmit={handleAuth}>
            {!isLogin && <div className="auth-input-wrapper"><User size={20} className="auth-icon" /><input type="text" placeholder="Full Name" className="auth-premium-input" value={authForm.name} onChange={e => setAuthForm({...authForm, name: e.target.value})} required /></div>}
            <div className="auth-input-wrapper"><Mail size={20} className="auth-icon" /><input type="text" placeholder="Username / Email" className="auth-premium-input" value={authForm.email} onChange={e => setAuthForm({...authForm, email: e.target.value})} required /></div>
            <div className="auth-input-wrapper"><Lock size={20} className="auth-icon" /><input type="password" placeholder="Password" className="auth-premium-input" value={authForm.password} onChange={e => setAuthForm({...authForm, password: e.target.value})} required /></div>
            <motion.button className="auth-submit-btn" whileHover={{ scale: 1.02 }}>{loading ? 'SYNCING...' : (isLogin ? 'LOG IN' : 'REGISTER')}</motion.button>
          </form>
          <p className="auth-toggle-text">{isLogin ? "NEW EXPLORER?" : "HAVE AN ACCOUNT?"} <span onClick={() => setIsLogin(!isLogin)}>{isLogin ? ' REGISTER' : ' LOGIN'}</span></p>
        </motion.div>
        <style>{`
          .auth-fullscreen-container { height: 100vh; width: 100vw; display: flex; align-items: center; justify-content: center; position: relative; background: #000; overflow: hidden; font-family: 'Outfit', sans-serif; }
          .auth-video-bg img { width: 100%; height: 100%; object-fit: cover; filter: brightness(0.5); }
          .auth-black-overlay { position: absolute; top: 0; left: 0; width: 100%; height: 100%; background: radial-gradient(circle, transparent, rgba(0,0,0,0.8)); z-index: 1; }
          .auth-premium-card { position: relative; z-index: 10; width: 100%; max-width: 420px; padding: 3.5rem; text-align: center; border-radius: 40px; }
          .glass-v4 { background: rgba(15, 23, 42, 0.4); backdrop-filter: blur(40px); border: 1px solid rgba(255,255,255,0.1); }
          .auth-title { font-size: 2.2rem; font-weight: 900; letter-spacing: 4px; color: #fff; margin-bottom: 0.5rem; }
          .auth-title span { color: #6366f1; }
          .auth-subtitle { font-size: 0.7rem; color: #64748b; letter-spacing: 3px; font-weight: 800; }
          .auth-modern-form { display: flex; flex-direction: column; gap: 1.5rem; margin-top: 2.5rem; }
          .auth-input-wrapper { display: flex; align-items: center; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); border-radius: 18px; padding: 0 1.2rem; }
          .auth-premium-input { flex: 1; background: transparent; border: none; padding: 1.2rem; color: #fff; font-size: 1rem; outline: none; }
          .auth-submit-btn { background: linear-gradient(to right, #6366f1, #4f46e5); color: #fff; border: none; padding: 1.2rem; border-radius: 18px; font-weight: 900; cursor: pointer; letter-spacing: 1px; }
          .auth-toggle-text { margin-top: 2.5rem; font-size: 0.8rem; color: #64748b; }
          .auth-toggle-text span { color: #6366f1; cursor: pointer; text-decoration: underline; }
        `}</style>
      </div>
    );
  }

  return (
    <div className="app-container-excellent">
      {userData?.role === 'admin' ? (
        <div className="admin-portal-v3">
          <nav className="navbar-excellent glass-excellent">
            <div className="brand-excellent"><LayoutDashboard size={28} /> ROVE ADMIN</div>
            <button className="btn-logout-v3" onClick={() => setView('auth')}><LogOut size={18} /> Logout</button>
          </nav>
          <main className="content-excellent">
            <h1 className="admin-title-v3">Database <span>Activity Monitor</span></h1>
            <div className="admin-grid-v3">
              <div className="admin-card glass-excellent">
                <h3><Users size={20} color="#6366f1" /> Registered Users</h3>
                <div className="admin-list">
                  {adminDB?.users.map((u, i) => (
                    <div key={i} className="admin-item"><b>{u.name}</b> <span>{u.email}</span></div>
                  ))}
                </div>
              </div>
              <div className="admin-card glass-excellent">
                <h3><Activity size={20} color="#10b981" /> Recent Trip Activity</h3>
                <div className="admin-list">
                  {adminDB?.trips.map((t, i) => (
                    <div key={i} className="admin-item"><b>{t.destination}</b> <span>by {t.email}</span></div>
                  ))}
                </div>
              </div>
            </div>
            <div className="admin-raw-v3 glass-excellent">
               <h3><Database size={20} /> Raw Database JSON</h3>
               <pre>{JSON.stringify(adminDB, null, 2)}</pre>
            </div>
          </main>
        </div>
      ) : (
        <div className="user-portal-v3">
          <div className={`map-v3-excellent ${mapOpen ? 'expanded' : 'minimized'}`}>
            <MapContainer center={currentData.coords} zoom={mapOpen ? 16 : 13} style={{ height: '100%', width: '100%' }} zoomControl={false}>
              <TileLayer url={MAP_VIEWS[mapType].url} />
              <MapController coords={navMode && currentData.nearby[activePoiIndex] ? currentData.nearby[activePoiIndex].coords : currentData.coords} isExpanded={mapOpen} />
              <Marker position={currentData.coords}><Popup><b>Origin: {destination}</b></Popup></Marker>
              {navMode && routePath.length > 1 && <Polyline positions={routePath} color="#6366f1" weight={5} opacity={0.7} />}
              {currentData.nearby.map((place, i) => (
                <Marker key={i} position={place.coords}><Popup><div className="excellent-popup"><b>{place.name}</b><br/><button className="btn-mini-excellent" onClick={() => setActivePoiIndex(i)}>Navigate</button></div></Popup></Marker>
              ))}
            </MapContainer>
            <div className="map-tools-excellent">
              <button className="tool-btn-excellent" onClick={() => setMapType(mapType === 'satellite' ? 'standard' : 'satellite')}>{mapType === 'satellite' ? <Globe /> : <Layers />}</button>
              <button className="tool-btn-excellent" onClick={() => setMapOpen(!mapOpen)}>{mapOpen ? <Minimize2 /> : <Maximize2 />}</button>
            </div>
          </div>

          <nav className="navbar-excellent glass-excellent">
            <div className="brand-excellent"><Zap size={28} /> ROVE AI</div>
            <div className="nav-links-excellent">
              <button className="btn-sec-excellent" onClick={() => setView('discovery')}>New Route</button>
              <div className="user-profile-excellent">{userData?.name[0]}</div>
              <button className="btn-logout-icon" onClick={() => setView('auth')}><LogOut size={18} /></button>
            </div>
          </nav>

          <main className="content-excellent">
            {view === 'discovery' ? (
              <div className="discovery-excellent">
                <motion.div className="discovery-hero" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
                  <h1 className="hero-title-excellent">Welcome, <span>{userData?.name}</span></h1>
                  <p className="hero-sub-excellent">Your personal AI-driven global exploration suite is ready.</p>
                  <div className="search-bar-excellent glass-excellent">
                    <Search size={24} color="#64748b" /><input type="text" placeholder="Explore a city..." value={destination} onChange={(e) => setDestination(e.target.value)} onKeyPress={(e) => e.key === 'Enter' && handleDiscovery()} />
                    <button className="btn-search-excellent" onClick={() => handleDiscovery()}>Explore</button>
                  </div>
                </motion.div>
                <div className="trending-section">
                  <h3>Popular Voyages</h3>
                  <div className="trending-grid">
                    {[ {n:'Paris', i:'https://images.unsplash.com/photo-1502602898657-3e91760cbb34?w=400'}, {n:'Tokyo', i:'https://images.unsplash.com/photo-1503899036084-c55cdd92da26?w=400'}, {n:'London', i:'https://images.unsplash.com/photo-1513635269975-59663e0ac1ad?w=400'} ].map((city, i) => (
                      <motion.div key={i} className="trending-card glass-excellent" whileHover={{ y: -10 }} onClick={() => handleDiscovery(city.n)}>
                        <img src={city.i} alt={city.n} /><div className="trending-info"><h4>{city.n}</h4></div>
                      </motion.div>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="planner-layout-excellent">
                <div className="planner-main">
                  <div className="header-card-excellent glass-excellent">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}><div className="city-box-excellent"><MapPin size={32} /></div><div><span className="sub-header-excellent">PLANNING MODE</span><h2 className="city-title-excellent">{destination}</h2></div></div>
                  </div>
                  <div className="route-steps-excellent">
                    {currentData.nearby.map((place, i) => (
                      <motion.div key={i} className={`step-card-excellent glass-excellent ${activePoiIndex === i ? 'active' : ''}`} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}>
                        <div className="step-badge">{i + 1}</div><div className="step-content"><h4>{place.name}</h4><p>{place.type} • {place.distance}</p></div>
                        <button className="btn-navigate-excellent" onClick={() => { setActivePoiIndex(i); setMapOpen(true); }}>NAVIGATE</button>
                      </motion.div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </main>
        </div>
      )}

      <style>{`
        :root { --p: #6366f1; --bg: #020617; --g: rgba(255,255,255,0.03); --gb: rgba(255,255,255,0.08); }
        body { background: var(--bg); color: #f8fafc; font-family: 'Outfit', sans-serif; overflow-x: hidden; }
        .glass-excellent { background: var(--g); backdrop-filter: blur(24px); border: 1px solid var(--gb); border-radius: 24px; }
        .navbar-excellent { margin: 1rem 2rem; padding: 1rem 2.5rem; display: flex; justify-content: space-between; align-items: center; position: sticky; top: 1rem; z-index: 100; }
        .brand-excellent { font-size: 1.5rem; font-weight: 900; letter-spacing: 4px; color: var(--p); display: flex; align-items: center; gap: 0.8rem; }
        .btn-logout-v3 { background: rgba(239, 68, 68, 0.1); border: 1px solid rgba(239, 68, 68, 0.2); color: #ef4444; padding: 0.6rem 1.2rem; border-radius: 12px; cursor: pointer; display: flex; align-items: center; gap: 0.5rem; font-weight: 800; transition: 0.3s; }
        .btn-logout-v3:hover { background: #ef4444; color: white; }
        .admin-title-v3 { font-size: 3rem; font-weight: 900; margin: 3rem 0; text-align: center; }
        .admin-title-v3 span { color: #6366f1; }
        .admin-grid-v3 { display: grid; grid-template-columns: 1fr 1fr; gap: 2rem; margin-bottom: 2rem; }
        .admin-card { padding: 2rem; }
        .admin-card h3 { margin-bottom: 1.5rem; display: flex; align-items: center; gap: 0.8rem; border-bottom: 1px solid var(--gb); padding-bottom: 1rem; }
        .admin-list { max-height: 300px; overflow-y: auto; display: flex; flex-direction: column; gap: 1rem; }
        .admin-item { background: rgba(255,255,255,0.02); padding: 1rem; border-radius: 12px; display: flex; justify-content: space-between; align-items: center; }
        .admin-item span { font-size: 0.8rem; color: #64748b; }
        .admin-raw-v3 { padding: 2rem; margin-top: 2rem; }
        .admin-raw-v3 pre { background: rgba(0,0,0,0.3); padding: 1.5rem; border-radius: 16px; font-size: 0.8rem; color: #10b981; overflow-x: auto; }
        
        .user-profile-excellent { width: 40px; height: 40px; background: var(--p); border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: 900; }
        .btn-logout-icon { background: transparent; border: none; color: #64748b; cursor: pointer; margin-left: 1rem; }
        .hero-title-excellent { font-size: 4rem; font-weight: 900; margin-bottom: 1rem; }
        .hero-title-excellent span { color: var(--p); }
        .search-bar-excellent { max-width: 700px; margin: 3rem auto; padding: 0.8rem 1.5rem; display: flex; align-items: center; gap: 1rem; }
        .search-bar-excellent input { flex: 1; background: transparent; border: none; padding: 1rem; color: white; font-size: 1.2rem; outline: none; }
        .btn-search-excellent { background: var(--p); border: none; padding: 1rem 2rem; border-radius: 14px; color: white; font-weight: 800; cursor: pointer; }
        .map-v3-excellent { position: fixed; bottom: 2rem; right: 2rem; width: 400px; height: 300px; z-index: 2000; transition: 0.5s; border-radius: 24px; overflow: hidden; box-shadow: 0 40px 100px rgba(0,0,0,0.6); }
        .map-v3-excellent.expanded { top: 0; left: 0; width: 100vw; height: 100vh; border-radius: 0; }
        .btn-mini-excellent { background: var(--p); border: none; padding: 0.4rem 0.8rem; border-radius: 8px; color: white; font-size: 0.7rem; cursor: pointer; margin-top: 0.5rem; }
      `}</style>
    </div>
  );
}

export default App;
