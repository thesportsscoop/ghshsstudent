import React, { useState, useEffect } from 'react';
import { useAuth } from './context/AuthContext';
import Login from './components/Login';
import Register from './components/Register';
import Dashboard from './components/Dashboard';
import AdminDashboard from './components/AdminDashboard';
import Quizzes from './components/Quizzes';
import Results from './components/Results';
import Materials from './components/Materials';
import QuizTaking from './components/QuizTaking'; // Import the new QuizTaking component

function App() {
  const [currentPage, setCurrentPage] = useState('login');
  const { currentUser, isAdmin, loadingAuth } = useAuth();

  const navigate = (page, params = {}) => {
    setCurrentPage({ name: page, params: params });
  };

  useEffect(() => {
    console.log("App.js useEffect (DEBUG): Called with -> currentUser:", currentUser?.uid, "isAdmin:", isAdmin, "loadingAuth:", loadingAuth, "currentPage:", currentPage);

    if (!loadingAuth) {
      console.log("App.js useEffect (DEBUG): Authentication loading is complete.");
      const pageName = typeof currentPage === 'string' ? currentPage : currentPage.name;

      if (currentUser) {
        if (isAdmin) {
          if (pageName !== 'admin') {
            setCurrentPage('admin');
          }
        } else {
          if (!['dashboard', 'quizzes', 'materials', 'results', 'quizTaking'].includes(pageName)) {
            setCurrentPage('dashboard');
          }
        }
      } else {
        if (pageName !== 'login' && pageName !== 'register') {
          setCurrentPage('login');
        }
      }
    } else {
      console.log("App.js useEffect (DEBUG): Authentication is still loading. Waiting...");
    }
  }, [currentUser, isAdmin, loadingAuth]);

  const pageName = typeof currentPage === 'string' ? currentPage : currentPage.name;
  const pageParams = typeof currentPage === 'object' ? currentPage.params : {};

  if (loadingAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="text-xl font-semibold text-gray-700">Loading Application (Authentication in progress)...</div>
      </div>
    );
  }

  switch (pageName) {
    case 'login':
      return <Login navigate={navigate} />;
    case 'register':
      return <Register navigate={navigate} />;
    case 'dashboard':
      if (currentUser && !isAdmin) {
        return <Dashboard navigate={navigate} />;
      } else if (currentUser && isAdmin) {
        navigate('admin');
        return null;
      } else {
        navigate('login');
        return null;
      }
    case 'admin':
      if (currentUser && isAdmin) {
        return <AdminDashboard navigate={navigate} />;
      } else {
        navigate(currentUser ? 'dashboard' : 'login');
        return null;
      }
    case 'quizzes':
      if (currentUser && !isAdmin) {
        return <Quizzes navigate={navigate} />;
      } else if (currentUser && isAdmin) {
        navigate('admin');
        return null;
      } else {
        navigate('login');
        return null;
      }
    case 'quizTaking':
      if (currentUser && !isAdmin) {
        return <QuizTaking navigate={navigate} quizId={pageParams.quizId} />;
      } else if (currentUser && isAdmin) {
        navigate('admin');
        return null;
      } else {
        navigate('login');
        return null;
      }
    case 'results':
      if (currentUser && !isAdmin) {
        return <Results navigate={navigate} />;
      } else if (currentUser && isAdmin) {
        navigate('admin');
        return null;
      } else {
        navigate('login');
        return null;
      }
    case 'materials':
      if (currentUser && !isAdmin) {
        return <Materials navigate={navigate} />;
      } else if (currentUser && isAdmin) {
        navigate('admin');
        return null;
      } else {
        navigate('login');
        return null;
      }
    default:
      return <Login navigate={navigate} />;
  }
}

export default App;
