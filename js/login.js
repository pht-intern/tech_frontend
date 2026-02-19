/* ====================================================================
   LOGIN PAGE - Production Ready Authentication
   ==================================================================== */

// --- Constants ---
const API_BASE = '/api';
const LS_KEYS = {
    role: 'rolewise_role',
    user: 'rolewise_user',
    userEmail: 'rolewise_user_email',
    userName: 'rolewise_user_name',
    userId: 'rolewise_user_id',
    sessionExpiry: 'rolewise_session_expiry',
    sessionTimeout: 'rolewise_session_timeout',
    sessionStart: 'rolewise_session_start'
};

// Role-based redirect mapping (must match backend)
const ROLE_REDIRECTS = {
    'Owner': '/owner.html',
    'Admin': '/admin.html',
    'Manager': '/manager.html',
    'Sales': '/employee.html',
    'Accountant': '/accountant.html',
    'Employee': '/employee.html'
};

// Valid roles for validation
const VALID_ROLES = Object.keys(ROLE_REDIRECTS);

// --- Utility Functions ---

/**
 * Show error message to user
 * @param {string} message - Error message to display
 */
function showError(message) {
    // Use alert for now - can be replaced with a better UI component
    alert(message);
}

/**
 * Show success message (optional - for future UI enhancements)
 * @param {string} message - Success message
 */
function showSuccess(message) {
    // Can be replaced with toast notification or other UI component
}

/**
 * Store user session data in localStorage with expiration timestamp
 * @param {Object} userData - User data object from API
 * @param {number} timeoutSeconds - Session timeout in seconds (default: 8 hours = 28800)
 */
function storeUserSession(userData, timeoutSeconds = 28800) {
    if (!userData) {
        return;
    }

    try {
        // Store individual fields for easy access
        if (userData.role) {
            localStorage.setItem(LS_KEYS.role, userData.role);
        }
        if (userData.email) {
            localStorage.setItem(LS_KEYS.userEmail, userData.email);
        }
        if (userData.name) {
            localStorage.setItem(LS_KEYS.userName, userData.name);
        }
        if (userData.id) {
            localStorage.setItem(LS_KEYS.userId, String(userData.id));
        }
        
        // Store complete user object as JSON
        localStorage.setItem(LS_KEYS.user, JSON.stringify(userData));
        
        // Store session start and expiration timestamps
        const now = Date.now();
        const expiryTimestamp = now + (timeoutSeconds * 1000);
        localStorage.setItem(LS_KEYS.sessionStart, String(now));
        localStorage.setItem(LS_KEYS.sessionExpiry, String(expiryTimestamp));
        localStorage.setItem(LS_KEYS.sessionTimeout, String(timeoutSeconds));
    } catch (error) {
        showError('Failed to store session data. Please try again.');
    }
}

/**
 * Clear all user session data from localStorage
 */
function clearUserSession() {
    try {
        Object.values(LS_KEYS).forEach(key => {
            localStorage.removeItem(key);
        });
    } catch (error) {
        // Silent fail
    }
}

/**
 * Check if session has expired
 * @returns {boolean} - True if session is expired, false otherwise
 */
function isSessionExpired() {
    try {
        const expiryTimestamp = localStorage.getItem(LS_KEYS.sessionExpiry);
        if (!expiryTimestamp) {
            return true; // No expiry timestamp means expired
        }
        
        const expiryTime = parseInt(expiryTimestamp, 10);
        const currentTime = Date.now();
        
        return currentTime >= expiryTime;
    } catch (error) {
        return true; // On error, consider expired
    }
}

/**
 * Check if user is already logged in and redirect if valid session exists
 * @returns {boolean} - True if valid session exists, false otherwise
 */
function checkExistingSession() {
    try {
        const userRole = localStorage.getItem(LS_KEYS.role);
        const userDataStr = localStorage.getItem(LS_KEYS.user);
        
        if (!userRole || !userDataStr) {
            return false;
        }
        
        // Check if session has expired
        if (isSessionExpired()) {
            clearUserSession();
            return false;
        }
        
        // Validate role
        if (!VALID_ROLES.includes(userRole)) {
            clearUserSession();
            return false;
        }
        
        // Parse and validate user data
        let userData;
        try {
            userData = JSON.parse(userDataStr);
        } catch (parseError) {
            clearUserSession();
            return false;
        }
        
        // Validate user data structure
        if (!userData.email || !userData.role) {
            clearUserSession();
            return false;
        }
        
        // Check if role matches
        if (userData.role !== userRole) {
            clearUserSession();
            return false;
        }
        
        // Get redirect URL for the role
        const redirectUrl = ROLE_REDIRECTS[userRole];
        if (redirectUrl) {
            window.location.href = redirectUrl;
            return true;
        }
        
        return false;
    } catch (error) {
        clearUserSession();
        return false;
    }
}

/**
 * Validate email format
 * @param {string} email - Email to validate
 * @returns {boolean} - True if valid, false otherwise
 */
function isValidEmail(email) {
    if (!email || typeof email !== 'string') {
        return false;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email.trim());
}

/**
 * Validate password (basic validation)
 * @param {string} password - Password to validate
 * @returns {boolean} - True if valid, false otherwise
 */
function isValidPassword(password) {
    if (!password || typeof password !== 'string') {
        return false;
    }
    // Minimum 3 characters (adjust as needed)
    return password.length >= 3;
}

/**
 * Handle login form submission
 * @param {Event} event - Form submit event
 */
async function handleLogin(event) {
    event.preventDefault();
    
    // Get form elements
    const emailInput = document.getElementById('loginEmail');
    const passwordInput = document.getElementById('loginPassword');
    const submitButton = event.target.querySelector('button[type="submit"]');
    
    if (!emailInput || !passwordInput || !submitButton) {
        showError('Form elements not found. Please refresh the page.');
        return;
    }
    
    // Get and validate input values
    const email = emailInput.value.trim().toLowerCase();
    const password = passwordInput.value;
    
    // Client-side validation
    if (!email) {
        showError('Please enter your email address.');
        emailInput.focus();
        return;
    }
    
    if (!isValidEmail(email)) {
        showError('Please enter a valid email address.');
        emailInput.focus();
        return;
    }
    
    if (!password) {
        showError('Please enter your password.');
        passwordInput.focus();
        return;
    }
    
    if (!isValidPassword(password)) {
        showError('Password must be at least 3 characters long.');
        passwordInput.focus();
        return;
    }
    
    // Disable submit button to prevent double submission
    submitButton.disabled = true;
    submitButton.textContent = 'Logging in...';
    
    try {
        // Prepare JSON data (backend supports both JSON and FormData)
        const requestData = {
            email: email,
            password: password
        };
        
        // Call backend API with JSON
        const response = await fetch(`${API_BASE}/login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            credentials: 'include',  // Send cookies with cross-origin requests
            body: JSON.stringify(requestData)
        });
        
        // Get response as text first to check format
        const responseText = await response.text();
        
        // Check if response is empty
        if (!responseText || responseText.trim().length === 0) {
            showError(`Server error (${response.status}): Empty response received. Please try again.`);
            return;
        }
        
        // Check content type
        const contentType = response.headers.get('content-type') || '';
        const isJson = contentType.includes('application/json') || 
                      contentType.includes('application/javascript') ||
                      responseText.trim().startsWith('{') ||
                      responseText.trim().startsWith('[');
        
        let responseData;
        
        // Try to parse as JSON
        if (isJson) {
            try {
                // Check if it's JSONP (starts with callback function)
                if (responseText.trim().includes('(') && responseText.trim().includes(')')) {
                    // Extract JSON from JSONP: callback({...}) -> {...}
                    const jsonMatch = responseText.match(/\(({.*})\)/);
                    if (jsonMatch && jsonMatch[1]) {
                        responseData = JSON.parse(jsonMatch[1]);
                    } else {
                        throw new Error('Invalid JSONP format');
                    }
                } else {
                    // Regular JSON
                    responseData = JSON.parse(responseText);
                }
            } catch (jsonError) {
                // If it's an HTML error page, provide better error message
                if (responseText.includes('<!DOCTYPE') || responseText.includes('<html')) {
                    showError(`Server error (${response.status}): The server encountered an internal error. Please contact support or try again later.`);
                } else {
                    showError('Server returned invalid response format. Please try again.');
                }
                return;
            }
        } else {
            // Non-JSON response (likely HTML error page from web server)
            // Try to extract error message from HTML if possible
            let errorMsg = `Server error (${response.status}): ${response.statusText}`;
            if (response.status === 500) {
                errorMsg = 'Internal server error. Please contact support or try again later.';
            }
            
            showError(errorMsg);
            return;
        }
        
        // Validate response structure
        if (!responseData || typeof responseData !== 'object') {
            showError('Server returned invalid response. Please try again.');
            return;
        }
        
        // Handle response based on backend format
        // Backend returns: {success: true/false, data: {...}, message: "...", error: "..."}
        if (response.ok && responseData.success === true) {
            // Login successful
            const userData = responseData.data?.user;
            const redirectUrl = responseData.data?.redirect;
            const role = responseData.data?.role || userData?.role;
            
            if (!userData) {
                showError('Login successful but user data not received. Please try again.');
                return;
            }
            
            if (!role) {
                showError('Login successful but user role not found. Please contact administrator.');
                return;
            }
            
            // Validate role
            if (!VALID_ROLES.includes(role)) {
                showError('Invalid user role. Please contact administrator.');
                return;
            }
            
            // Get session timeout from backend (default: 8 hours = 28800 seconds)
            const sessionTimeout = responseData.data?.sessionTimeout || 28800;
            
            // Store user session with expiration
            storeUserSession(userData, sessionTimeout);
            
            // Show success message
            const welcomeMessage = responseData.data?.message || 
                responseData.message || 
                `Welcome, ${userData.name || userData.email}!`;
            showSuccess(welcomeMessage);
            
            // Redirect to role-based dashboard
            const finalRedirectUrl = redirectUrl || ROLE_REDIRECTS[role];
            if (finalRedirectUrl) {
                // Small delay to ensure localStorage is written
                setTimeout(() => {
                    window.location.href = finalRedirectUrl;
                }, 100);
            } else {
                showError('Login successful but redirect URL not found. Please contact administrator.');
            }
        } else {
            // Login failed - extract error message from backend format
            // Backend returns "Someone is already using this user." when same email is logged in elsewhere
            const errorMessage = responseData.error ||
                responseData.message ||
                'Invalid email or password. Please try again.';

            showError(errorMessage);

            // Clear password field for security
            passwordInput.value = '';
            passwordInput.focus();
        }
    } catch (error) {
        // Determine error message based on error type
        let errorMessage = 'Unable to connect to server. ';
        
        if (error instanceof TypeError && error.message.includes('fetch')) {
            errorMessage += 'Please check your internet connection and try again.';
        } else if (error instanceof SyntaxError) {
            errorMessage += 'Server returned invalid data. Please try again.';
        } else {
            errorMessage += 'Please try again later or contact support.';
        }
        
        showError(errorMessage);
        
        // Clear password field
        passwordInput.value = '';
        passwordInput.focus();
    } finally {
        // Re-enable submit button
        submitButton.disabled = false;
        submitButton.textContent = 'Log In';
    }
}

/**
 * Apply company logo from settings (used on login page).
 * Only runs over http(s). Uses API_BASE; set window.API_BASE if your API is on a different path/origin.
 */
function applyCompanyLogo() {
    if (window.location.protocol !== 'http:' && window.location.protocol !== 'https:') return;
    var base = (typeof window !== 'undefined' && window.API_BASE) ? window.API_BASE : API_BASE;
    var url = (base.replace(/\/$/, '')) + '/settings/logo';
    fetch(url, { method: 'GET' })
        .then(function(r) {
            if (!r.ok) return null;
            return r.json();
        })
        .then(function(res) {
            if (!res) return;
            var logo = null; /* logo no longer from settings API */
            if (!logo || typeof logo !== 'string') return;
            var el = document.getElementById('companyLogoImg');
            if (el) el.src = logo;
        })
        .catch(function() {});
}

/**
 * Initialize login page functionality
 */
function initializeLogin() {
    // Check for existing session (optional - uncomment if you want auto-redirect)
    // checkExistingSession();
    
    // Apply company logo from settings
    applyCompanyLogo();
    
    // Get login form
    const loginForm = document.getElementById('loginForm');
    
    if (!loginForm) {
        return;
    }
    
    // Attach submit event listener
    loginForm.addEventListener('submit', handleLogin);
    
    // Focus on email input when page loads
    const emailInput = document.getElementById('loginEmail');
    if (emailInput) {
        emailInput.focus();
    }
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeLogin);
} else {
    // DOM is already ready
    initializeLogin();
}

