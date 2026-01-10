import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './AdminDashboard.css';

const API_URL = process.env.REACT_APP_API_URL || "http://localhost:8000";

export default function AdminDashboard({ apiBase = API_URL, toast }) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [filterRole, setFilterRole] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState('created_at'); // 'created_at', 'email', 'role'
  const [sortOrder, setSortOrder] = useState('desc'); // 'asc', 'desc'
  
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

  // Calculate statistics
  const stats = {
    total: users.length,
    admins: users.filter(u => u.role === 'admin').length,
    regularUsers: users.filter(u => u.role === 'user').length,
    recentlyAdded: users.filter(u => {
      const createdDate = new Date(u.created_at);
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      return createdDate > sevenDaysAgo;
    }).length
  };

  // Filter and sort users
  const filteredUsers = users
    .filter(user => {
      const matchesRole = filterRole === 'all' || user.role === filterRole;
      const matchesSearch = 
        user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (user.username && user.username.toLowerCase().includes(searchTerm.toLowerCase()));
      return matchesRole && matchesSearch;
    })
    .sort((a, b) => {
      let comparison = 0;
      
      switch(sortBy) {
        case 'email':
          comparison = a.email.localeCompare(b.email);
          break;
        case 'role':
          comparison = a.role.localeCompare(b.role);
          break;
        case 'created_at':
        default:
          comparison = new Date(b.created_at) - new Date(a.created_at);
          break;
      }
      
      return sortOrder === 'asc' ? comparison : -comparison;
    });

  // Get role distribution for visual indicator
  const getRoleDistribution = () => {
    const total = users.length;
    if (total === 0) return { adminPercent: 0, userPercent: 0 };
    return {
      adminPercent: Math.round((stats.admins / total) * 100),
      userPercent: Math.round((stats.regularUsers / total) * 100)
    };
  };

  const roleDistribution = getRoleDistribution();


  return (
    <div className="admin-dashboard">
      {/* Dashboard Statistics */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon">👥</div>
          <div className="stat-content">
            <div className="stat-value">{stats.total}</div>
            <div className="stat-label">Total Users</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon">👑</div>
          <div className="stat-content">
            <div className="stat-value">{stats.admins}</div>
            <div className="stat-label">Administrators</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon">📋</div>
          <div className="stat-content">
            <div className="stat-value">{stats.regularUsers}</div>
            <div className="stat-label">Regular Users</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon">✨</div>
          <div className="stat-content">
            <div className="stat-value">{stats.recentlyAdded}</div>
            <div className="stat-label">Added This Week</div>
          </div>
        </div>
      </div>

      {/* Role Distribution Visual */}
      <div className="role-distribution-card">
        <h3>👤 Role Distribution</h3>
        <div className="distribution-bars">
          <div className="distribution-item">
            <div className="distribution-label">Admins</div>
            <div className="distribution-bar">
              <div 
                className="distribution-fill admin-fill" 
                style={{ width: `${roleDistribution.adminPercent}%` }}
              ></div>
            </div>
            <div className="distribution-percent">{roleDistribution.adminPercent}%</div>
          </div>
          <div className="distribution-item">
            <div className="distribution-label">Users</div>
            <div className="distribution-bar">
              <div 
                className="distribution-fill user-fill" 
                style={{ width: `${roleDistribution.userPercent}%` }}
              ></div>
            </div>
            <div className="distribution-percent">{roleDistribution.userPercent}%</div>
          </div>
        </div>
      </div>

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
          <h3>All Users ({filteredUsers.length} of {users.length})</h3>
          <button className="btn-secondary" onClick={fetchUsers} disabled={loading}>
            {loading ? '🔄 Loading...' : '🔄 Refresh'}
          </button>
        </div>

        {/* Filters and Search */}
        <div className="filters-section">
          <div className="search-box">
            <input
              type="text"
              placeholder="🔍 Search by email or username..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="search-input"
            />
          </div>

          <div className="filters-controls">
            <div className="filter-group">
              <label>Filter by Role:</label>
              <select 
                value={filterRole}
                onChange={(e) => setFilterRole(e.target.value)}
                className="filter-select"
              >
                <option value="all">All Roles</option>
                <option value="admin">Admins Only</option>
                <option value="user">Users Only</option>
              </select>
            </div>

            <div className="filter-group">
              <label>Sort by:</label>
              <select 
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="filter-select"
              >
                <option value="created_at">Created Date</option>
                <option value="email">Email</option>
                <option value="role">Role</option>
              </select>
            </div>

            <button
              className={`sort-order-btn ${sortOrder === 'asc' ? 'asc' : 'desc'}`}
              onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
              title={`Sort ${sortOrder === 'asc' ? 'descending' : 'ascending'}`}
            >
              {sortOrder === 'asc' ? '↑ Ascending' : '↓ Descending'}
            </button>
          </div>
        </div>

        {loading ? (
          <div className="loading-state">Loading users...</div>
        ) : filteredUsers.length === 0 ? (
          <div className="empty-state">
            <p>
              {searchTerm || filterRole !== 'all' 
                ? 'No users match your filters.' 
                : 'No users found. Create the first user to get started.'
              }
            </p>
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
                {filteredUsers.map((user) => (
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
