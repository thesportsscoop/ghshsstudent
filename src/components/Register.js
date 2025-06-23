import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext'; // Import useAuth hook

const Register = ({ navigate }) => {
  const { register, authError, loadingAuth, userId } = useAuth(); // Destructure userId
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [yearGroup, setYearGroup] = useState('');
  const [shsProgram, setShsProgram] = useState('');
  const [electiveSubjects, setElectiveSubjects] = useState([]);
  const [contactNumber, setContactNumber] = useState(''); // NEW state for contact number
  const [message, setMessage] = useState('');

  // Predefined lists for dropdowns and electives
  const yearGroupOptions = ['Year 1', 'Year 2', 'Year 3'];
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

  const handleElectiveChange = (e) => {
    const { value, checked } = e.target;
    if (checked) {
      if (electiveSubjects.length < 4) {
        setElectiveSubjects([...electiveSubjects, value]);
        setMessage('');
      } else {
        setMessage("You must select exactly 4 elective subjects. Uncheck an existing one to select a new one.");
      }
    } else {
      setElectiveSubjects(electiveSubjects.filter((subject) => subject !== value));
      setMessage('');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage('');

    // --- Enhanced Validation ---
    if (!name.trim()) {
      setMessage("Please enter your full name.");
      return;
    }
    if (!email.trim()) {
      setMessage("Please enter your email address.");
      return;
    }
    if (!password) {
      setMessage("Please enter a password.");
      return;
    }
    if (password.length < 6) {
        setMessage("Password must be at least 6 characters long.");
        return;
    }
    if (!yearGroup) {
      setMessage("Please select your Year Group.");
      return;
    }
    if (!shsProgram) {
      setMessage("Please select your SHS Program.");
      return;
    }
    if (electiveSubjects.length !== 4) {
      setMessage("Please select exactly 4 elective subjects.");
      return;
    }
    // NEW Validation for Contact Number
    if (!contactNumber.trim() || !/^\d{10}$/.test(contactNumber.trim())) { // Simple check for 10 digits only
        setMessage("Please enter a valid 10-digit contact number (digits only).");
        return;
    }

    // Pass contactNumber to the register function
    const result = await register(email, password, name, yearGroup, shsProgram, electiveSubjects, contactNumber);
    if (result.success) {
      setMessage("Registration successful! Redirecting to dashboard...");
      setTimeout(() => navigate('dashboard'), 1500);
    } else {
      setMessage(result.error || "Registration failed. Please try again.");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-400 to-pink-600 p-4">
      <div className="bg-white p-8 rounded-xl shadow-2xl w-full max-w-md backdrop-blur-md bg-opacity-80 border border-gray-200">
        <h2 className="text-3xl font-extrabold text-center text-gray-900 mb-8">Register for SHS Platform</h2>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-gray-700">Full Name</label>
            <input
              id="name"
              name="name"
              type="text"
              autoComplete="name"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 block w-full px-4 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-purple-500 focus:border-purple-500 text-base"
            />
          </div>
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
              className="mt-1 block w-full px-4 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-purple-500 focus:border-purple-500 text-base"
            />
          </div>
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700">Password</label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="new-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 block w-full px-4 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-purple-500 focus:border-purple-500 text-base"
            />
          </div>

          {/* Year Group Selector */}
          <div>
            <label htmlFor="yearGroup" className="block text-sm font-medium text-gray-700">Year Group</label>
            <select
              id="yearGroup"
              name="yearGroup"
              required
              value={yearGroup}
              onChange={(e) => setYearGroup(e.target.value)}
              className="mt-1 block w-full px-4 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-purple-500 focus:border-purple-500 text-base"
            >
              <option value="">Select Year Group</option>
              {yearGroupOptions.map((option) => (
                <option key={option} value={option}>{option}</option>
              ))}
            </select>
          </div>

          {/* SHS Program Selector */}
          <div>
            <label htmlFor="shsProgram" className="block text-sm font-medium text-gray-700">SHS Program</label>
            <select
              id="shsProgram"
              name="shsProgram"
              required
              value={shsProgram}
              onChange={(e) => setShsProgram(e.target.value)}
              className="mt-1 block w-full px-4 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-purple-500 focus:border-purple-500 text-base"
            >
              <option value="">Select SHS Program</option>
              {shsProgramOptions.map((option) => (
                <option key={option} value={option}>{option}</option>
              ))}
            </select>
          </div>

          {/* Elective Subjects (exactly 4) */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Elective Subjects (Select Exactly 4)</label>
            <div className="grid grid-cols-2 gap-2 text-sm text-gray-800">
              {allElectiveSubjects.map((subject) => (
                <label key={subject} className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    value={subject}
                    checked={electiveSubjects.includes(subject)}
                    onChange={handleElectiveChange}
                    // Disable if 4 are already selected AND this subject is not currently selected
                    disabled={electiveSubjects.length === 4 && !electiveSubjects.includes(subject)}
                    className="rounded text-purple-600 focus:ring-purple-500"
                  />
                  <span>{subject}</span>
                </label>
              ))}
            </div>
            {electiveSubjects.length > 0 && (
                <p className="mt-2 text-gray-600 text-xs">Selected: {electiveSubjects.join(', ')}</p>
            )}
          </div>

          {/* NEW FIELD: Contact Number */}
          <div>
            <label htmlFor="contactNumber" className="block text-sm font-medium text-gray-700">Contact Number</label>
            <input
              id="contactNumber"
              name="contactNumber"
              type="tel" // Use type="tel" for phone numbers
              autoComplete="tel"
              required
              value={contactNumber}
              onChange={(e) => setContactNumber(e.target.value)}
              className="mt-1 block w-full px-4 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-purple-500 focus:border-purple-500 text-base"
              placeholder="e.g., 0551234567"
            />
          </div>

          <div>
            <button
              type="submit"
              disabled={loadingAuth}
              className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-lg font-semibold text-white bg-purple-600 hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 transition duration-300 ease-in-out disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loadingAuth ? 'Registering...' : 'Register'}
            </button>
          </div>
        </form>
        {/* Global authentication errors are displayed here */}
        {authError && <p className="mt-4 text-center text-red-600 text-sm">{authError}</p>}
        
        {/* Local registration specific messages are displayed here, now bigger and red */}
        {message && (
          <p className="mt-4 text-center text-red-600 font-semibold text-base">
            {message}
          </p>
        )}

        <p className="mt-6 text-center text-gray-600 text-sm">
          Already have an account?{' '}
          <button onClick={() => navigate('login')} className="font-medium text-purple-600 hover:text-purple-500 focus:outline-none">
            Login
          </button>
        </p>
        <p className="mt-4 text-center text-gray-500 text-xs">
            Current User ID (for debug): {userId}
        </p>
      </div>
    </div>
  );
};

export default Register;
