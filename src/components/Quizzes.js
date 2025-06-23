import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { collection, onSnapshot, query, where } from 'firebase/firestore';

const Quizzes = ({ navigate }) => {
  const { currentUser, logout, db, userId, loadingAuth } = useAuth();
  const [quizzes, setQuizzes] = useState([]);
  // New state to store quiz results, mapped by quizId for quick lookup
  const [userQuizResults, setUserQuizResults] = useState({});
  const [loadingData, setLoadingData] = useState(true); // Combined loading state for quizzes and results
  const [errorMessage, setErrorMessage] = useState('');

  const appId = 'gh-shs-student-74e82';

  useEffect(() => {
    if (!db || !currentUser || loadingAuth) {
      if (!loadingAuth && !currentUser) {
        navigate('login');
      }
      return;
    }

    setLoadingData(true); // Start loading
    setErrorMessage('');

    let unsubscribes = [];

    try {
      // 1. Listen for all available quizzes
      const quizzesRef = collection(db, `artifacts/${appId}/public/data/quizzes`);
      unsubscribes.push(onSnapshot(quizzesRef, (snapshot) => {
        const fetchedQuizzes = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setQuizzes(fetchedQuizzes);
        // Do not set loadingData to false here, wait for results as well
      }, (error) => {
        console.error("Error fetching quizzes:", error);
        setErrorMessage("Failed to load quizzes.");
        setLoadingData(false);
      }));

      // 2. Listen for the current user's quiz results
      const resultsRef = collection(db, `artifacts/${appId}/public/data/results`);
      const userResultsQuery = query(resultsRef, where("studentId", "==", currentUser.uid));
      unsubscribes.push(onSnapshot(userResultsQuery, (snapshot) => {
        const fetchedResultsMap = {};
        snapshot.docs.forEach(doc => {
          const resultData = doc.data();
          fetchedResultsMap[resultData.quizId] = { id: doc.id, ...resultData }; // Map result by quizId
        });
        setUserQuizResults(fetchedResultsMap);
        // Set loadingData to false once both quizzes and results are fetched
        setLoadingData(false);
      }, (error) => {
        console.error("Error fetching user results:", error);
        setErrorMessage("Failed to load your quiz results.");
        setLoadingData(false);
      }));

    } catch (error) {
      console.error("Error setting up Firestore listeners:", error);
      setErrorMessage("An unexpected error occurred while setting up data listeners.");
      setLoadingData(false);
    }

    // Cleanup function: unsubscribe from all listeners when component unmounts
    return () => {
      unsubscribes.forEach(unsub => unsub());
    };
  }, [db, currentUser, loadingAuth, navigate, appId]); // Dependencies for useEffect

  return (
    <div className="flex flex-col md:flex-row min-h-screen bg-purple-100 font-sans">
      {/* Sidebar - Consistent with Student Hub for navigation */}
      <div className="bg-gradient-to-br from-blue-700 to-indigo-900 text-white w-full md:w-64 p-6 flex flex-col rounded-tr-xl md:rounded-bl-xl shadow-lg">
        <div className="flex items-center mb-8">
          <svg className="w-8 h-8 mr-3 text-blue-200" fill="currentColor" viewBox="0 0 20 20">
            <path d="M10 2a8 8 0 100 16 8 8 0 000-16zM9 13V7l5 3-5 3z"></path>
          </svg>
          <h1 className="text-2xl font-bold">Student Hub</h1>
        </div>
        <nav className="flex-grow">
          <ul className="space-y-4">
            <li>
              <button onClick={() => navigate('dashboard')} className="flex items-center text-blue-200 hover:text-white transition duration-200 p-2 rounded-lg w-full text-left">
                <svg className="w-5 h-5 mr-3" fill="currentColor" viewBox="0 0 20 20"><path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z"></path></svg>
                Dashboard
              </button>
            </li>
            <li className="bg-blue-600 rounded-lg"> {/* Highlight current page */}
              <button onClick={() => navigate('quizzes')} className="flex items-center text-white transition duration-200 p-2 rounded-lg w-full text-left">
                <svg className="w-5 h-5 mr-3" fill="currentColor" viewBox="0 0 20 20"><path d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 018.618 5.04A12.007 12.007 0 0012 15a12.007 12.007 0 00-8.618-7.016A11.955 11.955 0 0112 2.944c-.682 0-1.39.043-2.049.122a11.986 11.986 0 00-7.394 6.786L.2 11.363a12.001 12.001 0 0011.8 8.637 12.001 12.001 0 0011.8-8.637l-1.407-1.173a12.007 12.007 0 00-8.618-7.016z"></path></svg>
                Quizzes
              </button>
            </li>
            <li>
              <button onClick={() => navigate('materials')} className="flex items-center text-blue-200 hover:text-white transition duration-200 p-2 rounded-lg w-full text-left">
                <svg className="w-5 h-5 mr-3" fill="currentColor" viewBox="0 0 20 20"><path d="M9 17.293V14.707a1 1 0 011.707-.707l4-4a1 1 0 011.414 0l2 2a1 1 0 010 1.414l-2 2a1 1 0 01-1.414 0L10.707 15.293A1 1 0 0110 16.293V17a1 1 0 001 1h2a1 1 0 001-1v-2.586l1.293 1.293a1 1 0 001.414-1.414L15.414 13l2-2a1 1 0 000-1.414L15.414 9l-2-2a1 1 0 00-1.414 0L10.707 9.586A1 1 0 0110 10.586V7a1 1 0 00-1-1H7a1 1 0 00-1 1v3.586l-2-2a1 1 0 00-1.414 0L.293 10.707a1 1 0 000 1.414L2.586 14 1 15.414a1 1 0 001.414 1.414l2-2L6 16.414a1 1 0 001 1H9z"></path></svg>
                Materials
              </button>
            </li>
            <li>
              <button onClick={() => navigate('results')} className="flex items-center text-blue-200 hover:text-white transition duration-200 p-2 rounded-lg w-full text-left">
                <svg className="w-5 h-5 mr-3" fill="currentColor" viewBox="0 0 20 20"><path d="M10 12a2 2 0 100-4 2 2 0 000 4z"></path><path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd"></path></svg>
                Results
              </button>
            </li>
          </ul>
        </nav>
        <div className="mt-8">
          <p className="text-sm text-blue-200">Logged in as:</p>
          <p className="font-semibold text-lg">{currentUser?.email}</p>
          <button
            onClick={logout}
            className="mt-4 w-full py-2 px-4 rounded-md bg-blue-500 hover:bg-blue-600 text-white font-semibold transition duration-200"
          >
            Logout
          </button>
        </div>
        <p className="mt-4 text-center text-blue-300 text-xs">
            Your User ID: {userId}
        </p>
      </div>

      {/* Main Content Area */}
      <div className="flex-grow p-6 md:p-8 bg-white rounded-xl shadow-xl ml-4 mr-4 mt-4 mb-4">
        <h2 className="text-3xl font-bold text-gray-800 mb-8">Available Quizzes</h2>
        {errorMessage && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-md relative mb-4">
            <strong className="font-bold">Error!</strong>
            <span className="block sm:inline ml-2">{errorMessage}</span>
          </div>
        )}
        {loadingData ? ( // Use loadingData for overall loading
          <div className="text-xl font-semibold text-gray-700">Loading Quizzes and your Results...</div>
        ) : quizzes.length === 0 ? (
          <div className="bg-blue-50 p-6 rounded-lg shadow-md text-center">
            <p className="text-xl font-semibold text-gray-800 mb-4">No quizzes available at the moment.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {quizzes.map(quiz => {
              const hasTakenQuiz = userQuizResults[quiz.id]; // Check if this quiz has a result
              return (
                <div key={quiz.id} className="bg-white p-6 rounded-lg shadow-md border border-gray-200">
                  <h3 className="text-xl font-bold text-gray-800 mb-2">{quiz.title}</h3>
                  <p className="text-gray-600 mb-4">{quiz.subjectName} ({quiz.subjectType})</p>
                  {hasTakenQuiz ? (
                    <div className="flex flex-col items-start space-y-2">
                      <p className="text-green-600 font-semibold">Quiz Completed!</p>
                      <p className="text-gray-700 text-sm">Your Score: <span className="font-bold">{hasTakenQuiz.score.toFixed(1)}%</span></p>
                      <button
                        onClick={() => navigate('results')} // Navigate to results page
                        className="bg-yellow-600 hover:bg-yellow-700 text-white font-bold py-2 px-4 rounded-md shadow-lg transition duration-200"
                      >
                        View Score
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => navigate('quiztaking', { quizId: quiz.id })}
                      className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-md shadow-lg transition duration-200"
                    >
                      Start Quiz
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default Quizzes;
