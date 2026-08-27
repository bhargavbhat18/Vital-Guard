import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const Signup = () => {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    role: 'PATIENT',
    fullName: '',
    age: '',
    bloodGroup: '',
    address: '',
    latitude: 12.9716,
    longitude: 77.5946,
    doctorName: '',
    doctorPhone: '',
    doctorHospital: ''
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: name === 'age' ? parseInt(value) || '' : value
    }));
  };

  const handleGeoLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setFormData((prev) => ({
            ...prev,
            latitude: position.coords.latitude,
            longitude: position.coords.longitude
          }));
          alert('Location loaded successfully.');
        },
        (error) => {
          console.error(error);
          alert('Could not fetch location. Using default coordinates.');
        }
      );
    } else {
      alert('Geolocation is not supported by your browser.');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const userData = await register(formData);
      if (userData.role === 'PATIENT' || userData.role === 'FAMILY_MEMBER') {
        navigate('/user-dashboard');
      } else {
        navigate('/healthcare-dashboard');
      }
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.error || 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-card signup-card">
        <div className="auth-header">
          <div className="auth-logo">🛡️</div>
          <h2>Create Account</h2>
          <p className="auth-subtitle">Join VitalGuard Health Network</p>
        </div>

        {error && <div className="auth-error">{error}</div>}

        <form onSubmit={handleSubmit} className="auth-form">
          <div className="form-grid">
            <div className="form-group">
              <label htmlFor="email">Email Address</label>
              <input
                type="email"
                id="email"
                name="email"
                placeholder="name@email.com"
                value={formData.email}
                onChange={handleChange}
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="password">Password</label>
              <input
                type="password"
                id="password"
                name="password"
                placeholder="••••••••"
                value={formData.password}
                onChange={handleChange}
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="role">Account Type (Role)</label>
              <select id="role" name="role" value={formData.role} onChange={handleChange}>
                <option value="PATIENT">Patient</option>
                <option value="FAMILY_MEMBER">Family Member</option>
                <option value="DOCTOR">Healthcare Doctor</option>
                <option value="HOSPITAL_ADMIN">Hospital Administrator</option>
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="fullName">Full Name</label>
              <input
                type="text"
                id="fullName"
                name="fullName"
                placeholder="e.g. Rahul Sharma"
                value={formData.fullName}
                onChange={handleChange}
                required
              />
            </div>

            {formData.role === 'PATIENT' && (
              <>
                <div className="form-group">
                  <label htmlFor="age">Age</label>
                  <input
                    type="number"
                    id="age"
                    name="age"
                    placeholder="45"
                    value={formData.age}
                    onChange={handleChange}
                    required
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="bloodGroup">Blood Group</label>
                  <select
                    id="bloodGroup"
                    name="bloodGroup"
                    value={formData.bloodGroup}
                    onChange={handleChange}
                    required
                  >
                    <option value="">Select Blood Group</option>
                    <option value="A+">A+</option>
                    <option value="A-">A-</option>
                    <option value="B+">B+</option>
                    <option value="B-">B-</option>
                    <option value="O+">O+</option>
                    <option value="O-">O-</option>
                    <option value="AB+">AB+</option>
                    <option value="AB-">AB-</option>
                  </select>
                </div>
              </>
            )}

            <div className="form-group full-width">
              <label htmlFor="address">Address</label>
              <input
                type="text"
                id="address"
                name="address"
                placeholder="Street address, City"
                value={formData.address}
                onChange={handleChange}
                required
              />
            </div>

            <div className="form-group full-width location-fetcher">
              <label>Geographic Coordinates</label>
              <div className="loc-inputs">
                <input
                  type="number"
                  step="any"
                  name="latitude"
                  placeholder="Latitude"
                  value={formData.latitude}
                  onChange={(e) => setFormData(p => ({ ...p, latitude: parseFloat(e.target.value) }))}
                  required
                />
                <input
                  type="number"
                  step="any"
                  name="longitude"
                  placeholder="Longitude"
                  value={formData.longitude}
                  onChange={(e) => setFormData(p => ({ ...p, longitude: parseFloat(e.target.value) }))}
                  required
                />
                <button type="button" onClick={handleGeoLocation} className="loc-btn">
                  📍 Detect Location
                </button>
              </div>
            </div>

            {formData.role === 'PATIENT' && (
              <div className="form-group full-width doctor-details-section">
                <h3>Primary Doctor Referral (Optional)</h3>
                <div className="doctor-inputs-grid">
                  <input
                    type="text"
                    name="doctorName"
                    placeholder="Doctor Name (e.g. Dr. Kulkarni)"
                    value={formData.doctorName}
                    onChange={handleChange}
                  />
                  <input
                    type="text"
                    name="doctorPhone"
                    placeholder="Doctor Phone Number"
                    value={formData.doctorPhone}
                    onChange={handleChange}
                  />
                  <input
                    type="text"
                    name="doctorHospital"
                    placeholder="Doctor Associated Hospital"
                    value={formData.doctorHospital}
                    onChange={handleChange}
                  />
                </div>
              </div>
            )}
          </div>

          <button type="submit" className="auth-submit" disabled={loading}>
            {loading ? 'Creating Account...' : 'Create Account'}
          </button>
        </form>

        <div className="auth-footer">
          Already have an account? <Link to="/login">Sign in</Link>
        </div>
      </div>
    </div>
  );
};

export default Signup;
