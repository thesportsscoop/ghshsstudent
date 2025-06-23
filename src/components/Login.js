import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext'; // Import useAuth hook

const Login = ({ navigate }) => {
  const { login, authError, loadingAuth, userId, setAuthError, resetPassword } = useAuth(); // Added resetPassword
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showForgotPasswordModal, setShowForgotPasswordModal] = useState(false); // New state for modal visibility
  const [resetEmail, setResetEmail] = useState(''); // State for email in reset modal
  const [resetMessage, setResetMessage] = useState(''); // State for messages in reset modal
  const [isSendingResetEmail, setIsSendingResetEmail] = useState(false); // State for loading during reset

  const handleSubmit = async (e) => {
    e.preventDefault();
    setAuthError(null); // Clear any previous global auth errors before a new attempt

    try {
      const result = await login(email, password);
      if (result.success) {
        // Login successful. Redirection logic is handled by AuthContext's onAuthStateChanged
      } else {
        console.error("Login failed (from handleSubmit):", result.error);
        // authError is already set by the login function in AuthContext
      }
    } catch (error) {
      console.error("Login handleSubmit encountered an unexpected error:", error);
      setAuthError("An unexpected error occurred during login. Please try again.");
    }
  };

  const handleResetPasswordSubmit = async (e) => {
    e.preventDefault();
    setResetMessage('');
    setAuthError(null); // Clear any main login errors
    setIsSendingResetEmail(true);

    try {
      // Ensure resetPassword function exists and is called from AuthContext
      if (resetPassword) {
        const result = await resetPassword(resetEmail);
        if (result.success) {
          setResetMessage("Password reset link sent to your email. Please check your inbox.");
          setResetEmail(''); // Clear email input
        } else {
          setResetMessage(result.error || "Failed to send password reset email.");
        }
      } else {
        setResetMessage("Password reset functionality is not available.");
      }
    } catch (error) {
      console.error("Error during password reset:", error);
      setResetMessage("An unexpected error occurred during password reset.");
    } finally {
      setIsSendingResetEmail(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-400 to-purple-600 p-4">
      <div className="bg-white p-8 rounded-xl shadow-2xl w-full max-w-md backdrop-blur-md bg-opacity-80 border border-gray-200">
        <h2 className="text-3xl font-extrabold text-center text-gray-900 mb-8">Login to SHS Platform</h2>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700">Email Address</label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 block w-full px-4 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-base"
            />
          </div>
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700">Password</label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 block w-full px-4 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-base"
            />
          </div>
          <div className="flex items-center justify-between">
            <div className="text-sm">
              <button
                type="button"
                onClick={() => {
                  setShowForgotPasswordModal(true); // Open the new password reset modal
                  setResetEmail(email); // Pre-fill email from login form if available
                  setResetMessage(''); // Clear any previous reset messages
                }}
                className="font-medium text-blue-600 hover:text-blue-500 focus:outline-none"
              >
                Forgot password?
              </button>
            </div>
            <button
              type="submit"
              disabled={loadingAuth}
              className="flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-lg font-semibold text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition duration-300 ease-in-out disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loadingAuth ? 'Logging In...' : 'Login'}
            </button>
          </div>
        </form>
        {/* Display authError from AuthContext if present */}
        {authError && (
          <div className="mt-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded-md text-center shadow-sm">
            <p className="font-semibold text-sm">
              {String(authError)}
            </p>
          </div>
        )}

        <p className="mt-6 text-center text-gray-600 text-sm">
          Don't have an account?{' '}
          <button onClick={() => navigate('register')} className="font-medium text-blue-600 hover:text-blue-500 focus:outline-none">
            Register
          </button>
        </p>
        <p className="mt-4 text-center text-gray-500 text-xs">
            Current User ID (for debug): {userId}
        </p>
      </div>

      {/* Forgot Password Modal */}
      {showForgotPasswordModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-75 flex items-center justify-center z-50 p-4">
          <div className="bg-white p-8 rounded-lg shadow-2xl text-center max-w-sm mx-auto">
            <h3 className="text-2xl font-bold text-gray-800 mb-4">Reset Password</h3>
            <form onSubmit={handleResetPasswordSubmit} className="space-y-4">
              <p className="text-gray-700">Enter your email address to receive a password reset link.</p>
              <div>
                <label htmlFor="resetEmail" className="sr-only">Email Address</label>
                <input
                  id="resetEmail"
                  name="resetEmail"
                  type="email"
                  autoComplete="email"
                  required
                  value={resetEmail}
                  onChange={(e) => setResetEmail(e.target.value)}
                  className="mt-1 block w-full px-4 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-base"
                  placeholder="Enter your email"
                />
              </div>
              {resetMessage && (
                <div className={`p-2 rounded-md text-sm ${
                  resetMessage.includes('sent') ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                }`}>
                  {resetMessage}
                </div>
              )}
              <div className="flex justify-center space-x-4">
                <button
                  type="submit"
                  disabled={isSendingResetEmail}
                  className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-md shadow-md transition duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSendingResetEmail ? 'Sending...' : 'Send Reset Link'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowForgotPasswordModal(false);
                    setResetMessage(''); // Clear message when closing
                    setResetEmail(''); // Clear email when closing
                  }}
                  className="bg-gray-400 hover:bg-gray-500 text-white font-bold py-2 px-4 rounded-md shadow-md transition duration-200"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Login;
