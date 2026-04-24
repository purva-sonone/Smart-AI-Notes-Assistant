const API_URL = window.location.origin.includes('localhost') ? `${window.location.protocol}//${window.location.hostname}:5000/api` : '/api';

// Handle Registration
const regForm = document.getElementById('register-form');
if (regForm) {
    regForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const name = e.target[0].value;
        const email = e.target[1].value;
        const password = e.target[2].value;

        try {
            const response = await fetch(`${API_URL}/auth/register`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, email, password })
            });

            const data = await response.json();
            if (response.ok) {
                localStorage.setItem('token', data.token);
                localStorage.setItem('user', JSON.stringify(data.user));
                window.location.href = 'dashboard.html';
            } else {
                alert(data.message || 'Registration failed');
            }
        } catch (err) {
            console.error('Registration Error:', err);
            alert(`Connection Error: ${err.message}. Please check if Vercel Environment Variables are set correctly.`);
        }
    });
}

// Handle Login
const loginForm = document.getElementById('login-form');
if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = e.target[0].value;
        const password = e.target[1].value;
        const submitBtn = e.target.querySelector('button');
        const originalBtnText = submitBtn.innerText;

        try {
            submitBtn.disabled = true;
            submitBtn.innerText = 'Logging in...';

            const response = await fetch(`${API_URL}/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: email.toLowerCase(), password })
            });

            const data = await response.json();
            if (response.ok) {
                localStorage.setItem('token', data.token);
                localStorage.setItem('user', JSON.stringify(data.user || {email}));
                window.location.href = 'dashboard.html';
            } else {
                alert(data.message || 'Login failed: Invalid Credentials');
            }
        } catch (err) {
            console.error('Login Error:', err);
            alert(`Connection Error: ${err.message}. \n\nPlease check:\n1. Vercel Environment Variables\n2. MongoDB Atlas IP Whitelist (0.0.0.0/0)`);
        } finally {
            submitBtn.disabled = false;
            submitBtn.innerText = originalBtnText;
        }
    });
}

window.onload = () => {
    const token = localStorage.getItem('token');
    if (token && window.location.pathname.includes('index.html')) {
        // window.location.href = 'dashboard.html';
    }
};
