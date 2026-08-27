import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import API from '../services/api';
import { createStompClient } from '../services/websocket';
import MapComponent from '../components/MapComponent';

const UserDashboard = () => {
  const { user, logout, updateProfile } = useAuth();
  const [activeTab, setActiveTab] = useState('vitals');
  const [vitalsHistory, setVitalsHistory] = useState([]);
  const [latestVital, setLatestVital] = useState(null);
  const [trendAnalysis, setTrendAnalysis] = useState(null);

  // Vital entry form
  const [vitalForm, setVitalForm] = useState({
    heart_rate: 72,
    spO2: 98,
    bp_systolic: 120,
    bp_diastolic: 80,
    glucose: 95,
    temperature: 36.6,
    respiratory_rate: 16
  });

  // SOS state
  const [symptomList, setSymptomList] = useState([]);
  const [symptomDesc, setSymptomDesc] = useState('');
  const [activeSos, setActiveSos] = useState(null);
  const [trackingData, setTrackingData] = useState(null);

  // Medical history state
  const [medHistory, setMedHistory] = useState([]);
  const [medProfile, setMedProfile] = useState(null);
  const [historyForm, setHistoryForm] = useState({
    symptoms: '',
    diagnosis: '',
    department: 'General Medicine',
    hospital: '',
    doctor: '',
    treatment: '',
    medications: '',
    notes: '',
    vitals: ''
  });

  // Telehealth chat state
  const [chatMessages, setChatMessages] = useState([
    { sender: 'AI', text: 'Hello! I am your Med-AI assistant. How can I help you today?' }
  ]);
  const [chatInput, setChatInput] = useState('');

  // Profile setup
  const [profileForm, setProfileForm] = useState({
    existingConditions: '',
    previousHeartProblems: '',
    diabetes: false,
    hypertension: false,
    asthma: false,
    allergies: '',
    currentMedications: ''
  });

  const stompClientRef = useRef(null);

  useEffect(() => {
    loadVitals();
    loadMedicalHistory();
    loadMedicalProfile();
    checkActiveSos();
  }, [user]);

  // Handle WebSocket updates
  useEffect(() => {
    if (!user) return;
    
    // Connect to WebSocket for real-time vitals and SOS updates
    const client = createStompClient(
      () => {
        console.log('STOMP connected successfully.');
        
        // Subscribe to live vitals
        client.subscribe(`/topic/vitals/${user.uid}`, (msg) => {
          const vital = JSON.parse(msg.body);
          setLatestVital(vital);
          setVitalsHistory(prev => [vital, ...prev]);
          loadTrendAnalysis();
        });

        // If there's an active SOS, subscribe to its live tracking channel
        if (activeSos) {
          subscribeToSosTracking(client, activeSos.id);
        }
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
  }, [user, activeSos?.id]);

  const subscribeToSosTracking = (client, sosId) => {
    client.subscribe(`/topic/emergency/${sosId}`, (msg) => {
      const data = JSON.parse(msg.body);
      setTrackingData(data);
      if (data.status === 'ARRIVED_AT_HOSPITAL' || data.status === 'COMPLETED') {
        alert('Ambulance has safely arrived at the hospital.');
        checkActiveSos();
      }
    });
  };

  const loadVitals = async () => {
    try {
      const res = await API.get('/vitals/history');
      setVitalsHistory(res.data);
      if (res.data.length > 0) {
        setLatestVital(res.data[0]);
      }
      loadTrendAnalysis();
    } catch (err) {
      console.error(err);
    }
  };

  const loadTrendAnalysis = async () => {
    if (!user) return;
    try {
      const res = await API.get(`/analysis/predict/${user.uid}`);
      setTrendAnalysis(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  const loadMedicalHistory = async () => {
    try {
      const res = await API.get('/patients/me/medical-history');
      setMedHistory(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  const loadMedicalProfile = async () => {
    try {
      const res = await API.get('/patients/me/medical-profile');
      setMedProfile(res.data);
      setProfileForm({
        existingConditions: res.data.existingConditions || '',
        previousHeartProblems: res.data.previousHeartProblems || '',
        diabetes: res.data.diabetes || false,
        hypertension: res.data.hypertension || false,
        asthma: res.data.asthma || false,
        allergies: res.data.allergies || '',
        currentMedications: res.data.currentMedications || ''
      });
    } catch (err) {
      console.error(err);
    }
  };

  const checkActiveSos = async () => {
    try {
      const res = await API.get('/emergency/active');
      const myActive = res.data.find(req => req.patientUid === user.uid);
      if (myActive) {
        setActiveSos(myActive);
        setTrackingData({
          sosId: myActive.id,
          status: myActive.status,
          ambulanceLatitude: myActive.latitude,
          ambulanceLongitude: myActive.longitude,
          progress: 0.0,
          eta: 'Estimating...'
        });
      } else {
        setActiveSos(null);
        setTrackingData(null);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const postVital = async (e) => {
    e.preventDefault();
    try {
      await API.post('/vitals', vitalForm);
      alert('Vitals logged successfully.');
      loadVitals();
    } catch (err) {
      alert('Failed to log vitals.');
    }
  };

  const toggleSymptom = (sym) => {
    setSymptomList(prev =>
      prev.includes(sym) ? prev.filter(s => s !== sym) : [...prev, sym]
    );
  };

  const triggerSos = async () => {
    if (symptomList.length === 0) {
      alert('Please check at least one symptom.');
      return;
    }

    let lat = 12.9716;
    let lng = 77.5946;

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          lat = position.coords.latitude;
          lng = position.coords.longitude;
          await executeSosTrigger(lat, lng);
        },
        async () => {
          await executeSosTrigger(lat, lng);
        }
      );
    } else {
      await executeSosTrigger(lat, lng);
    }
  };

  const executeSosTrigger = async (lat, lng) => {
    try {
      const res = await API.post('/emergency/sos', {
        alert_message: symptomList.join(', '),
        description: symptomDesc,
        symptoms: symptomList,
        location: { lat, lng }
      });
      setActiveSos(res.data);
      setActiveTab('sos');
      checkActiveSos();
      alert('Emergency Alert Dispatched! Nearest hospital assigned.');
    } catch (err) {
      alert('SOS Trigger Failed.');
    }
  };

  const saveMedProfile = async (e) => {
    e.preventDefault();
    try {
      const res = await API.put('/patients/me/medical-profile', profileForm);
      setMedProfile(res.data);
      alert('Medical emergency profile updated.');
    } catch (err) {
      alert('Failed to save profile.');
    }
  };

  const addHistoryEntry = async (e) => {
    e.preventDefault();
    try {
      await API.post('/patients/me/medical-history', historyForm);
      alert('Medical history entry created successfully.');
      setHistoryForm({
        symptoms: '',
        diagnosis: '',
        department: 'General Medicine',
        hospital: '',
        doctor: '',
        treatment: '',
        medications: '',
        notes: '',
        vitals: ''
      });
      loadMedicalHistory();
    } catch (err) {
      alert('Failed to save history entry.');
    }
  };

  const handleSendChat = () => {
    if (!chatInput.trim()) return;
    const userMsg = { sender: 'User', text: chatInput };
    setChatMessages(prev => [...prev, userMsg]);
    setChatInput('');

    // Simulate AI clinical response
    setTimeout(() => {
      const aiReply = {
        sender: 'AI',
        text: `Consulting Clinical Database: The symptoms you described ("${userMsg.text}") could indicate an acute stressor. Please keep tracking your vitals. If chest pain or severe breathing issues occur, press the emergency SOS trigger button immediately.`
      };
      setChatMessages(prev => [...prev, aiReply]);
    }, 1200);
  };

  // Determine active theme based on user role (patient: teal, family: green/teal)
  const themeClass = 'theme-family';

  return (
    <div className={`dashboard-wrapper ${themeClass}`}>
      {/* Sidebar */}
      <aside className="sidebar">
        <div className="sidebar-logo">🛡️</div>
        <nav className="sidebar-nav">
          <button className={`nav-btn ${activeTab === 'vitals' ? 'active' : ''}`} onClick={() => setActiveTab('vitals')}>
            📊 <span className="tip">Vitals Monitor</span>
          </button>
          <button className={`nav-btn ${activeTab === 'sos' ? 'active' : ''}`} onClick={() => setActiveTab('sos')}>
            🚨 <span className="tip">Emergency SOS</span>
          </button>
          <button className={`nav-btn ${activeTab === 'history' ? 'active' : ''}`} onClick={() => setActiveTab('history')}>
            📂 <span className="tip">Medical Records</span>
          </button>
          <button className={`nav-btn ${activeTab === 'chat' ? 'active' : ''}`} onClick={() => setActiveTab('chat')}>
            💬 <span className="tip">Med-AI Chat</span>
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
          <div className="header-title">
            <h1>VitalGuard User Dashboard</h1>
            <div className="subtitle">Welcome back, {user?.fullName || 'User'} ({user?.uid})</div>
          </div>
          <div className="header-right">
            <div className="status-badge">
              <span className="status-dot"></span>
              Live Monitoring Active
            </div>
            <div className="clock">{new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
          </div>
        </header>

        <main className="main-content">
          {/* TAB 1: VITALS */}
          {activeTab === 'vitals' && (
            <div className="tab-view active">
              <div className="page-header-bar">
                <h2 className="page-title">Vitals & Health Trends</h2>
              </div>

              {/* Gauges row */}
              <div className="vitals-grid">
                <div className="gauge-card">
                  <div className="gauge-label">Heart Rate</div>
                  <div className="gauge-ring">
                    <span className="g-val">{latestVital?.heartRate || '--'} <span style={{fontSize: 10}}>bpm</span></span>
                  </div>
                  <div className={`gauge-status ${latestVital?.heartRate > 100 || latestVital?.heartRate < 60 ? 'critical' : 'normal'}`}>
                    {latestVital?.heartRate > 100 ? 'Tachycardia' : latestVital?.heartRate < 60 ? 'Bradycardia' : 'Stable'}
                  </div>
                </div>

                <div className="gauge-card">
                  <div className="gauge-label">SpO2 (Oxygen)</div>
                  <div className="gauge-ring">
                    <span className="g-val">{latestVital?.spo2 || '--'} <span style={{fontSize: 10}}>%</span></span>
                  </div>
                  <div className={`gauge-status ${latestVital?.spo2 < 95 ? 'critical' : 'normal'}`}>
                    {latestVital?.spo2 < 95 ? 'Hypoxia Risk' : 'Normal'}
                  </div>
                </div>

                <div className="gauge-card">
                  <div className="gauge-label">Blood Pressure</div>
                  <div className="gauge-ring">
                    <span className="g-val" style={{fontSize: 18}}>{latestVital?.bpSystolic || '--'}/{latestVital?.bpDiastolic || '--'}</span>
                  </div>
                  <div className={`gauge-status ${latestVital?.bpSystolic > 140 ? 'critical' : 'normal'}`}>
                    {latestVital?.bpSystolic > 140 ? 'Hypertensive' : 'Stable'}
                  </div>
                </div>

                <div className="gauge-card">
                  <div className="gauge-label">Temperature</div>
                  <div className="gauge-ring">
                    <span className="g-val">{latestVital?.temperature || '--'} <span style={{fontSize: 10}}>°C</span></span>
                  </div>
                  <div className={`gauge-status ${latestVital?.temperature > 37.5 ? 'critical' : 'normal'}`}>
                    {latestVital?.temperature > 37.5 ? 'Fever' : 'Normal'}
                  </div>
                </div>

                <div className="gauge-card">
                  <div className="gauge-label">Respiration</div>
                  <div className="gauge-ring">
                    <span className="g-val">{latestVital?.respiratoryRate || '--'} <span style={{fontSize: 10}}>rpm</span></span>
                  </div>
                  <div className="gauge-status normal">Normal</div>
                </div>
              </div>

              {/* Predictive analysis panel & Vitals entry form side-by-side */}
              <div className="dashboard-grid">
                {/* Predictions Panel */}
                <div className="panel">
                  <div className="panel-header">
                    <div className="panel-title">
                      <span className="dot" style={{ backgroundColor: 'var(--accent-teal)' }}></span>
                      Health Analytics & Regression Predictions
                    </div>
                  </div>
                  <div className="panel-body" style={{ padding: 20 }}>
                    {trendAnalysis ? (
                      <div className="trend-box">
                        <div className="trend-score-row">
                          <span className="trend-label">System Risk Score:</span>
                          <span className={`badge ${trendAnalysis.warning ? 'red' : 'green'}`} style={{fontSize: 14}}>
                            {trendAnalysis.risk_score} / 100 ({trendAnalysis.prediction.toUpperCase()})
                          </span>
                        </div>
                        {trendAnalysis.warnings && trendAnalysis.warnings.length > 0 ? (
                          <div className="warning-list" style={{ marginTop: 15 }}>
                            <h4 style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 8 }}>Vitals Trend Analysis:</h4>
                            <ul>
                              {trendAnalysis.warnings.map((w, idx) => (
                                <li key={idx} style={{ color: 'var(--accent-red)', fontSize: 12, marginBottom: 4 }}>⚠️ {w}</li>
                              ))}
                            </ul>
                          </div>
                        ) : (
                          <p style={{ fontSize: 13, color: 'var(--accent-green)', marginTop: 15 }}>✓ Vitals trends are stable. No abnormal regressions predicted.</p>
                        )}
                      </div>
                    ) : (
                      <p style={{ color: 'var(--text-muted)' }}>Waiting for sufficient vitals data history to perform predictions (minimum 3 records required).</p>
                    )}
                  </div>
                </div>

                {/* Vitals Entry Form */}
                <div className="panel">
                  <div className="panel-header">
                    <div className="panel-title">Simulate / Log Vitals</div>
                  </div>
                  <form onSubmit={postVital} className="panel-body form-padding">
                    <div className="form-row-grid">
                      <div className="form-group">
                        <label>Heart Rate</label>
                        <input
                          type="number"
                          value={vitalForm.heart_rate}
                          onChange={(e) => setVitalForm(p => ({ ...p, heart_rate: parseInt(e.target.value) || 0 }))}
                        />
                      </div>
                      <div className="form-group">
                        <label>SpO2 (Oxygen)</label>
                        <input
                          type="number"
                          value={vitalForm.spO2}
                          onChange={(e) => setVitalForm(p => ({ ...p, spO2: parseInt(e.target.value) || 0 }))}
                        />
                      </div>
                      <div className="form-group">
                        <label>BP Systolic</label>
                        <input
                          type="number"
                          value={vitalForm.bp_systolic}
                          onChange={(e) => setVitalForm(p => ({ ...p, bp_systolic: parseInt(e.target.value) || 0 }))}
                        />
                      </div>
                      <div className="form-group">
                        <label>BP Diastolic</label>
                        <input
                          type="number"
                          value={vitalForm.bp_diastolic}
                          onChange={(e) => setVitalForm(p => ({ ...p, bp_diastolic: parseInt(e.target.value) || 0 }))}
                        />
                      </div>
                      <div className="form-group">
                        <label>Glucose</label>
                        <input
                          type="number"
                          value={vitalForm.glucose}
                          onChange={(e) => setVitalForm(p => ({ ...p, glucose: parseInt(e.target.value) || 0 }))}
                        />
                      </div>
                      <div className="form-group">
                        <label>Temperature</label>
                        <input
                          type="number"
                          step="0.1"
                          value={vitalForm.temperature}
                          onChange={(e) => setVitalForm(p => ({ ...p, temperature: parseFloat(e.target.value) || 0 }))}
                        />
                      </div>
                    </div>
                    <button type="submit" className="btn-primary" style={{ marginTop: 15, width: '100%', justifyContent: 'center' }}>
                      💾 Save Vital Reading
                    </button>
                  </form>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: EMERGENCY SOS */}
          {activeTab === 'sos' && (
            <div className="tab-view active">
              <div className="page-header-bar">
                <h2 className="page-title">Intelligent Dispatch Emergency SOS</h2>
              </div>

              <div className="sos-panel-grid">
                {/* Active Tracking panel */}
                {activeSos ? (
                  <div className="panel tracking-panel full-width-panel">
                    <div className="panel-header alert-header">
                      <div className="panel-title text-red">
                        🚨 EMERGENCY SOS ACTIVE — AMBULANCE IN TRANSIT
                      </div>
                      <div className="badge red">{trackingData?.status || activeSos.status}</div>
                    </div>
                    <div className="tracking-body-grid">
                      {/* Left info */}
                      <div className="tracking-details">
                        <div className="track-step">
                          <label>Assigned Hospital:</label>
                          <span>Apollo Hospital (Nearest Capability Matched)</span>
                        </div>
                        <div className="track-step">
                          <label>Dispatched Doctor:</label>
                          <span>{trackingData?.doctor || 'Emergency Response Team'}</span>
                        </div>
                        <div className="track-step">
                          <label>Estimated Arrival (ETA):</label>
                          <span className="eta-highlight">{trackingData?.eta || 'calculating...'}</span>
                        </div>
                        <div className="track-step progress-step">
                          <label>Dispatch Progress:</label>
                          <div className="progress-bar">
                            <div className="progress-bar-fill" style={{ width: `${(trackingData?.progress || 0) * 100}%` }} />
                          </div>
                        </div>
                        <div className="track-step">
                          <label>Emergency Symptoms:</label>
                          <span className="badge amber">{activeSos.symptoms}</span>
                        </div>
                      </div>

                      {/* Map */}
                      <div className="tracking-map-container">
                        <MapComponent
                          patientLoc={[activeSos.latitude, activeSos.longitude]}
                          ambulanceLoc={trackingData?.ambulanceLatitude ? [trackingData.ambulanceLatitude, trackingData.ambulanceLongitude] : null}
                          hospitalLoc={[12.9252, 77.6011]} // default apollo coords
                        />
                      </div>
                    </div>
                  </div>
                ) : (
                  /* Trigger SOS form */
                  <div className="panel sos-trigger-box">
                    <div className="panel-header">
                      <div className="panel-title">Verify Symptoms & Dispatch SOS</div>
                    </div>
                    <div className="panel-body form-padding">
                      <p className="sos-warning-text">Check all emergency symptoms that apply. The intelligent dispatcher will class routing parameters and assign the most appropriate specialized hospital capability.</p>
                      
                      <div className="symptoms-checker">
                        {[
                          'Chest Pain', 'Breathing Difficulty', 'Accident/Injury',
                          'Seizure', 'Severe Bleeding', 'Loss of Consciousness', 'High Fever'
                        ].map((sym) => (
                          <label key={sym} className={`symptom-card ${symptomList.includes(sym) ? 'selected' : ''}`}>
                            <input
                              type="checkbox"
                              checked={symptomList.includes(sym)}
                              onChange={() => toggleSymptom(sym)}
                            />
                            {sym}
                          </label>
                        ))}
                      </div>

                      <div className="form-group" style={{ marginTop: 15 }}>
                        <label>Symptom Details & Medical History Context</label>
                        <textarea
                          placeholder="Please specify any additional details (e.g. onset, known allergy, medications taken)..."
                          value={symptomDesc}
                          onChange={(e) => setSymptomDesc(e.target.value)}
                        />
                      </div>

                      <button onClick={triggerSos} className="sos-button-trigger">
                        🚨 TRIGGER EMERGENCY SOS DISPATCH
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 3: MEDICAL HISTORY */}
          {activeTab === 'history' && (
            <div className="tab-view active">
              <div className="page-header-bar">
                <h2 className="page-title">Electronic Health & Medical Records</h2>
              </div>

              <div className="dashboard-grid">
                {/* Emergency medical profile config */}
                <div className="panel">
                  <div className="panel-header">
                    <div className="panel-title">Emergency Medical Profile Setup</div>
                  </div>
                  <form onSubmit={saveMedProfile} className="panel-body form-padding">
                    <div className="form-group">
                      <label>Known Chronic/Existing Conditions</label>
                      <input
                        type="text"
                        value={profileForm.existingConditions}
                        onChange={(e) => setProfileForm(p => ({ ...p, existingConditions: e.target.value }))}
                      />
                    </div>
                    <div className="form-group">
                      <label>Previous Cardiac/Heart Problems</label>
                      <input
                        type="text"
                        value={profileForm.previousHeartProblems}
                        onChange={(e) => setProfileForm(p => ({ ...p, previousHeartProblems: e.target.value }))}
                      />
                    </div>
                    <div className="form-checkbox-row">
                      <label>
                        <input
                          type="checkbox"
                          checked={profileForm.diabetes}
                          onChange={(e) => setProfileForm(p => ({ ...p, diabetes: e.target.checked }))}
                        /> Diabetes
                      </label>
                      <label>
                        <input
                          type="checkbox"
                          checked={profileForm.hypertension}
                          onChange={(e) => setProfileForm(p => ({ ...p, hypertension: e.target.checked }))}
                        /> Hypertension
                      </label>
                      <label>
                        <input
                          type="checkbox"
                          checked={profileForm.asthma}
                          onChange={(e) => setProfileForm(p => ({ ...p, asthma: e.target.checked }))}
                        /> Asthma
                      </label>
                    </div>
                    <div className="form-group">
                      <label>Known Drug/Other Allergies</label>
                      <input
                        type="text"
                        value={profileForm.allergies}
                        onChange={(e) => setProfileForm(p => ({ ...p, allergies: e.target.value }))}
                      />
                    </div>
                    <div className="form-group">
                      <label>Active Medications List</label>
                      <input
                        type="text"
                        value={profileForm.currentMedications}
                        onChange={(e) => setProfileForm(p => ({ ...p, currentMedications: e.target.value }))}
                      />
                    </div>
                    <button type="submit" className="btn-primary" style={{ width: '100%', justifyContent: 'center' }}>
                      💾 Save Emergency Profile
                    </button>
                  </form>
                </div>

                {/* History list & Adding entries */}
                <div className="panel">
                  <div className="panel-header">
                    <div className="panel-title">Health History Records</div>
                  </div>
                  <div className="panel-body list-scrollable" style={{ padding: 20 }}>
                    {medHistory.length > 0 ? (
                      <div className="record-list">
                        {medHistory.map((rec) => (
                          <div key={rec.id} className="record-card">
                            <div className="rec-top">
                              <span className="rec-diagnosis">{rec.diagnosis}</span>
                              <span className="rec-date">{rec.date}</span>
                            </div>
                            <div className="rec-body">
                              <p><strong>Symptoms:</strong> {rec.symptoms}</p>
                              <p><strong>Treatment:</strong> {rec.treatment}</p>
                              <p><strong>Doctor:</strong> {rec.doctor} ({rec.hospital})</p>
                              {rec.notes && <p><strong>Notes:</strong> {rec.notes}</p>}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p style={{ color: 'var(--text-muted)' }}>No medical history records found.</p>
                    )}

                    <hr style={{ margin: '20px 0', borderColor: 'var(--border-color)' }} />
                    <h3 style={{ fontSize: 14, marginBottom: 12 }}>Create Medical History Entry</h3>
                    <form onSubmit={addHistoryEntry} className="history-input-form">
                      <input
                        type="text"
                        placeholder="Diagnosis (e.g. Acute Coronary Syndrome)"
                        value={historyForm.diagnosis}
                        onChange={(e) => setHistoryForm(p => ({ ...p, diagnosis: e.target.value }))}
                        required
                      />
                      <input
                        type="text"
                        placeholder="Symptoms"
                        value={historyForm.symptoms}
                        onChange={(e) => setHistoryForm(p => ({ ...p, symptoms: e.target.value }))}
                        required
                      />
                      <input
                        type="text"
                        placeholder="Treatment Details"
                        value={historyForm.treatment}
                        onChange={(e) => setHistoryForm(p => ({ ...p, treatment: e.target.value }))}
                        required
                      />
                      <input
                        type="text"
                        placeholder="Doctor Name"
                        value={historyForm.doctor}
                        onChange={(e) => setHistoryForm(p => ({ ...p, doctor: e.target.value }))}
                        required
                      />
                      <input
                        type="text"
                        placeholder="Hospital Name"
                        value={historyForm.hospital}
                        onChange={(e) => setHistoryForm(p => ({ ...p, hospital: e.target.value }))}
                        required
                      />
                      <button type="submit" className="btn-primary" style={{ width: '100%', justifyContent: 'center' }}>
                        ➕ Add Health Record
                      </button>
                    </form>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: CHAT */}
          {activeTab === 'chat' && (
            <div className="tab-view active">
              <div className="page-header-bar">
                <h2 className="page-title">Med-AI Assistant Chat</h2>
              </div>
              <div className="panel chat-panel">
                <div className="panel-header">
                  <div className="panel-title">Clinical Support Assistant</div>
                </div>
                <div className="chat-body">
                  {chatMessages.map((msg, idx) => (
                    <div key={idx} className={`chat-bubble-container ${msg.sender === 'AI' ? 'ai' : 'user'}`}>
                      <div className="chat-avatar">{msg.sender === 'AI' ? '🤖' : '👤'}</div>
                      <div className="chat-bubble">{msg.text}</div>
                    </div>
                  ))}
                </div>
                <div className="chat-input-row">
                  <input
                    type="text"
                    placeholder="Ask about symptoms, medications, or vital trends..."
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSendChat()}
                  />
                  <button onClick={handleSendChat} className="chat-send-btn">Send</button>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
};

export default UserDashboard;
