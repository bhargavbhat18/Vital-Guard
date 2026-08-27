# VitalGuard — Run Guide

## Terminals

### Terminal 1 — Java Spring Boot Backend
```bash
cd backend-java
mvn spring-boot:run
```
The backend runs at `http://localhost:8000`.

### Terminal 2 — React Vite Frontend
```bash
cd frontend
npm run dev
```
The React development server runs at `http://localhost:5173`.

### Terminal 3 — Simulator & Scenario Verification
```bash
cd simulator
python3 -m venv venv && source venv/bin/activate
./venv/bin/pip install numpy requests python-dotenv websocket-client
./venv/bin/python verify_all_scenarios.py
```

## All Integration Requirements Covered
- ✅ Patient Profile / Database Setup (MySQL)
- ✅ Intelligent SOS Classification (Cardiology / Pulmonology / Fallback to Emergency)
- ✅ Hospital Capability / Department Filtering / Routing Fallback
- ✅ Nearest Ambulance Allocation (Location-Based Geolocation matching)
- ✅ Ambulance Dispatch Status Lock (Concurrent prevention)
- ✅ Real-time Coordinate Updates (OSRM routing + SockJS WebSocket Broker)
