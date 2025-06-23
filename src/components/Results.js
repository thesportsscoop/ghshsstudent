import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
// Import Font Awesome components
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCircleInfo } from '@fortawesome/free-solid-svg-icons';


const Results = ({ navigate }) => {
  const { currentUser, db, loadingAuth, userId, logout } = useAuth();
  const [loadingResults, setLoadingResults] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [resultsBySubject, setResultsBySubject] = useState({});
  const [overallStats, setOverallStats] = useState({
    totalQuizzesTaken: 0,
    totalScoreSum: 0,
    overallAverage: 0,
    overallGrade: 'N/A'
  });
  const [showGradesExplanation, setShowGradesExplanation] = useState(false);

  const appId = 'gh-shs-student-74e82';

  // Function to calculate grade based on score (UPDATED GRADING SYSTEM)
  const getGrade = (score) => {
    if (score >= 75) return 'A1';
    if (score >= 70) return 'B2';
    if (score >= 65) return 'B3';
    if (score >= 60) return 'C4';
    if (score >= 55) return 'C5';
    if (score >= 50) return 'C6';
    if (score >= 45) return 'D7';
    if (score >= 40) return 'E8';
    return 'F9';
  };

  // Function to process raw results into structured subject-wise and overall stats
  const calculatePerformance = (rawResults) => {
    const bySubject = {};
    let totalScoreSum = 0;
    let totalQuizzesTaken = 0;

    rawResults.forEach(result => {
      // This is the critical line for grouping: it creates a unique key for each subject
      // using the subjectType and subjectName found in the *result document*.
      const subjectKey = `${result.subjectType || 'unknown'}-${result.subjectName || 'Unknown'}`;
      if (!bySubject[subjectKey]) {
        // Initialize a new subject widget entry if it doesn't exist
        bySubject[subjectKey] = {
          name: result.subjectName || 'Unknown',
          type: result.subjectType || 'unknown',
          quizzes: [],
          totalScore: 0,
          count: 0,
          average: 0,
          grade: 'N/A'
        };
      }
      // Add the current quiz result to the appropriate subject's list of quizzes
      bySubject[subjectKey].quizzes.push(result);
      bySubject[subjectKey].totalScore += result.score;
      bySubject[subjectKey].count += 1;

      totalScoreSum += result.score;
      totalQuizzesTaken += 1;
    });

    // Calculate averages and grades for each subject
    for (const key in bySubject) {
      if (bySubject.hasOwnProperty(key)) {
        bySubject[key].average = bySubject[key].totalScore / bySubject[key].count;
        bySubject[key].grade = getGrade(bySubject[key].average);
      }
    }

    // Calculate overall average and grade
    const overallAverage = totalQuizzesTaken > 0 ? totalScoreSum / totalQuizzesTaken : 0;
    const overallGrade = getGrade(overallAverage);

    return {
      resultsBySubject: bySubject,
      overallStats: {
        totalQuizzesTaken,
        totalScoreSum,
        overallAverage,
        overallGrade
      }
    };
  };

  useEffect(() => {
    if (!db || !currentUser || loadingAuth) {
      if (!loadingAuth && !currentUser) {
        navigate('login');
      }
      return;
    }

    setLoadingResults(true);
    setErrorMessage('');

    // Query for results specifically for the current student
    const resultsColRef = collection(db, `artifacts/${appId}/public/data/results`);
    const q = query(resultsColRef, where("studentId", "==", currentUser.uid));

    // Listen for real-time updates to the results
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedResults = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      // Process the fetched results to group them by subject and calculate stats
      const { resultsBySubject, overallStats } = calculatePerformance(fetchedResults);
      setResultsBySubject(resultsBySubject);
      setOverallStats(overallStats);
      setLoadingResults(false);
    }, (error) => {
      console.error("Error fetching results:", error);
      setErrorMessage(`Failed to load results: ${error.message}`);
      setLoadingResults(false);
    });

    return () => unsubscribe(); // Cleanup listener on component unmount
  }, [db, currentUser, loadingAuth, navigate, appId, userId]);

  if (loadingAuth || loadingResults) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="text-xl font-semibold text-gray-700">Loading Results...</div>
      </div>
    );
  }

  if (errorMessage) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-red-50 p-4">
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-md shadow-md text-center max-w-md">
          <strong className="font-bold">Error!</strong>
          <span className="block sm:inline ml-2">{errorMessage}</span>
          <button onClick={() => navigate('dashboard')} className="mt-4 bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-4 rounded-md">Back to Dashboard</button>
        </div>
      </div>
    );
  }

  // Sort subjects for consistent display (e.g., Core first, then alphabetically)
  const sortedSubjects = Object.values(resultsBySubject).sort((a, b) => {
    if (a.type === 'core' && b.type !== 'core') return -1;
    if (a.type !== 'core' && b.type === 'core') return 1;
    return a.name.localeCompare(b.name);
  });

  return (
    <div className="flex flex-col md:flex-row min-h-screen bg-gray-100 font-sans">
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
            <li>
              <button onClick={() => navigate('quizzes')} className="flex items-center text-blue-200 hover:text-white transition duration-200 p-2 rounded-lg w-full text-left">
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
              <button onClick={() => navigate('results')} className="flex items-center text-blue-200 hover:text-white transition duration-200 p-2 rounded-lg w-full text-left bg-blue-600">
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
        <div className="flex justify-between items-center mb-8">
          <h2 className="text-3xl font-bold text-gray-800">Your Quiz Results</h2>
          <button
            onClick={() => setShowGradesExplanation(true)}
            className="bg-purple-600 hover:bg-purple-700 text-white font-bold py-2 px-4 rounded-md shadow-md transition duration-200 flex items-center"
          >
            <FontAwesomeIcon icon={faCircleInfo} className="mr-2" />
            Grades Explained
          </button>
        </div>

        {overallStats.totalQuizzesTaken === 0 ? (
          <div className="text-center p-8 bg-blue-50 rounded-lg shadow-md">
            <p className="text-xl font-semibold text-gray-800 mb-4">No quiz results found yet.</p>
            <p className="text-gray-700 mb-6">Start by taking some quizzes to see your performance here!</p>
            <button
              onClick={() => navigate('quizzes')}
              className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-6 rounded-md shadow-lg transition duration-200"
            >
              Go to Quizzes
            </button>
          </div>
        ) : (
          <div className="space-y-8">
            {/* Overall Results Widget */}
            <div className="bg-gradient-to-r from-blue-500 to-blue-700 text-white p-6 rounded-lg shadow-lg flex flex-col md:flex-row justify-between items-center">
              <div className="text-center md:text-left mb-4 md:mb-0">
                <h3 className="text-2xl font-bold mb-1">Overall Performance</h3>
                <p className="text-blue-100">Across all quizzes taken</p>
              </div>
              <div className="text-center md:text-right">
                <p className="text-4xl font-extrabold">{overallStats.overallAverage.toFixed(1)}%</p>
                <p className="text-xl font-semibold">Grade: {overallStats.overallGrade}</p>
                <p className="text-blue-200 text-sm">Total Quizzes: {overallStats.totalQuizzesTaken}</p>
              </div>
            </div>

            {/* Subject-wise Results Widgets */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {sortedSubjects.map(subject => (
                <div key={`${subject.type}-${subject.name}`} className="bg-white p-6 rounded-lg shadow-md border border-gray-200">
                  <h3 className="text-xl font-bold text-gray-800 mb-2">{subject.name}</h3>
                  <p className="text-sm text-gray-500 mb-4 capitalize">({subject.type} Subject)</p>
                  <p className="text-lg font-semibold text-gray-700">Average Score: <span className="text-blue-600">{subject.average.toFixed(1)}%</span></p>
                  <p className="text-lg font-semibold text-gray-700">Grade: <span className={`font-bold ${
                    // Dynamically apply text color based on the new grading scale
                    subject.grade === 'A1' ? 'text-green-600' :
                    subject.grade === 'B2' || subject.grade === 'B3' ? 'text-lime-600' :
                    subject.grade === 'C4' || subject.grade === 'C5' || subject.grade === 'C6' ? 'text-yellow-600' :
                    subject.grade === 'D7' || subject.grade === 'E8' ? 'text-orange-600' :
                    'text-red-600' // F9
                  }`}>{subject.grade}</span></p>
                  <p className="text-md text-gray-600">Quizzes Taken: {subject.count}</p>

                  <div className="mt-4 border-t pt-4">
                    <h4 className="font-semibold text-gray-700 mb-2">Individual Quizzes:</h4>
                    {subject.quizzes.length > 0 ? (
                      <ul className="list-disc list-inside text-sm text-gray-600 space-y-1">
                        {subject.quizzes.map(quiz => (
                          <li key={quiz.id} className="flex justify-between items-center">
                            <span>{quiz.quizTitle}</span>
                            <span className="font-bold text-right">{quiz.score.toFixed(1)}%</span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-gray-500 text-sm">No quizzes taken in this subject yet.</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Grades Explanation Modal */}
      {showGradesExplanation && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-75 flex items-center justify-center z-50 p-4">
          <div className="bg-white p-8 rounded-lg shadow-2xl text-center max-w-md mx-auto">
            <h3 className="text-2xl font-bold text-gray-800 mb-4">Grading Scale</h3>
            <div className="text-left mb-6">
              <ul className="list-disc list-inside space-y-2 text-gray-700">
                <li><span className="font-bold text-green-600">A1:</span> Excellent (75% - 100%)</li>
                <li><span className="font-bold text-lime-600">B2:</span> Very Good (70% - 74%)</li>
                <li><span className="font-bold text-lime-600">B3:</span> Good (65% - 69%)</li>
                <li><span className="font-bold text-yellow-600">C4:</span> Credit (60% - 64%)</li>
                <li><span className="font-bold text-yellow-600">C5:</span> Credit (55% - 59%)</li>
                <li><span className="font-bold text-yellow-600">C6:</span> Credit (50% - 54%)</li>
                <li><span className="font-bold text-orange-600">D7:</span> Pass (45% - 49%)</li>
                <li><span className="font-bold text-orange-600">E8:</span> Pass (40% - 44%)</li>
                <li><span className="font-bold text-red-600">F9:</span> Fail (Below 40%)</li>
              </ul>
            </div>
            <button
              onClick={() => setShowGradesExplanation(false)}
              className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-md shadow-md transition duration-200"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Results;
