import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { collection, onSnapshot, query, where, getDoc, doc } from 'firebase/firestore';

const Materials = ({ navigate }) => {
  const { currentUser, logout, db, userId, loadingAuth } = useAuth();
  const [materialsBySubject, setMaterialsBySubject] = useState({}); // Changed to object for subject-wise grouping
  const [loadingMaterials, setLoadingMaterials] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [studentProfile, setStudentProfile] = useState(null);

  const appId = 'gh-shs-student-74e82';

  useEffect(() => {
    if (!db || !currentUser || loadingAuth) {
      if (!loadingAuth && !currentUser) {
        navigate('login');
      }
      return;
    }

    setLoadingMaterials(true);
    setErrorMessage('');

    let unsubscribes = [];

    const setupMaterialListeners = async () => {
      try {
        const studentProfileRef = doc(db, `artifacts/${appId}/users/${currentUser.uid}/studentProfiles`, currentUser.uid);
        const profileSnap = await getDoc(studentProfileRef);
        let currentStudentProfile = null;

        if (profileSnap.exists()) {
          currentStudentProfile = profileSnap.data();
          setStudentProfile(currentStudentProfile);
        } else {
          console.warn("Materials: Student Profile Document DOES NOT EXIST at path:", studentProfileRef.path);
          currentStudentProfile = { electiveSubjects: [] };
          setStudentProfile(currentStudentProfile);
          setErrorMessage("Your student profile was not found. Please ensure your registration is complete.");
        }

        const studentElectives = currentStudentProfile.electiveSubjects || [];

        // Temporary object to build up materials grouped by subject before setting state
        let currentMaterialsBySubject = {};

        const allMaterialsRef = collection(db, `artifacts/${appId}/public/data/materials`);

        // Listener for core materials
        const qCoreMaterials = query(allMaterialsRef, where("subjectType", "==", "core"));
        unsubscribes.push(onSnapshot(qCoreMaterials, (snapshot) => {
          // Clear existing core materials to avoid duplicates on re-snapshot
          currentMaterialsBySubject = Object.fromEntries(
            Object.entries(currentMaterialsBySubject).filter(([key, value]) => value.type !== 'core')
          );
          
          snapshot.docs.forEach(docSnap => {
            const material = { id: docSnap.id, ...docSnap.data() };
            const subjectKey = `${material.subjectType || 'unknown'}-${material.subjectName || 'Unknown'}`;
            if (!currentMaterialsBySubject[subjectKey]) {
              currentMaterialsBySubject[subjectKey] = {
                name: material.subjectName || 'Unknown',
                type: material.subjectType || 'unknown',
                materials: []
              };
            }
            currentMaterialsBySubject[subjectKey].materials.push(material);
          });
          setMaterialsBySubject({ ...currentMaterialsBySubject }); // Trigger re-render
        }, (error) => console.error("Materials: Error fetching core materials:", error)));


        // Listener for elective materials
        if (studentElectives.length > 0) {
          const qElectiveMaterials = query(
            allMaterialsRef,
            where("subjectType", "==", "elective"),
            where("subjectName", "in", studentElectives)
          );
          unsubscribes.push(onSnapshot(qElectiveMaterials, (snapshot) => {
            // Clear existing elective materials to avoid duplicates on re-snapshot
            currentMaterialsBySubject = Object.fromEntries(
                Object.entries(currentMaterialsBySubject).filter(([key, value]) => value.type !== 'elective')
            );

            snapshot.docs.forEach(docSnap => {
              const material = { id: docSnap.id, ...docSnap.data() };
              const subjectKey = `${material.subjectType || 'unknown'}-${material.subjectName || 'Unknown'}`;
              if (!currentMaterialsBySubject[subjectKey]) {
                currentMaterialsBySubject[subjectKey] = {
                  name: material.subjectName || 'Unknown',
                  type: material.subjectType || 'unknown',
                  materials: []
                };
              }
              currentMaterialsBySubject[subjectKey].materials.push(material);
            });
            setMaterialsBySubject({ ...currentMaterialsBySubject }); // Trigger re-render
          }, (error) => console.error("Materials: Error fetching elective materials:", error)));
        } else {
            // If no electives, ensure no elective materials are displayed
            setMaterialsBySubject(prev => Object.fromEntries(
                Object.entries(prev).filter(([key, value]) => value.type === 'core')
            ));
        }

        setLoadingMaterials(false);

      } catch (error) {
        console.error("Materials: Error during data fetching and subscription setup:", error);
        setErrorMessage("Failed to load materials. Please check your network and try again. See console for details.");
        setLoadingMaterials(false);
      }
    };

    setupMaterialListeners();

    return () => {
      unsubscribes.forEach(unsub => unsub());
    };

  }, [db, currentUser, loadingAuth, appId, navigate]);

  const handleViewMaterial = (url, title) => {
    if (url) {
      window.open(url, '_blank');
    } else {
      const messageBox = document.createElement('div');
      messageBox.className = "fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50";
      messageBox.innerHTML = `
        <div class="bg-white p-6 rounded-lg shadow-xl text-center max-w-sm mx-auto">
          <p class="text-lg font-semibold mb-4">No URL Available</p>
          <p class="text-gray-700 mb-6">No direct link is available for "${title}".</p>
          <button class="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-md shadow-md transition duration-200" onclick="this.closest('.fixed').remove()">OK</button>
      </div>
    `;
      document.body.appendChild(messageBox);
    }
  };

  // Sort subjects for consistent display (e.g., Core first, then alphabetically)
  const sortedSubjects = Object.values(materialsBySubject).sort((a, b) => {
    // Custom sort: core subjects first, then by name
    if (a.type === 'core' && b.type !== 'core') return -1;
    if (a.type !== 'core' && b.type === 'core') return 1;
    return a.name.localeCompare(b.name);
  });

  return (
    <div className="flex flex-col md:flex-row min-h-screen bg-purple-100 font-sans">
      {/* Sidebar - Consistent with Dashboard */}
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
            <li className="bg-blue-600 rounded-lg"> {/* Highlight current page */}
              <button onClick={() => navigate('materials')} className="flex items-center text-white transition duration-200 p-2 rounded-lg w-full text-left">
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

      {/* Main Content - Outer wrapper with a distinct background for the page */}
      <div className="flex-grow p-6 md:p-8 bg-purple-100 rounded-xl shadow-xl ml-4 mr-4 mt-4 mb-4">
        <div className="flex justify-between items-center mb-8">
          <h2 className="text-3xl font-bold text-gray-800">Learning Materials</h2>
        </div>

        {errorMessage && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-md relative mb-4">
            <strong className="font-bold">Error!</strong>
            <span className="block sm:inline ml-2">{errorMessage}</span>
          </div>
        )}

        {Object.keys(materialsBySubject).length === 0 && !loadingMaterials ? (
          <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-200">
            <p className="text-gray-500 text-center py-4">No learning materials available at the moment.</p>
          </div>
        ) : (
          <div className="space-y-8">
            {sortedSubjects.map(subject => (
              <div key={`${subject.type}-${subject.name}`} className="bg-white p-6 rounded-xl shadow-lg border border-gray-200">
                <h3 className="text-xl font-bold text-gray-800 mb-2">{subject.name}</h3>
                <p className="text-sm text-gray-500 mb-4 capitalize">({subject.type} Subject)</p>
                {subject.materials.length > 0 ? (
                  <ul className="space-y-3">
                    {subject.materials.map((material) => (
                      <li key={material.id} className="p-3 bg-gray-50 rounded-md flex items-center justify-between text-gray-700 hover:bg-gray-100 transition duration-200">
                        <span>{material.title} ({material.type})</span>
                        <button
                          onClick={() => handleViewMaterial(material.url, material.title)}
                          className="py-1 px-3 rounded-md bg-green-600 hover:bg-green-700 text-white text-sm font-semibold transition duration-200"
                        >
                          View
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-gray-500 text-sm">No materials available for this subject yet.</p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Materials;
