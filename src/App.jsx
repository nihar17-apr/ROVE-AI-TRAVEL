import React, { useState, useEffect } from 'react';
import { Search, MapPin, Calendar, DollarSign, Cloud, Navigation, Sparkles, Map as MapIcon, User, Lock, Mail, ArrowRight, X, Info, Maximize2, Minimize2, Eye, EyeOff, Landmark, Mountain, Users, Ticket, Layers, Globe, Zap, Compass, Navigation2, ChevronRight, Activity, TrendingUp, Star, ShieldCheck, Heart, Share2, Camera } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { MapContainer, TileLayer, Marker, Popup, useMap, Polyline } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// Fix for Leaflet default icon issue
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

const TRENDING = [
  { name: 'Paris', country: 'France', img: 'https://images.unsplash.com/photo-1502602898657-3e91760cbb34?q=80&w=400', desc: 'The city of lights and love.' },
  { name: 'Tokyo', country: 'Japan', img: 'https://images.unsplash.com/photo-1503899036084-c55cdd92da26?q=80&w=400', desc: 'Neon lights and ancient traditions.' },
  { name: 'New York', country: 'USA', img: 'https://images.unsplash.com/photo-1496442226666-8d4d0e62e6e9?q=80&w=400', desc: 'The city that never sleeps.' }
];

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
  const [destination, setDestination] = useState('');
  const [currentData, setCurrentData] = useState({ coords: [20, 0], nearby: [], itinerary: [] });
  const [loading, setLoading] = useState(false);
  const [mapOpen, setMapOpen] = useState(false);
  const [mapVisible, setMapVisible] = useState(true);
  const [mapType, setMapType] = useState('satellite');
  const [navMode, setNavMode] = useState(false);
  const [activePoiIndex, setActivePoiIndex] = useState(0);

  const handleAuth = (e) => {
    e.preventDefault();
    setLoading(true);
    setTimeout(() => { setView('discovery'); setLoading(false); }, 1200);
  };

  const handleDiscovery = async (destName = destination) => {
    const target = destName || destination;
    if (!target) return;
    setLoading(true);
    try {
      const geoRes = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(target)}`);
      const geoData = await geoRes.json();
      if (!geoData || geoData.length === 0) throw new Error("Location not found. Please try a different city.");
      
      const lat = parseFloat(geoData[0].lat);
      const lon = parseFloat(geoData[0].lon);
      if (isNaN(lat) || isNaN(lon)) throw new Error("Invalid coordinates received.");
      const centerCoords = [lat, lon];

      const overpassQuery = `[out:json];(node(around:10000,${lat},${lon})["tourism"~"attraction|viewpoint|museum"];node(around:10000,${lat},${lon})["amenity"="place_of_worship"];);out 30;`;
      const poiRes = await fetch(`https://overpass-api.de/api/interpreter?data=${encodeURIComponent(overpassQuery)}`);
      const poiData = await poiRes.json();

      const nearbyPlaces = (poiData.elements || [])
        .filter(el => el.tags && el.tags.name && !isNaN(el.lat) && !isNaN(el.lon))
        .map(el => {
          const elLat = parseFloat(el.lat);
          const elLon = parseFloat(el.lon);
          const dist = L.latLng(lat, lon).distanceTo(L.latLng(elLat, elLon));
          return {
            name: el.tags.name,
            coords: [elLat, elLon],
            type: el.tags.tourism || el.tags.amenity || 'Point of Interest',
            distance: (dist / 1000).toFixed(1) + ' km'
          };
        })
        .sort((a, b) => parseFloat(a.distance) - parseFloat(b.distance))
        .slice(0, 12);

      setCurrentData({
        coords: centerCoords,
        nearby: nearbyPlaces,
        itinerary: [
          { day: 1, title: "Iconic Experience", activities: [`Arrive in ${target}`, `Check-in at City Center`, `Visit ${nearbyPlaces[0]?.name || 'Local Landmark'}`] },
          { day: 2, title: "Culture & Sightseeing", activities: [`Explore ${nearbyPlaces[1]?.name || 'Historic Site'}`, `Lunch near ${nearbyPlaces[2]?.name || 'City Square'}`] }
        ]
      });
      setDestination(target);
      setView('planner');
      setMapVisible(true);
      setNavMode(true);
      setActivePoiIndex(0);
    } catch (err) { 
      console.error(err);
      alert(err.message); 
    } finally { 
      setLoading(false); 
    }
  };

  const routePath = currentData.nearby.length > 0 ? [currentData.coords, ...currentData.nearby.map(p => p.coords)] : [];

  if (view === 'auth') {
    return (
      <div className="auth-fullscreen-container">
        <div className="auth-video-bg">
          <img src="https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1?q=80&w=2070&auto=format&fit=crop" alt="Cinematic" />
        </div>
        <div className="auth-black-overlay"></div>
        
        <motion.div className="auth-premium-card glass-v4" initial={{ opacity: 0, y: 50 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8 }}>
          <div className="auth-brand-area">
            <motion.div className="auth-logo-sphere" animate={{ rotate: 360 }} transition={{ duration: 20, repeat: Infinity, ease: "linear" }}><Globe size={48} color="#6366f1" /></motion.div>
            <h1 className="auth-title">ROVE <span>AI</span></h1>
            <p className="auth-subtitle">THE FUTURE OF GLOBAL EXPLORATION</p>
          </div>
          <form className="auth-modern-form" onSubmit={handleAuth}>
            <AnimatePresence mode="wait">
              {!isLogin && (
                <motion.div className="auth-input-wrapper" initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }}>
                  <User size={20} className="auth-icon" />
                  <input type="text" placeholder="Full Name" className="auth-premium-input" required />
                </motion.div>
              )}
            </AnimatePresence>
            <div className="auth-input-wrapper"><Mail size={20} className="auth-icon" /><input type="email" placeholder="Email Address" className="auth-premium-input" required /></div>
            <div className="auth-input-wrapper"><Lock size={20} className="auth-icon" /><input type="password" placeholder="Password" className="auth-premium-input" required /></div>
            <motion.button className="auth-submit-btn" whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
              {loading ? <div className="auth-spinner"></div> : (isLogin ? 'SIGN IN TO DISCOVER' : 'JOIN THE VOYAGE')}
            </motion.button>
          </form>
          <p className="auth-toggle-text">{isLogin ? "DON'T HAVE AN ACCOUNT?" : "ALREADY A MEMBER?"} <span onClick={() => setIsLogin(!isLogin)}>{isLogin ? ' REGISTER' : ' LOGIN'}</span></p>
        </motion.div>
        <style>{`
          .auth-fullscreen-container { height: 100vh; width: 100vw; display: flex; align-items: center; justify-content: center; position: relative; background: #000; overflow: hidden; font-family: 'Outfit', sans-serif; }
          .auth-video-bg { position: absolute; top: 0; left: 0; width: 100%; height: 100%; z-index: 0; }
          .auth-video-bg img { width: 100%; height: 100%; object-fit: cover; filter: brightness(0.6) scale(1.1); animation: kenBurns 30s infinite alternate ease-in-out; }
          @keyframes kenBurns { from { transform: scale(1); } to { transform: scale(1.2) rotate(1deg); } }
          .auth-black-overlay { position: absolute; top: 0; left: 0; width: 100%; height: 100%; background: radial-gradient(circle at center, transparent 0%, rgba(0,0,0,0.8) 100%); z-index: 1; }
          .auth-premium-card { position: relative; z-index: 10; width: 100%; max-width: 450px; padding: 4rem 3rem; text-align: center; border-radius: 40px; }
          .glass-v4 { background: rgba(2, 6, 23, 0.4); backdrop-filter: blur(40px); -webkit-backdrop-filter: blur(40px); border: 1px solid rgba(255, 255, 255, 0.1); box-shadow: 0 50px 100px rgba(0,0,0,0.5); }
          .auth-brand-area { margin-bottom: 3rem; }
          .auth-title { font-size: 2.2rem; font-weight: 900; letter-spacing: 6px; color: #fff; margin-bottom: 0.5rem; }
          .auth-title span { color: #6366f1; }
          .auth-modern-form { display: flex; flex-direction: column; gap: 1.5rem; }
          .auth-input-wrapper { position: relative; display: flex; align-items: center; background: rgba(255, 255, 255, 0.03); border: 1px solid rgba(255, 255, 255, 0.08); border-radius: 18px; padding: 0 1.2rem; }
          .auth-premium-input { flex: 1; background: transparent; border: none; padding: 1.2rem; color: #fff; font-size: 1rem; outline: none; }
          .auth-submit-btn { background: linear-gradient(135deg, #6366f1 0%, #4f46e5 100%); color: #fff; border: none; padding: 1.3rem; border-radius: 20px; font-size: 0.9rem; font-weight: 900; letter-spacing: 2px; cursor: pointer; }
          .auth-toggle-text { margin-top: 3rem; font-size: 0.8rem; color: #64748b; }
          .auth-spinner { width: 20px; height: 20px; border: 3px solid rgba(255,255,255,0.2); border-top-color: #fff; border-radius: 50%; animation: spin 0.8s linear infinite; margin: 0 auto; }
          @keyframes spin { to { transform: rotate(360deg); } }
        `}</style>
      </div>
    );
  }

  return (
    <div className="app-container-excellent">
      {/* FULL-FLEDGED NAVIGATION MAP */}
      <div className={`map-v3-excellent ${mapOpen ? 'expanded' : 'minimized'}`}>
        <MapContainer center={currentData.coords} zoom={mapOpen ? 16 : 13} style={{ height: '100%', width: '100%' }} zoomControl={false}>
          <TileLayer url={MAP_VIEWS[mapType].url} />
          <MapController coords={navMode && currentData.nearby[activePoiIndex] ? currentData.nearby[activePoiIndex].coords : currentData.coords} isExpanded={mapOpen} />
          <Marker position={currentData.coords}><Popup><b>Origin: {destination}</b></Popup></Marker>
          {navMode && routePath.length > 1 && <Polyline positions={routePath} color="#6366f1" weight={5} opacity={0.7} />}
          {currentData.nearby.map((place, i) => (
            <Marker key={i} position={place.coords}>
              <Popup>
                <div className="excellent-popup">
                  <b>{place.name}</b><br/><span>Stop {i + 1}</span><br/>
                  <button className="btn-mini-excellent" onClick={() => setActivePoiIndex(i)}>Navigate Here</button>
                </div>
              </Popup>
            </Marker>
          ))}
        </MapContainer>
        <div className="map-tools-excellent">
          <button className="tool-btn-excellent" onClick={() => setMapType(mapType === 'satellite' ? 'standard' : 'satellite')}>{mapType === 'satellite' ? <Globe /> : <Layers />}</button>
          <button className="tool-btn-excellent" onClick={() => setMapOpen(!mapOpen)}>{mapOpen ? <Minimize2 /> : <Maximize2 />}</button>
        </div>
        <AnimatePresence>
          {navMode && currentData.nearby.length > 0 && (
            <motion.div className="ai-guide-panel-excellent glass-excellent" initial={{ x: 400 }} animate={{ x: 0 }} exit={{ x: 400 }}>
              <div className="guide-header"><Sparkles size={18} /> AI GUIDANCE ACTIVE</div>
              <h3>{currentData.nearby[activePoiIndex]?.name}</h3>
              <p className="dist-text">{currentData.nearby[activePoiIndex]?.distance} away</p>
              <div className="guide-tip"><Info size={14} /> AI Tip: This {currentData.nearby[activePoiIndex]?.type} is a must-see! Use local transit for the best experience.</div>
              <button className="btn-next-excellent" onClick={() => setActivePoiIndex((activePoiIndex + 1) % currentData.nearby.length)}>Next Stop <ChevronRight size={18} /></button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <nav className="navbar-excellent glass-excellent">
        <div className="brand-excellent"><Zap size={28} /> ROVE AI</div>
        <div className="nav-links-excellent">
          {view === 'planner' && <button className="btn-sec-excellent" onClick={() => setView('discovery')}>New Discovery</button>}
          <div className="user-profile-excellent"><User size={20} /></div>
        </div>
      </nav>

      <main className="content-excellent">
        {view === 'discovery' ? (
          <div className="discovery-excellent">
            <motion.div className="discovery-hero" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
              <h1 className="hero-title-excellent">Where will <span>AI</span> take you?</h1>
              <p className="hero-sub-excellent">Enter any city on Earth and watch ROVE AI build your perfect visual itinerary.</p>
              <div className="search-bar-excellent glass-excellent">
                <Search size={24} color="#64748b" />
                <input type="text" placeholder="Explore Chennai, Paris, Tokyo..." value={destination} onChange={(e) => setDestination(e.target.value)} onKeyPress={(e) => e.key === 'Enter' && handleDiscovery()} />
                <button className="btn-search-excellent" onClick={() => handleDiscovery()} disabled={loading}>{loading ? 'ROVING...' : 'Explore Now'}</button>
              </div>
            </motion.div>

            <div className="trending-section">
              <h3><TrendingUp size={20} color="#6366f1" /> Popular Voyages</h3>
              <div className="trending-grid">
                {TRENDING.map((city, i) => (
                  <motion.div key={i} className="trending-card glass-excellent" whileHover={{ y: -10 }} onClick={() => handleDiscovery(city.name)}>
                    <img src={city.img} alt={city.name} />
                    <div className="trending-info">
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <h4>{city.name}</h4>
                        <Heart size={16} color="#ef4444" fill="#ef4444" />
                      </div>
                      <p>{city.desc}</p>
                      <div className="trending-footer-excellent">
                        <span className="trending-stars"><Star size={12} fill="#fbbf24" color="#fbbf24" /> 4.9</span>
                        <span className="trending-loc"><MapPin size={12} /> {city.country}</span>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="planner-layout-excellent">
            <div className="planner-main">
              <div className="header-card-excellent glass-excellent">
                <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
                  <div className="city-box-excellent"><MapPin size={32} /></div>
                  <div>
                    <span className="sub-header-excellent">AI OPTIMIZED ROUTE</span>
                    <h2 className="city-title-excellent">{destination}</h2>
                  </div>
                </div>
                <div className="live-status-excellent"><Activity size={16} /> LIVE DATA FEED</div>
              </div>

              <div className="route-steps-excellent">
                {currentData.nearby.length > 0 ? currentData.nearby.map((place, i) => (
                  <motion.div key={i} className={`step-card-excellent glass-excellent ${activePoiIndex === i ? 'active' : ''}`} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }}>
                    <div className="step-badge">{i + 1}</div>
                    <div className="step-content">
                      <h4>{place.name}</h4>
                      <p>{place.type.replace(/_/g, ' ')} • <span className="dist-tag">{place.distance}</span></p>
                    </div>
                    <div className="step-actions-excellent">
                      <button className="btn-navigate-excellent" onClick={() => { setActivePoiIndex(i); setMapOpen(true); }}>NAVIGATE</button>
                    </div>
                  </motion.div>
                )) : (
                  <div className="glass-excellent no-data-v3">
                    <Info size={40} color="#64748b" />
                    <p>No sightseeing hubs found in this exact area. Try expanding your search or choosing a city center!</p>
                  </div>
                )}
              </div>
            </div>

            <aside className="planner-sidebar">
              <div className="widget-excellent glass-excellent">
                <h3><ShieldCheck size={20} color="#6366f1" /> Voyage Quality</h3>
                <p>ROVE AI has analyzed this itinerary for sightseeing value and travel logistics.</p>
                <div className="progress-excellent"><div className="fill-excellent" style={{ width: '95%' }}></div></div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.5rem' }}>
                   <span className="progress-label">95% Score</span>
                   <span className="progress-label">Optimal</span>
                </div>
              </div>
              <div className="widget-excellent glass-excellent" style={{ marginTop: '1.5rem' }}>
                <h3><Camera size={20} color="#6366f1" /> Photo Spots</h3>
                <div className="photo-grid-excellent">
                  {currentData.nearby.slice(0, 4).map((p, i) => (
                    <div key={i} className="photo-placeholder-v3"><Star size={14} /></div>
                  ))}
                </div>
                <p style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '1rem' }}>AI identified {currentData.nearby.length} iconic photo opportunities on this route.</p>
              </div>
            </aside>
          </div>
        )}
      </main>

      <style>{`
        :root { --p: #6366f1; --bg: #020617; --g: rgba(255,255,255,0.03); --gb: rgba(255,255,255,0.08); }
        body { background: var(--bg); color: #f8fafc; font-family: 'Outfit', sans-serif; overflow-x: hidden; }
        .glass-excellent { background: var(--g); backdrop-filter: blur(24px); border: 1px solid var(--gb); border-radius: 24px; }
        .navbar-excellent { margin: 1rem 2rem; padding: 1rem 2.5rem; display: flex; justify-content: space-between; align-items: center; position: sticky; top: 1rem; z-index: 100; }
        .brand-excellent { font-size: 1.5rem; font-weight: 900; letter-spacing: 4px; color: var(--p); display: flex; align-items: center; gap: 0.8rem; }
        .content-excellent { max-width: 1400px; margin: 0 auto; padding: 1rem 2rem; }
        .hero-title-excellent { font-size: 5rem; font-weight: 900; line-height: 1.1; margin-bottom: 1.5rem; }
        .hero-title-excellent span { color: var(--p); }
        .search-bar-excellent { max-width: 800px; margin: 0 auto; padding: 0.8rem 1.5rem; display: flex; align-items: center; gap: 1rem; }
        .search-bar-excellent input { flex: 1; background: transparent; border: none; padding: 1rem; color: white; font-size: 1.2rem; outline: none; }
        .btn-search-excellent { background: var(--p); border: none; padding: 1rem 2.5rem; border-radius: 16px; color: white; font-weight: 800; cursor: pointer; transition: 0.3s; }
        .trending-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 2rem; }
        .trending-card { overflow: hidden; position: relative; cursor: pointer; transition: 0.4s; height: 350px; }
        .trending-card img { width: 100%; height: 180px; object-fit: cover; border-radius: 20px; margin-bottom: 1rem; }
        .trending-info { padding: 0 1.5rem 1.5rem; }
        .trending-info p { font-size: 0.85rem; color: #94a3b8; margin: 0.5rem 0 1rem; line-height: 1.4; }
        .trending-footer-excellent { display: flex; justify-content: space-between; border-top: 1px solid var(--gb); padding-top: 1rem; }
        .trending-loc { font-size: 0.75rem; color: #64748b; display: flex; align-items: center; gap: 0.3rem; }
        .planner-layout-excellent { display: grid; grid-template-columns: 2.5fr 1fr; gap: 2rem; margin-top: 2rem; }
        .header-card-excellent { padding: 2.5rem; display: flex; justify-content: space-between; align-items: center; margin-bottom: 2rem; }
        .city-title-excellent { font-size: 3rem; font-weight: 900; }
        .step-card-excellent { padding: 1.5rem 1.8rem; display: flex; align-items: center; gap: 2rem; margin-bottom: 1rem; transition: 0.3s; position: relative; }
        .step-card-excellent.active { border-color: var(--p); background: rgba(99, 102, 241, 0.05); }
        .step-badge { width: 40px; height: 40px; background: var(--p); border-radius: 12px; display: flex; align-items: center; justify-content: center; font-weight: 900; font-size: 1.1rem; }
        .dist-tag { color: var(--p); font-weight: 800; }
        .no-data-v3 { padding: 4rem; text-align: center; color: #64748b; display: flex; flex-direction: column; align-items: center; gap: 1rem; }
        .photo-grid-excellent { display: grid; grid-template-columns: repeat(4, 1fr); gap: 0.8rem; margin-top: 1.5rem; }
        .photo-placeholder-v3 { height: 60px; background: var(--gb); border-radius: 12px; display: flex; align-items: center; justify-content: center; color: #475569; border: 1px dashed rgba(255,255,255,0.1); }
        .map-v3-excellent { position: fixed; bottom: 2rem; right: 2rem; width: 450px; height: 350px; z-index: 2000; transition: all 0.7s cubic-bezier(0.4, 0, 0.2, 1); border-radius: 32px; overflow: hidden; box-shadow: 0 40px 100px rgba(0,0,0,0.6); }
        .map-v3-excellent.expanded { top: 0; left: 0; width: 100vw; height: 100vh; border-radius: 0; }
        .ai-guide-panel-excellent { position: absolute; bottom: 2rem; left: 2rem; width: 350px; padding: 2rem; z-index: 2100; border-bottom: 4px solid var(--p); }
        .progress-excellent { height: 8px; background: rgba(255,255,255,0.05); border-radius: 4px; margin-top: 1.5rem; overflow: hidden; }
        .fill-excellent { height: 100%; background: linear-gradient(to right, #6366f1, #a855f7); }
        .btn-mini-excellent { background: var(--p); border: none; padding: 0.4rem 0.8rem; border-radius: 8px; color: white; font-weight: 700; cursor: pointer; margin-top: 0.5rem; font-size: 0.75rem; }
      `}</style>
    </div>
  );
}

export default App;
