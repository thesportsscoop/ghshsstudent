/* global __initial_auth_token */
import React, { createContext, useContext, useState, useEffect } from 'react';
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, onAuthStateChanged, signOut, signInAnonymously, signInWithCustomToken, sendPasswordResetEmail } from 'firebase/auth'; // Added sendPasswordResetEmail
import { getFirestore, doc, getDoc, setDoc } from 'firebase/firestore';
import { app } from '../firebase'; // Import the initialized Firebase app

// Create the Auth Context
const AuthContext = createContext();

// Custom hook to use the Auth Context
export const useAuth = () => {
  return useContext(AuthContext);
};

// Auth Provider Component
export const AuthProvider = ({ children }) => {
  const [currentUser, setCurrentUser] = useState(null);
  const [loadingAuth, setLoadingAuth] = useState(true); // Initial loading state for authentication
  const [authError, setAuthError] = useState(''); // General auth errors (e.g., login failed)
  const [isAdmin, setIsAdmin] = useState(false); // State to track admin status
  const [userId, setUserId] = useState(null); // Stores the user's UID

  const auth = getAuth(app); // Get auth instance
  const db = getFirestore(app); // Get firestore instance

  // FORCE the actual project ID to ensure consistent data paths
  const appId = 'gh-shs-student-74e82';

  // Function to check admin status from Firestore
  const checkAdminStatus = async (uid) => {
    if (!db || !uid) {
      console.warn("AuthContext: Firestore DB or UID not available to check admin status.");
      return false;
    }
    try {
      // Define the path to the user's role document
      const userRoleRef = doc(db, `artifacts/${appId}/public/data/userRoles`, uid);
      const docSnap = await getDoc(userRoleRef);
      const adminStatus = docSnap.exists() && docSnap.data().isAdmin === true;
      console.log(`AuthContext: Admin status for UID ${uid}: ${adminStatus}. (Doc exists: ${docSnap.exists()}, isAdmin field: ${docSnap.data()?.isAdmin})`);
      return adminStatus;
    } catch (error) {
      console.error("AuthContext: Error checking admin status from Firestore:", error);
      // It's crucial to return false on error to prevent unauthorized access
      return false;
    }
  };

  // Effect for handling authentication state changes
  useEffect(() => {
    // Sign in anonymously if no initial auth token is provided (e.g., in development environment)
    // This is important for the Canvas environment to allow Firestore operations.
    if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token !== null) {
      signInWithCustomToken(auth, __initial_auth_token)
        .then((userCredential) => {
          console.log("AuthContext: Signed in with custom token:", userCredential.user.uid);
          // Proceed to onAuthStateChanged listener to set context
        })
        .catch((error) => {
          console.error("AuthContext: Error signing in with custom token:", error);
          setAuthError(`Authentication failed: ${error.message}. Please try again.`);
          setLoadingAuth(false);
        });
    } else {
      // If no custom token, sign in anonymously for basic access or if user explicitly wants to be anonymous.
      // This is often a fallback for unauthenticated states or dev environments.
      signInAnonymously(auth)
        .then(() => console.log("AuthContext: Signed in anonymously."))
        .catch(error => console.error("AuthContext: Anonymous sign-in failed:", error));
    }

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      console.log("AuthContext: onAuthStateChanged triggered. User:", user?.uid);
      setCurrentUser(user);
      setUserId(user ? user.uid : null); // Set userId based on authenticated user

      if (user) {
        // Fetch admin status from Firestore immediately after user is identified
        const userIsAdmin = await checkAdminStatus(user.uid);
        setIsAdmin(userIsAdmin);
        console.log(`AuthContext: User ${user.uid} (isAdmin: ${userIsAdmin})`);

        // Only create user role document here as a fallback if it doesn't exist
        // The student profile is now created directly by the `register` function.
        const userRoleRef = doc(db, `artifacts/${appId}/public/data/userRoles`, user.uid);
        const roleSnap = await getDoc(userRoleRef);

        if (!roleSnap.exists()) {
          console.log(`AuthContext: Creating user role document for new user: ${user.uid}`);
          await setDoc(userRoleRef, { isAdmin: false }, { merge: true }); // Default to not admin
        }

      } else {
        // User logged out or no user
        setIsAdmin(false);
        console.log("AuthContext: No user authenticated. isAdmin set to false.");
      }
      setLoadingAuth(false); // Authentication state is now known
    });

    // Cleanup subscription on component unmount
    return () => unsubscribe();
  }, [auth, db, appId]); // Dependencies for useEffect

  // Login function
  const login = async (email, password) => {
    setAuthError(''); // Clear previous errors
    setLoadingAuth(true);
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      console.log("AuthContext: User signed in:", userCredential.user.uid);
      // The onAuthStateChanged listener will handle setting currentUser and isAdmin
      return { success: true };
    } catch (error) {
      console.error("AuthContext: Login failed:", error);
      let errorMessage = "Failed to log in. Please check your credentials.";
      if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
        errorMessage = "Invalid email or password.";
      } else if (error.code === 'auth/too-many-requests') {
        errorMessage = "Too many login attempts. Please try again later.";
      } else if (error.code === 'auth/network-request-failed') {
        errorMessage = "Network error. Please check your internet connection.";
      }
      setAuthError(errorMessage);
      setLoadingAuth(false);
      return { success: false, error: errorMessage };
    }
  };

  // Register function (updated to accept full profile data)
  const register = async (email, password, name, yearGroup, shsProgram, electiveSubjects) => {
    setAuthError(''); // Clear previous errors
    setLoadingAuth(true);
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;
      console.log("AuthContext: User registered:", user.uid);

      // Create student profile with ALL details from registration form
      const studentProfileRef = doc(db, `artifacts/${appId}/users/${user.uid}/studentProfiles`, user.uid);
      await setDoc(studentProfileRef, {
        uid: user.uid,
        email: email, // Use the provided email directly
        name: name,
        yearGroup: yearGroup,
        shsProgram: shsProgram,
        electiveSubjects: electiveSubjects,
        registeredAt: Date.now(),
        profileImageData: null, // Keep this as initial value
      });
      console.log("AuthContext: Student profile created successfully for:", user.uid);

      // Create user role document (default to student)
      const userRoleRef = doc(db, `artifacts/${appId}/public/data/userRoles`, user.uid);
      await setDoc(userRoleRef, { isAdmin: false }, { merge: true });
      console.log("AuthContext: User role created successfully for:", user.uid);

      return { success: true, user: user };
    } catch (error) {
      console.error("AuthContext: Registration failed:", error);
      let errorMessage = "Failed to register.";
      if (error.code === 'auth/email-already-in-use') {
        errorMessage = "Email already in use. Please use a different email or login.";
      } else if (error.code === 'auth/weak-password') {
        errorMessage = "Password is too weak. Please choose a stronger password.";
      } else if (error.code === 'auth/invalid-email') {
        errorMessage = "Invalid email address format.";
      } else if (error.code === 'auth/operation-not-allowed') {
        errorMessage = "Email/password authentication is not enabled. Please contact support.";
      }
      setAuthError(errorMessage);
      setLoadingAuth(false);
      return { success: false, error: errorMessage };
    }
  };

  // NEW FUNCTION: Password Reset
  const resetPassword = async (emailToReset) => {
    setAuthError(''); // Clear any previous errors
    try {
      await sendPasswordResetEmail(auth, emailToReset);
      console.log(`AuthContext: Password reset email sent to ${emailToReset}`);
      return { success: true };
    } catch (error) {
      console.error("AuthContext: Password reset failed:", error);
      let errorMessage = "Failed to send password reset email.";
      if (error.code === 'auth/user-not-found') {
        errorMessage = "No user found with that email address.";
      } else if (error.code === 'auth/invalid-email') {
        errorMessage = "Invalid email address format.";
      } else if (error.code === 'auth/network-request-failed') {
        errorMessage = "Network error. Please check your internet connection.";
      }
      setAuthError(errorMessage); // Set global error for visibility
      return { success: false, error: errorMessage };
    }
  };

  // Logout function
  const logout = async () => {
    setAuthError('');
    setLoadingAuth(true);
    try {
      await signOut(auth);
      console.log("AuthContext: User logged out.");
      // onAuthStateChanged will set currentUser to null and isAdmin to false
    } catch (error) {
      console.error("AuthContext: Logout failed:", error);
      setAuthError("Failed to log out. Please try again.");
    } finally {
      setLoadingAuth(false);
    }
  };

  // Context value provided to children
  const value = {
    currentUser,
    userId, // Provide userId
    loadingAuth,
    authError,
    isAdmin, // Provide isAdmin status
    login,
    register,
    logout,
    db, // Provide db instance
    auth, // Provide auth instance
    app, // Provide app instance
    setAuthError, // Explicitly provide setAuthError for external use
    resetPassword, // NEW: Provide resetPassword function
  };

  return (
    <AuthContext.Provider value={value}>
      {!loadingAuth && children} {/* Render children only when authentication status is known */}
    </AuthContext.Provider>
  );
};
