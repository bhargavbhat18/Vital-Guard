import React, { useEffect, useRef } from 'react';

const L = window.L;

const MapComponent = ({ patientLoc, ambulanceLoc, hospitalLoc }) => {
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  
  const patientMarkerRef = useRef(null);
  const ambulanceMarkerRef = useRef(null);
  const hospitalMarkerRef = useRef(null);
  const routePolylineRef = useRef(null);

  useEffect(() => {
    if (!mapRef.current) return;

    // Initialize map
    const defaultLat = patientLoc ? patientLoc[0] : 12.9716;
    const defaultLng = patientLoc ? patientLoc[1] : 77.5946;
    
    const map = L.map(mapRef.current, {
      zoomControl: true,
      scrollWheelZoom: true,
    }).setView([defaultLat, defaultLng], 13);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
    }).addTo(map);

    mapInstanceRef.current = map;

    // Clean up on unmount
    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    const bounds = [];

    // 1. Update Patient Marker
    if (patientLoc && patientLoc[0] && patientLoc[1]) {
      const patientIcon = L.divIcon({
        html: `<div style="font-size: 28px; filter: drop-shadow(0 2px 4px rgba(0,0,0,0.25)); text-align: center;">👤</div>`,
        className: 'custom-patient-icon',
        iconSize: [30, 30],
        iconAnchor: [15, 15]
      });

      if (patientMarkerRef.current) {
        patientMarkerRef.current.setLatLng(patientLoc);
      } else {
        patientMarkerRef.current = L.marker(patientLoc, { icon: patientIcon })
          .bindPopup('Patient (Emergency Location)')
          .addTo(map);
      }
      bounds.push(patientLoc);
    } else if (patientMarkerRef.current) {
      map.removeLayer(patientMarkerRef.current);
      patientMarkerRef.current = null;
    }

    // 2. Update Hospital Marker
    if (hospitalLoc && hospitalLoc[0] && hospitalLoc[1]) {
      const hospitalIcon = L.divIcon({
        html: `<div style="font-size: 28px; filter: drop-shadow(0 2px 4px rgba(0,0,0,0.25)); text-align: center;">🏥</div>`,
        className: 'custom-hospital-icon',
        iconSize: [30, 30],
        iconAnchor: [15, 15]
      });

      if (hospitalMarkerRef.current) {
        hospitalMarkerRef.current.setLatLng(hospitalLoc);
      } else {
        hospitalMarkerRef.current = L.marker(hospitalLoc, { icon: hospitalIcon })
          .bindPopup('Assigned Hospital')
          .addTo(map);
      }
      bounds.push(hospitalLoc);
    } else if (hospitalMarkerRef.current) {
      map.removeLayer(hospitalMarkerRef.current);
      hospitalMarkerRef.current = null;
    }

    // 3. Update Ambulance Marker
    if (ambulanceLoc && ambulanceLoc[0] && ambulanceLoc[1]) {
      const ambulanceIcon = L.divIcon({
        html: `<div style="font-size: 32px; filter: drop-shadow(0 4px 6px rgba(0,0,0,0.3)); text-align: center; animation: pulse-ambulance 1s infinite alternate;">🚑</div>`,
        className: 'custom-ambulance-icon',
        iconSize: [36, 36],
        iconAnchor: [18, 18]
      });

      if (ambulanceMarkerRef.current) {
        ambulanceMarkerRef.current.setLatLng(ambulanceLoc);
      } else {
        ambulanceMarkerRef.current = L.marker(ambulanceLoc, { icon: ambulanceIcon })
          .bindPopup('Dispatched Ambulance')
          .addTo(map);
      }
      bounds.push(ambulanceLoc);
    } else if (ambulanceMarkerRef.current) {
      map.removeLayer(ambulanceMarkerRef.current);
      ambulanceMarkerRef.current = null;
    }

    // 4. Update Route Line (Draw connection line)
    const points = [];
    if (ambulanceLoc) points.push(ambulanceLoc);
    if (patientLoc) points.push(patientLoc);
    if (hospitalLoc) points.push(hospitalLoc);

    if (points.length >= 2) {
      if (routePolylineRef.current) {
        routePolylineRef.current.setLatLngs(points);
      } else {
        routePolylineRef.current = L.polyline(points, {
          color: '#ef4444',
          weight: 4,
          opacity: 0.7,
          dashArray: '8, 8',
          lineJoin: 'round'
        }).addTo(map);
      }
    } else if (routePolylineRef.current) {
      map.removeLayer(routePolylineRef.current);
      routePolylineRef.current = null;
    }

    // Auto-fit bounds
    if (bounds.length > 0) {
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 15 });
    }
  }, [patientLoc, ambulanceLoc, hospitalLoc]);

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <div ref={mapRef} style={{ width: '100%', height: '100%', borderRadius: '12px' }} />
      <style>{`
        @keyframes pulse-ambulance {
          0% { transform: scale(1); filter: drop-shadow(0 4px 6px rgba(182, 23, 30, 0.4)); }
          100% { transform: scale(1.1); filter: drop-shadow(0 6px 12px rgba(182, 23, 30, 0.7)); }
        }
      `}</style>
    </div>
  );
};

export default MapComponent;
