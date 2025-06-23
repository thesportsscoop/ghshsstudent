import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { collection, onSnapshot, doc, setDoc, deleteDoc, getDocs, query, collectionGroup, writeBatch, getDoc, addDoc } from 'firebase/firestore';

const AdminDashboard = ({ navigate }) => {
  const { currentUser, logout, db, userId, loadingAuth, isAdmin } = useAuth();
  const [activeTab, setActiveTab] = useState('users'); // State for active tab: 'users', 'quizzes', 'materials'
  const [users, setUsers] = useState([]); // State for all users
  const [quizzes, setQuizzes] = useState([]); // State for all quizzes
  const [materials, setMaterials] = useState([]); // State for all materials
  const [loadingData, setLoadingData] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  // States for Quiz Management Form
  const [quizForm, setQuizForm] = useState({ 
    id: null, 
    title: '', 
    subjectType: 'core', 
    subjectName: '', 
    questions: [], // Array to hold question objects
    duration: 300 // Default duration in seconds (e.g., 5 minutes)
  });
  const [isQuizModalOpen, setIsQuizModal] = useState(false);
  const [isBulkImportModalOpen, setIsBulkImportModalOpen] = useState(false); // New state for bulk import modal
  const [bulkImportText, setBulkImportText] = useState(''); // State for bulk import textarea content

  // States for Material Management Form
  const [materialForm, setMaterialForm] = useState({ id: null, title: '', type: '', url: '', subjectType: 'core', subjectName: '' });
  const [isMaterialModalOpen, setIsMaterialModalOpen] = useState(false);

  // Predefined lists for dropdowns (same as Register.js, for consistency)
  const shsProgramOptions = [
    'General Arts', 'Business', 'Science', 'Visual Arts',
    'Home Economics', 'Agricultural Science', 'Technical'
  ];
  const allElectiveSubjects = [
    'Economics', 'Geography', 'Government', 'History',
    'Business Management', 'Accounting', 'Elective ICT',
    'Biology', 'Chemistry', 'Physics', 'General Science',
    'Graphic Design', 'Sculpture', 'Textile',
    'Food & Nutrition', 'Management in Living',
    'Crop Husbandry', 'Animal Husbandry',
    'Technical Drawing', 'Applied Electricity', 'Auto Mechanics'
  ];
  const coreSubjects = ['English Language', 'Core Mathematics', 'Integrated Science', 'Social Studies'];

  // FORCE the actual project ID to ensure consistent data paths
  const appId = 'gh-shs-student-74e82'; // <--- EXPLICITLY SET TO YOUR ACTUAL PROJECT ID


  // Effect to fetch data based on active tab
  useEffect(() => {
    console.log("AdminDashboard useEffect (vNEW.11): Initial check - isAdmin:", isAdmin, "loadingAuth:", loadingAuth, "currentUser:", currentUser?.uid);
    console.log("AdminDashboard useEffect (vNEW.11): Component's appId:", appId, "Component's userId (from AuthContext):", userId);


    if (!db || !currentUser || loadingAuth || !isAdmin) {
      if (!loadingAuth && !isAdmin && currentUser) {
        console.log("AdminDashboard (vNEW.11): Auth complete, but currentUser is NOT admin. Redirecting to dashboard.");
        navigate('dashboard'); 
      } else if (!currentUser) {
        console.log("AdminDashboard (vNEW.11): No current user, will be handled by App.js to login.");
      } else {
        console.log("AdminDashboard (vNEW.11): Still loading auth or DB not ready. Waiting to fetch data.");
      }
      return;
    }

    console.log("AdminDashboard useEffect (vNEW.11): Conditions met. Starting data fetch for activeTab:", activeTab);

    setLoadingData(true);
    setErrorMessage('');
    setSuccessMessage('');

    let unsubscribeFunctions = [];

    const fetchData = async () => {
      try {
        if (activeTab === 'users') {
          console.log("AdminDashboard (vNEW.11): Fetching 'users' tab data (collectionGroup).");
          console.log(`AdminDashboard (vNEW.11): Firestore query path for studentProfiles expected: artifacts/${appId}/users/{uid}/studentProfiles/{uid}`);
          // The collectionGroup query will find all 'studentProfiles' subcollections regardless of their parent path.
          // This is why the security rules for collection groups are critical.
          const studentProfilesQuery = query(collectionGroup(db, 'studentProfiles'));
          
          const unsubscribeUsers = onSnapshot(studentProfilesQuery, (snapshot) => {
            console.log("AdminDashboard (vNEW.11): onSnapshot for studentProfiles triggered. Raw snapshot received.");
            console.log("AdminDashboard (vNEW.11): Snapshot docs length:", snapshot.docs.length, "documents initially received from query.");

            const fetchedUsers = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data(), uid: doc.id }));
            console.log("AdminDashboard (vNEW.11): fetchedUsers (after mapping doc.id):", fetchedUsers);

            // Fetch user roles from the now consistent path
            const userRolesPromises = fetchedUsers.map(user => 
              getDoc(doc(db, `artifacts/${appId}/public/data/userRoles`, user.id))
            );

            Promise.all(userRolesPromises).then(rolesSnaps => {
                const usersWithRoles = fetchedUsers.map((user, index) => {
                    const roleData = rolesSnaps[index].data();
                    const isUserAdmin = roleData ? (roleData.isAdmin === true) : false;
                    console.log(`AdminDashboard (vNEW.11): User ${user.id} role: isAdmin=${isUserAdmin} (Raw:${JSON.stringify(roleData)})`);
                    return {
                        ...user,
                        isAdmin: isUserAdmin
                    };
                });
                console.log("AdminDashboard (vNEW.11): usersWithRoles (after all role checks):", usersWithRoles);
                setUsers(usersWithRoles);
                setLoadingData(false);
            }).catch(error => {
                console.error("AdminDashboard (vNEW.11): Error fetching user roles for admin panel display:", error);
                setErrorMessage("Failed to load user roles data for display. Check console.");
                setLoadingData(false);
            });
          }, (error) => {
              console.error("AdminDashboard (vNEW.11): CRITICAL Firestore Error fetching student profiles (collection group):", error);
              setErrorMessage("Failed to load users. This is likely due to incorrect Firebase Security Rules or a missing composite index for 'studentProfiles' collection group. Please check Firebase Console Rules Playground and Indexes tab.");
              setLoadingData(false);
          });
          unsubscribeFunctions.push(unsubscribeUsers);
        }

        if (activeTab === 'quizzes') {
          console.log("AdminDashboard (vNEW.11): Fetching 'quizzes' tab data.");
          // This path aligns with where AdminDashboard writes and where Quizzes/Materials reads
          const quizzesColRef = collection(db, `artifacts/${appId}/public/data/quizzes`);
          const unsubscribeQuizzes = onSnapshot(quizzesColRef, (snapshot) => {
            // Explicitly filter documents that don't have a valid ID right from the snapshot.
            // This is a defensive measure if malformed documents exist or doc.id is unexpectedly null.
            const fetchedQuizzes = snapshot.docs
              .filter(docSnap => {
                if (!docSnap.id) {
                  console.error("AdminDashboard: Found a Firestore quiz document with a null/undefined ID directly from snapshot:", docSnap.ref.path);
                  return false; // Exclude this document
                }
                return true;
              })
              .map(docSnap => ({ id: docSnap.id, ...docSnap.data() })); // Map only valid documents
            
            setQuizzes(fetchedQuizzes);
            setLoadingData(false);
          }, (error) => {
            console.error("AdminDashboard (vNEW.11): Error fetching quizzes:", error);
            setErrorMessage("Failed to load quizzes. Check console for rules or network issues.");
            setLoadingData(false);
          });
          unsubscribeFunctions.push(unsubscribeQuizzes);
        }

        if (activeTab === 'materials') {
          console.log("AdminDashboard (vNEW.11): Fetching 'materials' tab data.");
          // This path aligns with where AdminDashboard writes and where Quizzes/Materials reads
          const materialsColRef = collection(db, `artifacts/${appId}/public/data/materials`);
          const unsubscribeMaterials = onSnapshot(materialsColRef, (snapshot) => {
            const fetchedMaterials = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setMaterials(fetchedMaterials);
            setLoadingData(false);
          }, (error) => {
            console.error("AdminDashboard (vNEW.11): Error fetching materials:", error);
            setErrorMessage("Failed to load materials. Check console for rules or network issues.");
            setLoadingData(false);
          });
          unsubscribeFunctions.push(unsubscribeMaterials);
        }

      } catch (error) {
        console.error("AdminDashboard (vNEW.11): Error during data fetching and subscription setup (catch block):", error);
        setErrorMessage("Failed to load data. Please check console for details.");
        setLoadingData(false);
      }
    };

    fetchData();

    return () => {
      console.log("AdminDashboard (vNEW.11): Cleaning up Firestore listeners.");
      unsubscribeFunctions.forEach(unsub => unsub());
    };
  }, [db, currentUser, loadingAuth, isAdmin, appId, activeTab, navigate]);


  const handleAddQuiz = () => {
    // Initialize with a blank question
    setQuizForm({ id: null, title: '', subjectType: 'core', subjectName: '', duration: 300, questions: [{ questionText: '', options: ['', '', '', ''], correctAnswerIndex: 0 }] });
    setIsQuizModal(true);
  };

  const handleEditQuiz = (quiz) => {
    console.log("AdminDashboard: handleEditQuiz called with quiz:", quiz);
    console.log("AdminDashboard: Quiz ID passed to handleEditQuiz:", quiz.id);

    if (!quiz.id) {
      setErrorMessage("Cannot edit: Quiz ID is missing or invalid. Please check the console for more details.");
      console.error("AdminDashboard: Attempted to edit a quiz with a null/undefined ID.", quiz);
      return;
    }

    // Ensure questions array and its properties are properly initialized if missing
    const sanitizedQuiz = {
      ...quiz,
      questions: quiz.questions && quiz.questions.length > 0
        ? quiz.questions.map(q => ({
            questionText: q.questionText || '',
            options: Array.isArray(q.options) && q.options.length === 4 ? q.options : ['', '', '', ''],
            correctAnswerIndex: typeof q.correctAnswerIndex === 'number' ? q.correctAnswerIndex : 0
          }))
        : [{ questionText: '', options: ['', '', '', ''], correctAnswerIndex: 0 }],
      duration: quiz.duration || 300 // Ensure duration is set
    };
    setQuizForm(sanitizedQuiz);
    console.log("AdminDashboard: QuizForm after sanitization in handleEditQuiz:", sanitizedQuiz);
    setIsQuizModal(true);
  };

  const handleAddQuestion = () => {
    setQuizForm(prev => ({
      ...prev,
      questions: [...prev.questions, { questionText: '', options: ['', '', '', ''], correctAnswerIndex: 0 }]
    }));
  };

  const handleRemoveQuestion = (indexToRemove) => {
    setQuizForm(prev => ({
      ...prev,
      questions: prev.questions.filter((_, index) => index !== indexToRemove)
    }));
  };

  const handleQuestionChange = (index, field, value) => {
    setQuizForm(prev => {
      const newQuestions = [...prev.questions];
      if (field === 'options') {
        // value for options field will be an array, specifically targeting an option index
        const [optionIndex, optionValue] = value;
        newQuestions[index].options[optionIndex] = optionValue;
      } else {
        newQuestions[index][field] = value;
      }
      return { ...prev, questions: newQuestions };
    });
  };

  // New function for handling bulk import
  const handleBulkImport = () => {
    setBulkImportText('');
    setIsBulkImportModalOpen(true);
  };

  const parseBulkQuestions = () => {
    setErrorMessage(''); // Clear errors for new parse attempt
    const rawText = bulkImportText.trim();
    if (!rawText) {
      setErrorMessage("No text provided for bulk import.");
      return;
    }

    const questionBlocks = rawText.split(/\n\s*\n/).filter(block => block.trim() !== ''); // Split by two or more newlines
    const parsedQuestions = [];

    for (const block of questionBlocks) {
      const lines = block.split('\n').map(line => line.trim()).filter(line => line !== '');

      if (lines.length < 2) { // At least question text and one option
        setErrorMessage("Each question block must have at least a question text and one option. Check formatting.");
        return;
      }

      const questionText = lines[0];
      const options = lines.slice(1);
      let correctAnswerIndex = -1;
      const cleanOptions = [];

      for (let i = 0; i < options.length; i++) {
        const option = options[i];
        if (option.endsWith('*')) {
          correctAnswerIndex = i;
          cleanOptions.push(option.slice(0, -1).trim()); // Remove asterisk
        } else {
          cleanOptions.push(option);
        }
      }

      if (correctAnswerIndex === -1) {
        setErrorMessage(`Question "${questionText}" is missing a correct answer (marked with '*').`);
        return;
      }
      if (cleanOptions.length < 4) { // Assuming minimum of 4 options
        setErrorMessage(`Question "${questionText}" must have at least 4 options.`);
        return;
      }
      if (cleanOptions.length > 4) { // Assuming maximum of 4 options
        setErrorMessage(`Question "${questionText}" has more than 4 options. Please adjust to 4 options.`);
        return;
      }


      parsedQuestions.push({
        questionText: questionText,
        options: cleanOptions,
        correctAnswerIndex: correctAnswerIndex,
      });
    }

    if (parsedQuestions.length > 0) {
      setQuizForm(prev => ({
        ...prev,
        questions: [...prev.questions, ...parsedQuestions] // Append imported questions
      }));
      setIsBulkImportModalOpen(false); // Close modal on successful import
      setBulkImportText(''); // Clear textarea
      setSuccessMessage(`Successfully imported ${parsedQuestions.length} questions.`);
    } else {
      setErrorMessage("No valid questions were parsed from the input. Please check the format.");
    }
  };


  const handleSaveQuiz = async (e) => {
    e.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');
    
    // Add debug log to confirm function call
    console.log("AdminDashboard: handleSaveQuiz called.");
    console.log("AdminDashboard: Quiz form data BEFORE save attempt:", quizForm); // More prominent log

    if (!db) {
      console.error("AdminDashboard: Firestore DB is not initialized for saving quiz.");
      setErrorMessage("Firestore is not ready. Please try again.");
      return;
    }

    try {
      if (!quizForm.title || !quizForm.subjectName || !quizForm.subjectType) {
        setErrorMessage("Quiz title, subject type, and subject name are required.");
        console.warn("AdminDashboard: Required quiz fields are missing.");
        return;
      }
      if (quizForm.subjectType === 'elective' && !allElectiveSubjects.includes(quizForm.subjectName)) {
        setErrorMessage("Invalid elective subject name.");
        console.warn("AdminDashboard: Invalid elective subject selected.");
        return;
      }
      if (quizForm.subjectType === 'core' && !coreSubjects.includes(quizForm.subjectName)) {
        setErrorMessage("Invalid core subject name.");
        console.warn("AdminDashboard: Invalid core subject selected.");
        return;
      }

      if (quizForm.questions.length === 0) {
        setErrorMessage("At least one question is required for the quiz.");
        return;
      }

      // Validate each question
      for (const q of quizForm.questions) {
        if (!q.questionText.trim()) {
          setErrorMessage("All questions must have text.");
          return;
        }
        if (q.options.some(opt => !opt.trim())) {
          setErrorMessage("All options for each question must be filled.");
          return;
        }
        if (typeof q.correctAnswerIndex !== 'number' || q.correctAnswerIndex < 0 || q.correctAnswerIndex >= q.options.length) {
          setErrorMessage("Each question must have a valid correct answer selected.");
          return;
        }
      }

      const quizzesColRef = collection(db, `artifacts/${appId}/public/data/quizzes`);
      console.log("AdminDashboard: Attempting to save quiz to path:", quizzesColRef.path);
      
      // Prepare quiz data, ensuring correct structure
      const quizDataToSave = {
        title: quizForm.title,
        subjectType: quizForm.subjectType,
        subjectName: quizForm.subjectName,
        duration: quizForm.duration,
        questions: quizForm.questions.map(q => ({
          questionText: q.questionText.trim(),
          options: q.options.map(opt => opt.trim()),
          correctAnswerIndex: q.correctAnswerIndex
        }))
      };

      if (quizForm.id) {
        // Update existing quiz
        const quizDocRef = doc(quizzesColRef, quizForm.id); // This line is crucial for updates
        console.log("AdminDashboard: Updating existing quiz. Document reference path:", quizDocRef.path);
        await setDoc(quizDocRef, quizDataToSave, { merge: true });
        setSuccessMessage("Quiz updated successfully!");
        console.log("AdminDashboard: Quiz updated successfully with ID:", quizForm.id);
      } else {
        // Add new quiz
        const newQuizData = { ...quizDataToSave, createdAt: new Date().toISOString() };
        const docRef = await addDoc(quizzesColRef, newQuizData); // This adds a new document
        setSuccessMessage("Quiz added successfully!");
        console.log("AdminDashboard: New quiz added successfully with ID:", docRef.id);
      }
      setIsQuizModal(false);
    } catch (error) {
      console.error("AdminDashboard: Error saving quiz:", error);
      // More specific error messages for Firestore errors
      if (error.code === 'permission-denied') {
        setErrorMessage("Permission denied: You do not have the necessary rights to add/update quizzes. Ensure your account is an admin and Firebase Security Rules allow this operation.");
      } else if (error.code === 'unavailable') {
        setErrorMessage("Service unavailable: Could not connect to Firestore. Check your internet connection.");
      } else {
        setErrorMessage(`Failed to save quiz: ${error.message}. Check console for details.`);
      }
    }
  };

  const handleDeleteQuiz = async (quizId) => {
    console.log("AdminDashboard: handleDeleteQuiz called with quizId:", quizId); // Log the ID being deleted
    if (window.confirm("Are you sure you want to delete this quiz?")) {
      setErrorMessage('');
      setSuccessMessage('');
      
      if (!quizId) {
        setErrorMessage("Cannot delete: Quiz ID is missing or invalid. Please check the console for more details.");
        console.error("AdminDashboard: Attempted to delete a quiz with a null/undefined ID.");
        return;
      }
      if (!db) {
        console.error("AdminDashboard: Firestore DB is not initialized for deleting quiz.");
        setErrorMessage("Firestore is not ready. Please try again.");
        return;
      }
      try {
        const quizDocRef = doc(db, `artifacts/${appId}/public/data/quizzes`, quizId);
        console.log("AdminDashboard: Deleting quiz at document reference path:", quizDocRef.path);
        await deleteDoc(quizDocRef);
        setSuccessMessage("Quiz deleted successfully!");
        console.log("AdminDashboard: Quiz deleted successfully with ID:", quizId);
      } catch (error) {
        console.error("AdminDashboard: Error deleting quiz:", error);
        if (error.code === 'permission-denied') {
          setErrorMessage("Permission denied: You do not have the necessary rights to delete quizzes. Ensure your account is an admin and Firebase Security Rules allow this operation.");
        } else {
          setErrorMessage(`Failed to delete quiz: ${error.message}. Check console for details.`);
        }
      }
    }
  };

  const handleAddMaterial = () => {
    setMaterialForm({ id: null, title: '', type: '', url: '', subjectType: 'core', subjectName: '' });
    setIsMaterialModalOpen(true);
  };

  const handleEditMaterial = (material) => {
    setMaterialForm(material);
    setIsMaterialModalOpen(true);
  };

  const handleSaveMaterial = async (e) => {
    e.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');

    // Add debug log to confirm function call
    console.log("AdminDashboard: handleSaveMaterial called.");
    console.log("AdminDashboard: Material form data:", materialForm);

    if (!db) {
      console.error("AdminDashboard: Firestore DB is not initialized for saving material.");
      setErrorMessage("Firestore is not ready. Please try again.");
      return;
    }

    try {
      if (!materialForm.title || !materialForm.type || !materialForm.url || !materialForm.subjectName || !materialForm.subjectType) {
        setErrorMessage("All material fields (Title, Type, URL, Subject Type, Subject Name) are required.");
        console.warn("AdminDashboard: Required material fields are missing.");
        return;
      }
      if (materialForm.subjectType === 'elective' && !allElectiveSubjects.includes(materialForm.subjectName)) {
        setErrorMessage("Invalid elective subject name.");
        console.warn("AdminDashboard: Invalid elective subject selected.");
        return;
      }
      if (materialForm.subjectType === 'core' && !coreSubjects.includes(materialForm.subjectName)) {
        setErrorMessage("Invalid core subject name.");
        console.warn("AdminDashboard: Invalid core subject selected.");
        return;
      }

      const materialsColRef = collection(db, `artifacts/${appId}/public/data/materials`);
      console.log("AdminDashboard: Attempting to save material to path:", materialsColRef.path);

      if (materialForm.id) {
        // Update existing material
        const materialDocRef = doc(materialsColRef, materialForm.id);
        await setDoc(materialDocRef, materialForm, { merge: true });
        setSuccessMessage("Material updated successfully!");
        console.log("AdminDashboard: Material updated successfully with ID:", materialForm.id);
      } else {
        // Add new material
        const newMaterialData = { ...materialForm, createdAt: new Date().toISOString() };
        const docRef = await addDoc(materialsColRef, newMaterialData);
        setSuccessMessage("Material added successfully!");
        console.log("AdminDashboard: New material added successfully with ID:", docRef.id);
      }
      setIsMaterialModalOpen(false);
    } catch (error) {
      console.error("AdminDashboard: Error saving material:", error);
      // More specific error messages for Firestore errors
      if (error.code === 'permission-denied') {
        setErrorMessage("Permission denied: You do not have the necessary rights to add/update materials. Ensure your account is an admin and Firebase Security Rules allow this operation.");
      } else if (error.code === 'unavailable') {
        setErrorMessage("Service unavailable: Could not connect to Firestore. Check your internet connection.");
      } else {
        setErrorMessage(`Failed to save material: ${error.message}. Check console for details.`);
      }
    }
  };

  const handleDeleteMaterial = async (materialId) => {
    if (window.confirm("Are you sure you want to delete this material?")) {
      setErrorMessage('');
      setSuccessMessage('');
      console.log("AdminDashboard: Attempting to delete material with ID:", materialId);
      if (!db) {
        console.error("AdminDashboard: Firestore DB is not initialized for deleting material.");
        setErrorMessage("Firestore is not ready. Please try again.");
        return;
      }
      try {
        await deleteDoc(doc(db, `artifacts/${appId}/public/data/materials`, materialId));
        setSuccessMessage("Material deleted successfully!");
        console.log("AdminDashboard: Material deleted successfully with ID:", materialId);
      } catch (error) {
        console.error("AdminDashboard: Error deleting material:", error);
        if (error.code === 'permission-denied') {
          setErrorMessage("Permission denied: You do not have the necessary rights to delete materials. Ensure your account is an admin and Firebase Security Rules allow this operation.");
        } else {
          setErrorMessage(`Failed to delete material: ${error.message}. Check console for details.`);
        }
      }
    }
  };

  const handleToggleAdminStatus = async (userUid, currentIsAdmin) => {
    setErrorMessage('');
    setSuccessMessage('');
    if (userUid === currentUser.uid) {
      setErrorMessage("You cannot change your own admin status.");
      return;
    }
    if (window.confirm(`Are you sure you want to ${currentIsAdmin ? 'demote' : 'promote'} this user?`)) {
        try {
            const userRoleRef = doc(db, `artifacts/${appId}/public/data/userRoles`, userUid);
            const batch = writeBatch(db);
            batch.set(userRoleRef, { isAdmin: !currentIsAdmin }, { merge: true });
            await batch.commit();
            setSuccessMessage(`User ${currentIsAdmin ? 'demoted from' : 'promoted to'} admin successfully!`);
        } catch (error) {
            console.error("Error toggling admin status:", error);
            setErrorMessage("Failed to update user's admin status.");
        }
    }
  };


  if (loadingAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="text-xl font-semibold text-gray-700">Loading Admin Dashboard (Authenticating)...</div>
      </div>
    );
  }

  if (!isAdmin) {
    console.log("AdminDashboard (vNEW.11): isAdmin is false. Redirecting to dashboard.");
    navigate('dashboard'); 
    return null;
  }

  if (loadingData) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="text-xl font-semibold text-gray-700">Loading Admin Dashboard (Fetching Data)...</div>
      </div>
    );
  }


  return (
    <div className="flex flex-col md:flex-row min-h-screen bg-gray-100 font-sans">
      {/* Admin Sidebar */}
      <div className="bg-gradient-to-br from-red-700 to-red-900 text-white w-full md:w-64 p-6 flex flex-col rounded-tr-xl md:rounded-bl-xl shadow-lg">
        <div className="flex items-center mb-8">
          <svg className="w-8 h-8 mr-3 text-red-200" fill="currentColor" viewBox="0 0 20 20">
            <path d="M10 2a8 8 0 100 16 8 8 0 000-16zM9 13V7l5 3-5 3z"></path>
          </svg>
          <h1 className="text-2xl font-bold">Admin Panel</h1>
        </div>
        <nav className="flex-grow">
          <ul className="space-y-4">
            <li>
              <button onClick={() => setActiveTab('users')} className={`flex items-center p-2 rounded-lg w-full text-left transition duration-200 ${activeTab === 'users' ? 'bg-red-600 text-white' : 'text-red-200 hover:text-white'}`}>
                <svg className="w-5 h-5 mr-3" fill="currentColor" viewBox="0 0 20 20"><path d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z"></path></svg>
                Manage Users
              </button>
            </li>
            <li>
              <button onClick={() => setActiveTab('quizzes')} className={`flex items-center p-2 rounded-lg w-full text-left transition duration-200 ${activeTab === 'quizzes' ? 'bg-red-600 text-white' : 'text-red-200 hover:text-white'}`}>
                <svg className="w-5 h-5 mr-3" fill="currentColor" viewBox="0 0 20 20"><path d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 018.618 5.04A12.007 12.007 0 0012 15a12.007 12.007 0 00-8.618-7.016A11.955 11.955 0 0112 2.944c-.682 0-1.39.043-2.049.122a11.986 11.986 0 00-7.394 6.786L.2 11.363a12.001 12.001 0 0011.8 8.637 12.001 12.001 0 0011.8-8.637l-1.407-1.173a12.007 12.007 0 00-8.618-7.016z"></path></svg>
                Manage Quizzes
              </button>
            </li>
            <li>
              <button onClick={() => setActiveTab('materials')} className={`flex items-center p-2 rounded-lg w-full text-left transition duration-200 ${activeTab === 'materials' ? 'bg-red-600 text-white' : 'text-red-200 hover:text-white'}`}>
                <svg className="w-5 h-5 mr-3" fill="currentColor" viewBox="0 0 20 20"><path d="M9 17.293V14.707a1 1 0 011.707-.707l4-4a1 1 0 011.414 0l2 2a1 1 0 010 1.414l-2 2a1 1 0 01-1.414 0L10.707 15.293A1 1 0 0110 16.293V17a1 1 0 001 1h2a1 1 0 001-1v-2.586l1.293 1.293a1 1 0 001.414-1.414L15.414 13l2-2a1 1 0 000-1.414L15.414 9l-2-2a1 1 0 00-1.414 0L10.707 9.586A1 1 0 0110 10.586V7a1 1 0 00-1-1H7a1 1 0 00-1 1v3.586l-2-2a1 1 0 00-1.414 0L.293 10.707a1 1 0 000 1.414L2.586 14 1 15.414a1 1 0 001.414 1.414l2-2L6 16.414a1 1 0 001 1H9z"></path></svg>
                Manage Materials
              </button>
            </li>
          </ul>
        </nav>
        <div className="mt-8">
          <p className="text-sm text-red-200">Admin User:</p>
          <p className="font-semibold text-lg">{currentUser?.email}</p>
          <button
            onClick={logout}
            className="mt-4 w-full py-2 px-4 rounded-md bg-red-500 hover:bg-red-600 text-white font-semibold transition duration-200"
          >
            Logout
          </button>
        </div>
        <p className="mt-4 text-center text-red-300 text-xs">
            Admin User ID: {userId}
        </p>
      </div>

      {/* Main Content Area */}
      <div className="flex-grow p-6 md:p-8 bg-gray-100 rounded-xl shadow-xl ml-4 mr-4 mt-4 mb-4">
        <h2 className="text-3xl font-bold text-gray-800 mb-8">
          {activeTab === 'users' && 'User Management'}
          {activeTab === 'quizzes' && 'Quiz Management'}
          {activeTab === 'materials' && 'Material Management'}
        </h2>

        {/* Success and Error Messages */}
        {successMessage && (
          <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded-md relative mb-4">
            <strong className="font-bold">Success!</strong>
            <span className="block sm:inline ml-2">{successMessage}</span>
          </div>
        )}
        {errorMessage && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-md relative mb-4">
            <strong className="font-bold">Error!</strong>
            <span className="block sm:inline ml-2">{errorMessage}</span>
          </div>
        )}

        {/* User Management Tab Content */}
        {activeTab === 'users' && (
          <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-200">
            <h3 className="text-xl font-semibold text-gray-800 mb-4">All Registered Users</h3>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Email</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Year/Program</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Electives</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Admin?</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {users.length > 0 ? (
                    users.map((user) => (
                      <tr key={user.id}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{user.name || 'N/A'}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">{user.email || 'N/A'}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">{user.yearGroup || 'N/A'} / {user.shsProgram || 'N/A'}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">{user.electiveSubjects?.join(', ') || 'N/A'}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${user.isAdmin ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                            {user.isAdmin ? 'Yes' : 'No'}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-left text-sm font-medium">
                          <button
                            onClick={() => handleToggleAdminStatus(user.id, user.isAdmin)}
                            className={`px-3 py-1 rounded-md text-white transition duration-200 ${user.isAdmin ? 'bg-yellow-500 hover:bg-yellow-600' : 'bg-blue-500 hover:bg-blue-600'}`}
                            disabled={user.id === currentUser.uid} // Prevent changing own status
                          >
                            {user.isAdmin ? 'Demote' : 'Promote'}
                          </button>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="6" className="px-6 py-4 text-center text-gray-500">No users found.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Quiz Management Tab Content */}
        {activeTab === 'quizzes' && (
          <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-200">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-semibold text-gray-800">Manage Quizzes</h3>
              <button
                onClick={handleAddQuiz}
                className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-md shadow-md transition duration-200"
              >
                Add New Quiz
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Title</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Subject Type</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Subject Name</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Questions</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Duration (s)</th> {/* Added Duration column */}
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {quizzes.length > 0 ? (
                    quizzes.map((quiz) => {
                      // This log helps confirm that the quiz objects received from Firestore
                      // and passed into the state *do* have a valid ID.
                      // If this still logs an empty/null ID, the issue is with the Firestore data itself or the SDK.
                      if (!quiz.id) {
                          console.error("AdminDashboard: Rendering a quiz with a null/undefined ID despite data filtering. Check Firestore data directly:", quiz);
                      }
                      return (
                        // Use quiz.id directly as the key. The filter above ensures it's valid.
                        // Fallback key is removed as it can mask real ID issues for React.
                        <tr key={quiz.id}> 
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{quiz.title}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">{quiz.subjectType}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">{quiz.subjectName}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">{quiz.questions?.length || 0}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">{quiz.duration || 'N/A'}</td> {/* Display duration */}
                          <td className="px-6 py-4 whitespace-nowrap text-left text-sm font-medium">
                            <button onClick={() => handleEditQuiz(quiz)} className="text-indigo-600 hover:text-indigo-900 mr-4">Edit</button>
                            <button onClick={() => handleDeleteQuiz(quiz.id)} className="text-red-600 hover:text-red-900">Delete</button>
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan="6" className="px-6 py-4 text-center text-gray-500">No quizzes available.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            {/* Quiz Modal */}
            {isQuizModalOpen && (
              <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50 p-4">
                <div className="bg-white p-8 rounded-lg shadow-xl w-full max-w-lg relative max-h-[90vh] overflow-y-auto"> {/* Added max-h and overflow-y */}
                  <h3 className="text-2xl font-bold mb-6 text-gray-800">{quizForm.id ? 'Edit Quiz' : 'Add New Quiz'}</h3>
                  <form onSubmit={handleSaveQuiz} className="space-y-4">
                    <div>
                      <label htmlFor="quizTitle" className="block text-sm font-medium text-gray-700">Quiz Title</label>
                      <input
                        type="text"
                        id="quizTitle"
                        value={quizForm.title}
                        onChange={(e) => setQuizForm({ ...quizForm, title: e.target.value })}
                        className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                        required
                      />
                    </div>
                    <div>
                      <label htmlFor="subjectType" className="block text-sm font-medium text-gray-700">Subject Type</label>
                      <select
                        id="subjectType"
                        value={quizForm.subjectType}
                        onChange={(e) => setQuizForm({ ...quizForm, subjectType: e.target.value, subjectName: '' })} // Reset subjectName on type change
                        className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                        required
                      >
                        <option value="core">Core</option>
                        <option value="elective">Elective</option>
                      </select>
                    </div>
                    <div>
                      <label htmlFor="subjectName" className="block text-sm font-medium text-gray-700">Subject Name</label>
                      <select
                        id="subjectName"
                        value={quizForm.subjectName}
                        onChange={(e) => setQuizForm({ ...quizForm, subjectName: e.target.value })}
                        className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                        required
                      >
                        <option value="">Select Subject</option>
                        {quizForm.subjectType === 'core' && coreSubjects.map(sub => (
                          <option key={sub} value={sub}>{sub}</option>
                        ))}
                        {quizForm.subjectType === 'elective' && allElectiveSubjects.map(sub => (
                          <option key={sub} value={sub}>{sub}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                        <label htmlFor="duration" className="block text-sm font-medium text-gray-700">Duration (seconds)</label>
                        <input
                            type="number"
                            id="duration"
                            value={quizForm.duration}
                            onChange={(e) => setQuizForm({ ...quizForm, duration: parseInt(e.target.value) || 0 })}
                            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                            min="1"
                            required
                        />
                    </div>

                    {/* Questions Management Section */}
                    <div className="space-y-6 mt-6 p-4 border border-gray-200 rounded-md bg-gray-50">
                      <h4 className="text-lg font-semibold text-gray-800">Questions</h4>
                      {/* New Bulk Import Button */}
                      <button
                        type="button"
                        onClick={handleBulkImport}
                        className="w-full py-2 px-4 border border-purple-300 rounded-md shadow-sm text-sm font-medium text-purple-700 bg-purple-100 hover:bg-purple-200 transition duration-200 mb-4"
                      >
                        Bulk Import Questions
                      </button>

                      {quizForm.questions.map((q, qIndex) => (
                        <div key={qIndex} className="p-4 border border-gray-200 rounded-md bg-white shadow-sm relative">
                          <h5 className="text-md font-medium text-gray-700 mb-3">Question {qIndex + 1}</h5>
                          {quizForm.questions.length > 1 && (
                            <button
                              type="button"
                              onClick={() => handleRemoveQuestion(qIndex)}
                              className="absolute top-2 right-2 text-red-500 hover:text-red-700"
                              title="Remove Question"
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                              </svg>
                            </button>
                          )}
                          <div>
                            <label htmlFor={`questionText-${qIndex}`} className="block text-sm font-medium text-gray-700">Question Text</label>
                            <textarea
                              id={`questionText-${qIndex}`}
                              value={q.questionText}
                              onChange={(e) => handleQuestionChange(qIndex, 'questionText', e.target.value)}
                              rows="2"
                              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                              required
                            ></textarea>
                          </div>
                          <div className="mt-4">
                            <label className="block text-sm font-medium text-gray-700 mb-2">Options</label>
                            {q.options.map((option, optIndex) => (
                              <div key={optIndex} className="flex items-center space-x-2 mb-2">
                                <input
                                  type="radio"
                                  name={`correctAnswer-${qIndex}`}
                                  checked={q.correctAnswerIndex === optIndex}
                                  onChange={() => handleQuestionChange(qIndex, 'correctAnswerIndex', optIndex)}
                                  className="text-blue-600 focus:ring-blue-500"
                                />
                                <input
                                  type="text"
                                  value={option}
                                  onChange={(e) => handleQuestionChange(qIndex, 'options', [optIndex, e.target.value])}
                                  className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm text-sm focus:ring-blue-500 focus:border-blue-500"
                                  placeholder={`Option ${optIndex + 1}`}
                                  required
                                />
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                      <button
                        type="button"
                        onClick={handleAddQuestion}
                        className="w-full py-2 px-4 border border-blue-300 rounded-md shadow-sm text-sm font-medium text-blue-700 bg-blue-100 hover:bg-blue-200 transition duration-200"
                      >
                        Add Another Question
                      </button>
                    </div>

                    <div className="flex justify-end space-x-4 mt-6">
                      <button
                        type="button"
                        onClick={() => setIsQuizModal(false)}
                        className="bg-gray-300 hover:bg-gray-400 text-gray-800 font-bold py-2 px-4 rounded-md transition duration-200"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-md shadow-md transition duration-200"
                      >
                        Save Quiz
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}

            {/* Bulk Import Questions Modal */}
            {isBulkImportModalOpen && (
              <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50 p-4">
                <div className="bg-white p-8 rounded-lg shadow-xl w-full max-w-md relative">
                  <h3 className="text-2xl font-bold mb-6 text-gray-800">Bulk Import Questions</h3>
                  <div className="mb-4">
                    <p className="text-sm text-gray-700 mb-2">Paste your questions below, following this format:</p>
                    <pre className="bg-gray-100 p-3 rounded-md text-xs border border-gray-200 overflow-x-auto">
                      {`Question Text 1?
Option A
Option B*
Option C
Option D

Question Text 2?
Option A*
Option B
Option C
Option D`}
                    </pre>
                    <p className="text-xs text-gray-600 mt-2">
                      * Separate each question block by **two blank lines**.
                      * Mark the **correct option** with an asterisk `*` at the end.
                      * Each question must have exactly **4 options**.
                    </p>
                  </div>
                  <div>
                    <label htmlFor="bulkImportTextArea" className="block text-sm font-medium text-gray-700">Questions Text</label>
                    <textarea
                      id="bulkImportTextArea"
                      value={bulkImportText}
                      onChange={(e) => setBulkImportText(e.target.value)}
                      rows="10"
                      className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-purple-500 focus:border-purple-500"
                      placeholder="Paste your questions here..."
                    ></textarea>
                  </div>

                  {errorMessage && (
                    <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-md relative mt-4">
                      <strong className="font-bold">Error!</strong>
                      <span className="block sm:inline ml-2">{errorMessage}</span>
                    </div>
                  )}

                  <div className="flex justify-end space-x-4 mt-6">
                    <button
                      type="button"
                      onClick={() => setIsBulkImportModalOpen(false)}
                      className="bg-gray-300 hover:bg-gray-400 text-gray-800 font-bold py-2 px-4 rounded-md transition duration-200"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={parseBulkQuestions}
                      className="bg-purple-600 hover:bg-purple-700 text-white font-bold py-2 px-4 rounded-md shadow-md transition duration-200"
                    >
                      Import Questions
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Material Management Tab Content */}
        {activeTab === 'materials' && (
          <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-200">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-semibold text-gray-800">Manage Materials</h3>
              <button
                onClick={handleAddMaterial}
                className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-md shadow-md transition duration-200"
              >
                Add New Material
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Title</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Subject Type</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Subject Name</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">URL</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {materials.length > 0 ? (
                    materials.map((material) => (
                      <tr key={material.id}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{material.title}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">{material.type}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">{material.subjectType}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">{material.subjectName}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-blue-600 hover:underline">
                          <a href={material.url} target="_blank" rel="noopener noreferrer" className="truncate block max-w-xs">{material.url}</a>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-left text-sm font-medium">
                          <button onClick={() => handleEditMaterial(material)} className="text-indigo-600 hover:text-indigo-900 mr-4">Edit</button>
                          <button onClick={() => handleDeleteMaterial(material.id)} className="text-red-600 hover:text-red-900">Delete</button>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="6" className="px-6 py-4 text-center text-gray-500">No materials available.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            {/* Material Modal */}
            {isMaterialModalOpen && (
              <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50 p-4">
                <div className="bg-white p-8 rounded-lg shadow-xl w-full max-w-lg relative">
                  <h3 className="text-2xl font-bold mb-6 text-gray-800">{materialForm.id ? 'Edit Material' : 'Add New Material'}</h3>
                  <form onSubmit={handleSaveMaterial} className="space-y-4">
                    <div>
                      <label htmlFor="materialTitle" className="block text-sm font-medium text-gray-700">Material Title</label>
                      <input
                        type="text"
                        id="materialTitle"
                        value={materialForm.title}
                        onChange={(e) => setMaterialForm({ ...materialForm, title: e.target.value })}
                        className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                        required
                      />
                    </div>
                    <div>
                      <label htmlFor="materialType" className="block text-sm font-medium text-gray-700">Material Type</label>
                      <input
                        type="text"
                        id="materialType"
                        value={materialForm.type}
                        onChange={(e) => setMaterialForm({ ...materialForm, type: e.target.value })}
                        className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                        required
                      />
                    </div>
                    <div>
                      <label htmlFor="materialUrl" className="block text-sm font-medium text-gray-700">URL</label>
                      <input
                        type="url"
                        id="materialUrl"
                        value={materialForm.url}
                        onChange={(e) => setMaterialForm({ ...materialForm, url: e.target.value })}
                        className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                        required
                      />
                    </div>
                    <div>
                      <label htmlFor="materialSubjectType" className="block text-sm font-medium text-gray-700">Subject Type</label>
                      <select
                        id="materialSubjectType"
                        value={materialForm.subjectType}
                        onChange={(e) => setMaterialForm({ ...materialForm, subjectType: e.target.value, subjectName: '' })} // Reset subjectName on type change
                        className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                        required
                      >
                        <option value="core">Core</option>
                        <option value="elective">Elective</option>
                      </select>
                    </div>
                    <div>
                      <label htmlFor="materialSubjectName" className="block text-sm font-medium text-gray-700">Subject Name</label>
                      <select
                        id="materialSubjectName"
                        value={materialForm.subjectName}
                        onChange={(e) => setMaterialForm({ ...materialForm, subjectName: e.target.value })}
                        className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                        required
                      >
                        <option value="">Select Subject</option>
                        {materialForm.subjectType === 'core' && coreSubjects.map(sub => (
                          <option key={sub} value={sub}>{sub}</option>
                        ))}
                        {materialForm.subjectType === 'elective' && allElectiveSubjects.map(sub => (
                          <option key={sub} value={sub}>{sub}</option>
                        ))}
                      </select>
                    </div>
                    <div className="flex justify-end space-x-4 mt-6">
                      <button
                        type="button"
                        onClick={() => setIsMaterialModalOpen(false)}
                        className="bg-gray-300 hover:bg-gray-400 text-gray-800 font-bold py-2 px-4 rounded-md transition duration-200"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-md shadow-md transition duration-200"
                      >
                        Save Material
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminDashboard;
