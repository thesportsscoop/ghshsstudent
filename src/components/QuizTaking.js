import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { doc, getDoc, setDoc, collection, query, where, getDocs } from 'firebase/firestore';

const QuizTaking = ({ navigate, quizId }) => {
  const { currentUser, db, loadingAuth, userId, logout } = useAuth();
  const [quiz, setQuiz] = useState(null);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [selectedAnswers, setSelectedAnswers] = useState({}); // Stores {questionIndex: selectedOptionIndex}
  // New state to track the status of each question: 'unanswered', 'answered', 'skipped'
  const [questionStatuses, setQuestionStatuses] = useState([]);
  const [timeLeft, setTimeLeft] = useState(0);
  const [quizStarted, setQuizStarted] = useState(false);
  const [quizFinished, setQuizFinished] = useState(false);
  const [score, setScore] = useState(0);
  const [errorMessage, setErrorMessage] = useState('');
  const [showResultModal, setShowResultModal] = useState(false);
  const [hasTakenQuiz, setHasTakenQuiz] = useState(false);

  const appId = 'gh-shs-student-74e82';

  // Effect to fetch quiz details and check for previous attempts
  useEffect(() => {
    if (!db || !currentUser || loadingAuth) {
      if (!loadingAuth && !currentUser) {
        navigate('login');
      } else if (!loadingAuth && !db) {
        setErrorMessage("Firestore is not initialized. Please try again.");
      }
      return;
    }

    if (!quizId) {
      setErrorMessage("No quiz ID provided. Please select a quiz.");
      return;
    }

    const fetchData = async () => {
      try {
        // 1. Fetch Quiz Details
        const quizDocRef = doc(db, `artifacts/${appId}/public/data/quizzes`, quizId);
        const quizSnap = await getDoc(quizDocRef);

        if (quizSnap.exists()) {
          const fetchedQuiz = { id: quizSnap.id, ...quizSnap.data() };
          const shuffledQuestions = [...fetchedQuiz.questions].sort(() => Math.random() - 0.5);
          setQuiz({ ...fetchedQuiz, questions: shuffledQuestions });
          setTimeLeft(fetchedQuiz.duration || 300);
          setErrorMessage('');

          // Initialize questionStatuses array based on the number of questions
          setQuestionStatuses(shuffledQuestions.map(() => ({ status: 'unanswered', selectedOption: null })));

          // 2. Check for Previous Quiz Attempts (One-time access logic)
          const resultsColRef = collection(db, `artifacts/${appId}/public/data/results`);
          const q = query(
            resultsColRef,
            where("studentId", "==", currentUser.uid),
            where("quizId", "==", quizId)
          );
          const resultsSnap = await getDocs(q);

          if (resultsSnap.docs.length > 0) {
            setHasTakenQuiz(true);
            setErrorMessage("You have already completed this quiz. You can only take each quiz once.");
          } else {
            setHasTakenQuiz(false); // Ensure it's false if no results found
          }

        } else {
          setErrorMessage("Quiz not found.");
        }
      } catch (error) {
        console.error("Error fetching quiz or checking results:", error);
        setErrorMessage(`Failed to load quiz or check past attempts: ${error.message}`);
      }
    };

    fetchData();
  }, [db, currentUser, loadingAuth, navigate, quizId, appId]);

  // Effect for timer logic
  useEffect(() => {
    let timer;
    if (quizStarted && timeLeft > 0 && !quizFinished) {
      timer = setInterval(() => {
        setTimeLeft((prevTime) => prevTime - 1);
      }, 1000);
    } else if (timeLeft === 0 && quizStarted && !quizFinished) {
      // Time's up, automatically submit quiz
      handleSubmitQuiz();
    }

    return () => clearInterval(timer);
  }, [quizStarted, timeLeft, quizFinished, quiz]);

  const handleStartButton = () => {
    if (hasTakenQuiz) {
      setErrorMessage("You have already completed this quiz. You cannot take it again.");
      return;
    }
    setQuizStarted(true);
    setErrorMessage('');
    if (quiz && timeLeft === 0) {
      setTimeLeft(quiz.duration || 300);
    }
  };

  const handleOptionSelect = (questionIndex, optionIndex) => {
    setSelectedAnswers((prev) => ({
      ...prev,
      [questionIndex]: optionIndex,
    }));
    // Mark question as 'answered'
    setQuestionStatuses(prev => {
      const newStatuses = [...prev];
      newStatuses[questionIndex] = { status: 'answered', selectedOption: optionIndex };
      return newStatuses;
    });
  };

  const handleSkipQuestion = () => {
    // Only mark as skipped if it's currently unanswered
    if (questionStatuses[currentQuestionIndex].status === 'unanswered') {
      setQuestionStatuses(prev => {
        const newStatuses = [...prev];
        newStatuses[currentQuestionIndex] = { status: 'skipped', selectedOption: null };
        return newStatuses;
      });
    }
    // Move to next question if not the last one
    if (currentQuestionIndex < quiz.questions.length - 1) {
      setCurrentQuestionIndex(prev => prev + 1);
    }
  };

  const handleNavigateToQuestion = (index) => {
    setCurrentQuestionIndex(index);
  };

  const handleSubmitQuiz = async () => {
    if (!quiz) {
      setErrorMessage("No quiz data to submit.");
      return;
    }
    if (quizFinished) {
      return;
    }

    setQuizFinished(true); // Mark quiz as finished
    let correctAnswersCount = 0;
    quiz.questions.forEach((q, index) => {
      // A question is correct if it was answered AND the selected answer matches the correct one
      if (selectedAnswers[index] !== undefined && selectedAnswers[index] === q.correctAnswerIndex) {
        correctAnswersCount++;
      }
    });

    const calculatedScore = (correctAnswersCount / quiz.questions.length) * 100;
    setScore(calculatedScore);
    setShowResultModal(true); // Show result modal

    if (currentUser && db) {
      try {
        const resultsColRef = collection(db, `artifacts/${appId}/public/data/results`);
        await setDoc(doc(resultsColRef), { // Use doc() with no second argument for auto-generated ID
          studentId: currentUser.uid,
          quizId: quiz.id,
          quizTitle: quiz.title,
          score: calculatedScore,
          totalQuestions: quiz.questions.length,
          correctQuestions: correctAnswersCount,
          // *** IMPORTANT FIX: Add subjectType and subjectName here ***
          subjectType: quiz.subjectType || 'unknown', // Ensure your quiz object has subjectType
          subjectName: quiz.subjectName || 'Unknown Subject', // Ensure your quiz object has subjectName
          timestamp: Date.now(), // Store as Unix timestamp for easy sorting
        });
        console.log("Quiz result saved successfully!");
      } catch (error) {
        console.error("Error saving quiz result:", error);
        setErrorMessage(`Failed to save result: ${error.message}. Please check permissions.`);
      }
    }
  };

  const formatTime = (seconds) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds < 10 ? '0' : ''}${remainingSeconds}`;
  };

  if (loadingAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="text-xl font-semibold text-gray-700">Loading Authentication...</div>
      </div>
    );
  }

  if (errorMessage) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-red-50 p-4">
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-md shadow-md text-center max-w-md">
          <strong className="font-bold">Error!</strong>
          <span className="block sm:inline ml-2">{errorMessage}</span>
          <button onClick={() => navigate('quizzes')} className="mt-4 bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-4 rounded-md">Back to Quizzes</button>
        </div>
      </div>
    );
  }

  if (!quiz) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="text-xl font-semibold text-gray-700">Loading Quiz Details...</div>
      </div>
    );
  }

  const currentQuestion = quiz.questions[currentQuestionIndex];

  return (
    <div className="flex flex-col md:flex-row min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 font-sans">
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
              <button onClick={() => navigate('quizzes')} className="flex items-center text-blue-200 hover:text-white transition duration-200 p-2 rounded-lg w-full text-left bg-blue-600">
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
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-3xl font-bold text-gray-800">{quiz.title}</h2>
          {quizStarted && !quizFinished && (
            <div className="text-2xl font-bold text-blue-600">Time Left: {formatTime(timeLeft)}</div>
          )}
        </div>

        {!quizStarted && !hasTakenQuiz ? (
          <div className="text-center p-8 bg-blue-50 rounded-lg shadow-md">
            <p className="text-xl font-semibold text-gray-800 mb-4">Instructions for this Quiz:</p>
            <ul className="text-gray-700 text-left mb-6 space-y-2 list-disc list-inside">
              <li>This quiz contains {quiz.questions.length} questions and has a duration of {quiz.duration / 60} minutes.</li>
              <li>You can skip questions and return to them later using the navigation panel on the right.</li>
              <li>Once the timer runs out, the quiz will be automatically submitted.</li>
              <li>You can only attempt each quiz **once**.</li>
              <li>Your answers will be automatically saved as you select them.</li>
            </ul>
            <button
              onClick={handleStartButton}
              className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-8 rounded-full shadow-lg transition duration-300 transform hover:scale-105"
            >
              Start Quiz
            </button>
          </div>
        ) : hasTakenQuiz ? (
          <div className="text-center p-8 bg-yellow-50 rounded-lg shadow-md">
            <p className="text-2xl font-bold text-yellow-800 mb-4">Quiz Already Completed!</p>
            <p className="text-gray-700 mb-6">{errorMessage}</p>
            <button
              onClick={() => navigate('quizzes')}
              className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-6 rounded-md shadow-lg transition duration-200"
            >
              Back to Quizzes
            </button>
          </div>
        ) : quizFinished ? (
            <div className="text-center p-8 bg-green-50 rounded-lg shadow-md">
              <p className="text-2xl font-bold text-green-700 mb-4">Quiz Completed!</p>
              <p className="text-xl text-gray-800 mb-6">Your Score: <span className="font-bold">{score.toFixed(2)}%</span></p>
              <button
                onClick={() => navigate('results')}
                className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-6 rounded-md shadow-lg transition duration-200 mr-4"
              >
                View All Results
              </button>
              <button
                onClick={() => {
                  setShowResultModal(false);
                  navigate('quizzes');
                }}
                className="bg-gray-400 hover:bg-gray-500 text-white font-bold py-2 px-6 rounded-md shadow-lg transition duration-200"
              >
                Take Another Quiz
              </button>
            </div>
        ) : (
          <div className="space-y-6">
            <div className="flex flex-col lg:flex-row gap-6">
                {/* Main Question Card */}
                <div className="flex-grow bg-blue-50 p-6 rounded-lg shadow-md">
                    <p className="text-xl font-semibold text-gray-800 mb-4">Question {currentQuestionIndex + 1} of {quiz.questions.length}</p>
                    <p className="text-lg text-gray-700 mb-6">{currentQuestion.questionText}</p>
                    <div className="space-y-3">
                        {currentQuestion.options.map((option, index) => (
                            <button
                                key={index}
                                onClick={() => handleOptionSelect(currentQuestionIndex, index)}
                                className={`block w-full text-left p-4 border border-blue-300 rounded-md transition duration-200
                                        ${selectedAnswers[currentQuestionIndex] === index ? 'bg-blue-200 text-blue-900 border-blue-500 shadow-inner' : 'bg-white hover:bg-blue-50 text-gray-800'}`}
                            >
                                {option}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Question Navigation Sidebar */}
                <div className="lg:w-1/4 bg-white p-6 rounded-lg shadow-md border border-gray-200">
                    <h3 className="text-xl font-semibold text-gray-800 mb-4">Questions</h3>
                    <div className="grid grid-cols-5 sm:grid-cols-6 md:grid-cols-7 lg:grid-cols-4 xl:grid-cols-5 gap-2">
                        {quiz.questions.map((_, index) => {
                            let buttonClass = "w-9 h-9 flex items-center justify-center rounded-full font-semibold text-sm transition duration-200";
                            const status = questionStatuses[index]?.status;

                            if (index === currentQuestionIndex) {
                                buttonClass += " bg-blue-600 text-white border-2 border-blue-800 shadow-md";
                            } else if (status === 'answered') {
                                buttonClass += " bg-green-200 text-green-800 hover:bg-green-300";
                            } else if (status === 'skipped') {
                                buttonClass += " bg-yellow-200 text-yellow-800 hover:bg-yellow-300";
                            } else { // unanswered
                                buttonClass += " bg-gray-200 text-gray-700 hover:bg-gray-300";
                            }

                            return (
                                <button
                                    key={index}
                                    onClick={() => handleNavigateToQuestion(index)}
                                    className={buttonClass}
                                    title={status === 'answered' ? 'Answered' : (status === 'skipped' ? 'Skipped' : 'Unanswered')}
                                >
                                    {index + 1}
                                </button>
                            );
                        })}
                    </div>
                </div>
            </div>


            <div className="flex justify-between mt-6">
              <button
                onClick={() => setCurrentQuestionIndex(prev => Math.max(0, prev - 1))}
                disabled={currentQuestionIndex === 0}
                className="bg-gray-300 hover:bg-gray-400 text-gray-800 font-bold py-2 px-4 rounded-md shadow transition duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Previous
              </button>
              <button
                onClick={handleSkipQuestion}
                disabled={currentQuestionIndex === quiz.questions.length -1} // Disable skip on last question
                className="bg-yellow-500 hover:bg-yellow-600 text-white font-bold py-2 px-4 rounded-md shadow transition duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Skip Question
              </button>
              {currentQuestionIndex < quiz.questions.length - 1 ? (
                <button
                  onClick={() => setCurrentQuestionIndex(prev => prev + 1)}
                  className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-md shadow transition duration-200"
                >
                  Next
                </button>
              ) : (
                <button
                  onClick={handleSubmitQuiz}
                  className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded-md shadow-lg transition duration-200"
                >
                  Submit Quiz
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Result Modal */}
      {showResultModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-75 flex items-center justify-center z-50 p-4">
          <div className="bg-white p-8 rounded-lg shadow-2xl text-center max-w-sm mx-auto">
            <h3 className="text-3xl font-bold text-green-700 mb-4">Quiz Result</h3>
            <p className="text-xl text-gray-800 mb-6">Your Score: <span className="font-extrabold text-green-900">{score.toFixed(2)}%</span></p>
            <div className="flex justify-center space-x-4">
              <button
                onClick={() => {
                  setShowResultModal(false);
                  navigate('results');
                }}
                className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-md shadow-md transition duration-200"
              >
                View All Results
              </button>
              <button
                onClick={() => {
                  setShowResultModal(false);
                  navigate('quizzes');
                }}
                className="bg-gray-400 hover:bg-gray-500 text-white font-bold py-2 px-4 rounded-md shadow-md transition duration-200"
              >
                Back to Quizzes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default QuizTaking;
