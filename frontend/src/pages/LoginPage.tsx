import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await login(username, password);
      // After login, token is set - read the role from localStorage JWT
      const token = localStorage.getItem('token');
      if (token) {
        const payload = JSON.parse(atob(token.split('.')[1]));
        if (payload.role === 'COURSE_REP') {
          navigate('/course-rep-dashboard');
        } else {
          navigate('/course-reps');
        }
      } else {
        navigate('/course-reps');
      }
    } catch {
      setError('Invalid username or password.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F6F8FA] flex items-center justify-center">
      <div className="bg-white border border-[#D0D7DE] rounded-md shadow-sm p-6 w-full max-w-sm">
        <h1 className="text-lg font-semibold text-[#1F2328] mb-4">TruMark - Login</h1>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-sm text-[#656D76] mb-1">Username</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="border border-[#D0D7DE] rounded-md px-3 py-1.5 text-sm w-full focus:outline-none focus:ring-2 focus:ring-[#0969DA] focus:border-transparent shadow-sm"
              required
            />
          </div>
          <div>
            <label className="block text-sm text-[#656D76] mb-1">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="border border-[#D0D7DE] rounded-md px-3 py-1.5 text-sm w-full focus:outline-none focus:ring-2 focus:ring-[#0969DA] focus:border-transparent shadow-sm"
              required
            />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button
            type="submit"
            disabled={submitting}
            className="bg-[#0969DA] text-white px-3 py-1.5 rounded-md text-sm font-medium hover:bg-[#0353A4] transition-colors w-full disabled:opacity-50"
          >
            {submitting ? 'Logging in…' : 'Log in'}
          </button>
        </form>
      </div>
    </div>
  );
}
