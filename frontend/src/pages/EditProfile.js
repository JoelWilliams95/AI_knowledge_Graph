import React, { useState, useEffect } from 'react';
import { useAuth } from '../services/AuthContext';
import { API_BASE } from '../utils/constants';
import axios from 'axios';
import './EditProfile.css';

const EditProfile = () => {
  const { user, login } = useAuth();
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('');

  useEffect(() => {
    if (user) {
      setFormData(prev => ({
        ...prev,
        username: user.username || '',
        email: user.email || ''
      }));
    }
  }, [user]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');

    try {
      const token = localStorage.getItem('token');
      const updateData = {};

      // Only include fields that have been changed
      if (formData.username !== (user.username || '')) {
        updateData.username = formData.username.trim();
      }

      if (formData.email !== user.email) {
        updateData.email = formData.email.trim().toLowerCase();
      }

      // Handle password change
      if (formData.newPassword) {
        if (!formData.currentPassword) {
          setMessage('Current password is required to change password');
          setMessageType('error');
          setLoading(false);
          return;
        }

        if (formData.newPassword !== formData.confirmPassword) {
          setMessage('New passwords do not match');
          setMessageType('error');
          setLoading(false);
          return;
        }

        if (formData.newPassword.length < 6) {
          setMessage('New password must be at least 6 characters');
          setMessageType('error');
          setLoading(false);
          return;
        }

        updateData.password = formData.newPassword;
      }

      // Only make API call if there are changes
      if (Object.keys(updateData).length === 0) {
        setMessage('No changes to save');
        setMessageType('info');
        setLoading(false);
        return;
      }

      const response = await axios.put(
        `${API_BASE}/auth/admin/users/${user.id}`,
        updateData,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );

      // Update local user data
      const updatedUser = {
        ...user,
        ...response.data
      };
      login(token, updatedUser);

      setMessage('Profile updated successfully!');
      setMessageType('success');

      // Clear password fields
      setFormData(prev => ({
        ...prev,
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
      }));

    } catch (error) {
      console.error('Failed to update profile:', error);
      setMessage(error.response?.data?.detail || 'Failed to update profile');
      setMessageType('error');
    } finally {
      setLoading(false);
    }
  };

  const closeTab = () => {
    window.close();
  };

  if (!user) {
    return (
      <div className="edit-profile-page">
        <div className="container">
          <div className="error-state">
            <h2>Access Denied</h2>
            <p>You must be logged in to edit your profile.</p>
            <button onClick={closeTab} className="btn-secondary">Close</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="edit-profile-page">
      <div className="container">
        <div className="edit-profile-header">
          <h1>Edit Profile</h1>
          <button onClick={closeTab} className="close-btn" title="Close Tab">
            ✕
          </button>
        </div>

        <div className="edit-profile-content">
          {message && (
            <div className={`message ${messageType}`}>
              {message}
            </div>
          )}

          <form onSubmit={handleSubmit} className="edit-profile-form">
            <div className="form-section">
              <h3>Basic Information</h3>

              <div className="form-group">
                <label htmlFor="username">Username</label>
                <input
                  type="text"
                  id="username"
                  name="username"
                  value={formData.username}
                  onChange={handleInputChange}
                  placeholder="Enter your username"
                />
                <small>Optional. Leave blank to keep current username.</small>
              </div>

              <div className="form-group">
                <label htmlFor="email">Email Address *</label>
                <input
                  type="email"
                  id="email"
                  name="email"
                  value={formData.email}
                  onChange={handleInputChange}
                  required
                  placeholder="Enter your email"
                />
                <small>Your current email: {user.email}</small>
              </div>

              <div className="form-group">
                <label>Role</label>
                <div className="role-display">
                  <span className={`role-badge role-${user.role}`}>
                    {user.role?.toUpperCase() || 'USER'}
                  </span>
                  <small>Role cannot be changed by users. Contact an administrator if needed.</small>
                </div>
              </div>
            </div>

            <div className="form-section">
              <h3>Change Password</h3>
              <p className="section-description">
                Leave these fields blank if you don't want to change your password.
              </p>

              <div className="form-group">
                <label htmlFor="currentPassword">Current Password</label>
                <input
                  type="password"
                  id="currentPassword"
                  name="currentPassword"
                  value={formData.currentPassword}
                  onChange={handleInputChange}
                  placeholder="Enter current password"
                />
                <small>Required only when changing password.</small>
              </div>

              <div className="form-group">
                <label htmlFor="newPassword">New Password</label>
                <input
                  type="password"
                  id="newPassword"
                  name="newPassword"
                  value={formData.newPassword}
                  onChange={handleInputChange}
                  placeholder="Enter new password"
                  minLength={6}
                />
                <small>Minimum 6 characters. Leave blank to keep current password.</small>
              </div>

              <div className="form-group">
                <label htmlFor="confirmPassword">Confirm New Password</label>
                <input
                  type="password"
                  id="confirmPassword"
                  name="confirmPassword"
                  value={formData.confirmPassword}
                  onChange={handleInputChange}
                  placeholder="Confirm new password"
                />
                <small>Must match the new password above.</small>
              </div>
            </div>

            <div className="form-actions">
              <button type="button" onClick={closeTab} className="btn-secondary">
                Cancel
              </button>
              <button type="submit" className="btn-primary" disabled={loading}>
                {loading ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default EditProfile;