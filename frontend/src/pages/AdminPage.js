import React from 'react';
import { useNavigate } from 'react-router-dom';
import AdminDashboard from '../components/AdminDashboard';
import { useAuth } from '../services/AuthContext';
import { useToast } from '../hooks/useToast';
import { API_BASE } from '../utils/constants';
import '../styles/admin.css';

export default function AdminPage() {
  const navigate = useNavigate();
  const { isAdmin } = useAuth();
  const toast = useToast();

  // Redirect if not admin
  React.useEffect(() => {
    if (!isAdmin()) {
      navigate('/');
      toast.error('You do not have permission to access this page');
    }
  }, [isAdmin, navigate, toast]);

  if (!isAdmin()) {
    return null;
  }

  return (
    <div className="admin-page">
      <header className="admin-page-header">
        <div className="admin-header-content">
          <button 
            onClick={() => navigate('/')}
            className="back-button"
            title="Back to home"
          >
            ← Back
          </button>
          <h1>Administration Panel</h1>
        </div>
      </header>

      <main className="admin-page-main">
        <AdminDashboard apiBase={API_BASE} toast={toast} />
      </main>
    </div>
  );
}
