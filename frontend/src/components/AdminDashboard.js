import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './AdminDashboard.css';

const API_URL = process.env.REACT_APP_API_URL || "http://localhost:8000";

export default function AdminDashboard({ apiBase = API_URL, toast }) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  
  // Form state
  const [formData, setFormData] = useState({
    email: '',
    username: '',
    password: '',
    confirmPassword: '',
    role: 'user'
  });

  // Fetch users list
  const fetchUsers = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${apiBase}/auth/admin/users`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      setUsers(response.data);
    } catch (error) {
      console.error('Failed to fetch users:', error);
      if (toast) {
        toast.error('Failed to load users. Please check your permissions.');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  // Handle form input changes
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  // Create new user
  const handleCreateUser = async (e) => {
    e.preventDefault();
    
    if (formData.password !== formData.confirmPassword) {
      if (toast) toast.error('Passwords do not match');
      return;
    }

    if (formData.password.length < 6) {
      if (toast) toast.error('Password must be at least 6 characters');
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const response = await axios.post(
        `${apiBase}/auth/admin/users`,
        {
          email: formData.email.trim().toLowerCase(),
          username: formData.username.trim(),
          password: formData.password,
          role: formData.role
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (toast) toast.success(`User ${response.data.email} created successfully!`);
      setShowCreateForm(false);
      setFormData({ email: '', username: '', password: '', confirmPassword: '', role: 'user' });
      fetchUsers();
    } catch (error) {
      console.error('Failed to create user:', error);
      if (toast) {
        toast.error(error.response?.data?.detail || 'Failed to create user');
      }
    }
  };

  // Update user
  const handleUpdateUser = async (e) => {
    e.preventDefault();
    
    try {
      const token = localStorage.getItem('token');
      const updateData = {};
      
      if (formData.username) updateData.username = formData.username.trim();
      if (formData.email) updateData.email = formData.email.trim().toLowerCase();
      if (formData.role) updateData.role = formData.role;
      if (formData.password) {
        if (formData.password !== formData.confirmPassword) {
          if (toast) toast.error('Passwords do not match');
          return;
        }
        if (formData.password.length < 6) {
          if (toast) toast.error('Password must be at least 6 characters');
          return;
        }
        updateData.password = formData.password;
      }

      await axios.put(
        `${apiBase}/auth/admin/users/${editingUser.id}`,
        updateData,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (toast) toast.success('User updated successfully!');
      setEditingUser(null);
      setFormData({ email: '', username: '', password: '', confirmPassword: '', role: 'user' });
      fetchUsers();
    } catch (error) {
      console.error('Failed to update user:', error);
      if (toast) {
        toast.error(error.response?.data?.detail || 'Failed to update user');
      }
    }
  };

  // Delete user
  const handleDeleteUser = async (userId, userEmail) => {
    if (!window.confirm(`Are you sure you want to delete user ${userEmail}? This action cannot be undone.`)) {
      return;
    }

    try {
      const token = localStorage.getItem('token');
      await axios.delete(
        `${apiBase}/auth/admin/users/${userId}`,
        {
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      );

      if (toast) toast.success('User deleted successfully!');
      fetchUsers();
    } catch (error) {
      console.error('Failed to delete user:', error);
      if (toast) {
        toast.error(error.response?.data?.detail || 'Failed to delete user');
      }
    }
  };

  // Start editing user
  const startEdit = (user) => {
    setEditingUser(user);
    setFormData({
      email: user.email,
      username: user.username || '',
      password: '',
      confirmPassword: '',
      role: user.role
    });
    setShowCreateForm(false);
  };

  // Cancel form
  const cancelForm = () => {
    setShowCreateForm(false);
    setEditingUser(null);
    setFormData({ email: '', username: '', password: '', confirmPassword: '', role: 'user' });
  };

  return (
    <div className="admin-dashboard">
      <div className="admin-header">
        <h2>👥 User Management</h2>
        <button 
          className="btn-primary"
          onClick={() => {
            setShowCreateForm(true);
            setEditingUser(null);
            setFormData({ email: '', username: '', password: '', confirmPassword: '', role: 'user' });
          }}
        >
          ➕ Create New User
        </button>
      </div>

      {/* Create/Edit Form */}
      {(showCreateForm || editingUser) && (
        <div className="admin-form-card">
          <h3>{editingUser ? 'Edit User' : 'Create New User'}</h3>
          <form onSubmit={editingUser ? handleUpdateUser : handleCreateUser}>
            <div className="form-group">
              <label>Email {!editingUser && '*'}</label>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleInputChange}
                required={!editingUser}
                disabled={!!editingUser}
                placeholder="user@example.com"
              />
            </div>

            <div className="form-group">
              <label>Username</label>
              <input
                type="text"
                name="username"
                value={formData.username}
                onChange={handleInputChange}
                placeholder="Username (optional)"
              />
            </div>

            <div className="form-group">
              <label>Role *</label>
              <select
                name="role"
                value={formData.role}
                onChange={handleInputChange}
                required
              >
                <option value="user">User</option>
                <option value="admin">Admin</option>
              </select>
            </div>

            <div className="form-group">
              <label>Password {!editingUser && '*'}</label>
              <input
                type="password"
                name="password"
                value={formData.password}
                onChange={handleInputChange}
                required={!editingUser}
                placeholder={editingUser ? "Leave blank to keep current password" : "Minimum 6 characters"}
                minLength={editingUser ? 0 : 6}
              />
            </div>

            {formData.password && (
              <div className="form-group">
                <label>Confirm Password *</label>
                <input
                  type="password"
                  name="confirmPassword"
                  value={formData.confirmPassword}
                  onChange={handleInputChange}
                  placeholder="Confirm password"
                />
              </div>
            )}

            <div className="form-actions">
              <button type="submit" className="btn-primary">
                {editingUser ? 'Update User' : 'Create User'}
              </button>
              <button type="button" className="btn-secondary" onClick={cancelForm}>
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Users List */}
      <div className="users-list-card">
        <div className="users-list-header">
          <h3>All Users ({users.length})</h3>
          <button className="btn-secondary" onClick={fetchUsers} disabled={loading}>
            {loading ? '🔄 Loading...' : '🔄 Refresh'}
          </button>
        </div>

        {loading ? (
          <div className="loading-state">Loading users...</div>
        ) : users.length === 0 ? (
          <div className="empty-state">
            <p>No users found. Create the first user to get started.</p>
          </div>
        ) : (
          <div className="users-table-container">
            <table className="users-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Email</th>
                  <th>Username</th>
                  <th>Role</th>
                  <th>Created At</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user.id} className={user.role === 'admin' ? 'admin-row' : ''}>
                    <td>{user.id}</td>
                    <td>{user.email}</td>
                    <td>{user.username || '-'}</td>
                    <td>
                      <span className={`role-badge role-${user.role}`}>
                        {user.role}
                      </span>
                    </td>
                    <td>{user.created_at ? new Date(user.created_at).toLocaleDateString() : '-'}</td>
                    <td>
                      <div className="action-buttons">
                        <button 
                          className="btn-edit"
                          onClick={() => startEdit(user)}
                          title="Edit user"
                        >
                          ✏️
                        </button>
                        <button 
                          className="btn-delete"
                          onClick={() => handleDeleteUser(user.id, user.email)}
                          title="Delete user"
                        >
                          🗑️
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
