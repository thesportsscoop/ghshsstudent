// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth"; // Import getAuth for Authentication
import { getFirestore } from "firebase/firestore"; // Import getFirestore for Firestore
// import { getAnalytics } from "firebase/analytics"; // Analytics is optional and can be imported if needed

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyCLMrLb4HKSUByKYj2f1qW0ezK3L97Ytms",
  authDomain: "gh-shs-student-74e82.firebaseapp.com",
  projectId: "gh-shs-student-74e82",
  storageBucket: "gh-shs-student-74e82.firebasestorage.app",
  messagingSenderId: "1014504195899",
  appId: "1:1014504195899:web:b534c4886d5b29b370191e",
  measurementId: "G-M3Q3ERM0ZY"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app); // Initialize Firebase Authentication
const db = getFirestore(app); // Initialize Cloud Firestore
// const analytics = getAnalytics(app); // Initialize Firebase Analytics (uncomment if using)

// Export the initialized services for use throughout your application
export { app, auth, db };
