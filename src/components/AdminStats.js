import React, { useState, useEffect } from 'react';
import { collection, query, onSnapshot, collectionGroup, getDocs, doc, getDoc } from 'firebase/firestore';
import { useAuth } from '../context/AuthContext';

const AdminStats = ({ db, appId, coreSubjects, allElectiveSubjects }) => {
  const { currentUser, loadingAuth, isAdmin } = useAuth(); // Destructure isAdmin from useAuth
  const [loadingStats, setLoadingStats] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');

  const [studentProfiles, setStudentProfiles] = useState([]);
  const [quizDefinitions, setQuizDefinitions] = useState([]);
  const [quizResults, setQuizResults] = useState([]); 
  const [attemptsByQuiz, setAttemptsByQuiz] = useState({});
  const [studentsWhoAttemptedQuiz, setStudentsWhoAttemptedQuiz] = useState({});

  // Filter states for the main dashboard statistics
  const [filterSubjectType, setFilterSubjectType] = useState('all'); // 'all', 'core', 'elective'
  const [filterSubjectName, setFilterSubjectName] = useState('all'); // specific subject name
  const [filterYearGroup, setFilterYearGroup] = useState('all'); // 'SHS1', 'SHS2', 'SHS3'
  const [filterQuizId, setFilterQuizId] = useState('all'); // specific quiz ID

  // States for Student Report Modal
  const [showStudentReportModal, setShowStudentReportModal] = useState(false);
  const [selectedStudentForReport, setSelectedStudentForReport] = useState(null);
  // NEW: Filter state specifically for the student report modal
  const [reportTimeframeFilter, setReportTimeframeFilter] = useState('all'); // 'all', 'last7Days', 'last30Days', 'thisMonth', 'thisYear'


  // Derived data for display (these now reflect the main dashboard filters)
  const [totalStudents, setTotalStudents] = useState(0);
  const [totalQuizzes, setTotalQuizzes] = useState(0);
  const [totalQuizAttempts, setTotalQuizAttempts] = useState(0); // This reflects main dashboard filters now
  const [averageQuizScore, setAverageQuizScore] = useState(0); // This reflects main dashboard filters now
  // Removed studentsByYearGroup, attemptsByQuiz, studentsWhoAttemptedQuiz as they can be derived directly from filteredQuizResults

  // List of year groups (assuming SHS1, SHS2, SHS3)
  const yearGroupOptions = ['SHS1', 'SHS2', 'SHS3'];
  const shsProgramOptions = [
    'General Arts', 'Business', 'Science', 'Visual Arts',
    'Home Economics', 'Agricultural Science', 'Technical'
  ];

  // Hardcoded date for 'Today Onwards' filter (June 27, 2025, 00:00:00 GMT)
  // This will be used only for the 'Today Onwards' option if explicitly selected in the report.
  const fixedStartDateForFiltering = new Date('2025-06-27T00:00:00Z').getTime();

  useEffect(() => {
    console.log("AdminStats useEffect: Starting. isAdmin:", isAdmin, "currentUser:", currentUser?.uid, "loadingAuth:", loadingAuth);
    if (!db || !currentUser || loadingAuth || !isAdmin) {
      if (!loadingAuth && !isAdmin && currentUser) {
        setErrorMessage("You do not have administrative privileges to view statistics.");
        console.warn("AdminStats: User is not admin or auth not ready.");
      } else if (!currentUser) {
        setErrorMessage("Please log in to view statistics.");
        console.warn("AdminStats: No current user.");
      } else {
        if (!loadingAuth && !db) {
            setErrorMessage("Firestore database is not initialized. Please refresh.");
            console.error("AdminStats: Firestore DB is null despite auth not loading.");
        }
      }
      setLoadingStats(false);
      return;
    }

    setLoadingStats(true);
    setErrorMessage('');

    let unsubscribes = [];

    const fetchData = async () => {
      try {
        // 1. Fetch Student Profiles (NO DATE FILTER HERE - always fetch all profiles)
        const studentProfilesQuery = query(collectionGroup(db, 'studentProfiles'));
        const unsubscribeProfiles = onSnapshot(studentProfilesQuery, (snapshot) => {
          const fetchedProfiles = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
          setStudentProfiles(fetchedProfiles);
          setTotalStudents(fetchedProfiles.length); // Total students reflect all students
          console.log("AdminStats: Fetched ALL student profiles (count:", fetchedProfiles.length, "):", fetchedProfiles);
        }, (error) => {
          console.error("Error fetching student profiles (AdminStats):", error);
          setErrorMessage("Failed to load student profiles. Check Firestore rules/indexes for 'studentProfiles' collection group.");
        });
        unsubscribes.push(unsubscribeProfiles);

        // 2. Fetch Quiz Definitions (no date filter needed here as it's quiz metadata)
        const quizzesColRef = collection(db, `artifacts/${appId}/public/data/quizzes`);
        const unsubscribeQuizzes = onSnapshot(quizzesColRef, (snapshot) => {
          const fetchedQuizzes = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
          setQuizDefinitions(fetchedQuizzes);
          setTotalQuizzes(fetchedQuizzes.length);
          console.log("AdminStats: Fetched quiz definitions (count:", fetchedQuizzes.length, "):", fetchedQuizzes);
        }, (error) => {
          console.error("Error fetching quiz definitions (AdminStats):", error);
          setErrorMessage("Failed to load quiz definitions.");
        });
        unsubscribes.push(unsubscribeQuizzes);

        // 3. Fetch ALL Quiz Results (NO DATE FILTER HERE - filtering will happen in derived state or report modal)
        const quizResultsColRef = collection(db, `artifacts/${appId}/public/data/results`);
        const unsubscribeResults = onSnapshot(quizResultsColRef, (snapshot) => {
          const fetchedResults = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
          setQuizResults(fetchedResults);
          // Initial total attempts and average score based on ALL results (before UI filters)
          setTotalQuizAttempts(fetchedResults.length);
          if (fetchedResults.length > 0) {
            const sumScores = fetchedResults.reduce((sum, result) => sum + (result.score || 0), 0);
            setAverageQuizScore((sumScores / fetchedResults.length).toFixed(2));
          } else {
            setAverageQuizScore(0);
          }
          console.log("AdminStats: Fetched ALL quiz results (count:", fetchedResults.length, "):", fetchedResults);
        }, (error) => {
          console.error("Error fetching quiz results (AdminStats):", error);
          setErrorMessage("Failed to load quiz results. Check Firestore rules/indexes for 'results' collection.");
        });
        unsubscribes.push(unsubscribeResults);

      } catch (error) {
        console.error("AdminStats: Error setting up Firestore listeners (main try-catch):", error);
        setErrorMessage(`Failed to load data: ${error.message}`);
      } finally {
        setLoadingStats(false); // Set to false after all initial fetches are attempted
      }
    };

    fetchData();

    return () => {
      console.log("AdminStats useEffect: Cleaning up Firestore listeners.");
      unsubscribes.forEach(unsub => unsub());
    };
  }, [db, appId, currentUser, loadingAuth, isAdmin]); // Removed dataRange and hardcodedFromDateTimestamp from dependencies

  // Derived state to compute main dashboard stats based on filters
  const filteredQuizResultsMainDashboard = quizResults.filter(result => {
    // Quiz ID filter
    if (filterQuizId !== 'all' && result.quizId !== filterQuizId) {
        return false;
    }
    // Subject type filter: Use result.subjectType directly
    if (filterSubjectType !== 'all' && result.subjectType !== filterSubjectType) {
        return false;
    }
    // Subject name filter: Use result.subjectName directly
    if (filterSubjectName !== 'all' && result.subjectName !== filterSubjectName) {
        return false;
    }
    // Year group filter (needs student profile - studentProfiles is NOT date filtered)
    if (filterYearGroup !== 'all') {
      const student = studentProfiles.find(p => p.id === result.studentId);
      if (!student || student.yearGroup !== filterYearGroup) {
        return false;
      }
    }
    return true;
  });

  // Re-calculate main dashboard stats whenever filters or base data changes
  useEffect(() => {
    const totalAttempts = filteredQuizResultsMainDashboard.length;
    const sumScores = filteredQuizResultsMainDashboard.reduce((sum, result) => sum + (result.score || 0), 0);
    const avgScore = totalAttempts > 0 ? (sumScores / totalAttempts).toFixed(2) : 0;
    
    setTotalQuizAttempts(totalAttempts);
    setAverageQuizScore(avgScore);

    // Recalculate attempts by quiz and students who attempted based on filtered results
    const attemptsMap = {};
    const attemptedStudentsMap = {};
    filteredQuizResultsMainDashboard.forEach(result => {
      attemptsMap[result.quizId] = (attemptsMap[result.quizId] || 0) + 1;
      if (!attemptedStudentsMap[result.quizId]) {
        attemptedStudentsMap[result.quizId] = new Set();
      }
      attemptedStudentsMap[result.quizId].add(result.studentId);
    });
    // This is where the error occurred in your environment.
    // The setters are defined at the component's top level, so they should be accessible.
    setAttemptsByQuiz(attemptsMap); 
    setStudentsWhoAttemptedQuiz(attemptedStudentsMap);

    console.log("AdminStats: Main dashboard filters applied. Filtered results count:", filteredQuizResultsMainDashboard.length);
  }, [filterSubjectType, filterSubjectName, filterYearGroup, filterQuizId, filteredQuizResultsMainDashboard.length]);


  // Calculate unique students who attempted filtered quizzes (for main dashboard)
  const uniqueStudentsInFilteredResults = new Set(filteredQuizResultsMainDashboard.map(res => res.studentId)).size;

  // Aggregate results by quiz for Quiz Performance Overview table
  const aggregatedQuizStats = {};
  filteredQuizResultsMainDashboard.forEach(result => {
    if (!aggregatedQuizStats[result.quizId]) {
      aggregatedQuizStats[result.quizId] = {
        title: result.quizTitle || 'Unknown Quiz',
        subjectName: result.subjectName || 'Unknown Subject',
        subjectType: result.subjectType || 'unknown',
        attempts: [],
        uniqueStudents: new Set()
      };
    }
    aggregatedQuizStats[result.quizId].attempts.push(result.score);
    aggregatedQuizStats[result.quizId].uniqueStudents.add(result.studentId);
  });

  // Calculate averages for aggregatedQuizStats
  for (const quizId in aggregatedQuizStats) {
    const stats = aggregatedQuizStats[quizId];
    const sum = stats.attempts.reduce((acc, score) => acc + score, 0);
    stats.averageScore = stats.attempts.length > 0 ? (sum / stats.attempts.length).toFixed(2) : 'N/A';
    stats.totalAttempts = stats.attempts.length;
    stats.uniqueStudentsCount = stats.uniqueStudents.size;
  }

  // Prepare data for Individual Student Performance (studentQuizPerformance)
  // This will include ALL students, but their results will be a subset based on main filters
  const studentQuizPerformance = {};
  studentProfiles.forEach(student => {
    studentQuizPerformance[student.id] = {
      name: student.name || 'N/A',
      email: student.email || 'N/A',
      yearGroup: student.yearGroup || 'N/A',
      shsProgram: student.shsProgram || 'N/A',
      results: [] // Will be populated with filtered results
    };
  });

  filteredQuizResultsMainDashboard.forEach(result => {
    const student = studentProfiles.find(s => s.id === result.studentId);
    if (student) {
      studentQuizPerformance[student.id].results.push({
        quizId: result.quizId,
        quizTitle: result.quizTitle,
        score: result.score,
        timestamp: result.timestamp,
        subjectName: result.subjectName,
        subjectType: result.subjectType,
      });
    }
  });

  // Sort student's individual quiz results by timestamp (most recent first)
  for (const studentId in studentQuizPerformance) {
    studentQuizPerformance[studentId].results.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
  }


  // Helper for unique subjects and programs for filters (from fetched definitions/profiles)
  const uniqueSubjects = [...new Set(quizDefinitions.map(q => q.subjectName))].sort();
  const uniqueYearGroups = [...new Set(studentProfiles.map(s => s.yearGroup).filter(Boolean))].sort();
  const uniquePrograms = [...new Set(studentProfiles.map(s => s.shsProgram).filter(Boolean))].sort();


  // --- Student Report Modal Logic ---

  // Function to filter results for the report based on timeframe
  const filterReportResultsByTimeframe = (results, timeframe) => {
    if (timeframe === 'all') {
      return results;
    }

    const now = Date.now();
    let startDate;

    switch (timeframe) {
      case 'today-onwards': // Use the hardcoded date for this specific option
          startDate = fixedStartDateForFiltering;
          break;
      case 'last7Days':
        startDate = now - (7 * 24 * 60 * 60 * 1000);
        break;
      case 'last30Days':
        startDate = now - (30 * 24 * 60 * 60 * 1000);
        break;
      case 'thisMonth':
        startDate = new Date(new Date().getFullYear(), new Date().getMonth(), 1).getTime();
        break;
      case 'thisYear':
        startDate = new Date(new Date().getFullYear(), 0, 1).getTime();
        break;
      default:
        startDate = 0; // Effectively 'all time' if invalid
    }
    
    return results.filter(result => result.timestamp && result.timestamp >= startDate);
  };

  // Function to calculate grade based on score (copied from Results.js for consistency)
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

  // Function to generate a short remark for a subject grade
  const generateSubjectRemark = (grade) => {
    switch (grade) {
      case 'A1': return 'Excellent!';
      case 'B2': return 'Very good!';
      case 'B3': return 'Good!';
      case 'C4':
      case 'C5':
      case 'C6': return 'Credit pass.';
      case 'D7':
      case 'E8': return 'Pass, with room for improvement.';
      case 'F9': return 'Needs significant attention.';
      default: return '';
    }
  };

  // Function to generate a short overall remark/comment
  const generateOverallRemark = (averageScore) => {
    if (averageScore >= 75) return 'Outstanding overall performance!';
    if (averageScore >= 60) return 'Strong academic progress.';
    if (averageScore >= 50) return 'Solid effort, keep building foundations.';
    if (averageScore >= 40) return 'Satisfactory, focus on key areas.';
    return 'Immediate review of core concepts recommended.';
  };

  // This effect runs when selectedStudentForReport or reportTimeframeFilter changes
  // It calculates the data *for the modal*
  const [reportFilteredResults, setReportFilteredResults] = useState([]);
  const [reportAggregatedSubjectStats, setReportAggregatedSubjectStats] = useState({});
  const [reportOverallStats, setReportOverallStats] = useState({
    totalQuizzesTaken: 0,
    overallAverage: 0,
    overallGrade: 'N/A',
    overallRemark: ''
  });

  useEffect(() => {
    if (selectedStudentForReport) {
      const filtered = filterReportResultsByTimeframe(selectedStudentForReport.results, reportTimeframeFilter);
      setReportFilteredResults(filtered);

      const bySubject = {};
      let totalScoreSum = 0;
      filtered.forEach(result => {
        const subjectKey = `${result.subjectType || 'unknown'}-${result.subjectName || 'Unknown'}`;
        if (!bySubject[subjectKey]) {
          bySubject[subjectKey] = {
            name: result.subjectName || 'Unknown',
            type: result.subjectType || 'unknown',
            quizzes: [],
            totalScore: 0,
            count: 0,
            average: 0,
            grade: 'N/A',
            remark: ''
          };
        }
        bySubject[subjectKey].quizzes.push(result);
        bySubject[subjectKey].totalScore += result.score;
        bySubject[subjectKey].count += 1;
        totalScoreSum += result.score;
      });

      // Calculate averages, grades, and remarks for each subject
      for (const key in bySubject) {
        if (bySubject.hasOwnProperty(key)) {
          bySubject[key].average = bySubject[key].totalScore / bySubject[key].count;
          bySubject[key].grade = getGrade(bySubject[key].average);
          bySubject[key].remark = generateSubjectRemark(bySubject[key].grade);
        }
      }
      setReportAggregatedSubjectStats(bySubject);

      const overallAverage = filtered.length > 0 ? totalScoreSum / filtered.length : 0;
      const overallGrade = getGrade(overallAverage);
      const overallRemark = generateOverallRemark(overallAverage);
      setReportOverallStats({
        totalQuizzesTaken: filtered.length,
        overallAverage,
        overallGrade,
        overallRemark
      });
    }
  }, [selectedStudentForReport, reportTimeframeFilter, fixedStartDateForFiltering]);


  // Function to handle viewing a student report
  const handleViewStudentReport = (studentData) => {
    setSelectedStudentForReport(studentData);
    setReportTimeframeFilter('all'); // Reset report filter to 'all' when opening new report
    setShowStudentReportModal(true);
  };


  if (loadingStats) {
    return (
      <div className="flex items-center justify-center p-8 bg-white rounded-xl shadow-lg border border-gray-200">
        <div className="text-xl font-semibold text-gray-700">Loading Student Statistics...</div>
      </div>
    );
  }

  if (errorMessage) {
    return (
      <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-md relative mb-4">
        <strong className="font-bold">Error!</strong>
        <span className="block sm:inline ml-2">{errorMessage}</span>
      </div>
    );
  }

  return (
    <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-200">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
        {/* Overall Statistics Cards */}
        <div className="bg-blue-50 p-6 rounded-lg shadow-md text-center">
          <h4 className="text-lg font-semibold text-blue-800">Total Students Registered</h4>
          <p className="text-4xl font-bold text-blue-600">{totalStudents}</p>
        </div>
        <div className="bg-green-50 p-6 rounded-lg shadow-md text-center">
          <h4 className="text-lg font-semibold text-green-800">Total Quizzes Created</h4>
          <p className="text-4xl font-bold text-green-600">{totalQuizzes}</p>
        </div>
        <div className="bg-purple-50 p-6 rounded-lg shadow-md text-center">
          <h4 className="text-lg font-semibold text-purple-800">Total Quiz Attempts <span className="text-sm">(filtered)</span></h4>
          <p className="text-4xl font-bold text-purple-600">{totalQuizAttempts}</p>
        </div>
        <div className="bg-yellow-50 p-6 rounded-lg shadow-md text-center">
          <h4 className="text-lg font-semibold text-yellow-800">Overall Average Score <span className="text-sm">(filtered)</span></h4>
          <p className="text-4xl font-bold text-yellow-600">{averageQuizScore}%</p>
        </div>
        <div className="bg-indigo-50 p-6 rounded-lg shadow-md text-center">
          <h4 className="text-lg font-semibold text-indigo-800">Unique Students <span className="text-sm">(w/ filtered results)</span></h4>
          <p className="text-4xl font-bold text-indigo-600">{uniqueStudentsInFilteredResults}</p>
        </div>
        {/* Placeholder for an additional card if needed */}
        <div className="bg-gray-50 p-6 rounded-lg shadow-md text-center flex items-center justify-center">
            <p className="text-lg text-gray-500">More dashboard stats coming soon!</p>
        </div>
      </div>

      {/* Filters Section (for main dashboard stats) */}
      <div className="mb-8 p-6 bg-gray-50 rounded-lg shadow-inner border border-gray-200">
        <h3 className="text-xl font-semibold text-gray-800 mb-4">Dashboard Filters</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <label htmlFor="filterSubjectType" className="block text-sm font-medium text-gray-700">Subject Type</label>
            <select
              id="filterSubjectType"
              value={filterSubjectType}
              onChange={(e) => {
                setFilterSubjectType(e.target.value);
                setFilterSubjectName('all'); // Reset subject name when type changes
              }}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="all">All Types</option>
              <option value="core">Core</option>
              <option value="elective">Elective</option>
            </select>
          </div>
          <div>
            <label htmlFor="filterSubjectName" className="block text-sm font-medium text-gray-700">Subject Name</label>
            <select
              id="filterSubjectName"
              value={filterSubjectName}
              onChange={(e) => setFilterSubjectName(e.target.value)}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="all">All Subjects</option>
              {(filterSubjectType === 'core' || filterSubjectType === 'all') && coreSubjects.map(sub => (
                <option key={sub} value={sub}>{sub}</option>
              ))}
              {(filterSubjectType === 'elective' || filterSubjectType === 'all') && allElectiveSubjects.map(sub => (
                <option key={sub} value={sub}>{sub}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="filterYearGroup" className="block text-sm font-medium text-gray-700">Year Group</label>
            <select
              id="filterYearGroup"
              value={filterYearGroup}
              onChange={(e) => setFilterYearGroup(e.target.value)}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="all">All Year Groups</option>
              {uniqueYearGroups.map(year => (
                <option key={year} value={year}>{year}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="filterQuiz" className="block text-sm font-medium text-gray-700">Specific Quiz</label>
            <select
              id="filterQuiz"
              value={filterQuizId}
              onChange={(e) => setFilterQuizId(e.target.value)}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="all">All Quizzes</option>
              {quizDefinitions.map(quiz => (
                <option key={quiz.id} value={quiz.id}>{quiz.title} ({quiz.subjectName})</option>
              ))}
            </select>
          </div>
          {/* Removed the global data range filter as per request */}
        </div>
      </div>

      {/* Quiz Performance Overview (based on main dashboard filters) */}
      <div className="mb-8 p-6 bg-white rounded-lg shadow-lg border border-gray-200">
        <h3 className="text-xl font-semibold text-gray-800 mb-4">Quiz Performance Overview <span className="text-base font-normal text-gray-500">(based on selected filters)</span></h3>
        {Object.keys(aggregatedQuizStats).length > 0 ? (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Quiz Title</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Subject</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total Attempts</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Unique Students</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Average Score</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {Object.entries(aggregatedQuizStats).map(([quizId, stats]) => (
                  <tr key={quizId}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{stats.title}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">{stats.subjectName} ({stats.subjectType})</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">{stats.totalAttempts}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">{stats.uniqueStudentsCount}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">{stats.averageScore}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-gray-500">No quiz performance data available based on current filters.</p>
        )}
      </div>

      {/* Student Performance Reports (based on main dashboard filters, with "View Report" button) */}
      <div className="p-6 bg-white rounded-lg shadow-lg border border-gray-200">
        <h3 className="text-xl font-semibold text-gray-800 mb-4">Individual Student Performance <span className="text-base font-normal text-gray-500">(based on selected dashboard filters)</span></h3>
        {Object.keys(studentQuizPerformance).length > 0 ? (
          <div className="space-y-6">
            {/* Filter out students with no results after applying dashboard filters */}
            {Object.entries(studentQuizPerformance)
              .filter(([, studentData]) => studentData.results.length > 0)
              .map(([studentId, studentData]) => (
              <div key={studentId} className="border border-gray-200 rounded-md p-4 bg-gray-50">
                <h4 className="text-lg font-semibold text-gray-900 mb-2">{studentData.name} ({studentData.yearGroup}, {studentData.shsProgram})</h4>
                <p className="text-sm text-gray-700 mb-4">{studentData.email}</p>
                <ul className="space-y-2">
                  {studentData.results.map((result, idx) => (
                    <li key={idx} className="bg-white p-3 rounded-md shadow-sm text-sm flex justify-between items-center">
                      <div>
                        <p className="font-medium text-gray-800">{result.quizTitle} ({result.subjectName})</p>
                        <p className="text-xs text-gray-500">{new Date(result.timestamp).toLocaleString()}</p>
                      </div>
                      <span className={`font-bold text-lg ${result.score >= 70 ? 'text-green-600' : (result.score >= 50 ? 'text-yellow-600' : 'text-red-600')}`}>
                        {result.score.toFixed(2)}%
                      </span>
                    </li>
                  ))}
                </ul>
                <button
                  onClick={() => handleViewStudentReport(studentData)}
                  className="mt-4 bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-md shadow-md transition duration-200"
                >
                  View Report
                </button>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-gray-500">No student performance data available based on current filters.</p>
        )}
      </div>

      {/* Student Report Modal */}
      {showStudentReportModal && selectedStudentForReport && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-75 flex items-center justify-center z-50 p-4 print:hidden"> {/* Hide on print */}
          <div className="bg-white p-8 rounded-lg shadow-2xl w-full max-w-4xl relative max-h-[90vh] overflow-y-auto">
            <h3 className="text-2xl font-bold text-gray-800 mb-4 border-b pb-2">Student Performance Report</h3>
            
            {/* Report Filters */}
            <div className="mb-4 flex flex-col md:flex-row items-center gap-4 print:hidden">
                <label htmlFor="reportTimeframeFilter" className="block text-sm font-medium text-gray-700 whitespace-nowrap">Filter Report by Timeframe:</label>
                <select
                  id="reportTimeframeFilter"
                  value={reportTimeframeFilter}
                  onChange={(e) => setReportTimeframeFilter(e.target.value)}
                  className="mt-1 block w-full md:w-auto px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="all">All Time</option>
                  <option value="today-onwards">Today Onwards (Hardcoded Date)</option>
                  <option value="last7Days">Last 7 Days</option>
                  <option value="last30Days">Last 30 Days</option>
                  <option value="thisMonth">This Month</option>
                  <option value="thisYear">This Year</option>
                </select>
            </div>

            {/* Report Content */}
            <div id="student-report-content" className="p-4 space-y-4 print:block print:w-full print:p-0"> {/* Styles for printing */}
              <h4 className="text-xl font-semibold text-blue-700 mb-2">{selectedStudentForReport.name}</h4>
              <p><strong>Email:</strong> {selectedStudentForReport.email}</p>
              <p><strong>Year Group:</strong> {selectedStudentForReport.yearGroup}</p>
              <p><strong>SHS Program:</strong> {selectedStudentForReport.shsProgram}</p>
              <p className="mt-4"><strong>Total Quizzes Attempted in Timeframe:</strong> {reportOverallStats.totalQuizzesTaken}</p>

              <h5 className="text-lg font-semibold text-gray-800 mt-6 mb-2">Quiz Results by Subject:</h5>
              {Object.keys(reportAggregatedSubjectStats).length > 0 ? (
                <div className="space-y-4">
                    {Object.values(reportAggregatedSubjectStats).sort((a,b) => a.name.localeCompare(b.name)).map((subjectStats, index) => (
                        <div key={index} className="border border-gray-200 rounded-md p-3 bg-gray-50">
                            <h6 className="font-semibold text-gray-800">{subjectStats.name} ({subjectStats.type})</h6>
                            <p className="text-sm">Average Score: <span className="font-bold">{subjectStats.average.toFixed(1)}%</span></p>
                            <p className="text-sm">Grade: <span className="font-bold">{subjectStats.grade}</span></p>
                            <p className="text-sm text-gray-600 italic">Remark: {subjectStats.remark}</p>
                            <details className="mt-2 text-sm">
                                <summary className="cursor-pointer text-blue-600 hover:underline">View Individual Quiz Attempts ({subjectStats.quizzes.length})</summary>
                                <ul className="list-disc list-inside mt-2 space-y-1">
                                    {subjectStats.quizzes.sort((a,b) => (b.timestamp || 0) - (a.timestamp || 0)).map((quizAttempt, idx) => (
                                        <li key={idx} className="text-gray-700">
                                            {quizAttempt.quizTitle}: {quizAttempt.score.toFixed(1)}% ({getGrade(quizAttempt.score)}) on {new Date(quizAttempt.timestamp).toLocaleDateString()}
                                        </li>
                                    ))}
                                </ul>
                            </details>
                        </div>
                    ))}
                </div>
              ) : (
                <p className="text-gray-500">No quiz results available for this timeframe.</p>
              )}

              <h5 className="text-lg font-semibold text-gray-800 mt-6 mb-2">Overall Performance Summary:</h5>
              <div className="border border-gray-200 rounded-md p-3 bg-gray-50">
                  <p className="text-lg font-bold">Overall Average: <span className="text-blue-700">{reportOverallStats.overallAverage.toFixed(1)}%</span></p>
                  <p className="text-lg font-bold">Overall Grade: <span className="text-blue-700">{reportOverallStats.overallGrade}</span></p>
                  <p className="text-md text-gray-700 mt-2">Comments: <span className="italic">{reportOverallStats.overallRemark}</span></p>
              </div>

            </div>

            {/* Modal Actions */}
            <div className="flex justify-end space-x-4 mt-6 print:hidden">
              <button
                onClick={() => window.print()}
                className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded-md shadow-md transition duration-200"
              >
                Print Report
              </button>
              <button
                onClick={() => setShowStudentReportModal(false)}
                className="bg-gray-300 hover:bg-gray-400 text-gray-800 font-bold py-2 px-4 rounded-md transition duration-200"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminStats;
