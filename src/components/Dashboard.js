import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { doc, collection, query, where, getDoc, onSnapshot, setDoc } from 'firebase/firestore';

const Dashboard = ({ navigate }) => {
  const { currentUser, logout, db, userId, loadingAuth, auth, app } = useAuth();
  // Separate states for clarity and to manage updates from different queries
  const [coreQuizzes, setCoreQuizzes] = useState([]);
  const [electiveQuizzes, setElectiveQuizzes] = useState([]);
  const [coreMaterials, setCoreMaterials] = useState([]);
  const [electiveMaterials, setElectiveMaterials] = useState([]);

  const [quizzes, setQuizzes] = useState([]); // Combined quizzes for display
  const [materials, setMaterials] = useState([]); // Combined materials for display

  const [results, setResults] = useState([]);
  const [studentProfile, setStudentProfile] = useState(null);
  const [loadingData, setLoadingData] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const coreSubjects = ['English Language', 'Core Mathematics', 'Integrated Science', 'Social Studies'];

  const canvasRef = useRef(null);
  // FORCE the actual project ID to ensure consistent data paths
  const appId = 'gh-shs-student-74e82';

  const [isUploading, setIsUploading] = useState(false);

  useEffect(() => {
    // Exit early if essential data is not yet available from AuthContext
    if (!db || !currentUser || loadingAuth) {
      // If auth is done loading and no user, navigate to login
      if (!loadingAuth && !currentUser) {
        navigate('login');
      }
      return;
    }

    setLoadingData(true); // Indicate that dashboard data is loading
    setErrorMessage(''); // Clear previous errors

    let unsubscribes = []; // Array to hold all Firestore unsubscribe functions

    const setupFirestoreListeners = async () => {
      try {
        // 1. Fetch Student Profile First (using getDoc once)
        const studentProfileRef = doc(db, `artifacts/${appId}/users/${currentUser.uid}/studentProfiles`, currentUser.uid);
        const profileSnap = await getDoc(studentProfileRef);
        let currentStudentProfile = null;

        if (profileSnap.exists()) {
          currentStudentProfile = profileSnap.data();
          setStudentProfile(currentStudentProfile);
        } else {
          currentStudentProfile = {
            uid: currentUser.uid,
            email: currentUser.email,
            name: currentUser.email.split('@')[0], // Default name from email
            yearGroup: 'N/A',
            shsProgram: 'N/A',
            electiveSubjects: [],
            profileImageData: null,
          };
          setStudentProfile(currentStudentProfile);
          setErrorMessage("Student profile not found. Please ensure your registration is complete or update your profile.");
        }

        const studentElectives = currentStudentProfile.electiveSubjects || [];

        // 1. Quizzes Listeners
        const allQuizzesRef = collection(db, `artifacts/${appId}/public/data/quizzes`);
        
        // Core Quizzes: Always listen for core subjects
        const qCoreQuizzes = query(allQuizzesRef, where("subjectType", "==", "core"));
        unsubscribes.push(onSnapshot(qCoreQuizzes, (snapshot) => {
          setCoreQuizzes(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        }, (error) => console.error("Error fetching core quizzes:", error)));

        // Elective Quizzes: Listen only if student has electives
        if (studentElectives.length > 0) {
          // Firestore 'in' query has a limit of 10 items. Assuming max 4 electives as per Register.js.
          const qElectiveQuizzes = query(
            allQuizzesRef,
            where("subjectType", "==", "elective"),
            where("subjectName", "in", studentElectives)
          );
          unsubscribes.push(onSnapshot(qElectiveQuizzes, (snapshot) => {
            setElectiveQuizzes(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
          }, (error) => console.error("Error fetching elective quizzes:", error)));
        } else {
          // If no electives, ensure elective quizzes state is clear
          setElectiveQuizzes([]);
        }

        // 2. Materials Listeners
        const allMaterialsRef = collection(db, `artifacts/${appId}/public/data/materials`);

        // Core Materials: Always listen for core subjects
        const qCoreMaterials = query(allMaterialsRef, where("subjectType", "==", "core"));
        unsubscribes.push(onSnapshot(qCoreMaterials, (snapshot) => {
          setCoreMaterials(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        }, (error) => console.error("Error fetching core materials:", error)));

        // Elective Materials: Listen only if student has electives
        if (studentElectives.length > 0) {
          const qElectiveMaterials = query(
            allMaterialsRef,
            where("subjectType", "==", "elective"),
            where("subjectName", "in", studentElectives)
          );
          unsubscribes.push(onSnapshot(qElectiveMaterials, (snapshot) => {
            setElectiveMaterials(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
          }, (error) => console.error("Error fetching elective materials:", error)));
        } else {
          // If no electives, ensure elective materials state is clear
          setElectiveMaterials([]);
        }

        // 3. Results Listener
        const resultsRef = collection(db, `artifacts/${appId}/public/data/results`);
        const userResultsQuery = query(resultsRef, where("studentId", "==", currentUser.uid));
        unsubscribes.push(onSnapshot(userResultsQuery, (snapshot) => {
          const fetchedResults = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
          fetchedResults.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0)); // Sort by timestamp if exists
          setResults(fetchedResults);
        }, (error) => console.error("Error fetching results:", error)));

        setLoadingData(false); // All subscriptions set up, data loading complete

      } catch (error) {
        console.error("Dashboard: Error during data fetching and subscription setup:", error);
        setErrorMessage("Failed to load dashboard data. Please check your network and try again. See console for details.");
        setLoadingData(false); // Ensure loading is false even on error
      }
    };

    // Call the async setup function
    setupFirestoreListeners();

    // Set up timer for clearing messages
    const timer = setTimeout(() => {
      setErrorMessage('');
      setSuccessMessage('');
    }, 5000);

    // This is the cleanup function returned by useEffect
    return () => {
      clearTimeout(timer); // Clear the message timer
      unsubscribes.forEach(unsub => unsub()); // Call all collected unsubscribe functions
    };

  }, [db, currentUser, loadingAuth, userId, appId, navigate]);

  // Consolidate quizzes whenever coreQuizzes or electiveQuizzes states change
  useEffect(() => {
    // Combine core and elective quizzes, ensuring uniqueness by ID
    // Filtering by ID ensures that if a quiz somehow appears in both, it's only listed once.
    const combinedQuizzes = [...coreQuizzes, ...electiveQuizzes]
      .filter((quiz, index, self) => index === self.findIndex(q => q.id === quiz.id));
    setQuizzes(combinedQuizzes);
  }, [coreQuizzes, electiveQuizzes]);

  // Consolidate materials whenever coreMaterials or electiveMaterials states change
  useEffect(() => {
    // Combine core and elective materials, ensuring uniqueness by ID
    const combinedMaterials = [...coreMaterials, ...electiveMaterials]
      .filter((material, index, self) => index === self.findIndex(m => m.id === material.id));
    setMaterials(combinedMaterials);
  }, [coreMaterials, electiveMaterials]);


  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setIsUploading(true);
    setErrorMessage('');
    setSuccessMessage('');

    const maxOriginalFileSizeKB = 2000; // Increased to 2MB
    if (file.size > maxOriginalFileSizeKB * 1024) {
      setErrorMessage(`Original image file size (${(file.size / 1024).toFixed(2)}KB) exceeds ${maxOriginalFileSizeKB}KB. Please choose a smaller original image.`);
      setIsUploading(false);
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = async () => {
        const canvas = document.createElement('canvas'); // Create canvas dynamically
        const ctx = canvas.getContext('2d');
        const size = 100; // Desired dimensions for the profile picture (e.g., 100x100 pixels)

        canvas.width = size;
        canvas.height = size;

        // Calculate aspect ratio to fit image without distortion
        const aspectRatio = img.width / img.height;
        let sx, sy, sWidth, sHeight;

        if (img.width > img.height) { // Landscape or square image
          sHeight = img.height;
          sWidth = img.height * aspectRatio;
          sx = (img.width - sWidth) / 2;
          sy = 0;
        } else { // Portrait image
          sWidth = img.width;
          sHeight = img.width / aspectRatio;
          sx = 0;
          sy = (img.height - sHeight) / 2;
        }

        ctx.drawImage(img, sx, sy, sWidth, sHeight, 0, 0, size, size);

        const targetOutputSizeKB = 200; // Target for the final Base64 encoded image
        let dataUrl = '';
        let quality = 0.9;

        // Compress image until it meets the size requirement or quality is too low
        while (quality > 0.05) {
          dataUrl = canvas.toDataURL('image/jpeg', quality);
          if ((dataUrl.length * 0.75 / 1024) <= targetOutputSizeKB) {
            break;
          }
          quality -= 0.05;
        }

        if ((dataUrl.length * 0.75 / 1024) > targetOutputSizeKB) {
          setErrorMessage(`Even after compression, the image is too large (${(dataUrl.length * 0.75 / 1024).toFixed(2)}KB). Target is ${targetOutputSizeKB}KB. Please try a different, simpler image.`);
          setIsUploading(false);
          return;
        }

        if (!db || !currentUser) {
          setErrorMessage("Firebase Firestore or current user not available.");
          setIsUploading(false);
          return;
        }

        try {
          const studentProfileDocRef = doc(db, `artifacts/${appId}/users/${currentUser.uid}/studentProfiles`, currentUser.uid);
          // Store the Base64 string in the Firestore document
          // Use current studentProfile state as base to preserve existing fields
          await setDoc(studentProfileDocRef, {
            ...studentProfile, // Merge existing profile data
            profileImageData: dataUrl,
            // Ensure essential fields are always saved even if they were N/A or undefined initially
            name: studentProfile?.name || currentUser.email.split('@')[0],
            email: studentProfile?.email || currentUser.email,
            yearGroup: studentProfile?.yearGroup || 'N/A',
            shsProgram: studentProfile?.shsProgram || 'N/A',
            electiveSubjects: studentProfile?.electiveSubjects || [],
          }, { merge: true });

          setStudentProfile(prevProfile => ({
            ...prevProfile,
            profileImageData: dataUrl,
            name: prevProfile?.name || currentUser.email.split('@')[0],
            email: prevProfile?.email || currentUser.email,
          }));
          setSuccessMessage("Profile picture updated successfully!");
        } catch (error) {
          console.error("Error saving profile picture data to Firestore:", error);
          setErrorMessage("Failed to upload profile picture. Firestore error. Check console for details.");
        } finally {
          setIsUploading(false);
        }
      };
      img.onerror = () => {
        setErrorMessage("Could not load image. Ensure it's a valid image file.");
        setIsUploading(false);
      };
      img.src = event.target.result;
    };
    reader.readAsDataURL(file);
  };


  if (loadingAuth || loadingData) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="text-xl font-semibold text-gray-700">Loading Dashboard...</div>
      </div>
    );
  }

  // Redirection is handled at the top of the useEffect if currentUser is null and loadingAuth is false.
  if (!currentUser) {
    navigate('login');
    return null;
  }

  return (
    <div className="flex flex-col md:flex-row min-h-screen bg-gray-100 font-sans">
      {/* Sidebar */}
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
                <svg className="w-5 h-5 mr-3" fill="currentColor" viewBox="0 0 20 20"><path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0  001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z"></path></svg>
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
              <button onClick={() => navigate('results')} className="flex items-center text-blue-200 hover:text-white transition duration-200 p-2 rounded-lg w-full text-left">
                <svg className="w-5 h-5 mr-3" fill="currentColor" viewBox="0 0 20 20"><path d="M10 12a2 2 0 100-4 2 2 0 000 4z"></path><path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd"></path></svg>
                Results
              </button>
            </li>
          </ul>
        </nav>
        <div className="mt-8">
          {/* Profile Picture Upload Section in Sidebar */}
          <div className="flex flex-col items-center mb-6">
            <div className="w-24 h-24 rounded-full bg-gray-300 flex items-center justify-center overflow-hidden border-4 border-blue-300 shadow-lg">
              {/* Use profileImageData for src */}
              {studentProfile?.profileImageData ? (
                <img src={studentProfile.profileImageData} alt="Profile" className="w-full h-full object-cover" />
              ) : (
                <svg className="w-16 h-16 text-gray-500" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd"></path>
                </svg>
              )}
            </div>
            <label htmlFor="profile-upload" className="mt-3 cursor-pointer bg-blue-500 hover:bg-blue-600 text-white text-xs font-semibold py-1 px-3 rounded-md transition duration-200 shadow-sm">
              {isUploading ? 'Uploading...' : 'Change Photo'}
              <input
                id="profile-upload"
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleImageUpload}
                disabled={isUploading}
              />
            </label>
            {/* Using a hidden canvas for image processing */}
            <canvas ref={canvasRef} style={{ display: 'none' }}></canvas> 
          </div>

          <p className="text-sm text-blue-200">Logged in as:</p>
          <p className="font-semibold text-lg">{studentProfile?.name || currentUser?.email}</p>
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

      {/* Main Content */}
      <div className="flex-grow p-6 md:p-8 bg-white rounded-xl shadow-xl ml-4 mr-4 mt-4 mb-4">
        <div className="flex justify-between items-center mb-8">
          <h2 className="text-3xl font-bold text-gray-800">Welcome, {studentProfile?.name || "Student"}!</h2>
        </div>

        {/* Success and Error Messages */}
        {successMessage && (
          <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded-md relative mb-4">
            <strong className="font-bold">Success!</strong>
            <span className="block sm:inline ml-2">{successMessage}</span>
          </div>
        )}
        {errorMessage && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-md relative mb-4">
            <strong className="font-bold">Error!</strong> {/* Corrected from <b> */}
            <span className="block sm:inline ml-2">{errorMessage}</span>
          </div>
        )}

        {/* Student Details Widget */}
        <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-200 mb-6 transition transform hover:scale-105 duration-300">
          <h3 className="text-xl font-semibold text-gray-800 mb-4 flex items-center">
            <span className="text-indigo-500 mr-2">👤</span> Your Profile
          </h3>
          {studentProfile ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-gray-700">
              <div>
                <p><strong className="text-gray-900">Full Name:</strong> {studentProfile.name || 'N/A'}</p>
                <p><strong className="text-gray-900">Email:</strong> {studentProfile.email || 'N/A'}</p>
                {/* Display Student's Year Group */}
                <p><strong className="text-gray-900">Year Group:</strong> {studentProfile.yearGroup || 'N/A'}</p>
                {/* Display Student's SHS Program */}
                <p><strong className="text-gray-900">SHS Program:</strong> {studentProfile.shsProgram || 'N/A'}</p> {/* Corrected <b> to <strong> */}
              </div>
              <div>
                <p><strong className="text-gray-900">Core Subjects:</strong> {coreSubjects.join(', ')}</p>
                <p><strong className="text-gray-900">Elective Subjects:</strong> {studentProfile.electiveSubjects?.join(', ') || 'N/A'}</p>
              </div>
            </div>
          ) : (
            <p className="text-gray-500">Loading student profile...</p>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Quizzes Widget */}
          <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-200 transition transform hover:scale-105 duration-300">
            <h3 className="text-xl font-semibold text-gray-800 mb-4 flex items-center">
              <span className="text-blue-500 mr-2">📚</span> Upcoming Quizzes
            </h3>
            {quizzes.length > 0 ? (
              <ul className="space-y-3">
                {quizzes.map((quiz) => (
                  <li key={quiz.id} className="p-3 bg-blue-50 rounded-md flex items-center justify-between text-gray-700">
                    <span>{quiz.title} - {quiz.subjectName}</span>
                    <button onClick={() => navigate('quizzes')} className="text-sm text-blue-600 hover:underline">Start Quiz</button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-gray-500">No quizzes available at the moment.</p>
            )}
          </div>

          {/* Materials Widget */}
          <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-200 transition transform hover:scale-105 duration-300">
            <h3 className="text-xl font-semibold text-gray-800 mb-4 flex items-center">
              <span className="text-green-500 mr-2">📖</span> Learning Materials
            </h3>
            {materials.length > 0 ? (
              <ul className="space-y-3">
                {materials.map((material) => (
                  <li key={material.id} className="p-3 bg-green-50 rounded-md flex items-center justify-between text-gray-700">
                    <span>{material.title} ({material.type}) - {material.subjectName}</span>
                    <button onClick={() => navigate('materials')} className="text-sm text-green-600 hover:underline">View</button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-gray-500">No materials available yet.</p>
            )}
          </div>

          {/* Results Widget */}
          <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-200 transition transform hover:scale-105 duration-300">
            <h3 className="text-xl font-semibold text-gray-800 mb-4 flex items-center">
              <span className="text-yellow-500 mr-2">📊</span> Your Results
            </h3>
            {results.length > 0 ? (
              <ul className="space-y-3">
                {results.map((result) => (
                  <li key={result.id} className="p-3 bg-yellow-50 rounded-md flex items-center justify-between text-gray-700">
                    <span>{result.quizTitle}: {result.score}%</span>
                    <button onClick={() => navigate('results')} className="text-sm text-yellow-600 hover:underline">Details</button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-gray-500">No results recorded yet.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
