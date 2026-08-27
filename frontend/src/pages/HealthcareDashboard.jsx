import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import API from '../services/api';
import { createStompClient } from '../services/websocket';

const HealthcareDashboard = () => {
  const { logout } = useAuth();
  const [activeTab, setActiveTab] = useState('queue');
  const [hospitals, setHospitals] = useState([]);
  const [selectedHospital, setSelectedHospital] = useState(null);
  
  // Resources for selected hospital
  const [departments, setDepartments] = useState([]);
  const [doctors, setDoctors] = useState([]);
  const [emergencies, setEmergencies] = useState([]);
  const [selectedEmergency, setSelectedEmergency] = useState(null);
  const [patientProfile, setPatientProfile] = useState(null);
  const [patientHistory, setPatientHistory] = useState([]);
  const [patientVitals, setPatientVitals] = useState(null);

  const stompClientRef = useRef(null);

  useEffect(() => {
    loadHospitals();
    loadEmergencies();
  }, []);

  useEffect(() => {
    if (selectedHospital) {
      loadHospitalDetails(selectedHospital.name);
    }
  }, [selectedHospital]);

  useEffect(() => {
    if (selectedEmergency) {
      loadPatientDetails(selectedEmergency.patientUid);
    }
  }, [selectedEmergency]);

  // Handle STOMP WebSocket broadcasts
  useEffect(() => {
    const client = createStompClient(
      () => {
        console.log('Healthcare STOMP connected.');
        
        // Refresh when a new SOS is dispatched
        client.subscribe('/topic/hospital-queue-refresh', () => {
          loadEmergencies();
        });

        // Listen for live emergency progress updates
        client.subscribe('/topic/emergency-updates', (msg) => {
          const data = JSON.parse(msg.body);
          // Auto-refresh stats and queues
          loadEmergencies();
          if (selectedHospital) {
            loadHospitalDetails(selectedHospital.name);
          }
          if (selectedEmergency && selectedEmergency.id === data.sosId) {
            setSelectedEmergency(prev => ({ ...prev, status: data.status }));
          }
        });
      },
      (err) => {
        console.error('STOMP connection error:', err);
      }
    );

    client.activate();
    stompClientRef.current = client;

    return () => {
      if (stompClientRef.current) {
        stompClientRef.current.deactivate();
      }
    };
  }, [selectedHospital?.id, selectedEmergency?.id]);

  const loadHospitals = async () => {
    try {
      const res = await API.get('/hospital');
      setHospitals(res.data);
      if (res.data.length > 0) {
        setSelectedHospital(res.data[0]); // default to first hospital
      }
    } catch (err) {
      console.error(err);
    }
  };

  const loadHospitalDetails = async (hospitalName) => {
    try {
      const res = await API.get(`/hospital/departments/${encodeURIComponent(hospitalName)}`);
      setDepartments(res.data.departments || []);
      setDoctors(res.data.doctors || []);
    } catch (err) {
      console.error(err);
    }
  };

  const loadEmergencies = async () => {
    try {
      const res = await API.get('/hospital/emergencies');
      setEmergencies(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  const loadPatientDetails = async (uid) => {
    try {
      // Load medical profile
      const profRes = await API.get(`/patients/${uid}/medical-profile`);
      setPatientProfile(profRes.data);

      // Load medical history
      const histRes = await API.get(`/patients/${uid}/medical-history`);
      setPatientHistory(histRes.data);

      // Load latest vitals
      const vitalsRes = await API.get(`/analysis/predict/${uid}`);
      setPatientVitals(vitalsRes.data);
    } catch (err) {
      console.error(err);
    }
  };

  const acceptCase = async (id) => {
    try {
      const res = await API.post(`/emergency/${id}/accept`);
      alert('Emergency request accepted. Doctor and nearest ambulance dispatched.');
      loadEmergencies();
      setSelectedEmergency(res.data);
      if (selectedHospital) {
        loadHospitalDetails(selectedHospital.name);
      }
    } catch (err) {
      alert('Failed to accept case.');
    }
  };

  const resolveCase = async (id) => {
    try {
      await API.post(`/hospital/resolve/${id}`);
      alert('Case marked as resolved. Ambulance and beds released.');
      setSelectedEmergency(null);
      setPatientProfile(null);
      setPatientHistory([]);
      setPatientVitals(null);
      loadEmergencies();
      if (selectedHospital) {
        loadHospitalDetails(selectedHospital.name);
      }
    } catch (err) {
      alert('Failed to resolve case.');
    }
  };

  const toggleDoctor = async (doc, field) => {
    const updatedDoc = {
      id: doc.id,
      onDuty: field === 'onDuty' ? !doc.onDuty : doc.onDuty,
      availableForEmergency: field === 'availableForEmergency' ? !doc.availableForEmergency : doc.availableForEmergency
    };

    try {
      await API.post('/hospital/doctors/status', updatedDoc);
      if (selectedHospital) {
        loadHospitalDetails(selectedHospital.name);
      }
    } catch (err) {
      alert('Failed to update doctor status.');
    }
  };

  const updateBeds = async (dep, offset) => {
    const updatedDep = {
      id: dep.id,
      available: dep.available,
      emergencyService: dep.emergencyService,
      acceptingPatients: dep.acceptingPatients,
      availableBeds: Math.max(0, dep.availableBeds + offset),
      availableDoctors: dep.availableDoctors
    };

    try {
      await API.post('/hospital/departments', updatedDep);
      if (selectedHospital) {
        loadHospitalDetails(selectedHospital.name);
      }
    } catch (err) {
      alert('Failed to update bed details.');
    }
  };

  const themeClass = 'theme-doctor';

  return (
    <div className={`dashboard-wrapper ${themeClass}`}>
      {/* Sidebar */}
      <aside className="sidebar">
        <div className="sidebar-logo">🩺</div>
        <nav className="sidebar-nav">
          <button className={`nav-btn ${activeTab === 'queue' ? 'active' : ''}`} onClick={() => setActiveTab('queue')}>
            🚨 <span className="tip">Emergency Queue</span>
          </button>
          <button className={`nav-btn ${activeTab === 'resources' ? 'active' : ''}`} onClick={() => setActiveTab('resources')}>
            🏥 <span className="tip">Resources Manager</span>
          </button>
        </nav>
        <div className="sidebar-bottom">
          <button className="nav-btn" onClick={logout} style={{ color: 'var(--accent-red)' }}>
            🚪 <span className="tip">Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="main-container">
        {/* Header */}
        <header className="top-header">
          <div className="header-title" style={{ display: 'flex', alignItems: 'center', gap: 15 }}>
            <div>
              <h1>VitalGuard Healthcare Dashboard</h1>
              <div className="subtitle">Real-time Clinical Dispatch & Queue Management</div>
            </div>
            
            <select
              value={selectedHospital?.id || ''}
              onChange={(e) => {
                const hosp = hospitals.find(h => h.id === parseInt(e.target.value));
                if (hosp) setSelectedHospital(hosp);
              }}
              style={{ padding: '6px 12px', borderRadius: 8, border: '1px solid var(--border-color)', fontWeight: 600, fontSize: 13 }}
            >
              {hospitals.map(h => (
                <option key={h.id} value={h.id}>{h.name}</option>
              ))}
            </select>
          </div>
          <div className="header-right">
            <div className="status-badge">
              <span className="status-dot"></span>
              Live Queue Syncing
            </div>
            <div className="clock">{new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
          </div>
        </header>

        <main className="main-content">
          {/* TAB 1: EMERGENCY QUEUE */}
          {activeTab === 'queue' && (
            <div className="tab-view active">
              <div className="page-header-bar">
                <h2 className="page-title">SOS Real-time Dispatch Queue</h2>
              </div>

              {/* Queue columns layout */}
              <div className="emergencies-queue-layout">
                {/* Queue list */}
                <div className="queue-list-panel panel">
                  <div className="panel-header">
                    <div className="panel-title">Active SOS Incidents ({emergencies.length})</div>
                  </div>
                  <div className="panel-body list-scrollable">
                    {emergencies.length > 0 ? (
                      <div className="queue-items">
                        {emergencies.map((eq) => (
                          <div
                            key={eq.id}
                            className={`queue-item-card ${selectedEmergency?.id === eq.id ? 'active-select' : ''}`}
                            onClick={() => setSelectedEmergency(eq)}
                          >
                            <div className="q-card-header">
                              <span className="badge red">SOS-{eq.id}</span>
                              <span className="q-status-badge">{eq.status}</span>
                            </div>
                            <div className="q-symptoms">{eq.symptoms}</div>
                            <div className="q-patient-uid">Patient UID: {eq.patientUid}</div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p style={{ color: 'var(--text-muted)', padding: 20 }}>✓ No active emergency events reported.</p>
                    )}
                  </div>
                </div>

                {/* Queue details & patient snapshot */}
                <div className="emergency-details-panel panel">
                  <div className="panel-header">
                    <div className="panel-title">Patient Emergency Snapshot</div>
                  </div>
                  <div className="panel-body details-wrapper" style={{ padding: 20 }}>
                    {selectedEmergency ? (
                      <div className="patient-snapshot-data">
                        <div className="snapshot-header-row">
                          <h3>Emergency Event Details</h3>
                          <div className="action-buttons-row">
                            {selectedEmergency.status === 'HOSPITAL_ASSIGNED' && (
                              <button onClick={() => acceptCase(selectedEmergency.id)} className="btn-green-accept">
                                ✓ ACCEPT CASE
                              </button>
                            )}
                            {['ACCEPTED', 'DOCTOR_ASSIGNED', 'AMBULANCE_ASSIGNED', 'AMBULANCE_EN_ROUTE', 'PATIENT_PICKED_UP', 'ARRIVED_AT_HOSPITAL'].includes(selectedEmergency.status) && (
                              <button onClick={() => resolveCase(selectedEmergency.id)} className="btn-resolve">
                                🏁 RESOLVE & RELEASE Resources
                              </button>
                            )}
                          </div>
                        </div>

                        {/* General details */}
                        <div className="details-card">
                          <p><strong>Emergency Department Assigned:</strong> {selectedEmergency.requiredDepartment}</p>
                          <p><strong>Reported Symptoms:</strong> {selectedEmergency.symptoms}</p>
                          <p><strong>Description:</strong> {selectedEmergency.symptomDescription || 'None'}</p>
                          <p><strong>Coordinates:</strong> {selectedEmergency.latitude.toFixed(4)}, {selectedEmergency.longitude.toFixed(4)}</p>
                        </div>

                        {/* Patient Medical Profile Context */}
                        <div className="details-card-section">
                          <h4>Patient Emergency Medical Profile</h4>
                          {patientProfile ? (
                            <div className="profile-details-grid">
                              <p><strong>Existing Conditions:</strong> {patientProfile.existingConditions}</p>
                              <p><strong>Cardiac Problems:</strong> {patientProfile.previousHeartProblems}</p>
                              <p><strong>Allergies:</strong> {patientProfile.allergies}</p>
                              <p><strong>Active Medications:</strong> {patientProfile.currentMedications}</p>
                              <div className="vitals-checks" style={{ display: 'flex', gap: 10 }}>
                                <span className={`badge ${patientProfile.diabetes ? 'amber' : 'green'}`}>Diabetes: {patientProfile.diabetes ? 'Yes' : 'No'}</span>
                                <span className={`badge ${patientProfile.hypertension ? 'amber' : 'green'}`}>Hypertension: {patientProfile.hypertension ? 'Yes' : 'No'}</span>
                                <span className={`badge ${patientProfile.asthma ? 'amber' : 'green'}`}>Asthma: {patientProfile.asthma ? 'Yes' : 'No'}</span>
                              </div>
                            </div>
                          ) : (
                            <p style={{ color: 'var(--text-muted)', fontSize: 12 }}>No medical profile context registered for this patient.</p>
                          )}
                        </div>

                        {/* Patient ML Trend predictions */}
                        <div className="details-card-section">
                          <h4>Vitals Trend Predictions (1D Regression analysis)</h4>
                          {patientVitals ? (
                            <div className="vitals-trends-box">
                              <p><strong>System Risk Score:</strong> {patientVitals.risk_score} / 100 ({patientVitals.prediction.toUpperCase()})</p>
                              {patientVitals.warnings && patientVitals.warnings.length > 0 && (
                                <ul>
                                  {patientVitals.warnings.map((w, idx) => (
                                    <li key={idx} style={{ color: 'var(--accent-red)', fontSize: 12 }}>⚠️ {w}</li>
                                  ))}
                                </ul>
                              )}
                            </div>
                          ) : (
                            <p style={{ color: 'var(--text-muted)', fontSize: 12 }}>No vitals analysis predictions available.</p>
                          )}
                        </div>

                        {/* Patient medical history */}
                        <div className="details-card-section">
                          <h4>Patient Historical Medical Records</h4>
                          {patientHistory.length > 0 ? (
                            <div className="history-entries-scroll">
                              {patientHistory.map((h) => (
                                <div key={h.id} className="history-entry-mini-card">
                                  <div className="history-entry-header">
                                    <span className="entry-title">{h.diagnosis}</span>
                                    <span className="entry-date">{h.date}</span>
                                  </div>
                                  <p className="entry-desc"><strong>Treatment:</strong> {h.treatment} (Dr. {h.doctor})</p>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p style={{ color: 'var(--text-muted)', fontSize: 12 }}>No history logs found for this patient.</p>
                          )}
                        </div>
                      </div>
                    ) : (
                      <p style={{ color: 'var(--text-muted)' }}>Select an active emergency card from the queue to view details.</p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: RESOURCE MANAGER */}
          {activeTab === 'resources' && (
            <div className="tab-view active">
              <div className="page-header-bar">
                <h2 className="page-title">{selectedHospital?.name} Resource Controls</h2>
              </div>

              <div className="dashboard-grid">
                {/* Department beds panel */}
                <div className="panel">
                  <div className="panel-header">
                    <div className="panel-title">Department Beds Availability</div>
                  </div>
                  <div className="panel-body" style={{ padding: 20 }}>
                    <div className="departments-list">
                      {departments.map((dep) => (
                        <div key={dep.id} className="dep-resource-card">
                          <div className="dep-title-row">
                            <span className="dep-name">{dep.name}</span>
                            <span className={`badge ${dep.available ? 'green' : 'red'}`}>
                              {dep.available ? 'Available' : 'Unavailable'}
                            </span>
                          </div>
                          <div className="dep-details-row">
                            <span>Available Beds: <strong>{dep.availableBeds}</strong> / {dep.totalBeds}</span>
                            <div className="beds-adjuster-buttons">
                              <button onClick={() => updateBeds(dep, 1)} className="adjust-btn">+</button>
                              <button onClick={() => updateBeds(dep, -1)} className="adjust-btn">-</button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Doctors list panel */}
                <div className="panel">
                  <div className="panel-header">
                    <div className="panel-title">Specialized Doctors Directory</div>
                  </div>
                  <div className="panel-body" style={{ padding: 20 }}>
                    <div className="doctors-list">
                      {doctors.map((doc) => (
                        <div key={doc.id} className="doc-resource-card">
                          <div className="doc-header-row">
                            <span className="doc-name">{doc.name}</span>
                            <span className="doc-spec">{doc.specialization}</span>
                          </div>
                          <div className="doc-status-switches">
                            <label className="toggle-switch-container">
                              <input
                                type="checkbox"
                                checked={doc.onDuty}
                                onChange={() => toggleDoctor(doc, 'onDuty')}
                              />
                              On Duty
                            </label>
                            <label className="toggle-switch-container">
                              <input
                                type="checkbox"
                                checked={doc.availableForEmergency}
                                onChange={() => toggleDoctor(doc, 'availableForEmergency')}
                              />
                              Available for Emergency
                            </label>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
};

export default HealthcareDashboard;
