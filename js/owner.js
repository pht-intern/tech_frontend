
/* ====================================================================
   JAVASCRIPT LOGIC (API Integrated)
   ==================================================================== */

const defaultPlaceholderImage = '<svg style="width:48px;height:48px;color:#9aa4ad" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#ccc" width="24px" height="24px"><path d="M0 0h24v24H0z" fill="none"/><path d="M22 16V4a2 2 0 00-2-2H4a2 2 0 00-2 2v12a2 2 0 002 2h16a2 2 0 002-2zm-11.5-3c.83 0 1.5-.67 1.5-1.5S11.33 10 10.5 10 9 10.67 9 11.5s.67 1.5 1.5 1.5zM20 18H4v-1.5l3.5-3.5 4.5 6 4-4 4 4z"/></svg>';

// --- Constants ---
const API_BASE = '/api';
const LS_KEYS = {
    role: 'rolewise_role',
    user: 'rolewise_user',
    userEmail: 'rolewise_user_email',
    sessionExpiry: 'rolewise_session_expiry'
};
const USER_ROLES = ['Owner', 'Admin', 'Manager', 'Sales'];
const DEFAULT_ROLE = 'Owner';
const AUTHORIZED_TO_EDIT_ITEMS = ['Owner', 'Admin', 'Manager'];
const AUTHORIZED_TO_CREATE_QUOTATIONS = ['Owner', 'Admin', 'Manager', 'Sales'];
const AUTHORIZED_TO_VIEW_CUSTOMERS = ['Owner', 'Admin', 'Manager', 'Sales'];
const AUTHORIZED_TO_VIEW_LOGS = ['Owner', 'Admin', 'Manager'];
const AUTHORIZED_TO_DELETE_LOGS = ['Owner'];
const AUTHORIZED_TO_FIX_GST = ['Owner', 'Admin', 'Manager'];

// --- Session Validation Functions ---
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

function validateSession() {
    try {
        const userRole = localStorage.getItem(LS_KEYS.role);
        const userDataStr = localStorage.getItem(LS_KEYS.user);
        
        // Check if session data exists
        if (!userRole || !userDataStr) {
            return false;
        }
        
        // Check if session has expired
        if (isSessionExpired()) {
            // Clear session and redirect
            localStorage.removeItem(LS_KEYS.role);
            localStorage.removeItem(LS_KEYS.user);
            localStorage.removeItem(LS_KEYS.userEmail);
            localStorage.removeItem(LS_KEYS.sessionExpiry);
            return false;
        }
        
        // Validate role
        if (!USER_ROLES.includes(userRole)) {
            return false;
        }
        
        // Parse and validate user data
        let userData;
        try {
            userData = JSON.parse(userDataStr);
        } catch (parseError) {
            return false;
        }
        
        // Validate user data structure
        if (!userData.email || !userData.role) {
            return false;
        }
        
        // Check if role matches
        if (userData.role !== userRole) {
            return false;
        }
        
        return true;
    } catch (error) {
        return false;
    }
}

// --- Global State Variables ---
let CURRENT_USER_ROLE = localStorage.getItem(LS_KEYS.role) || DEFAULT_ROLE;
// Get email from userEmail key, or parse from user object, or use default
let userEmailFromStorage = localStorage.getItem(LS_KEYS.userEmail) || localStorage.getItem('rolewise_userEmail');
let userObjFromStorage = localStorage.getItem(LS_KEYS.user);
let CURRENT_USER_EMAIL = userEmailFromStorage || (userObjFromStorage ? (() => {
    try {
        const userData = JSON.parse(userObjFromStorage);
        return userData.email || `${DEFAULT_ROLE.toLowerCase()}@rolewise.app`;
    } catch (e) {
        return `${DEFAULT_ROLE.toLowerCase()}@rolewise.app`;
    }
})() : `${DEFAULT_ROLE.toLowerCase()}@rolewise.app`);
let quotationItems = [];
let isCreatingNewQuotation = true; // Track if we're creating a new quotation (true) or editing existing (false)
let itemsCurrentPage = 1;
const itemsPerPage = 5;
// Current type filter for Products table (items list)
let itemsCurrentTypeFilter = '';
// Track previous search filter to detect changes
let itemsPreviousSearchFilter = '';
let historyCurrentPage = 1;
const historyPerPage = 10;
let logsCurrentPage = 1;
const logsPerPage = 10;
let customersCurrentPage = 1;
const customersPerPage = 10;

function formatRupee(amount) {
    const numAmount = parseFloat(amount) || 0;
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(numAmount);
}

function toTitleCase(str) {
    return str.toLowerCase().split(' ').map(word => {
        return (word.charAt(0).toUpperCase() + word.slice(1));
    }).join(' ');
}

function generateUniqueId() {
    return Date.now().toString().slice(3) + Math.random().toString(36).substring(2, 6).toUpperCase();
}

async function generateProductId() {
    // Get all existing items to check for duplicates
    const items = await getItems();
    const existingIds = new Set(items.map(item => item.productId || item.id));
    
    let attempts = 0;
    const maxAttempts = 100; // Prevent infinite loop
    
    while (attempts < maxAttempts) {
        const today = new Date();
        const dateStr = today.toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' }).replace(/\//g, '');
        const timeStr = today.toLocaleTimeString('en-IN', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' }).replace(/:/g, '');
        
        let productId = `P${dateStr}${timeStr}`;
        
        // If ID exists, add a random suffix
        if (existingIds.has(productId)) {
            const randomSuffix = Math.random().toString(36).substring(2, 6).toUpperCase();
            productId = `P${dateStr}${timeStr}${randomSuffix}`;
        }
        
        // Check again with suffix if needed, or if still exists, try with different suffix
        if (!existingIds.has(productId)) {
            return productId;
        }
        
        attempts++;
    }
    
    // Fallback: use timestamp + random if all attempts failed
    const today = new Date();
    const dateStr = today.toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' }).replace(/\//g, '');
    const timeStr = today.toLocaleTimeString('en-IN', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' }).replace(/:/g, '');
    const randomSuffix = Math.random().toString(36).substring(2, 8).toUpperCase();
    return `P${dateStr}${timeStr}${randomSuffix}`;
}

// --- Cache Management Functions ---
/**
 * Clears browser cache for static resources (runs asynchronously without blocking)
 * This helps prevent stale cache issues without affecting page performance
 */
function clearCacheAsync() {
    // Use requestIdleCallback if available, otherwise setTimeout for non-blocking execution
    const runWhenIdle = window.requestIdleCallback || ((cb) => setTimeout(cb, 100));
    
    runWhenIdle(() => {
        try {
            // Clear service worker cache if present
            if ('serviceWorker' in navigator && 'caches' in window) {
                caches.keys().then(cacheNames => {
                    cacheNames.forEach(cacheName => {
                        caches.delete(cacheName).catch(() => {});
                    });
                }).catch(() => {});
            }
            
            // Clear application cache (if used)
            if (window.applicationCache) {
                try {
                    window.applicationCache.update();
                } catch (e) {}
            }
            
            // Force reload of cached resources by adding timestamp to links (only if needed)
            // This is done silently in the background
            console.log('Cache cleared successfully');
        } catch (error) {
            // Silently fail - cache clearing is not critical
            console.debug('Cache clearing completed with minor issues:', error);
        }
    });
}

/**
 * Adds cache-busting parameter to API requests when needed
 * Only adds if cache issues are detected (can be toggled)
 */
function getCacheBustingParam() {
    // Only add cache-busting if explicitly needed (can be controlled)
    // For production, you might want to disable this and rely on proper cache headers
    return ''; // Disabled by default for performance
}

// --- API Helper Functions ---
async function apiFetch(endpoint, options = {}) {
    try {
        // Ensure credentials (cookies/sessions) are sent with requests
        const fetchOptions = {
            ...options,
            credentials: 'include'  // Send cookies with cross-origin requests
        };
        
        // Add cache-busting if needed (disabled by default for performance)
        const cacheParam = getCacheBustingParam();
        const url = `${API_BASE}${endpoint}${cacheParam}`;
        
        const response = await fetch(url, fetchOptions);
        
        // Check content type before parsing
        const contentType = response.headers.get("content-type");
        const isJson = contentType && contentType.includes("application/json");
        
        if (!response.ok) {
            // Try to parse error response as JSON
            if (isJson) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.error || errorData.message || `API Error: ${response.statusText}`);
            } else {
                // Non-JSON error response (likely HTML error page)
                throw new Error(`Server error (${response.status}): ${response.statusText}`);
            }
        }
        
        // Parse success response
        if (isJson) {
            return await response.json();
        } else {
            // Non-JSON success response (shouldn't happen for API endpoints)
            throw new Error("Server returned non-JSON response");
        }
    } catch (error) {
        alert(error.message);
        throw error;
    }
}

async function getItems() {
    const response = await apiFetch('/items');
    // API returns {success: true, data: [...]} or just the array
    return Array.isArray(response) ? response : (response.data || []);
}

async function getQuotations() {
    const response = await apiFetch('/quotations');
    // API returns {success: true, data: [...]} or just the array
    return Array.isArray(response) ? response : (response.data || []);
}

async function getLogs() {
    const response = await apiFetch('/logs');
    // API returns {success: true, data: [...]} or just the array
    return Array.isArray(response) ? response : (response.data || []);
}

async function getGstRules() {
    const response = await apiFetch('/gst_rules');
    // API returns {success: true, data: [...]} or just the array
    return Array.isArray(response) ? response : (response.data || []);
}

async function getSettings() {
    return await apiFetch('/settings');
}

async function addLog(action, userRole, details) {
    try {
        await fetch(`${API_BASE}/logs`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                action,
                role: userRole,
                details,
                user: CURRENT_USER_EMAIL.split('@')[0]
            })
        });
        updateSummary(); // Update summary after log added
    } catch (e) {
        // Silent fail for log addition
    }
}

// --- Role & Permissions Management ---
function switchRole(newRole) {
    if (USER_ROLES.includes(newRole)) {
        CURRENT_USER_ROLE = newRole;
        CURRENT_USER_EMAIL = `${newRole.toLowerCase()}@rolewise.app`;
        localStorage.setItem(LS_KEYS.role, newRole);
        localStorage.setItem(LS_KEYS.user, CURRENT_USER_EMAIL);
        applyRoleRestrictions();
        initializeDashboard();
        const userRoleDisplay = document.getElementById('userRoleDisplay');
        const userEmailDisplay = document.getElementById('userEmailDisplay');
        const userAvatar = document.getElementById('userAvatar');
        const headerTitle = document.getElementById('headerTitle');
        if (userRoleDisplay) userRoleDisplay.textContent = newRole;
        if (userEmailDisplay) userEmailDisplay.textContent = CURRENT_USER_EMAIL;
        if (userAvatar) userAvatar.textContent = newRole.charAt(0).toUpperCase();
        if (headerTitle) headerTitle.textContent = `${newRole} Dashboard`;
        addLog('Role Switched', newRole, `Switched to role: ${newRole}`);
    }
}

function applyRoleRestrictions() {
    const isAdmin = CURRENT_USER_ROLE === 'Admin';
    const isOwnerOrAdmin = AUTHORIZED_TO_VIEW_LOGS.includes(CURRENT_USER_ROLE);
    const isAuthorizedToEditItems = AUTHORIZED_TO_EDIT_ITEMS.includes(CURRENT_USER_ROLE);
    const isAuthorizedToViewCustomers = AUTHORIZED_TO_VIEW_CUSTOMERS.includes(CURRENT_USER_ROLE);

    const navViewLogs = document.getElementById('navViewLogs');
    const navSettings = document.getElementById('navSettings');
    const navViewCustomers = document.getElementById('navViewCustomers');
    const tabViewLogs = document.getElementById('tabViewLogs');
    const tabSettings = document.getElementById('tabSettings');
    const tabViewCustomers = document.getElementById('tabViewCustomers');
    const summaryLogsCard = document.getElementById('summaryLogsCard');
    const addItem = document.getElementById('addItem');

    // Admin has superior access to all features
    if (navViewLogs) navViewLogs.style.display = (isAdmin || isOwnerOrAdmin) ? 'flex' : 'none';
    if (navSettings) navSettings.style.display = (isAdmin || isOwnerOrAdmin) ? 'flex' : 'none';
    if (navViewCustomers) navViewCustomers.style.display = (isAdmin || isAuthorizedToViewCustomers) ? 'flex' : 'none';
    if (tabViewLogs) tabViewLogs.style.display = (isAdmin || isOwnerOrAdmin) ? 'block' : 'none';
    if (tabSettings) tabSettings.style.display = (isAdmin || isOwnerOrAdmin) ? 'block' : 'none';
    if (tabViewCustomers) tabViewCustomers.style.display = (isAdmin || isAuthorizedToViewCustomers) ? 'block' : 'none';
    // Admin has superior access to all stat cards - ensure Activity Logs card is always visible for Admin
    if (summaryLogsCard) summaryLogsCard.style.display = (isAdmin || isOwnerOrAdmin) ? 'block' : 'none';
    if (addItem) addItem.style.display = (isAdmin || isAuthorizedToEditItems) ? 'block' : 'none';

    document.querySelectorAll('.delete-log-btn').forEach(btn => {
        btn.style.display = AUTHORIZED_TO_DELETE_LOGS.includes(CURRENT_USER_ROLE) ? 'inline-block' : 'none';
    });
}

// --- Data Manipulation ---
async function saveItem(event) {
    event.preventDefault();

    const form = event.target;
    const productId = form.elements['product-id'].value;
    const itemUrl = form.elements['item-url'].value;
    const productName = form.elements['product-name'].value;
    const type = form.elements['type'].value;
    const price = parseFloat(form.elements['price'].value);
    const gst = form.elements['gst'] ? parseFloat(form.elements['gst'].value) || null : null;
    const description = form.elements['description'].value;
    const addedBy = CURRENT_USER_EMAIL.split('@')[0];

    if (!AUTHORIZED_TO_EDIT_ITEMS.includes(CURRENT_USER_ROLE)) {
        alert('You are not authorized to add/edit products.');
        addLog('Unauthorized Attempt', CURRENT_USER_ROLE, `Tried to add/edit product: ${productName}`);
        return;
    }

    const payload = {
        productId,
        itemUrl,
        productName,
        type,
        price,
        description,
        addedBy
    };
    
    if (gst !== null && !isNaN(gst)) {
        payload.gst = gst;
    }

    const submitBtn = document.querySelector('#addItemForm button[type="submit"]');
    const isUpdate = submitBtn.textContent === 'Update Product';

    try {
        if (isUpdate) {
            await apiFetch(`/items/${productId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            alert('Product updated successfully!');
        } else {
            await apiFetch('/items', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            alert('Product added successfully!');
        }

        // Create/update GST rule if GST is provided
        if (gst !== null && !isNaN(gst) && gst >= 0) {
            try {
                await apiFetch('/gst_rules', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ productName: productName, percent: gst })
                });
            } catch (gstError) {
                // GST rule creation failed, but product was saved - log but don't block
                console.warn('Failed to create GST rule:', gstError);
            }
        }

        form.reset();
        document.getElementById('product-id').value = await generateProductId();
        resetAddProductForm(); // Reset validation and reload dynamic data
        updateSummary(); // Update overview summary
        showSection('itemsList');
        document.querySelector('#sideNav a[data-tab="itemsList"]').click();
        renderItemsList(); // Refresh list
    } catch (error) {
        // Error handled in apiFetch
    }
}

async function deleteItem(productId) {
    if (!confirm(`Are you sure you want to delete product ID ${productId}?`)) return;

    if (!AUTHORIZED_TO_EDIT_ITEMS.includes(CURRENT_USER_ROLE)) {
        alert('You are not authorized to delete products.');
        addLog('Unauthorized Attempt', CURRENT_USER_ROLE, `Tried to delete product: ${productId}`);
        return;
    }

    try {
        await apiFetch(`/items/${productId}`, { method: 'DELETE' });
        renderItemsList();
        updateSummary();
    } catch (error) {
        // Handled
    }
}

async function editItem(productId) {
    if (!AUTHORIZED_TO_EDIT_ITEMS.includes(CURRENT_USER_ROLE)) {
        alert('You are not authorized to edit products.');
        return;
    }

    try {
        const items = await getItems();
        const item = items.find(i => i.productId === productId);

        if (item) {
            // Populate modal form fields
            document.getElementById('edit-product-id').value = item.productId;
            document.getElementById('edit-item-url').value = item.itemUrl || '';
            document.getElementById('edit-product-name').value = item.productName || '';
            document.getElementById('edit-type').value = item.type || '';
            document.getElementById('edit-price').value = item.price || '';
            document.getElementById('edit-description').value = item.description || '';
            
            // Fetch and populate GST rate
            try {
                const gstRate = await getGstRateForItem(item.productName);
                const gstInput = document.getElementById('edit-gst');
                if (gstInput) {
                    gstInput.value = gstRate || '';
                }
            } catch (e) {
                // GST not found or error - try to use item's GST value
                const gstInput = document.getElementById('edit-gst');
                if (gstInput && item.gst) {
                    gstInput.value = item.gst;
                }
            }

            // Clear validation messages
            const editNameValidation = document.getElementById('edit-product-name-validation');
            if (editNameValidation) editNameValidation.innerHTML = '';
            const editNameInput = document.getElementById('edit-product-name');
            if (editNameInput) editNameInput.style.borderColor = '';

            // Show modal
            const modal = document.getElementById('editProductModal');
            if (modal) {
                modal.style.display = 'block';
            }
        } else {
            alert('Product not found.');
        }
    } catch (e) {
        console.error('Error loading product for edit:', e);
        alert('Failed to load product details.');
    }
}

async function handleItemEditReset() {
    const submitBtn = document.querySelector('#addItemForm button[type="submit"]');
    submitBtn.textContent = 'Add Product';
    document.getElementById('product-id').value = await generateProductId();
}

// Handle edit product modal form submission
async function saveEditProduct(event) {
    event.preventDefault();

    if (!AUTHORIZED_TO_EDIT_ITEMS.includes(CURRENT_USER_ROLE)) {
        alert('You are not authorized to edit products.');
        return;
    }

    const form = event.target;
    const productId = form.elements['edit-product-id'].value;
    const itemUrl = form.elements['edit-item-url'].value.trim();
    const productName = form.elements['edit-product-name'].value.trim();
    const type = form.elements['edit-type'].value;
    const price = parseFloat(form.elements['edit-price'].value);
    const gst = form.elements['edit-gst'] ? parseFloat(form.elements['edit-gst'].value) || null : null;
    const description = form.elements['edit-description'].value;

    // Validate URL format - only accept proper URLs with http:// or https://
    let isValidUrl = false;
    
    try {
        const urlObj = new URL(itemUrl);
        // Only accept http or https protocols
        isValidUrl = urlObj.protocol === 'http:' || urlObj.protocol === 'https:';
        
        // Additional validation: must have a valid hostname
        if (isValidUrl) {
            const hostname = urlObj.hostname;
            // Hostname must contain at least one dot (for TLD) and valid characters
            const hostnamePattern = /^([\da-z]([\da-z-]*[\da-z])?\.)+[a-z]{2,}$/i;
            isValidUrl = hostnamePattern.test(hostname) && hostname.length > 0;
        }
    } catch (e) {
        // URL constructor failed - not a valid URL
        isValidUrl = false;
    }

    if (!isValidUrl) {
        alert('Invalid URL format. Please enter a valid URL starting with http:// or https:// (e.g., https://example.com)');
        return;
    }

    // Validate product name uniqueness (excluding current product)
    const items = await getItems();
    const duplicate = items.find(item => {
        // Exclude current product
        if (item.productId === productId || item.id === productId) {
            return false;
        }
        return item.productName && item.productName.toLowerCase() === productName.toLowerCase();
    });

    if (duplicate) {
        alert(`Product name already exists (ID: ${duplicate.productId || duplicate.id}). Please choose a different name.`);
        return;
    }
    
    // Ensure addedBy is just the email prefix
    let addedBy = CURRENT_USER_EMAIL;
    if (addedBy && addedBy.includes('@')) {
        addedBy = addedBy.split('@')[0];
    } else {
        addedBy = addedBy || 'unknown';
    }

    const payload = {
        productId,
        itemUrl,
        productName,
        type,
        price,
        description,
        addedBy
    };
    
    if (gst !== null && !isNaN(gst)) {
        payload.gst = gst;
    }

    const submitBtn = form.querySelector('button[type="submit"]');
    const originalBtnText = submitBtn.textContent;
    submitBtn.disabled = true;
    submitBtn.textContent = 'Updating...';

    try {
        await apiFetch(`/items/${productId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        // Create/update GST rule if GST is provided
        if (gst !== null && !isNaN(gst) && gst >= 0) {
            try {
                await apiFetch('/gst_rules', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ productName: productName, percent: gst })
                });
            } catch (gstError) {
                console.warn('Failed to create GST rule:', gstError);
            }
        }

        // Save to temp table when price or GST is edited
        try {
            await apiFetch('/temp', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
        } catch (tempError) {
            console.warn('Failed to save to temp table:', tempError);
        }

        alert('Product updated successfully!');
        
        // Close modal
        const modal = document.getElementById('editProductModal');
        if (modal) {
            modal.style.display = 'none';
        }
        
        // Refresh the items list
        renderItemsList();
    } catch (error) {
        const errorMessage = error.message || error.toString();
        alert(`Error updating product: ${errorMessage}`);
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = originalBtnText;
    }
}

// Close edit product modal
function closeEditProductModal() {
    const modal = document.getElementById('editProductModal');
    if (modal) {
        modal.style.display = 'none';
    }
    // Clear validation messages
    const editNameValidation = document.getElementById('edit-product-name-validation');
    if (editNameValidation) editNameValidation.innerHTML = '';
    const editNameInput = document.getElementById('edit-product-name');
    if (editNameInput) editNameInput.style.borderColor = '';
}

// Initialize edit product modal event handlers
function initEditProductModal() {
    const modal = document.getElementById('editProductModal');
    if (!modal) return;

    // Close on background click
    modal.onclick = (e) => {
        if (e.target === modal) {
            closeEditProductModal();
        }
    };

    // Close on Escape key
    document.addEventListener('keydown', function escapeHandler(e) {
        if (e.key === 'Escape' && modal.style.display === 'block') {
            closeEditProductModal();
        }
    });
}

// --- CSV Handling ---
async function exportItemsToCsv() {
    window.location.href = `${API_BASE}/export/items`;
    addLog('Exported Data', CURRENT_USER_ROLE, 'Exported all product data to CSV');
}

async function handleCsvImport(event) {
    if (!AUTHORIZED_TO_EDIT_ITEMS.includes(CURRENT_USER_ROLE)) {
        alert('You are not authorized to import products.');
        return;
    }

    const file = event.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);

    try {
        const res = await fetch(`${API_BASE}/import/items`, {
            method: 'POST',
            headers: {
                'X-User-Email': CURRENT_USER_EMAIL
            },
            body: formData
        });
        
        // Check content type before parsing
        const contentType = res.headers.get("content-type");
        const isJson = contentType && contentType.includes("application/json");
        
        if (!res.ok) {
            // Try to parse error response
            if (isJson) {
                const errorData = await res.json().catch(() => ({}));
                throw new Error(errorData.error || errorData.message || 'Import failed');
            } else {
                // Handle JSONP or text response
                const textResponse = await res.text();
                try {
                    // Try to parse as JSONP
                    if (textResponse.includes('(') && textResponse.includes(')')) {
                        const jsonMatch = textResponse.match(/\(({.*})\)/);
                        if (jsonMatch && jsonMatch[1]) {
                            const errorData = JSON.parse(jsonMatch[1]);
                            throw new Error(errorData.error || errorData.message || 'Import failed');
                        }
                    }
                    // Try to parse as JSON
                    const errorData = JSON.parse(textResponse);
                    throw new Error(errorData.error || errorData.message || 'Import failed');
                } catch (parseError) {
                    throw new Error(`Import failed: ${res.statusText}`);
                }
            }
        }
        
        // Parse success response
        let data;
        if (isJson) {
            data = await res.json();
        } else {
            const textResponse = await res.text();
            // Handle JSONP response
            if (textResponse.includes('(') && textResponse.includes(')')) {
                const jsonMatch = textResponse.match(/\(({.*})\)/);
                if (jsonMatch && jsonMatch[1]) {
                    data = JSON.parse(jsonMatch[1]);
                } else {
                    throw new Error('Invalid response format');
                }
            } else {
                data = JSON.parse(textResponse);
            }
        }
        
        // Extract data from response (backend returns {success: true, data: {...}})
        const result = data.data || data;
        const imported = result.imported || 0;
        const updated = result.updated || 0;
        const total = result.total || (imported + updated);

        alert(`CSV import complete. ${imported} products imported, ${updated} products updated (${total} total).`);
        renderItemsList();
        updateSummary();
        
        // Reset file input
        event.target.value = '';
    } catch (error) {
        alert(error.message || 'Failed to import CSV file. Please try again.');
    }
}

// --- Customer Management ---
async function renderCustomersList() {
    const quotationsResponse = await getQuotations();
    // Handle API response format - ensure we have an array
    const quotations = Array.isArray(quotationsResponse) ? quotationsResponse : (quotationsResponse?.data || []);
    
    const customersMap = new Map();

    if (Array.isArray(quotations)) {
    quotations.forEach(q => {
            const phone = q.customer?.phone || q.customerPhone;
        if (!phone) return;

        const newCustomerData = {
                name: q.customer?.name || q.customerName || 'N/A',
                email: q.customer?.email || q.customerEmail || 'N/A',
            phone: phone,
                address: q.customer?.address || q.customerAddress || 'N/A',
                lastQuotationDate: q.dateCreated || q.created_at || 'N/A'
        };
        customersMap.set(phone, newCustomerData);
    });
    }

    const customers = Array.from(customersMap.values());
    const body = document.getElementById('customersListBody');
    const customersTable = document.getElementById('customersTable');
    const paginationDiv = document.getElementById('customersPagination');
    if (!body) return;
    
    body.innerHTML = '';

    if (customers.length === 0) {
        body.innerHTML = '<tr><td colspan="5" class="muted" style="text-align:center">No customer data available.</td></tr>';
        if (customersTable) customersTable.style.display = 'none';
        if (paginationDiv) paginationDiv.style.display = 'none';
        return;
    }

    if (customersTable) customersTable.style.display = 'table';
    if (paginationDiv) paginationDiv.style.display = 'flex';

    customers.sort((a, b) => {
        try {
            const dateA = new Date(a.lastQuotationDate);
            const dateB = new Date(b.lastQuotationDate);
            return dateB - dateA; // Most recent first
        } catch (e) {
            return 0;
        }
    });

    // Calculate pagination
    const totalPages = Math.ceil(customers.length / customersPerPage);
    const startIndex = (customersCurrentPage - 1) * customersPerPage;
    const endIndex = startIndex + customersPerPage;
    const paginatedCustomers = customers.slice(startIndex, endIndex);

    // Update pagination controls
    updateCustomersPaginationControls(totalPages, customers.length);

    paginatedCustomers.forEach(customer => {
        const row = body.insertRow();
        row.insertCell().textContent = customer.name || 'N/A';
        row.insertCell().textContent = customer.email || 'N/A';
        row.insertCell().textContent = customer.phone || 'N/A';
        row.insertCell().textContent = customer.address || 'N/A';
        row.insertCell().textContent = customer.lastQuotationDate;
    });
}

function updateCustomersPaginationControls(totalPages, totalItems) {
    const pageNumbersDiv = document.getElementById('customersPageNumbers');
    const nextBtn = document.getElementById('customersNextBtn');
    const prevBtn = document.getElementById('customersPrevBtn');
    const pageInfo = document.getElementById('customersPageInfo');

    if (pageNumbersDiv) {
        pageNumbersDiv.innerHTML = '';
        
        if (totalPages === 0) {
            if (pageInfo) pageInfo.textContent = '';
            return;
        }

        // Update page info
        if (pageInfo) {
            const startItem = (customersCurrentPage - 1) * customersPerPage + 1;
            const endItem = Math.min(customersCurrentPage * customersPerPage, totalItems);
            pageInfo.textContent = `Page ${customersCurrentPage} of ${totalPages} • Showing ${startItem}-${endItem} of ${totalItems}`;
        }

        // Show up to 7 page numbers with ellipsis
        const maxPagesToShow = 7;
        let startPage, endPage;
        let showStartEllipsis = false;
        let showEndEllipsis = false;
        
        if (totalPages <= maxPagesToShow) {
            // Show all pages if 7 or fewer
            startPage = 1;
            endPage = totalPages;
        } else {
            // Calculate which pages to show
            if (customersCurrentPage <= 4) {
                // Show first pages
                startPage = 1;
                endPage = maxPagesToShow - 1;
                showEndEllipsis = true;
            } else if (customersCurrentPage >= totalPages - 3) {
                // Show last pages
                startPage = totalPages - (maxPagesToShow - 2);
                endPage = totalPages;
                showStartEllipsis = true;
            } else {
                // Show pages around current
                startPage = customersCurrentPage - 2;
                endPage = customersCurrentPage + 2;
                showStartEllipsis = true;
                showEndEllipsis = true;
            }
        }

        // Add first page and ellipsis if needed
        if (showStartEllipsis) {
            const firstBtn = document.createElement('button');
            firstBtn.className = 'pagination-page-btn';
            firstBtn.textContent = '1';
            firstBtn.onclick = () => {
                customersCurrentPage = 1;
                renderCustomersList();
            };
            pageNumbersDiv.appendChild(firstBtn);

            const ellipsis = document.createElement('div');
            ellipsis.className = 'pagination-ellipsis';
            ellipsis.textContent = '...';
            pageNumbersDiv.appendChild(ellipsis);
        }

        // Add page number buttons
        for (let i = startPage; i <= endPage; i++) {
            const pageBtn = document.createElement('button');
            pageBtn.className = 'pagination-page-btn';
            if (i === customersCurrentPage) {
                pageBtn.classList.add('active');
            }
            pageBtn.textContent = i;
            
            pageBtn.onclick = () => {
                customersCurrentPage = i;
                renderCustomersList();
            };
            
            pageNumbersDiv.appendChild(pageBtn);
        }

        // Add last page and ellipsis if needed
        if (showEndEllipsis) {
            const ellipsis = document.createElement('div');
            ellipsis.className = 'pagination-ellipsis';
            ellipsis.textContent = '...';
            pageNumbersDiv.appendChild(ellipsis);

            const lastBtn = document.createElement('button');
            lastBtn.className = 'pagination-page-btn';
            lastBtn.textContent = totalPages;
            lastBtn.onclick = () => {
                customersCurrentPage = totalPages;
                renderCustomersList();
            };
            pageNumbersDiv.appendChild(lastBtn);
        }
    }

    // Update Previous and Next buttons
    if (prevBtn) {
        prevBtn.disabled = customersCurrentPage <= 1;
    }
    if (nextBtn) {
        nextBtn.disabled = customersCurrentPage >= totalPages;
    }
}

function goToCustomersPage(direction) {
    const body = document.getElementById('customersListBody');
    if (!body) return;
    
    customersCurrentPage += direction;
    if (customersCurrentPage < 1) customersCurrentPage = 1;
    
    // Get total pages to limit max page
    getQuotations().then(quotations => {
        const customersMap = new Map();
        quotations.forEach(q => {
            const phone = q.customer?.phone;
            if (!phone) return;
            const newCustomerData = {
                name: q.customer?.name || null,
                email: q.customer?.email || null,
                phone: phone,
                address: q.customer?.address || null,
                lastQuotationDate: q.dateCreated
            };
            customersMap.set(phone, newCustomerData);
        });
        const customers = Array.from(customersMap.values());
        const totalPages = Math.ceil(customers.length / customersPerPage);
        if (customersCurrentPage > totalPages) customersCurrentPage = totalPages;
        renderCustomersList();
    });
}

async function getCustomerByPhone(phoneNumber) {
    const quotations = await getQuotations();
    const mostRecentQuote = quotations
        .slice()
        .sort((a, b) => new Date(b.dateCreated) - new Date(a.dateCreated))
        .find(q => q.customer?.phone === phoneNumber);

    return mostRecentQuote ? mostRecentQuote.customer : null;
}

// --- GST Rule Management ---
async function getGstRateForItem(itemName) {
    const rulesResponse = await getGstRules();
    const settingsResponse = await getSettings();
    
    // Handle API response format
    const rules = Array.isArray(rulesResponse) ? rulesResponse : (rulesResponse?.data || []);
    const settings = settingsResponse?.data || settingsResponse || {};
    const defaultGst = settings.defaultGst || 18;

    const rule = Array.isArray(rules) ? rules.find(r => r.productName.toLowerCase() === itemName.toLowerCase()) : null;
    return rule ? parseFloat(rule.percent) : parseFloat(defaultGst);
}


// --- Quotation Creation Logic ---
function getQuotationItems() {
    return quotationItems;
}

// Dynamic type filters for "Add Items to Quotation"
async function renderQuotationTypeFilters() {
    const container = document.getElementById('quotationTypeFilters');
    if (!container) return;

    let types = [];
    try {
        const items = await getItems();
        types = [...new Set(items.map(item => item.type).filter(Boolean))]
            .sort((a, b) => a.localeCompare(b, 'en-IN', { sensitivity: 'base' }));
    } catch (error) {
        // Silent fail; we'll still render base types
    }

    const baseTypes = [
        { label: 'All', value: '' },
        { label: 'MONITOR', value: 'monitor' },
        { label: 'KEYBOARD&MOUSE', value: 'keyboard&mouse' },
        { label: 'ACCESSORIES', value: 'accessories' },
        { label: 'UPS', value: 'ups' },
        { label: 'LAPTOP', value: 'laptop' },
        { label: 'PRINTERS', value: 'printers' },
        { label: 'NETWORKING PRODUCTS', value: 'networking products' },
        { label: 'OTHERS', value: 'others' }
    ];

    const baseValues = new Set(baseTypes.map(t => String(t.value).toLowerCase()));
    const extraTypes = types.filter(t => !baseValues.has(String(t).toLowerCase()));

    container.innerHTML = '';

    function createButton(label, value, isActive) {
        const btn = document.createElement('button');
        btn.className = 'type-filter-btn';
        if (isActive) btn.classList.add('active');
        btn.dataset.type = value;
        btn.textContent = label;
        // Match existing inline styles
        btn.style.padding = '6px 12px';
        btn.style.border = '1px solid var(--border)';
        btn.style.borderRadius = '6px';
        btn.style.background = '#fff';
        btn.style.cursor = 'pointer';
        btn.style.fontSize = '12px';
        btn.style.transition = 'all 0.2s';
        return btn;
    }

    // Base categories (including "All")
    baseTypes.forEach(t => {
        const isActive = t.value === ''; // "All" active by default
        container.appendChild(createButton(t.label, t.value, isActive));
    });

    // Additional categories from Type dropdown / item types
    extraTypes.forEach(t => {
        const label = toTitleCase(String(t));
        const value = String(t).toLowerCase();
        container.appendChild(createButton(label, value, false));
    });
}

async function renderAvailableItemsForQuotation(filter = '', typeFilter = '') {
    const items = await getItems();
    const listDiv = document.getElementById('availableItemsList');
    listDiv.innerHTML = '';

    const normalizedFilter = filter.toLowerCase();
    const normalizedTypeFilter = typeFilter.toLowerCase();
    const filteredItems = items.filter(item => {
        const matchesSearch = !normalizedFilter || 
            item.productName.toLowerCase().includes(normalizedFilter) ||
            item.productId.toLowerCase().includes(normalizedFilter);
        let matchesType = true;
        if (normalizedTypeFilter) {
            const productType = (item.type || '').toLowerCase();
            
            // Handle special category matching
            if (normalizedTypeFilter === 'keyboard&mouse' || normalizedTypeFilter === 'keyboard and mouse') {
                matchesType = productType.includes('keyboard') || productType.includes('mouse') || 
                             productType === 'keyboard&mouse' || productType === 'keyboard and mouse';
            } else if (normalizedTypeFilter === 'networking products' || normalizedTypeFilter === 'networking') {
                matchesType = productType.includes('networking') || productType.includes('network') ||
                             productType === 'networking products' || productType === 'networking';
            } else if (normalizedTypeFilter === 'others' || normalizedTypeFilter === 'other') {
                // Match if type is "others", "other", or doesn't match specific categories
                matchesType = productType === 'others' || productType === 'other' || 
                             productType.includes('other');
            } else {
                // Exact match or contains match for other categories
                matchesType = productType === normalizedTypeFilter || productType.includes(normalizedTypeFilter);
            }
        }
        return matchesSearch && matchesType;
    });

    if (filteredItems.length === 0) {
        listDiv.innerHTML = '<p class="muted" style="padding:10px;text-align:center">No products found matching your search.</p>';
        return;
    }

    filteredItems.forEach(item => {
        const itemDiv = document.createElement('div');
        itemDiv.style.cssText = 'display:flex; justify-content:space-between; align-items:center; padding:10px; border-bottom:1px solid #f2f6fb;';

        itemDiv.innerHTML = `
                    <div>
                        <strong>${item.productName}</strong> <span class="muted" style="font-size:12px">(${item.productId})</span>
                        <div style="font-size:13px;">${formatRupee(item.price)}</div>
                    </div>
                    <button class="btn primary" onclick="addItemToQuotation('${item.productId}')"><i class="fas fa-plus"></i> Add</button>
                `;
        listDiv.appendChild(itemDiv);
    });
}

async function addItemToQuotation(productId) {
    // Always use items table for create quotation section (not temp table)
    const items = await getItems();
    const itemToAdd = items.find(item => item.productId === productId);

    if (!itemToAdd) return;

    const existingQuoteItem = quotationItems.find(qi => qi.productId === productId);

    if (existingQuoteItem) {
        existingQuoteItem.quantity++;
    } else {
        // Get GST rate from GST rules or settings
        const gstRate = await getGstRateForItem(itemToAdd.productName);
        const price = parseFloat(itemToAdd.price || 0);
        
        quotationItems.push({
            productId: itemToAdd.productId,
            productName: itemToAdd.productName,
            price: price,
            quantity: 1,
            gstRate: gstRate,
            description: itemToAdd.description,
        });
    }

    renderQuotationItems();
    updateGrandTotal();
}

function removeItemFromQuotation(productId) {
    quotationItems = quotationItems.filter(item => item.productId !== productId);
    renderQuotationItems();
    updateGrandTotal();
}

function updateItemQuantity(productId, newQuantity) {
    const item = quotationItems.find(qi => qi.productId === productId);
    if (item) {
        item.quantity = parseInt(newQuantity) || 1;
        if (item.quantity <= 0) {
            removeItemFromQuotation(productId);
            return;
        }
    }
    renderQuotationItems();
    updateGrandTotal();
}

async function updateItemPrice(productId, newPrice) {
    const item = quotationItems.find(qi => qi.productId === productId);
    if (item) {
        const parsedPrice = parseFloat(newPrice) || 0;
        if (parsedPrice < 0) {
            item.price = 0;
        } else {
            item.price = parsedPrice;
        }
    }
    
    // Save edited price to temp table (for history)
    // Only revert to items table value if editing an existing quotation (not during creation)
    if (AUTHORIZED_TO_EDIT_ITEMS.includes(CURRENT_USER_ROLE)) {
        try {
            // Fetch current item data to get all required fields
            const items = await getItems();
            const dbItem = items.find(i => i.productId === productId);
            
            if (dbItem && item) {
                let addedBy = CURRENT_USER_EMAIL;
                if (addedBy && addedBy.includes('@')) {
                    addedBy = addedBy.split('@')[0];
                } else {
                    addedBy = addedBy || 'unknown';
                }
                
                // Calculate GST amount from current GST rate
                const parsedPrice = parseFloat(newPrice) || 0;
                const gstAmount = parsedPrice * (parseFloat(item.gstRate || 0) / 100);
                const totalPrice = parsedPrice;
                
                // Save edited value to temp table only (for history viewing)
                await apiFetch('/temp', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        productId: dbItem.productId,
                        itemUrl: dbItem.itemUrl || '',
                        productName: dbItem.productName,
                        type: dbItem.type || '',
                        price: parsedPrice,
                        gst: gstAmount,
                        totalPrice: totalPrice,
                        description: dbItem.description || '',
                        addedBy: addedBy
                    })
                });
                
                // Only revert quotation item back to items table value if NOT creating a new quotation
                // (i.e., only revert when editing an existing quotation)
                if (!isCreatingNewQuotation) {
                    item.price = parseFloat(dbItem.price || 0);
                }
            }
        } catch (error) {
            console.error('Failed to save to temp table:', error);
        }
    }
    
    renderQuotationItems();
    updateGrandTotal();
}

async function updateItemGstRate(productId, newGstRate) {
    // Save edited GST to temp table (for history), but keep using items table value in quotation
    if (AUTHORIZED_TO_EDIT_ITEMS.includes(CURRENT_USER_ROLE)) {
        try {
            const items = await getItems();
            const dbItem = items.find(i => i.productId === productId);
            const item = quotationItems.find(qi => qi.productId === productId);
            
            if (dbItem && item) {
                let addedBy = CURRENT_USER_EMAIL;
                if (addedBy && addedBy.includes('@')) {
                    addedBy = addedBy.split('@')[0];
                } else {
                    addedBy = addedBy || 'unknown';
                }
                
                // Calculate GST amount and total price with edited GST rate
                const itemPrice = parseFloat(item.price || dbItem.price || 0);
                const editedGstRate = parseFloat(newGstRate) || 0;
                const gstAmount = itemPrice * (editedGstRate / 100);
                const totalPrice = itemPrice + gstAmount;
                
                // Save edited value to temp table only (for history viewing)
                await apiFetch('/temp', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        productId: dbItem.productId,
                        itemUrl: dbItem.itemUrl || '',
                        productName: dbItem.productName,
                        type: dbItem.type || '',
                        price: itemPrice,
                        gst: gstAmount,
                        totalPrice: totalPrice,
                        description: dbItem.description || '',
                        addedBy: addedBy
                    })
                });
                
                // Revert quotation item GST rate back to items table value (get from GST rules)
                const originalGstRate = await getGstRateForItem(dbItem.productName);
                item.gstRate = originalGstRate;
            }
        } catch (tempError) {
            console.warn('Failed to save to temp table:', tempError);
        }
    }
    
    renderQuotationItems();
    updateGrandTotal();
}

function renderQuotationItems() {
    const body = document.getElementById('quotationItemsBody');
    body.innerHTML = '';

    if (quotationItems.length === 0) {
        body.innerHTML = '<tr id="quotationNoItemsRow"><td colspan="6" class="muted" style="text-align:center">No items added yet.</td></tr>';
        return;
    }

    quotationItems.forEach(item => {
        const itemTotal = item.price * item.quantity;
        const itemGstAmount = itemTotal * (item.gstRate / 100);
        const total = itemTotal + itemGstAmount; // Total including GST
        const row = body.insertRow();

        row.insertCell().innerHTML = `<strong>${item.productName}</strong><br><span class="muted" style="font-size:12px">${item.description || 'No description'}</span>`;

        const qtyCell = row.insertCell();
        qtyCell.innerHTML = `<input type="number" value="${item.quantity}" min="1" style="width:50px; padding:5px; border-radius:4px; border:1px solid var(--border);" onchange="updateItemQuantity('${item.productId}', this.value)">`;

        const priceCell = row.insertCell();
        priceCell.innerHTML = `<input type="number" value="${item.price}" min="0" step="0.01" style="width:80px; padding:5px; border-radius:4px; border:1px solid var(--border); text-align:right;" onchange="updateItemPrice('${item.productId}', this.value)">`;
        row.insertCell().textContent = formatRupee(total);

        const gstCell = row.insertCell();
        gstCell.innerHTML = `<input type="number" value="${item.gstRate}" min="0" max="50" style="width:50px; padding:5px; border-radius:4px; border:1px solid var(--border);" onchange="updateItemGstRate('${item.productId}', this.value)">`;

        const actionsCell = row.insertCell();
        const removeBtn = document.createElement('button');
        removeBtn.className = 'btn danger';
        removeBtn.style.padding = '5px 8px';
        removeBtn.innerHTML = '<i class="fas fa-trash-alt"></i>';
        removeBtn.onclick = () => removeItemFromQuotation(item.productId);
        actionsCell.appendChild(removeBtn);
    });
}

function updateGrandTotal() {
    const items = getQuotationItems();
    let subTotal = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);

    const discountPercent = parseFloat(document.getElementById('discount-percent')?.value || 0);

    let discountAmount = (subTotal * (discountPercent / 100));
    let totalAfterDiscount = subTotal - discountAmount;

    let totalGstAmount = items.reduce((sum, item) => {
        const itemTotal = item.price * item.quantity;
        const itemGstRate = item.gstRate;
        const itemGstAmount = itemTotal * (itemGstRate / 100);
        return sum + itemGstAmount;
    }, 0);

    let grandTotal = totalAfterDiscount + totalGstAmount;

    const subTotalDisplay = document.getElementById('subTotalDisplay');
    const discountAmountDisplay = document.getElementById('discountAmountDisplay');
    const gstAmountDisplay = document.getElementById('gstAmountDisplay');
    const grandTotalDisplay = document.getElementById('grandTotalDisplay');
    if (subTotalDisplay) subTotalDisplay.textContent = formatRupee(subTotal);
    if (discountAmountDisplay) discountAmountDisplay.textContent = formatRupee(discountAmount);
    if (gstAmountDisplay) gstAmountDisplay.textContent = formatRupee(totalGstAmount);
    if (grandTotalDisplay) grandTotalDisplay.textContent = formatRupee(grandTotal);
}

async function createQuotation() {
    if (!AUTHORIZED_TO_CREATE_QUOTATIONS.includes(CURRENT_USER_ROLE)) {
        alert('You are not authorized to create quotations.');
        return;
    }

    const customerName = document.getElementById('cust-name')?.value.trim() || null;
    const phoneNumber = document.getElementById('phone-number')?.value.trim();
    const customerEmail = document.getElementById('cust-email')?.value.trim() || null;
    const customerAddress = document.getElementById('cust-address')?.value.trim() || null;
    const items = getQuotationItems();

    // Validate customer name length if provided
    if (customerName && customerName.length > 255) {
        alert('Customer name must be 255 characters or less.');
        return;
    }

    // Validate phone number (mandatory)
    if (!phoneNumber || phoneNumber.length !== 10) {
        alert('Please enter a valid 10-digit phone number for the customer.');
        return;
    }

    // Validate email if provided
    if (customerEmail && customerEmail.length > 0) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(customerEmail)) {
            alert('Please enter a valid email address or leave it empty.');
            return;
        }
    }

    if (items.length === 0) {
        alert('Please add at least one item to the quotation.');
        return;
    }

    // FIRST: Save all current quotation items to temp table before creating quotation
    // This ensures temp table has all the latest values before download
    try {
        const allItems = await getItems();
        let addedBy = CURRENT_USER_EMAIL;
        if (addedBy && addedBy.includes('@')) {
            addedBy = addedBy.split('@')[0];
        } else {
            addedBy = addedBy || 'unknown';
        }

        // Save each quotation item to temp table with current values
        const savePromises = items.map(async (item) => {
            const dbItem = allItems.find(i => i.productId === item.productId);
            if (dbItem) {
                const itemPrice = parseFloat(item.price || 0);
                const itemGstRate = parseFloat(item.gstRate || 0);
                const gstAmount = itemPrice * (itemGstRate / 100);
                const totalPrice = itemPrice;

                try {
                    await apiFetch('/temp', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            productId: dbItem.productId,
                            itemUrl: dbItem.itemUrl || '',
                            productName: dbItem.productName,
                            type: dbItem.type || '',
                            price: itemPrice,
                            gst: gstAmount,
                            totalPrice: totalPrice,
                            description: dbItem.description || '',
                            addedBy: addedBy
                        })
                    });
                } catch (saveError) {
                    console.warn(`Failed to save item ${item.productId} to temp table:`, saveError);
                }
            }
        });

        // Wait for all items to be saved to temp table before proceeding
        await Promise.all(savePromises);
    } catch (error) {
        console.warn('Failed to save items to temp table before creating quotation:', error);
        // Continue anyway - temp table might already have the values
    }

    // NOW: Fetch temp items and update prices before calculating totals
    // IMPORTANT: Preserve the order of items as they appear in quotationItems array
    // This order matches what the user sees in the Quotation Items section
    let updatedItems = [...items];
    try {
        const tempItemsResponse = await apiFetch('/temp');
        const tempItems = Array.isArray(tempItemsResponse) ? tempItemsResponse : (tempItemsResponse?.data || []);
        const tempItemsMap = new Map(tempItems.map(item => [item.productId, item]));
        
        // Update items with temp table data if available
        // Using map() preserves the original order from quotationItems array
        updatedItems = items.map(item => {
            const tempItem = tempItemsMap.get(item.productId);
            if (tempItem) {
                const tempPrice = parseFloat(tempItem.price || 0);
                const tempGst = parseFloat(tempItem.gst || 0);
                const tempTotalPrice = parseFloat(tempItem.totalPrice || 0);
                
                // Calculate GST rate: if gst is amount, convert to percentage; if already percentage, use as is
                let gstRate = item.gstRate || 0;
                if (tempGst > 0 && tempPrice > 0) {
                    // If gst is less than price, it's likely a percentage amount, convert to percentage
                    if (tempGst < tempPrice) {
                        gstRate = (tempGst / tempPrice) * 100;
                    } else {
                        // If gst is larger, it might already be a percentage value
                        gstRate = tempGst;
                    }
                }
                
                return {
                    ...item,
                    productId: tempItem.productId,
                    productName: tempItem.productName || item.productName,
                    price: tempPrice || tempTotalPrice || item.price,
                    gstRate: gstRate,
                    quantity: item.quantity || 1
                };
            }
            return item;
        });
    } catch (error) {
        console.warn('Failed to fetch temp items, using original items:', error);
        // Continue with original items if temp fetch fails
    }

    // Recalculate totals using updated items (from temp table if available)
    let subTotal = updatedItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const discountPercent = parseFloat(document.getElementById('discount-percent')?.value || 0);
    let discountAmount = (subTotal * (discountPercent / 100));
    let totalGstAmount = updatedItems.reduce((sum, item) => {
        return sum + (item.price * item.quantity * (item.gstRate / 100));
    }, 0);
    let grandTotal = (subTotal - discountAmount) + totalGstAmount;

    // Prepare items for API (remove description field as it's not in schema)
    const itemsForApi = updatedItems.map(item => ({
        productId: String(item.productId || item.id),
        productName: String(item.productName || item.name),
        price: String(parseFloat(item.price || 0).toFixed(2)),
        quantity: parseInt(item.quantity || 1),
        gstRate: String(parseFloat(item.gstRate || 0).toFixed(2))
    }));

    const payload = {
        quotationId: (await generateProductId()).replace('P', 'Q'),
        dateCreated: new Date().toLocaleDateString('en-IN'),
        customer: {
            name: customerName || null,
            phone: phoneNumber,
            email: customerEmail || null,
            address: customerAddress || null
        },
        items: itemsForApi,
        subTotal: String(parseFloat(subTotal).toFixed(2)),
        discountPercent: String(parseFloat(discountPercent).toFixed(2)),
        discountAmount: String(parseFloat(discountAmount).toFixed(2)),
        totalGstAmount: String(parseFloat(totalGstAmount).toFixed(2)),
        grandTotal: String(parseFloat(grandTotal).toFixed(2)),
        createdBy: CURRENT_USER_EMAIL.split('@')[0]
    };

    try {
        const res = await apiFetch('/quotations', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        // Extract data from response if needed
        const quotationData = res.data || res;
        
        // Ensure all numeric fields are properly parsed
        if (quotationData) {
            // IMPORTANT: Replace items with updated items (from temp table) before generating PNG
            // This ensures the downloaded quotation uses temp table prices, not items table prices
            // Preserve the original order from quotationItems array
            quotationData.items = itemsForApi.map(item => ({
                productId: item.productId,
                productName: item.productName,
                price: parseFloat(item.price),
                quantity: item.quantity,
                gstRate: parseFloat(item.gstRate)
            }));
            
            // Update totals to match the updated items (from temp table)
            quotationData.subTotal = subTotal;
            quotationData.discountAmount = discountAmount;
            quotationData.discountPercent = discountPercent;
            quotationData.totalGstAmount = totalGstAmount;
            quotationData.grandTotal = grandTotal;
        }
        
        // Download as PNG
        await downloadQuotationAsPngDirect(quotationData);

        // Reset
        quotationItems = [];
        isCreatingNewQuotation = true; // Reset to create mode for next quotation
        document.getElementById('cust-name').value = '';
        document.getElementById('phone-number').value = '';
        document.getElementById('cust-email').value = '';
        document.getElementById('cust-address').value = '';
        const discountPercentInput = document.getElementById('discount-percent');
        if (discountPercentInput) discountPercentInput.value = '0';
        const customerDetailsDisplay = document.getElementById('customer-details-display');
        if (customerDetailsDisplay) customerDetailsDisplay.innerHTML = '';
        renderQuotationItems();
        updateGrandTotal();
        document.getElementById('itemSearchInput').value = '';
        renderAvailableItemsForQuotation();

        alert('Quotation created successfully!');
    } catch (e) {
        // Handled
    }
}

// --- PDF Generation Logic ---
async function generateQuotationPdf(quotation) {
    const templateHtml = await generateQuotationHtml(quotation);
    const pdfTemplate = document.getElementById('quotationPdfTemplate');
    
    if (!pdfTemplate) {
        alert('PDF template element not found.');
        return;
    }

    // Set template content
    pdfTemplate.innerHTML = templateHtml;
    
    // Validate template has content
    if (!pdfTemplate.innerHTML || pdfTemplate.innerHTML.trim() === '') {
        alert('PDF template is empty. Cannot generate PDF.');
        return;
    }
    
    // Make template visible but off-screen for html2canvas
    const originalDisplay = pdfTemplate.style.display;
    const originalPosition = pdfTemplate.style.position;
    const originalLeft = pdfTemplate.style.left;
    const originalTop = pdfTemplate.style.top;
    const originalWidth = pdfTemplate.style.width;
    const originalZIndex = pdfTemplate.style.zIndex;
    const originalOpacity = pdfTemplate.style.opacity;
    const originalTransform = pdfTemplate.style.transform;
    
    // Position off-screen but visible to html2canvas
    pdfTemplate.style.display = 'block';
    pdfTemplate.style.position = 'fixed';
    pdfTemplate.style.left = '-9999px';
    pdfTemplate.style.top = '0';
    pdfTemplate.style.width = '800px';
    pdfTemplate.style.zIndex = '9999';
    pdfTemplate.style.opacity = '1';
    pdfTemplate.style.visibility = 'visible';
    pdfTemplate.style.pointerEvents = 'none';

    // Wait for content to render, especially images and fonts
    // Wait for images to load before capturing
    const images = pdfTemplate.querySelectorAll('img');
    const imagePromises = Array.from(images).map(img => {
        if (img.complete) return Promise.resolve();
        return new Promise((resolve, reject) => {
            img.onload = resolve;
            img.onerror = resolve; // Continue even if image fails
            setTimeout(resolve, 2000); // Timeout after 2 seconds
        });
    });
    
    await Promise.all(imagePromises);
    // Additional wait for background images and rendering
    await new Promise(resolve => setTimeout(resolve, 1000));

    try {
        const canvas = await html2canvas(pdfTemplate, { 
            scale: 2, 
            logging: false, 
            useCORS: true,
            allowTaint: true,
            backgroundColor: '#1a1a1a', // Dark background to match template
            width: 800,
            height: pdfTemplate.scrollHeight || pdfTemplate.offsetHeight,
            x: 0,
            y: 0,
            scrollX: 0,
            scrollY: 0,
            onclone: (clonedDoc) => {
                // Ensure background image is visible in cloned document (page-fixed)
                const clonedElement = clonedDoc.querySelector('#quotationPdfTemplate > div');
                if (clonedElement) {
                    clonedElement.style.backgroundImage = "url('../images/Quotation_bg_design.png')";
                    clonedElement.style.backgroundSize = "contain";
                    clonedElement.style.backgroundPosition = "center center";
                    clonedElement.style.backgroundRepeat = "no-repeat";
                    clonedElement.style.backgroundAttachment = "fixed";
                }
            }
        });
        
        if (!canvas || canvas.width === 0 || canvas.height === 0) {
            throw new Error('Canvas is empty');
        }
        
        // Always use A4 size
        const imgWidth = 595.28; // A4 width in pt
        const pageHeight = 841.89; // A4 height in pt (minimum)
        const imgHeight = (canvas.height * imgWidth) / canvas.width;
        
        // Create A4 document
        const doc = new window.jspdf.jsPDF({
            unit: 'pt',
            format: 'a4',
            compress: true
        });

        const imgData = canvas.toDataURL('image/png', 1.0);
        
        // Check if we need multiple pages (more than 7 items or content exceeds one page)
        const itemsCount = quotation.items ? (Array.isArray(quotation.items) ? quotation.items.length : 0) : 0;
        const needsMultiplePages = itemsCount > 7 || imgHeight > pageHeight;
        
        if (needsMultiplePages) {
            // Multi-page logic
        let heightLeft = imgHeight;
        let position = 0;

            doc.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;

        while (heightLeft >= 0) {
            position = heightLeft - imgHeight;
            doc.addPage();
                doc.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
            heightLeft -= pageHeight;
            }
        } else {
            // Single page - always use full A4 height (minimum)
            // If content is shorter, it will be centered or positioned at top, but page is always A4 height
            const contentHeight = Math.min(imgHeight, pageHeight);
            doc.addImage(imgData, 'PNG', 0, 0, imgWidth, contentHeight, undefined, 'FAST');
        }

        // Get customer name for filename
        const customer = quotation?.customer || {};
        const customerName = customer?.name || customer?.phone || quotation?.quotationId || quotation?.id || 'Unknown';
        // Sanitize filename: remove special characters, replace spaces with underscores
        const sanitizedName = customerName.toString().replace(/[^a-zA-Z0-9_ ]/g, '').replace(/\s+/g, '_').replace(/__+/g, '_').trim() || 'Quotation';
        const filename = `Quotation_${sanitizedName}.pdf`;
        
        doc.save(filename);
        
        // Restore original styles
        pdfTemplate.style.display = originalDisplay || '';
        pdfTemplate.style.position = originalPosition || '';
        pdfTemplate.style.left = originalLeft || '';
        pdfTemplate.style.top = originalTop || '';
        pdfTemplate.style.width = originalWidth || '';
        pdfTemplate.style.zIndex = originalZIndex || '';
        pdfTemplate.style.visibility = '';
        pdfTemplate.style.opacity = originalOpacity || '';
        pdfTemplate.style.transform = originalTransform || '';
    } catch (error) {
        console.error('PDF generation error:', error);
        alert("PDF generation failed. Please try again.");
        
        // Restore original styles
        pdfTemplate.style.display = originalDisplay || '';
        pdfTemplate.style.position = originalPosition || '';
        pdfTemplate.style.left = originalLeft || '';
        pdfTemplate.style.top = originalTop || '';
        pdfTemplate.style.width = originalWidth || '';
        pdfTemplate.style.zIndex = originalZIndex || '';
        pdfTemplate.style.visibility = '';
        pdfTemplate.style.opacity = originalOpacity || '';
        pdfTemplate.style.transform = originalTransform || '';
    }
}

async function generateQuotationHtml(quotation) {
    if (!quotation) {
        console.error('Quotation data is missing');
        return '<div>Error: Quotation data not available</div>';
    }
    
    const settings = await getSettings();
    const logoBase64 = settings.logo || '';
    const brandName = settings.brand || 'TECHTITANS';
    const companyGstId = settings.companyGstId || 'N/A';
    const validityDays = quotation.validityDays || settings.validityDays || 3;
    
    // Company details - using defaults if not in settings
    const companyAddress = settings.companyAddress || '1102, second Floor, Before Atithi Satkar Hotel OTC Road, Bangalore 560002';
    const companyEmail = settings.companyEmail || 'advanceinfotech21@gmail.com';

    // Ensure numeric values are parsed
    let subTotal = parseFloat(quotation.subTotal || 0);
    let discountAmount = parseFloat(quotation.discountAmount || 0);
    const discountPercent = parseFloat(quotation.discountPercent || 0);
    let totalGstAmount = parseFloat(quotation.totalGstAmount || 0);
    let grandTotal = parseFloat(quotation.grandTotal || 0);
    let totalAfterDiscount = subTotal - discountAmount;

    const customer = quotation.customer || {};
    // IMPORTANT: Preserve the order of items as they appear in the quotation
    // The order should match the order in the Quotation Items section
    let items = Array.isArray(quotation.items) ? [...quotation.items] : [];
    
    // Fetch temp items and replace quotation items with temp table data
    let priceUpdated = false;
    try {
        const tempItemsResponse = await apiFetch('/temp');
        const tempItems = Array.isArray(tempItemsResponse) ? tempItemsResponse : (tempItemsResponse?.data || []);
        const tempItemsMap = new Map(tempItems.map(item => [item.productId, item]));
        
        // Replace items with temp table data if available, otherwise keep original
        // Using map() preserves the original order of items
        items = items.map(item => {
            const tempItem = tempItemsMap.get(item.productId);
            if (tempItem) {
                // Use temp table data completely
                priceUpdated = true;
                const tempPrice = parseFloat(tempItem.price || 0);
                const tempGst = parseFloat(tempItem.gst || 0);
                const tempTotalPrice = parseFloat(tempItem.totalPrice || 0);
                
                // Calculate GST rate: if gst is amount, convert to percentage; if already percentage, use as is
                let gstRate = item.gstRate || 0;
                if (tempGst > 0 && tempPrice > 0) {
                    // If gst is less than price, it's likely a percentage amount, convert to percentage
                    if (tempGst < tempPrice) {
                        gstRate = (tempGst / tempPrice) * 100;
                    } else {
                        // If gst is larger, it might already be a percentage value
                        gstRate = tempGst;
                    }
                }
                
                return {
                    ...item,
                    productId: tempItem.productId,
                    productName: tempItem.productName || item.productName,
                    price: tempPrice || tempTotalPrice || item.price,
                    gstRate: gstRate,
                    quantity: item.quantity || 1
                };
            }
            return item;
        });
    } catch (error) {
        console.warn('Failed to fetch temp items, using original items:', error);
    }
    
    // ALWAYS recalculate totals from items array (using temp table data if available)
    // This ensures downloaded quotation uses updated values from temp table, not items table
    const newSubTotal = items.reduce((sum, item) => {
        const itemPrice = parseFloat(item.price || 0);
        const itemQuantity = parseInt(item.quantity || 1);
        return sum + (itemPrice * itemQuantity);
    }, 0);
    const newDiscountAmount = (newSubTotal * discountPercent) / 100;
    const newTotalAfterDiscount = newSubTotal - newDiscountAmount;
    const newTotalGstAmount = items.reduce((sum, item) => {
        const itemPrice = parseFloat(item.price || 0);
        const itemQuantity = parseInt(item.quantity || 1);
        const itemGstRate = parseFloat(item.gstRate || 0) / 100;
        return sum + (itemPrice * itemQuantity * itemGstRate);
    }, 0);
    const newGrandTotal = newTotalAfterDiscount + newTotalGstAmount;
    
    // Update totals with recalculated values
    subTotal = newSubTotal;
    discountAmount = newDiscountAmount;
    totalAfterDiscount = newTotalAfterDiscount;
    totalGstAmount = newTotalGstAmount;
    grandTotal = newGrandTotal;
    
    // Ensure quotation ID and date are available
    const quotationId = quotation.quotationId || quotation.id || 'N/A';
    const dateCreated = quotation.dateCreated || new Date().toLocaleDateString('en-IN');

    return `
                <div style="width: 800px; height: 1123px; margin: 0; background: #1a1a1a; background-image: url('images/Quotation_bg_design.png'); background-size: contain; background-position: center center; background-repeat: no-repeat; background-attachment: fixed; font-family: Arial, sans-serif; padding: 0; position: relative;">
                    <style>
                        @page {
                            size: A4;
                            margin: 0;
                            background: url('images/Quotation_bg_design.png') no-repeat center center;
                            background-size: contain;
                        }
                        .pdf-table { width: calc(100% - 40px); border-collapse: collapse; margin: 0 20px; border: none; }
                        .pdf-table th { 
                            background: rgba(138, 43, 226, 0.3); 
                            color: #ffffff; 
                            font-weight: bold; 
                            padding: 12px 15px; 
                            text-align: left; 
                            border: none; 
                            border-bottom: 2px solid rgba(255, 105, 180, 0.5);
                            border-right: 1px solid rgba(255, 255, 255, 0.1);
                        }
                        .pdf-table td { 
                            background: rgba(138, 43, 226, 0.2); 
                            color: #ffffff; 
                            padding: 12px 15px; 
                            text-align: left; 
                            border: none; 
                            border-bottom: 1px solid rgba(255, 255, 255, 0.1);
                            border-right: 1px solid rgba(255, 255, 255, 0.1);
                        }
                        .pdf-table tbody tr:hover {
                            background: rgba(138, 43, 226, 0.3) !important;
                        }
                        .text-right { text-align: right !important; }
                        .pdf-table{
                        margin-top: 5px;
                        font-size: 12px;
                        }
                    </style>
                    
                    <!-- Logo -->
                    <div style="position: absolute; top: 0; left: 0; z-index: 10; margin-top: 0px;">
                        <img src="images/logo_white.png" alt="Logo" style="width: 180px; height: auto;">
                    </div>

                    <!-- Company Info -->
                    <div style="position: absolute; top: 0; right: 0; z-index: 10; margin-top: 10px; margin-right: 10px;">
                        <img src="images/company_info.png" alt="Logo" style="width: 220px; height: auto;">
                    </div>

                    <!-- Title -->
                    <div style="text-align: center; margin: 0; padding-top: 40px;">
                        <h2 style="margin: 0; font-size: 35px; font-weight: bold; color: #ff69b4;">QUOTATION</h2>
                    </div>

                    <!-- Company Info -->
                    <!-- Customer and Quotation Info -->
                    <div style="margin-top: 50px; padding: 20px; padding-top: 0px; color: #ffffff;">
                        <div style="display: flex; justify-content: space-between;">
                            <div>
                                <strong style="color: #ff69b4; font-size: 18px;">Quotation To:</strong><br>
                                <span style="color: #ffffff;">${customer?.name || 'N/A'}</span><br>
                                ${customer?.phone ? `<span style="color: #ffffff;">${customer.phone}</span><br>` : ''}
                                ${customer?.email ? `<span style="color: #ffffff;">${customer.email}</span><br>` : ''}
                                ${customer?.address ? `<span style="color: #ffffff;">${customer.address}</span><br>` : ''}
                            </div>
                            <div style="text-align: right;">
                                <strong style="color: #ff69b4;">Date:</strong> <span style="color: #ffffff;">${dateCreated}</span>
                            </div>
                        </div>
                    </div>

                    <!-- Products Table -->
                    <table class="pdf-table">
                        <thead>
                            <tr>
                                <th>Description</th>
                                <th class="text-right">Qty</th>
                                <th class="text-right">Unit Price</th>
                                <th class="text-right">Total</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${items.length > 0 ? items.map(item => {
                                const itemPrice = parseFloat(item.price || 0);
                                const itemQuantity = parseInt(item.quantity || 1);
                                const itemTotal = itemPrice * itemQuantity;
                                return `
                                    <tr>
                                        <td>${item.productName || 'N/A'}</td>
                                        <td class="text-right">${itemQuantity}</td>
                                        <td class="text-right">${formatRupee(itemPrice)}</td>
                                        <td class="text-right">${formatRupee(itemTotal)}</td>
                                    </tr>
                                `;
                            }).join('') : '<tr><td colspan="4" style="text-align: center; padding: 20px; color: #ffffff; background: rgba(138, 43, 226, 0.2);">No products added</td></tr>'}
                        </tbody>
                    </table>

                    <!-- Pricing Summary -->
                    <div style="margin: 0; padding: 20px; text-align: right; color: #ffffff;">
                        <div style="display: inline-block; width: 300px;">
                            <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                                <span style="color: #ffffff;">Subtotal (Excl. GST):</span>
                                <span style="color: #ffffff;">${formatRupee(totalAfterDiscount)}</span>
                            </div>
                            <div style="display: flex; justify-content: space-between; margin-top: 10px; padding-top: 15px; border-top: 2px solid #ff69b4; font-weight: bold; font-size: 16px;">
                                <span style="color: #ff69b4;">TOTAL:</span>
                                <span style="color: #ffa500; font-size: 18px;">${formatRupee(grandTotal)}</span>
                            </div>
                            <div style="text-align: right; margin-top: 4px;">
                                <span style="color: #ffffff; font-size: 11px; opacity: 0.8;">(inclusive of GST)</span>
                            </div>
                        </div>
                    </div>

                    <!-- Footer Note -->
                    <div style="position: absolute; bottom: 0; left: 0; right: 0; padding: 20px; font-size: 16px; color: #ffffff; text-align: center; opacity: 0.8;">
                        <p style="margin: 0;">All prices are valid for <strong style="color: #ff69b4;">${validityDays} days</strong> from the date of quotation.</p>
                        <p style="margin: 5px 0 0 0;">"<strong style="color: #ff69b4;">Free</strong> pan India warranty" • <strong style="color: #ff69b4;">3-year</strong> call support <strong style="color: #ffa500;">Monday to Saturday 12pm to 7pm</strong></p>
                        <p style="margin: 5px 0 0 0;">All products from <strong style="color: #ff69b4;">direct manufacture</strong> or <strong style="color: #ff69b4;">store warranty</strong></p>
                    </div>
                </div>
    `;
}

// --- PNG Download Logic ---
async function downloadQuotationAsPng(quotation) {
    const content = document.getElementById('quotationViewContent');
    
    if (!content) {
        alert('Quotation content not found.');
        return;
    }

    // Get the quotation div inside the content
    const quotationDiv = content.querySelector('div[style*="width: 800px"]');
    
    if (!quotationDiv) {
        alert('Quotation template not found in modal.');
        return;
    }

    try {
        // Show loading
        const downloadBtn = document.getElementById('downloadQuotationPng');
        const originalBtnText = downloadBtn?.textContent;
        if (downloadBtn) {
            downloadBtn.disabled = true;
            downloadBtn.textContent = 'Generating...';
        }

        // Wait for images to load
        const images = quotationDiv.querySelectorAll('img');
        const imagePromises = Array.from(images).map(img => {
            if (img.complete) return Promise.resolve();
            return new Promise((resolve, reject) => {
                img.onload = resolve;
                img.onerror = resolve;
                setTimeout(resolve, 2000);
            });
        });
        
        await Promise.all(imagePromises);
        await new Promise(resolve => setTimeout(resolve, 500));

        // Capture as canvas
        const canvas = await html2canvas(quotationDiv, { 
            scale: 2, 
            logging: false, 
            useCORS: true,
            allowTaint: true,
            backgroundColor: '#1a1a1a',
            width: 800,
            height: quotationDiv.scrollHeight || quotationDiv.offsetHeight,
            x: 0,
            y: 0,
            scrollX: 0,
            scrollY: 0,
            onclone: (clonedDoc) => {
                // Ensure background image is visible in cloned document
                const clonedElement = clonedDoc.querySelector('div[style*="width: 800px"]');
                if (clonedElement) {
                    clonedElement.style.backgroundImage = "url('../images/Quotation_bg_design.png')";
                    clonedElement.style.backgroundSize = "contain";
                    clonedElement.style.backgroundPosition = "center center";
                    clonedElement.style.backgroundRepeat = "no-repeat";
                    clonedElement.style.backgroundAttachment = "fixed";
                }
            }
        });
        
        if (!canvas || canvas.width === 0 || canvas.height === 0) {
            throw new Error('Canvas is empty');
        }

        // Convert to PNG and download
        const imgData = canvas.toDataURL('image/png', 1.0);
        const link = document.createElement('a');
        
        // Generate filename
        const customerName = quotation.customer?.name || quotation.customerName || 'Quotation';
        const sanitizedName = customerName.toString().replace(/[^a-zA-Z0-9]/g, '_').replace(/_+/g, '_').trim();
        const quotationId = quotation.quotationId || quotation.id || 'N/A';
        const filename = `Quotation_${sanitizedName}_${quotationId}.png`;
        
        link.href = imgData;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        // Restore button
        if (downloadBtn) {
            downloadBtn.disabled = false;
            downloadBtn.textContent = originalBtnText;
        }
    } catch (error) {
        console.error('PNG generation error:', error);
        alert('Failed to generate PNG image. Please try again.');
        
        // Restore button
        const downloadBtn = document.getElementById('downloadQuotationPng');
        if (downloadBtn) {
            downloadBtn.disabled = false;
            downloadBtn.textContent = '<i class="fas fa-image"></i> PNG';
        }
    }
}

// --- History / Logs / Dashboard Rendering ---
async function renderItemsList(filter = '') {
    const items = await getItems();
    const body = document.getElementById('itemsListBody');
    const noItemsMessage = document.getElementById('noItemsMessage');
    body.innerHTML = '';

    const normalizedFilter = (filter || '').toLowerCase();
    const typeFilter = (itemsCurrentTypeFilter || '').toLowerCase();

    const filteredItems = items.filter(item => {
        const name = (item.productName || '').toLowerCase();
        const id = (item.productId || '').toLowerCase();
        const itemType = (item.type || '').toLowerCase();

        const matchesSearch =
            !normalizedFilter ||
            name.includes(normalizedFilter) ||
            id.includes(normalizedFilter);

        let matchesType = true;
        if (typeFilter) {
            // Handle special category matching
            if (typeFilter === 'keyboard&mouse' || typeFilter === 'keyboard and mouse') {
                matchesType = itemType.includes('keyboard') || itemType.includes('mouse') || 
                             itemType === 'keyboard&mouse' || itemType === 'keyboard and mouse';
            } else if (typeFilter === 'networking products' || typeFilter === 'networking') {
                matchesType = itemType.includes('networking') || itemType.includes('network') ||
                             itemType === 'networking products' || itemType === 'networking';
            } else if (typeFilter === 'others' || typeFilter === 'other') {
                // Match if type is "others", "other", or doesn't match specific categories
                matchesType = itemType === 'others' || itemType === 'other' || 
                             itemType.includes('other');
            } else {
                // Exact match or contains match for other categories
                matchesType = itemType === typeFilter || itemType.includes(typeFilter);
            }
        }

        return matchesSearch && matchesType;
    });

    if (filteredItems.length === 0) {
        noItemsMessage.style.display = 'block';
        document.getElementById('itemsTable').style.display = 'none';
        const paginationDiv = document.getElementById('itemsPagination');
        if (paginationDiv) paginationDiv.style.display = 'none';
        return;
    }

    noItemsMessage.style.display = 'none';
    document.getElementById('itemsTable').style.display = 'table';
    const paginationDiv = document.getElementById('itemsPagination');
    if (paginationDiv) paginationDiv.style.display = 'flex';

    // Reset to page 1 only if filter actually changed
    if (filter !== itemsPreviousSearchFilter) {
        itemsCurrentPage = 1;
        itemsPreviousSearchFilter = filter;
    }

    // Calculate pagination
    const totalPages = Math.ceil(filteredItems.length / itemsPerPage);
    const startIndex = (itemsCurrentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const paginatedItems = filteredItems.slice(startIndex, endIndex);

    // Update pagination controls
    updateItemsPaginationControls(totalPages, filteredItems.length);

    const isAuthorizedToEdit = AUTHORIZED_TO_EDIT_ITEMS.includes(CURRENT_USER_ROLE);

    paginatedItems.forEach(item => {
        const row = body.insertRow();
        row.insertCell().textContent = item.productId;
        row.insertCell().textContent = item.productName;
        row.insertCell().textContent = item.type;
        row.insertCell().textContent = item.description;

        const urlCell = row.insertCell();
        urlCell.innerHTML = `<a href="${item.itemUrl}" target="_blank">${item.itemUrl.length > 30 ? item.itemUrl.substring(0, 30) + '...' : item.itemUrl} <i class="fas fa-external-link-alt link-icon"></i></a>`;

        // Price
        const priceCell = row.insertCell();
        const price = parseFloat(item.price) || 0;
        priceCell.textContent = formatRupee(price);
        priceCell.style.fontWeight = '500';

        // GST (%)
        const gstCell = row.insertCell();
        const gst = parseFloat(item.gst) || 0;
        gstCell.textContent = gst > 0 ? `${gst}%` : 'N/A';
        gstCell.style.fontWeight = '500';
        if (gst === 0) gstCell.classList.add('muted');

        // Total Value (GST-inclusive: Price + GST amount)
        const totalValueCell = row.insertCell();
        const totalValue = price + (price * gst / 100); // GST-inclusive total
        totalValueCell.textContent = formatRupee(totalValue);
        totalValueCell.style.fontWeight = '600';
        totalValueCell.style.color = '#27AE60';

        row.insertCell().textContent = item.addedBy;
        row.insertCell().textContent = item.dateAdded;

        const actionsCell = row.insertCell();
        if (isAuthorizedToEdit) {
            actionsCell.innerHTML += `
                        <button class="btn" style="padding: 5px 8px; margin-right: 5px;" onclick="editItem('${item.productId}')"><i class="fas fa-edit"></i></button>
                        <button class="btn danger" style="padding: 5px 8px;" onclick="deleteItem('${item.productId}')"><i class="fas fa-trash-alt"></i></button>
                    `;
        } else {
            actionsCell.textContent = 'No Actions';
        }
    });
}

function updateItemsPaginationControls(totalPages, totalItems) {
    const pageNumbersDiv = document.getElementById('itemsPageNumbers');
    const nextBtn = document.getElementById('itemsNextBtn');
    const prevBtn = document.getElementById('itemsPrevBtn');
    const pageInfo = document.getElementById('itemsPageInfo');

    if (pageNumbersDiv) {
        pageNumbersDiv.innerHTML = '';
        
        if (totalPages === 0) {
            if (pageInfo) pageInfo.textContent = '';
            return;
        }

        // Update page info
        if (pageInfo) {
            const startItem = (itemsCurrentPage - 1) * itemsPerPage + 1;
            const endItem = Math.min(itemsCurrentPage * itemsPerPage, totalItems);
            pageInfo.textContent = `Page ${itemsCurrentPage} of ${totalPages} • Showing ${startItem}-${endItem} of ${totalItems}`;
        }

        // Show up to 7 page numbers with ellipsis
        const maxPagesToShow = 7;
        let startPage, endPage;
        let showStartEllipsis = false;
        let showEndEllipsis = false;
        
        if (totalPages <= maxPagesToShow) {
            // Show all pages if 7 or fewer
            startPage = 1;
            endPage = totalPages;
        } else {
            // Calculate which pages to show
            if (itemsCurrentPage <= 4) {
                // Show first pages
                startPage = 1;
                endPage = maxPagesToShow - 1;
                showEndEllipsis = true;
            } else if (itemsCurrentPage >= totalPages - 3) {
                // Show last pages
                startPage = totalPages - (maxPagesToShow - 2);
                endPage = totalPages;
                showStartEllipsis = true;
            } else {
                // Show pages around current
                startPage = itemsCurrentPage - 2;
                endPage = itemsCurrentPage + 2;
                showStartEllipsis = true;
                showEndEllipsis = true;
            }
        }

        // Add first page and ellipsis if needed
        if (showStartEllipsis) {
            const firstBtn = document.createElement('button');
            firstBtn.className = 'pagination-page-btn';
            firstBtn.textContent = '1';
            firstBtn.onclick = () => {
                itemsCurrentPage = 1;
                const searchInput = document.getElementById('productListSearchInput');
                const filter = searchInput ? searchInput.value : '';
                renderItemsList(filter);
            };
            pageNumbersDiv.appendChild(firstBtn);

            const ellipsis = document.createElement('div');
            ellipsis.className = 'pagination-ellipsis';
            ellipsis.textContent = '...';
            pageNumbersDiv.appendChild(ellipsis);
        }

        // Add page number buttons
        for (let i = startPage; i <= endPage; i++) {
            const pageBtn = document.createElement('button');
            pageBtn.className = 'pagination-page-btn';
            if (i === itemsCurrentPage) {
                pageBtn.classList.add('active');
            }
            pageBtn.textContent = i;
            
            pageBtn.onclick = () => {
                itemsCurrentPage = i;
                const searchInput = document.getElementById('productListSearchInput');
                const filter = searchInput ? searchInput.value : '';
                renderItemsList(filter);
            };
            
            pageNumbersDiv.appendChild(pageBtn);
        }

        // Add last page and ellipsis if needed
        if (showEndEllipsis) {
            const ellipsis = document.createElement('div');
            ellipsis.className = 'pagination-ellipsis';
            ellipsis.textContent = '...';
            pageNumbersDiv.appendChild(ellipsis);

            const lastBtn = document.createElement('button');
            lastBtn.className = 'pagination-page-btn';
            lastBtn.textContent = totalPages;
            lastBtn.onclick = () => {
                itemsCurrentPage = totalPages;
                const searchInput = document.getElementById('productListSearchInput');
                const filter = searchInput ? searchInput.value : '';
                renderItemsList(filter);
            };
            pageNumbersDiv.appendChild(lastBtn);
        }
    }

    // Update Previous and Next buttons
    if (prevBtn) {
        prevBtn.disabled = itemsCurrentPage <= 1;
    }
    if (nextBtn) {
        nextBtn.disabled = itemsCurrentPage >= totalPages;
    }
}

async function goToItemsPage(direction) {
    const items = document.getElementById('itemsListBody');
    if (!items) return;

    const searchInput = document.getElementById('productListSearchInput');
    const filter = searchInput ? searchInput.value : '';
    
    // Get all items and filter them to calculate total pages
    const allItems = await getItems();
    const normalizedFilter = (filter || '').toLowerCase();
    const typeFilter = (itemsCurrentTypeFilter || '').toLowerCase();

    const filteredItems = allItems.filter(item => {
        const name = (item.productName || '').toLowerCase();
        const id = (item.productId || '').toLowerCase();
        const itemType = (item.type || '').toLowerCase();

        const matchesSearch =
            !normalizedFilter ||
            name.includes(normalizedFilter) ||
            id.includes(normalizedFilter);

        let matchesType = true;
        if (typeFilter) {
            // Handle special category matching
            if (typeFilter === 'keyboard&mouse' || typeFilter === 'keyboard and mouse') {
                matchesType = itemType.includes('keyboard') || itemType.includes('mouse') || 
                             itemType === 'keyboard&mouse' || itemType === 'keyboard and mouse';
            } else if (typeFilter === 'networking products' || typeFilter === 'networking') {
                matchesType = itemType.includes('networking') || itemType.includes('network') ||
                             itemType === 'networking products' || itemType === 'networking';
            } else if (typeFilter === 'others' || typeFilter === 'other') {
                // Match if type is "others", "other", or doesn't match specific categories
                matchesType = itemType === 'others' || itemType === 'other' || 
                             itemType.includes('other');
            } else {
                // Exact match or contains match for other categories
                matchesType = itemType === typeFilter || itemType.includes(typeFilter);
            }
        }

        return matchesSearch && matchesType;
    });

    // Calculate total pages for filtered results
    const totalPages = Math.ceil(filteredItems.length / itemsPerPage);
    
    // Update page number and validate it's within range
    itemsCurrentPage += direction;
    if (itemsCurrentPage < 1) itemsCurrentPage = 1;
    if (itemsCurrentPage > totalPages && totalPages > 0) itemsCurrentPage = totalPages;
    
    renderItemsList(filter);
    
    // Scroll to top of table
    const table = document.getElementById('itemsTable');
    if (table) {
        table.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
}

async function renderHistoryList() {
    const quotationsResponse = await getQuotations();
    // Handle API response format - ensure we have an array
    const quotations = Array.isArray(quotationsResponse) ? quotationsResponse : (quotationsResponse?.data || []);
    
    const body = document.getElementById('historyListBody');
    const noHistoryMessage = document.getElementById('noHistoryMessage');
    const historyTable = document.getElementById('historyTable');
    const paginationDiv = document.getElementById('historyPagination');
    if (!body) return;
    
    body.innerHTML = '';

    if (!Array.isArray(quotations) || quotations.length === 0) {
        if (noHistoryMessage) noHistoryMessage.style.display = 'block';
        if (historyTable) historyTable.style.display = 'none';
        if (paginationDiv) paginationDiv.style.display = 'none';
        return;
    }
    if (noHistoryMessage) noHistoryMessage.style.display = 'none';
    if (historyTable) historyTable.style.display = 'table';
    if (paginationDiv) paginationDiv.style.display = 'flex';

    quotations.sort((a, b) => {
        try {
            const dateA = new Date(a.dateCreated || a.created_at || 0);
            const dateB = new Date(b.dateCreated || b.created_at || 0);
            return dateB - dateA; // Most recent first
        } catch (e) {
            return 0;
        }
    });

    // Calculate pagination
    const totalPages = Math.ceil(quotations.length / historyPerPage);
    const startIndex = (historyCurrentPage - 1) * historyPerPage;
    const endIndex = startIndex + historyPerPage;
    const paginatedQuotations = quotations.slice(startIndex, endIndex);

    // Update pagination controls
    updateHistoryPaginationControls(totalPages, quotations.length);

    paginatedQuotations.forEach(quote => {
        const row = body.insertRow();
        row.insertCell().textContent = quote.quotationId || quote.id || 'N/A';
        const customerName = quote.customer?.name || quote.customerName || 'N/A';
        const customerPhone = quote.customer?.phone || quote.customerPhone || '';
        row.insertCell().textContent = customerName !== 'N/A' ? customerName : (customerPhone || 'N/A');
        row.insertCell().textContent = quote.dateCreated || quote.created_at || 'N/A';
        row.insertCell().textContent = formatRupee(parseFloat(quote.grandTotal) || 0);
        row.insertCell().textContent = (quote.items?.length || 0);
        row.insertCell().textContent = quote.createdBy || quote.created_by || 'N/A';

        const actionsCell = row.insertCell();
        actionsCell.innerHTML = `
                    <button class="btn primary" style="padding: 5px 8px; margin-right: 5px;" onclick="fetchQuotationAndGeneratePdf('${quote.quotationId || quote.id}')"><i class="fas fa-download"></i></button>
                    <button class="btn secondary" style="padding: 5px 8px; margin-right: 5px;" onclick="viewQuotationDetails('${quote.quotationId || quote.id}')"><i class="fas fa-eye"></i></button>
                    <button class="btn danger" style="padding: 5px 8px;" onclick="deleteQuotation('${quote.quotationId || quote.id}')"><i class="fas fa-trash-alt"></i></button>
                `;
    });
}

// Render dynamic type filter buttons for Products (items list)
async function renderItemsTypeFilters() {
    const container = document.getElementById('itemsTypeFilters');
    if (!container) return;

    let types = [];
    try {
        const items = await getItems();
        types = [...new Set(items.map(item => item.type).filter(Boolean))]
            .sort((a, b) => a.localeCompare(b, 'en-IN', { sensitivity: 'base' }));
    } catch (error) {
        // Silent fail, just show base types
    }

    const baseTypes = [
        { label: 'All', value: '' },
        { label: 'MONITOR', value: 'monitor' },
        { label: 'KEYBOARD&MOUSE', value: 'keyboard&mouse' },
        { label: 'ACCESSORIES', value: 'accessories' },
        { label: 'UPS', value: 'ups' },
        { label: 'LAPTOP', value: 'laptop' },
        { label: 'PRINTERS', value: 'printers' },
        { label: 'NETWORKING PRODUCTS', value: 'networking products' },
        { label: 'OTHERS', value: 'others' }
    ];

    const baseValues = new Set(baseTypes.map(t => String(t.value).toLowerCase()));
    const extraTypes = types.filter(t => !baseValues.has(String(t).toLowerCase()));

    container.innerHTML = '';

    function createButton(label, typeValue) {
        const btn = document.createElement('button');
        btn.className = 'items-type-filter-btn';
        btn.dataset.type = typeValue;
        btn.textContent = label;

        if ((!itemsCurrentTypeFilter && typeValue === '') ||
            (itemsCurrentTypeFilter && typeValue.toLowerCase() === itemsCurrentTypeFilter.toLowerCase())) {
            btn.classList.add('active');
        }

        btn.addEventListener('click', () => {
            itemsCurrentTypeFilter = typeValue || '';

            // Toggle active state
            container.querySelectorAll('.items-type-filter-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            // Reset to first page whenever filter changes
            itemsCurrentPage = 1;

            const searchInput = document.getElementById('productListSearchInput');
            const filter = searchInput ? searchInput.value.trim() : '';
            renderItemsList(filter);
        });

        return btn;
    }

    // Base categories (including "All")
    baseTypes.forEach(t => {
        container.appendChild(createButton(t.label, t.value));
    });

    // Additional categories from Type dropdown / item types
    extraTypes.forEach(type => {
        container.appendChild(createButton(type, type));
    });
}

function updateHistoryPaginationControls(totalPages, totalItems) {
    const pageNumbersDiv = document.getElementById('historyPageNumbers');
    const nextBtn = document.getElementById('historyNextBtn');
    const prevBtn = document.getElementById('historyPrevBtn');
    const pageInfo = document.getElementById('historyPageInfo');

    if (pageNumbersDiv) {
        pageNumbersDiv.innerHTML = '';
        
        if (totalPages === 0) {
            if (pageInfo) pageInfo.textContent = '';
            return;
        }

        // Update page info
        if (pageInfo) {
            const startItem = (historyCurrentPage - 1) * historyPerPage + 1;
            const endItem = Math.min(historyCurrentPage * historyPerPage, totalItems);
            pageInfo.textContent = `Page ${historyCurrentPage} of ${totalPages} • Showing ${startItem}-${endItem} of ${totalItems}`;
        }

        // Show up to 7 page numbers with ellipsis
        const maxPagesToShow = 7;
        let startPage, endPage;
        let showStartEllipsis = false;
        let showEndEllipsis = false;
        
        if (totalPages <= maxPagesToShow) {
            // Show all pages if 7 or fewer
            startPage = 1;
            endPage = totalPages;
        } else {
            // Calculate which pages to show
            if (historyCurrentPage <= 4) {
                // Show first pages
                startPage = 1;
                endPage = maxPagesToShow - 1;
                showEndEllipsis = true;
            } else if (historyCurrentPage >= totalPages - 3) {
                // Show last pages
                startPage = totalPages - (maxPagesToShow - 2);
                endPage = totalPages;
                showStartEllipsis = true;
            } else {
                // Show pages around current
                startPage = historyCurrentPage - 2;
                endPage = historyCurrentPage + 2;
                showStartEllipsis = true;
                showEndEllipsis = true;
            }
        }

        // Add first page and ellipsis if needed
        if (showStartEllipsis) {
            const firstBtn = document.createElement('button');
            firstBtn.className = 'pagination-page-btn';
            firstBtn.textContent = '1';
            firstBtn.onclick = () => {
                historyCurrentPage = 1;
                renderHistoryList();
            };
            pageNumbersDiv.appendChild(firstBtn);

            const ellipsis = document.createElement('div');
            ellipsis.className = 'pagination-ellipsis';
            ellipsis.textContent = '...';
            pageNumbersDiv.appendChild(ellipsis);
        }

        // Add page number buttons
        for (let i = startPage; i <= endPage; i++) {
            const pageBtn = document.createElement('button');
            pageBtn.className = 'pagination-page-btn';
            if (i === historyCurrentPage) {
                pageBtn.classList.add('active');
            }
            pageBtn.textContent = i;
            
            pageBtn.onclick = () => {
                historyCurrentPage = i;
                renderHistoryList();
            };
            
            pageNumbersDiv.appendChild(pageBtn);
        }

        // Add last page and ellipsis if needed
        if (showEndEllipsis) {
            const ellipsis = document.createElement('div');
            ellipsis.className = 'pagination-ellipsis';
            ellipsis.textContent = '...';
            pageNumbersDiv.appendChild(ellipsis);

            const lastBtn = document.createElement('button');
            lastBtn.className = 'pagination-page-btn';
            lastBtn.textContent = totalPages;
            lastBtn.onclick = () => {
                historyCurrentPage = totalPages;
                renderHistoryList();
            };
            pageNumbersDiv.appendChild(lastBtn);
        }
    }

    // Update Previous and Next buttons
    if (prevBtn) {
        prevBtn.disabled = historyCurrentPage <= 1;
    }
    if (nextBtn) {
        nextBtn.disabled = historyCurrentPage >= totalPages;
    }
}

function goToHistoryPage(direction) {
    const body = document.getElementById('historyListBody');
    if (!body) return;
    
    historyCurrentPage += direction;
    if (historyCurrentPage < 1) historyCurrentPage = 1;
    
    // Get total pages to limit max page
    getQuotations().then(quotations => {
        const totalPages = Math.ceil(quotations.length / historyPerPage);
        if (historyCurrentPage > totalPages) historyCurrentPage = totalPages;
        renderHistoryList();
    });
}

async function fetchQuotationAndGeneratePdf(quotationId) {
    try {
        const response = await apiFetch(`/quotations/${quotationId}`);
        let quotationData = null;
        
        // Extract quotation data from response (handle both wrapped and direct responses)
        if (Array.isArray(response)) {
            quotationData = response[0];
        } else if (response && response.data) {
            quotationData = response.data;
        } else if (response && (response.quotationId || response.id)) {
            quotationData = response;
        }
        
        if (!quotationData) {
            alert('Quotation data not found in response');
            return;
        }
        
        // Download as PNG instead of PDF
        await downloadQuotationAsPngDirect(quotationData);
    } catch (e) {
        console.error('Error fetching quotation for PNG:', e);
        alert('Failed to fetch quotation for PNG download');
    }
}

async function downloadQuotationAsPngDirect(quotation) {
    try {
        // Generate HTML for quotation
        const quotationHtml = await generateQuotationHtml(quotation);
        
        // Create a temporary hidden container
        const tempContainer = document.createElement('div');
        tempContainer.style.position = 'absolute';
        tempContainer.style.left = '-9999px';
        tempContainer.style.top = '0';
        tempContainer.style.width = '800px';
        tempContainer.innerHTML = quotationHtml;
        document.body.appendChild(tempContainer);
        
        // Get the quotation div
        const quotationDiv = tempContainer.querySelector('div[style*="width: 800px"]');
        
        if (!quotationDiv) {
            alert('Failed to generate quotation template');
            document.body.removeChild(tempContainer);
            return;
        }
        
        // Wait for images to load
        const images = quotationDiv.querySelectorAll('img');
        const imagePromises = Array.from(images).map(img => {
            if (img.complete) return Promise.resolve();
            return new Promise((resolve, reject) => {
                img.onload = resolve;
                img.onerror = resolve;
                setTimeout(resolve, 2000);
            });
        });
        
        await Promise.all(imagePromises);
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // Capture as canvas
        const canvas = await html2canvas(quotationDiv, { 
            scale: 2, 
            logging: false, 
            useCORS: true,
            allowTaint: true,
            backgroundColor: '#1a1a1a',
            width: 800,
            height: quotationDiv.scrollHeight || quotationDiv.offsetHeight,
            x: 0,
            y: 0,
            scrollX: 0,
            scrollY: 0,
            onclone: (clonedDoc) => {
                // Ensure background image is visible in cloned document
                const clonedElement = clonedDoc.querySelector('div[style*="width: 800px"]');
                if (clonedElement) {
                    clonedElement.style.backgroundImage = "url('../images/Quotation_bg_design.png')";
                    clonedElement.style.backgroundSize = "contain";
                    clonedElement.style.backgroundPosition = "center center";
                    clonedElement.style.backgroundRepeat = "no-repeat";
                    clonedElement.style.backgroundAttachment = "fixed";
                }
            }
        });
        
        if (!canvas || canvas.width === 0 || canvas.height === 0) {
            throw new Error('Canvas is empty');
        }
        
        // Convert to PNG and download
        const imgData = canvas.toDataURL('image/png', 1.0);
        const link = document.createElement('a');
        
        // Generate filename
        const customerName = quotation.customer?.name || quotation.customerName || 'Quotation';
        const sanitizedName = customerName.toString().replace(/[^a-zA-Z0-9]/g, '_').replace(/_+/g, '_').trim();
        const quotationId = quotation.quotationId || quotation.id || 'N/A';
        const filename = `Quotation_${sanitizedName}_${quotationId}.png`;
        
        link.href = imgData;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        // Clean up temporary container
        document.body.removeChild(tempContainer);
    } catch (error) {
        console.error('PNG generation error:', error);
        alert('Failed to generate PNG image. Please try again.');
    }
}

async function viewQuotationDetails(quotationId) {
    try {
        // First try to get from already loaded quotations list
        const allQuotations = await getQuotations();
        let quote = allQuotations.find(q => q.quotationId === quotationId || q.id === quotationId);
        
        // If not found in list, fetch from API
        if (!quote) {
            const response = await apiFetch(`/quotations/${quotationId}`);
            if (response) {
                // Extract quotation data from response (handle both wrapped and direct responses)
                if (response.data) {
                    quote = response.data;
                } else if (Array.isArray(response) && response.length > 0) {
                    quote = response[0];
                } else {
                    quote = response;
                }
            }
        }
        
        if (!quote || (!quote.quotationId && !quote.id)) {
            console.error('Invalid quotation data:', quote);
            alert('Quotation not found');
            return;
        }

        // Generate quotation HTML using the same template as PDF
        const quotationHtml = await generateQuotationHtml(quote);
        
        // Get modal elements
        const modal = document.getElementById('quotationViewModal');
        const content = document.getElementById('quotationViewContent');
        const closeBtn = document.getElementById('closeQuotationModal');
        
        if (!modal || !content) {
            alert('Modal elements not found');
            return;
        }
        
        // Populate modal content
        content.innerHTML = quotationHtml;
        
        // Show modal
        modal.style.display = 'block';
        
        // Close button handler
        if (closeBtn) {
            closeBtn.onclick = () => {
                modal.style.display = 'none';
            };
        }
        
        // Close on background click
        modal.onclick = (e) => {
            if (e.target === modal) {
                modal.style.display = 'none';
            }
        };
        
        // Close on Escape key
        document.addEventListener('keydown', function escapeHandler(e) {
            if (e.key === 'Escape' && modal.style.display === 'block') {
                modal.style.display = 'none';
                document.removeEventListener('keydown', escapeHandler);
            }
        });
    } catch (e) {
        console.error('Error viewing quotation:', e);
        alert('Failed to fetch quotation details');
    }
}

async function cloneQuotation(quotationId) {
    if (!AUTHORIZED_TO_CREATE_QUOTATIONS.includes(CURRENT_USER_ROLE)) {
        alert('You are not authorized to create/clone quotations.');
        return;
    }

    try {
        const quote = await apiFetch(`/quotations/${quotationId}`);
        if (!quote) return;

        if (!confirm(`Are you sure you want to clone quotation ${quotationId}? This will replace current items in the New Quotation section.`)) return;

        // Set to create mode since cloning is creating a new quotation
        isCreatingNewQuotation = true;

        // Load customer details
        document.getElementById('cust-name').value = quote.customer?.name || '';
        document.getElementById('phone-number').value = quote.customer?.phone || '';
        document.getElementById('cust-email').value = quote.customer?.email || '';
        document.getElementById('cust-address').value = quote.customer?.address || '';
        const discountPercentInput = document.getElementById('discount-percent');
        if (discountPercentInput) discountPercentInput.value = quote.discountPercent || 0;

        // Load items
        quotationItems = quote.items.map(item => ({
            productId: item.productId,
            productName: item.productName,
            description: item.description,
            price: item.price,
            gstRate: item.gstRate,
            quantity: item.quantity,
        }));

        renderQuotationItems();
        updateGrandTotal();

        // Switch to create section
        const createQuoteTab = document.querySelector('#sideNav a[data-tab="createQuotation"]') || document.querySelector('#sideNav a[data-tab="dashboard"]');
        if (createQuoteTab) createQuoteTab.click();

        alert(`Quotation ${quotationId} cloned.`);
    } catch (e) {
        alert('Failed to clone quotation');
    }
}

async function renderLogsList() {
    if (!AUTHORIZED_TO_VIEW_LOGS.includes(CURRENT_USER_ROLE)) return;

    const logs = await getLogs();
    const body = document.getElementById('logsListBody');
    const noLogsMessage = document.getElementById('noLogsMessage');
    body.innerHTML = '';

    if (logs.length === 0) {
        noLogsMessage.style.display = 'block';
        return;
    }
    noLogsMessage.style.display = 'none';

    const canDelete = AUTHORIZED_TO_DELETE_LOGS.includes(CURRENT_USER_ROLE);

    logs.forEach(log => {
        const row = body.insertRow();
        row.insertCell().textContent = log.timestamp;
        row.insertCell().textContent = log.user;
        row.insertCell().textContent = log.role;
        row.insertCell().textContent = log.action;
        row.insertCell().textContent = log.details;
    });
}

function updateLogsPaginationControls(totalPages, totalLogs) {
    const pageNumbersDiv = document.getElementById('logsPageNumbers');
    const nextBtn = document.getElementById('logsNextBtn');
    const prevBtn = document.getElementById('logsPrevBtn');
    const pageInfo = document.getElementById('logsPageInfo');

    if (pageNumbersDiv) {
        pageNumbersDiv.innerHTML = '';
        
        if (totalPages === 0) {
            if (pageInfo) pageInfo.textContent = '';
            return;
        }

        // Update page info
        if (pageInfo) {
            const startItem = (logsCurrentPage - 1) * logsPerPage + 1;
            const endItem = Math.min(logsCurrentPage * logsPerPage, totalLogs);
            pageInfo.textContent = `Page ${logsCurrentPage} of ${totalPages} • Showing ${startItem}-${endItem} of ${totalLogs}`;
        }

        // Show up to 7 page numbers with ellipsis
        const maxPagesToShow = 7;
        let startPage, endPage;
        let showStartEllipsis = false;
        let showEndEllipsis = false;
        
        if (totalPages <= maxPagesToShow) {
            // Show all pages if 7 or fewer
            startPage = 1;
            endPage = totalPages;
        } else {
            // Calculate which pages to show
            if (logsCurrentPage <= 4) {
                // Show first pages
                startPage = 1;
                endPage = maxPagesToShow - 1;
                showEndEllipsis = true;
            } else if (logsCurrentPage >= totalPages - 3) {
                // Show last pages
                startPage = totalPages - (maxPagesToShow - 2);
                endPage = totalPages;
                showStartEllipsis = true;
            } else {
                // Show pages around current
                startPage = logsCurrentPage - 2;
                endPage = logsCurrentPage + 2;
                showStartEllipsis = true;
                showEndEllipsis = true;
            }
        }

        // Add first page and ellipsis if needed
        if (showStartEllipsis) {
            const firstBtn = document.createElement('button');
            firstBtn.className = 'pagination-page-btn';
            firstBtn.textContent = '1';
            firstBtn.onclick = () => {
                logsCurrentPage = 1;
                renderLogsList();
            };
            pageNumbersDiv.appendChild(firstBtn);

            const ellipsis = document.createElement('div');
            ellipsis.className = 'pagination-ellipsis';
            ellipsis.textContent = '...';
            pageNumbersDiv.appendChild(ellipsis);
        }

        // Add page number buttons
        for (let i = startPage; i <= endPage; i++) {
            const pageBtn = document.createElement('button');
            pageBtn.className = 'pagination-page-btn';
            if (i === logsCurrentPage) {
                pageBtn.classList.add('active');
            }
            pageBtn.textContent = i;
            
            pageBtn.onclick = () => {
                logsCurrentPage = i;
                renderLogsList();
            };
            
            pageNumbersDiv.appendChild(pageBtn);
        }

        // Add last page and ellipsis if needed
        if (showEndEllipsis) {
            const ellipsis = document.createElement('div');
            ellipsis.className = 'pagination-ellipsis';
            ellipsis.textContent = '...';
            pageNumbersDiv.appendChild(ellipsis);

            const lastBtn = document.createElement('button');
            lastBtn.className = 'pagination-page-btn';
            lastBtn.textContent = totalPages;
            lastBtn.onclick = () => {
                logsCurrentPage = totalPages;
                renderLogsList();
            };
            pageNumbersDiv.appendChild(lastBtn);
        }
    }

    // Update Previous and Next buttons
    if (prevBtn) {
        prevBtn.disabled = logsCurrentPage <= 1;
    }
    if (nextBtn) {
        nextBtn.disabled = logsCurrentPage >= totalPages;
    }
}

function goToLogsPage(direction) {
    logsCurrentPage += direction;
    if (logsCurrentPage < 1) logsCurrentPage = 1;
    
    // Call renderLogsList which will handle async getLogs
    renderLogsList();
}

function updateLogsPaginationControls(totalPages, totalLogs) {
    const pageNumbersDiv = document.getElementById('logsPageNumbers');
    const nextBtn = document.getElementById('logsNextBtn');
    const prevBtn = document.getElementById('logsPrevBtn');
    const pageInfo = document.getElementById('logsPageInfo');

    if (pageNumbersDiv) {
        pageNumbersDiv.innerHTML = '';
        
        if (totalPages === 0) {
            if (pageInfo) pageInfo.textContent = '';
            return;
        }

        // Update page info
        if (pageInfo) {
            const startItem = (logsCurrentPage - 1) * logsPerPage + 1;
            const endItem = Math.min(logsCurrentPage * logsPerPage, totalLogs);
            pageInfo.textContent = `Page ${logsCurrentPage} of ${totalPages} • Showing ${startItem}-${endItem} of ${totalLogs}`;
        }

        // Show up to 7 page numbers with ellipsis
        const maxPagesToShow = 7;
        let startPage, endPage;
        let showStartEllipsis = false;
        let showEndEllipsis = false;
        
        if (totalPages <= maxPagesToShow) {
            // Show all pages if 7 or fewer
            startPage = 1;
            endPage = totalPages;
        } else {
            // Calculate which pages to show
            if (logsCurrentPage <= 4) {
                // Show first pages
                startPage = 1;
                endPage = maxPagesToShow - 1;
                showEndEllipsis = true;
            } else if (logsCurrentPage >= totalPages - 3) {
                // Show last pages
                startPage = totalPages - (maxPagesToShow - 2);
                endPage = totalPages;
                showStartEllipsis = true;
            } else {
                // Show pages around current
                startPage = logsCurrentPage - 2;
                endPage = logsCurrentPage + 2;
                showStartEllipsis = true;
                showEndEllipsis = true;
            }
        }

        // Add first page and ellipsis if needed
        if (showStartEllipsis) {
            const firstBtn = document.createElement('button');
            firstBtn.className = 'pagination-page-btn';
            firstBtn.textContent = '1';
            firstBtn.onclick = () => {
                logsCurrentPage = 1;
                renderLogsList();
            };
            pageNumbersDiv.appendChild(firstBtn);

            const ellipsis = document.createElement('div');
            ellipsis.className = 'pagination-ellipsis';
            ellipsis.textContent = '...';
            pageNumbersDiv.appendChild(ellipsis);
        }

        // Add page number buttons
        for (let i = startPage; i <= endPage; i++) {
            const pageBtn = document.createElement('button');
            pageBtn.className = 'pagination-page-btn';
            if (i === logsCurrentPage) {
                pageBtn.classList.add('active');
            }
            pageBtn.textContent = i;
            
            pageBtn.onclick = () => {
                logsCurrentPage = i;
                renderLogsList();
            };
            
            pageNumbersDiv.appendChild(pageBtn);
        }

        // Add last page and ellipsis if needed
        if (showEndEllipsis) {
            const ellipsis = document.createElement('div');
            ellipsis.className = 'pagination-ellipsis';
            ellipsis.textContent = '...';
            pageNumbersDiv.appendChild(ellipsis);

            const lastBtn = document.createElement('button');
            lastBtn.className = 'pagination-page-btn';
            lastBtn.textContent = totalPages;
            lastBtn.onclick = () => {
                logsCurrentPage = totalPages;
                renderLogsList();
            };
            pageNumbersDiv.appendChild(lastBtn);
        }
    }

    // Update Previous and Next buttons
    if (prevBtn) {
        prevBtn.disabled = logsCurrentPage <= 1;
    }
    if (nextBtn) {
        nextBtn.disabled = logsCurrentPage >= totalPages;
    }
}

function goToLogsPage(direction) {
    logsCurrentPage += direction;
    if (logsCurrentPage < 1) logsCurrentPage = 1;
    
    // Call renderLogsList which will handle async getLogs
    renderLogsList();
}

async function renderSettings() {
    const settings = await getSettings();

    document.getElementById('settings-brand-name').value = settings.brand || '';
    document.getElementById('settings-company-gst-id').value = settings.companyGstId || '';
    document.getElementById('settings-validity-days').value = settings.validityDays || 3;
    document.getElementById('validityDaysDisplay').textContent = settings.validityDays || 3;

    // Logo
    const logoBase64 = settings.logo;
    const logoPreview = document.getElementById('logoPreview');
    const noLogoText = document.getElementById('noLogoText');
    const removeLogoBtn = document.getElementById('removeLogoBtn');

    if (logoBase64) {
        logoPreview.src = logoBase64;
        logoPreview.style.display = 'block';
        noLogoText.style.display = 'none';
        removeLogoBtn.style.display = 'inline-flex';
    } else {
        logoPreview.src = '';
        logoPreview.style.display = 'none';
        noLogoText.style.display = 'inline';
        removeLogoBtn.style.display = 'none';
    }

}

async function updateSummary() {
    try {
        const itemsResponse = await getItems();
        const quotationsResponse = await getQuotations();
        const logsResponse = await getLogs();

        // Handle API response format
        const items = Array.isArray(itemsResponse) ? itemsResponse : (itemsResponse?.data || []);
        const quotations = Array.isArray(quotationsResponse) ? quotationsResponse : (quotationsResponse?.data || []);
        const logs = Array.isArray(logsResponse) ? logsResponse : (logsResponse?.data || []);

        // Update basic counts
        const summaryItemsCount = document.getElementById('summaryItemsCount');
        const summaryQuotationsCount = document.getElementById('summaryQuotationsCount');
        const summaryLogsCount = document.getElementById('summaryLogsCount');
        if (summaryItemsCount) summaryItemsCount.textContent = items.length || 0;
        if (summaryQuotationsCount) summaryQuotationsCount.textContent = quotations.length || 0;
        if (summaryLogsCount) summaryLogsCount.textContent = logs.length || 0;

        // Calculate total value
        const totalValue = quotations.reduce((sum, q) => sum + (parseFloat(q.grandTotal) || 0), 0);
        const totalValueElement = document.getElementById('summaryTotalValue');
        if (totalValueElement) {
            totalValueElement.textContent = formatRupee(totalValue);
        }

        // Calculate unique customers count
        const customersMap = new Map();
        quotations.forEach(q => {
            const phone = q.customer?.phone;
            if (phone) {
                customersMap.set(phone, true);
            }
        });
        const customersCountElement = document.getElementById('summaryCustomersCount');
        if (customersCountElement) {
            customersCountElement.textContent = customersMap.size || 0;
        }

        // Calculate monthly statistics
        const now = new Date();
        const currentMonth = now.getMonth();
        const currentYear = now.getFullYear();
        
        const monthlyQuotations = quotations.filter(q => {
            try {
                // Try to parse date from various formats
                let quoteDate;
                if (q.dateCreated) {
                    // Handle DD/MM/YYYY format
                    if (typeof q.dateCreated === 'string' && q.dateCreated.includes('/')) {
                        const parts = q.dateCreated.split('/');
                        if (parts.length === 3) {
                            quoteDate = new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
                        } else {
                            quoteDate = new Date(q.dateCreated);
                        }
                    } else {
                        quoteDate = new Date(q.dateCreated);
                    }
                } else if (q.created_at) {
                    quoteDate = new Date(q.created_at);
                } else {
                    return false;
                }
                
                return quoteDate.getMonth() === currentMonth && quoteDate.getFullYear() === currentYear;
            } catch (e) {
                return false;
            }
        });

        const monthlyQuotationsCountElement = document.getElementById('summaryMonthlyQuotations');
        if (monthlyQuotationsCountElement) {
            monthlyQuotationsCountElement.textContent = monthlyQuotations.length || 0;
        }

        const monthlyValue = monthlyQuotations.reduce((sum, q) => sum + (parseFloat(q.grandTotal) || 0), 0);
        const monthlyValueElement = document.getElementById('summaryMonthlyValue');
        if (monthlyValueElement) {
            monthlyValueElement.textContent = formatRupee(monthlyValue);
        }

        // Calculate average quotation value
        const avgQuotation = quotations.length > 0 ? totalValue / quotations.length : 0;
        const avgQuotationElement = document.getElementById('summaryAvgQuotation');
        if (avgQuotationElement) {
            avgQuotationElement.textContent = formatRupee(avgQuotation);
        }

        // Render recent quotations
        renderRecentQuotations(quotations);

        // Render recent activity
        renderRecentActivity(logs);
    } catch (error) {
        console.error('Error updating summary:', error);
        // Set default values on error
        const summaryItemsCount = document.getElementById('summaryItemsCount');
        const summaryQuotationsCount = document.getElementById('summaryQuotationsCount');
        const summaryLogsCount = document.getElementById('summaryLogsCount');
        const totalValueElement = document.getElementById('summaryTotalValue');
        const customersCountElement = document.getElementById('summaryCustomersCount');
        const monthlyQuotationsCountElement = document.getElementById('summaryMonthlyQuotations');
        const monthlyValueElement = document.getElementById('summaryMonthlyValue');
        const avgQuotationElement = document.getElementById('summaryAvgQuotation');
        
        if (summaryItemsCount) summaryItemsCount.textContent = '0';
        if (summaryQuotationsCount) summaryQuotationsCount.textContent = '0';
        if (summaryLogsCount) summaryLogsCount.textContent = '0';
        if (totalValueElement) {
            totalValueElement.textContent = formatRupee(0);
        }
        if (customersCountElement) {
            customersCountElement.textContent = '0';
        }
        if (monthlyQuotationsCountElement) {
            monthlyQuotationsCountElement.textContent = '0';
        }
        if (monthlyValueElement) {
            monthlyValueElement.textContent = formatRupee(0);
        }
        if (avgQuotationElement) {
            avgQuotationElement.textContent = formatRupee(0);
        }
    }
}

function renderRecentQuotations(quotations) {
    const listDiv = document.getElementById('recentQuotationsList');
    if (!listDiv) return;

    if (!Array.isArray(quotations) || quotations.length === 0) {
        listDiv.innerHTML = '<p class="muted" style="text-align:center; padding:20px;">No quotations yet.</p>';
        return;
    }

    // Sort by date (most recent first) and take top 5
    const recentQuotations = quotations
        .slice()
        .sort((a, b) => {
            const dateA = new Date(a.dateCreated || a.created_at || 0);
            const dateB = new Date(b.dateCreated || b.created_at || 0);
            return dateB - dateA;
        })
        .slice(0, 5);

    listDiv.innerHTML = recentQuotations.map(quote => {
        const quoteDate = new Date(quote.dateCreated || quote.created_at || Date.now());
        const date = quoteDate.toLocaleDateString('en-IN', {
            day: '2-digit',
            month: 'short',
            year: 'numeric'
        });
        const time = quoteDate.toLocaleTimeString('en-IN', {
            hour: '2-digit',
            minute: '2-digit'
        });
        const customerName = quote.customer?.name || quote.customer_name || 'N/A';
        const customerPhone = quote.customer?.phone || '';
        const grandTotal = parseFloat(quote.grandTotal) || 0;
        const itemsCount = quote.items?.length || 0;
        const quotationId = quote.quotationId || quote.quotation_id || 'N/A';
        
        return `
            <div style="padding: 10px; border-bottom: 1px solid #f2f6fb; cursor: pointer;" 
                 onclick="cloneQuotation('${quotationId}')"
                 onmouseover="this.style.backgroundColor='#f8f9fa'" 
                 onmouseout="this.style.backgroundColor='transparent'">
                <div style="display: flex; align-items: flex-start; gap: 10px;">
                    <i class="fas fa-file-invoice-dollar" style="color: #27AE60; font-size: 16px; margin-top: 2px;"></i>
                    <div style="flex: 1;">
                        <div style="font-weight: bold; color: #34495E; font-size: 14px;">${quotationId}</div>
                        <div style="font-size: 12px; color: #7f8c8d; margin-top: 4px;">
                            <i class="fas fa-user" style="margin-right: 4px;"></i>${customerName}
                            ${customerPhone ? `<span style="margin: 0 6px;">•</span><i class="fas fa-phone" style="margin-right: 4px;"></i>${customerPhone}` : ''}
                        </div>
                        <div style="font-size: 11px; color: #95a5a6; margin-top: 4px;">
                            <i class="fas fa-rupee-sign" style="margin-right: 4px;"></i><strong style="color: #27AE60;">${formatRupee(grandTotal)}</strong>
                            <span style="margin: 0 6px;">•</span>
                            <i class="fas fa-box" style="margin-right: 4px;"></i>${itemsCount} item${itemsCount !== 1 ? 's' : ''}
                            <span style="margin: 0 6px;">•</span>
                            <i class="fas fa-clock" style="margin-right: 4px;"></i>${date} ${time}
                        </div>
                    </div>
                </div>
            </div>
        `;
    }).join('');

    if (recentQuotations.length === 0) {
        listDiv.innerHTML = '<p class="muted" style="text-align:center; padding:20px;">No quotations yet.</p>';
    }
}

function renderRecentActivity(logs) {
    const listDiv = document.getElementById('recentActivityList');
    if (!listDiv) return;

    if (!Array.isArray(logs) || logs.length === 0) {
        listDiv.innerHTML = '<p class="muted" style="text-align:center; padding:20px;">No activity yet.</p>';
        return;
    }

    // Sort by timestamp (most recent first) and take top 5
    const recentLogs = logs
        .slice()
        .sort((a, b) => {
            const timeA = new Date(a.timestamp || a.created_at || 0).getTime();
            const timeB = new Date(b.timestamp || b.created_at || 0).getTime();
            return timeB - timeA;
        })
        .slice(0, 5);

    listDiv.innerHTML = recentLogs.map(log => {
        const logDate = new Date(log.timestamp || log.created_at || Date.now());
        const date = logDate.toLocaleDateString('en-IN', {
            day: '2-digit',
            month: 'short',
            year: 'numeric'
        });
        const time = logDate.toLocaleTimeString('en-IN', {
            hour: '2-digit',
            minute: '2-digit'
        });
        
        // Get action icon based on action type
        let actionIcon = 'fa-circle';
        if (log.action) {
            const actionLower = log.action.toLowerCase();
            if (actionLower.includes('product') || actionLower.includes('item')) actionIcon = 'fa-box';
            else if (actionLower.includes('quotation') || actionLower.includes('quote')) actionIcon = 'fa-file-invoice-dollar';
            else if (actionLower.includes('customer')) actionIcon = 'fa-users';
            else if (actionLower.includes('delete')) actionIcon = 'fa-trash-alt';
            else if (actionLower.includes('create') || actionLower.includes('add')) actionIcon = 'fa-plus-circle';
            else if (actionLower.includes('update') || actionLower.includes('edit')) actionIcon = 'fa-edit';
            else if (actionLower.includes('login') || actionLower.includes('switch')) actionIcon = 'fa-sign-in-alt';
        }
        
        // Truncate details if too long
        const details = log.details || '';
        const truncatedDetails = details.length > 50 ? details.substring(0, 50) + '...' : details;
        
        return `
            <div style="padding: 10px; border-bottom: 1px solid #f2f6fb; cursor: pointer;" 
                 onmouseover="this.style.backgroundColor='#f8f9fa'" 
                 onmouseout="this.style.backgroundColor='transparent'">
                <div style="display: flex; align-items: flex-start; gap: 10px;">
                    <i class="fas ${actionIcon}" style="color: #3498DB; font-size: 16px; margin-top: 2px;"></i>
                    <div style="flex: 1;">
                        <div style="font-weight: bold; color: #34495E; font-size: 14px;">${log.action || 'N/A'}</div>
                        ${truncatedDetails ? `<div style="font-size: 12px; color: #95a5a6; margin-top: 2px;">${truncatedDetails}</div>` : ''}
                        <div style="font-size: 11px; color: #7f8c8d; margin-top: 4px;">
                            <i class="fas fa-user" style="margin-right: 4px;"></i>${log.user || 'N/A'} 
                            <span style="margin: 0 6px;">•</span>
                            <i class="fas fa-user-tag" style="margin-right: 4px;"></i>${log.role || 'N/A'}
                            <span style="margin: 0 6px;">•</span>
                            <i class="fas fa-clock" style="margin-right: 4px;"></i>${date} ${time}
                        </div>
                    </div>
                </div>
            </div>
        `;
    }).join('');

    if (recentLogs.length === 0) {
        listDiv.innerHTML = '<p class="muted" style="text-align:center; padding:20px;">No activity yet.</p>';
    }
}

// --- Event Handlers & Initializers ---
document.getElementById('addItemForm')?.addEventListener('submit', saveItem);
document.getElementById('addItemForm')?.addEventListener('reset', handleItemEditReset);
document.getElementById('editProductForm')?.addEventListener('submit', saveEditProduct);
document.getElementById('closeEditProductModal')?.addEventListener('click', closeEditProductModal);
document.getElementById('cancelEditProductBtn')?.addEventListener('click', closeEditProductModal);
// Initialize edit product modal
initEditProductModal();
document.getElementById('createQuotationBtn')?.addEventListener('click', createQuotation);
document.getElementById('itemSearchInput')?.addEventListener('input', (e) => {
    const activeTypeFilter = document.querySelector('.type-filter-btn.active')?.dataset.type || '';
    renderAvailableItemsForQuotation(e.target.value, activeTypeFilter);
});

// Type filter button handlers - use event delegation
document.addEventListener('click', function(e) {
    if (e.target.classList.contains('type-filter-btn')) {
        // Remove active class from all buttons
        document.querySelectorAll('.type-filter-btn').forEach(b => b.classList.remove('active'));
        // Add active class to clicked button
        e.target.classList.add('active');
        const typeFilter = e.target.dataset.type || '';
        const searchValue = document.getElementById('itemSearchInput')?.value || '';
        renderAvailableItemsForQuotation(searchValue, typeFilter);
    }
});

document.getElementById('phone-number')?.addEventListener('input', function (e) {
    this.value = this.value.replace(/\D/g, '');
});

document.getElementById('phone-number')?.addEventListener('blur', async function () {
    const phoneNumber = this.value;
    if (phoneNumber.length === 10) {
        const customer = await getCustomerByPhone(phoneNumber);
        if (customer) {
            document.getElementById('cust-name').value = customer?.name || '';
            document.getElementById('cust-email').value = customer?.email || '';
            document.getElementById('cust-address').value = customer?.address || '';

            const custDisplayName = document.getElementById('cust-display-name');
            const custDisplayPhone = document.getElementById('cust-display-phone');
            const custDisplayEmail = document.getElementById('cust-display-email');
            const custDisplayAddress = document.getElementById('cust-display-address');
            if (custDisplayName) custDisplayName.textContent = customer?.name || 'N/A';
            if (custDisplayPhone) custDisplayPhone.textContent = customer?.phone || '';
            if (custDisplayEmail) custDisplayEmail.textContent = customer?.email || 'N/A';
            if (custDisplayAddress) custDisplayAddress.textContent = customer?.address || 'N/A';
        } else {
            const custDisplayName = document.getElementById('cust-display-name');
            const custDisplayPhone = document.getElementById('cust-display-phone');
            const custDisplayEmail = document.getElementById('cust-display-email');
            const custDisplayAddress = document.getElementById('cust-display-address');
            if (custDisplayName) custDisplayName.textContent = '';
            if (custDisplayPhone) custDisplayPhone.textContent = phoneNumber;
            if (custDisplayEmail) custDisplayEmail.textContent = '';
            if (custDisplayAddress) custDisplayAddress.textContent = '';
        }
    }
});

async function showSection(sectionId) {
    document.querySelectorAll('.content-section').forEach(section => {
        section.style.display = 'none';
    });
    document.getElementById(sectionId).style.display = 'flex';

    document.querySelectorAll('#sideNav a').forEach(link => {
        link.classList.remove('active');
    });
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('active');
    });

    document.querySelector(`#sideNav a[data-tab="${sectionId}"]`)?.classList.add('active');

    const tabBtn = document.querySelector(`#dashboardTabs button[data-tab="${sectionId}"]`);
    if (tabBtn) tabBtn.classList.add('active');

    if (sectionId === 'addItem') {
        await handleItemEditReset();
        loadAddProductDynamicData();
    }
    if (sectionId === 'itemsList') {
        // Ensure type filters and list are in sync when showing Products tab
        renderItemsTypeFilters();
        renderItemsList();
    }
    if (sectionId === 'createQuotation') {
        // Initialize Create Quotation section
        renderQuotationTypeFilters();
        renderAvailableItemsForQuotation();
        renderQuotationItems();
        updateGrandTotal();
    }
    if (sectionId === 'viewHistory') renderHistoryList();
    if (sectionId === 'viewLogs') renderLogsList();
    if (sectionId === 'viewCustomers') renderCustomersList();
}

document.querySelectorAll('[data-tab]').forEach(el => {
    el.addEventListener('click', function (e) {
        e.preventDefault();
        const sectionId = this.getAttribute('data-tab');
        showSection(sectionId);
    });
});

// --- Settings Saving Logic ---

document.getElementById('saveBrandNameBtn')?.addEventListener('click', async function () {
    const brandName = document.getElementById('settings-brand-name').value.trim();
    if (!brandName) {
        alert('Brand name cannot be empty.');
        return;
    }
    try {
        await apiFetch('/settings', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ brand: brandName })
        });
        alert('Brand name saved successfully!');
    } catch (e) { }
});

document.getElementById('saveCompanyGstIdBtn')?.addEventListener('click', async function () {
    const gstId = document.getElementById('settings-company-gst-id').value.trim().toUpperCase();
    if (gstId.length !== 15 && gstId !== '') {
        alert('GST ID must be 15 alphanumeric characters or left empty.');
        return;
    }
    try {
        await apiFetch('/settings', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ companyGstId: gstId })
        });
        alert('Company GST ID saved successfully!');
    } catch (e) { }
});

document.getElementById('saveValidityBtn')?.addEventListener('click', async function () {
    const days = parseInt(document.getElementById('settings-validity-days').value);
    if (isNaN(days) || days < 1 || days > 365) {
        alert('Please enter a valid number of days between 1 and 365.');
        return;
    }
    try {
        await apiFetch('/settings', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ defaultValidityDays: days })
        });
        document.getElementById('validityDaysDisplay').textContent = days;
        alert('Quotation validity saved successfully!');
    } catch (e) { }
});

// --- Logo Handling ---
async function handleLogoUpload(event) {
    const file = event.target.files[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
        alert('Please upload an image file.');
        return;
    }
    if (file.size > 200 * 1024) {
        alert('Logo file size must be under 200KB.');
        return;
    }

    const formData = new FormData();
    formData.append('logo', file);

    try {
        await apiFetch('/upload_logo', {
            method: 'POST',
            body: formData
        });
        renderSettings();
        alert('Company logo uploaded successfully!');
    } catch (e) { }
}

document.getElementById('removeLogoBtn')?.addEventListener('click', async function () {
    if (confirm('Are you sure you want to remove the company logo?')) {
        alert('Feature not implemented in API yet.');
    }
});

/* ---------- Product Management ---------- */
document.getElementById('addItemForm')?.addEventListener('submit', async function (e) {
    e.preventDefault();

    if (!AUTHORIZED_TO_EDIT_ITEMS.includes(CURRENT_USER_ROLE)) {
        alert('You are not authorized to add products.');
        return;
    }

    const productId = document.getElementById('product-id').value;
    const productName = document.getElementById('product-name').value.trim();
    const itemUrl = document.getElementById('item-url').value.trim();
    const price = parseFloat(document.getElementById('price').value);
    const type = document.getElementById('type').value.trim();
    const description = document.getElementById('description').value.trim();

    if (!productName || !itemUrl || isNaN(price)) {
        alert('Please fill in all required fields correctly.');
        return;
    }

    // Validate URL format - only accept proper URLs with http:// or https://
    let isValidUrl = false;
    
    try {
        const urlObj = new URL(itemUrl);
        // Only accept http or https protocols
        isValidUrl = urlObj.protocol === 'http:' || urlObj.protocol === 'https:';
        
        // Additional validation: must have a valid hostname
        if (isValidUrl) {
            const hostname = urlObj.hostname;
            // Hostname must contain at least one dot (for TLD) and valid characters
            const hostnamePattern = /^([\da-z]([\da-z-]*[\da-z])?\.)+[a-z]{2,}$/i;
            isValidUrl = hostnamePattern.test(hostname) && hostname.length > 0;
        }
    } catch (e) {
        // URL constructor failed - not a valid URL
        isValidUrl = false;
    }

    if (!isValidUrl) {
        alert('Invalid URL format. Please enter a valid URL starting with http:// or https:// (e.g., https://example.com)');
        return;
    }

    // Validate product name uniqueness
    const isNameValid = await validateProductName();
    if (!isNameValid) {
        alert('Product name already exists. Please choose a different name.');
        return;
    }

    const payload = {
        productId,
        productName,
        itemUrl,
        price,
        type,
        description,
        addedBy: CURRENT_USER_EMAIL.split('@')[0]
    };

    try {
        await apiFetch('/items', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        alert('Product added successfully!');
        this.reset();
        document.getElementById('product-id').value = await generateProductId();
        resetAddProductForm(); // Reset validation and reload dynamic data
        updateSummary(); // Update overview summary
        renderItemsList();
        showSection('itemsList');
    } catch (error) {
        // Silent fail
    }
});

/* ---------- Other Actions ---------- */
async function deleteQuotation(quotationId) {
    if (!confirm(`Are you sure you want to delete quotation ID ${quotationId}?`)) return;
    try {
        await apiFetch(`/quotations/${quotationId}`, { method: 'DELETE' });
        renderHistoryList();
        updateSummary();
    } catch (e) { }
}

async function deleteLog(logId) {
    if (!AUTHORIZED_TO_DELETE_LOGS.includes(CURRENT_USER_ROLE)) {
        alert('You are not authorized to delete logs.');
        return;
    }
    if (!confirm('Are you sure you want to delete this log entry?')) return;
    try {
        await apiFetch(`/logs/${logId}`, { method: 'DELETE' });
        renderLogsList();
        updateSummary();
    } catch (e) { }
}

/* ---------- Initializers ---------- */
async function initializeDashboard() {
    const userRoleDisplay = document.getElementById('userRoleDisplay');
    const userEmailDisplay = document.getElementById('userEmailDisplay');
    const userAvatar = document.getElementById('userAvatar');
    const headerTitle = document.getElementById('headerTitle');
    const productIdInput = document.getElementById('product-id');

    if (userRoleDisplay) userRoleDisplay.textContent = CURRENT_USER_ROLE;
    if (userEmailDisplay) userEmailDisplay.textContent = CURRENT_USER_EMAIL;
    if (userAvatar) userAvatar.textContent = CURRENT_USER_ROLE.charAt(0).toUpperCase();
    if (headerTitle) headerTitle.textContent = `${CURRENT_USER_ROLE} Dashboard`;

    applyRoleRestrictions();

    // Load initial data - prioritize critical data first, then load others
    try {
        // Load critical data first (dashboard summary and items list)
        const criticalData = await Promise.all([
            updateSummary().catch(err => console.error('Error updating summary:', err)),
            renderItemsList().catch(err => console.error('Error rendering items:', err))
        ]);
        
        // Load secondary data after critical data (non-blocking)
        // Use Promise.allSettled to ensure all load even if one fails
        Promise.allSettled([
            renderHistoryList().catch(err => console.error('Error rendering history:', err)),
            renderLogsList().catch(err => console.error('Error rendering logs:', err)),
            renderSettings().catch(err => console.error('Error rendering settings:', err)),
            renderCustomersList().catch(err => console.error('Error rendering customers:', err))
        ]).then(() => {
            // All secondary data loaded
            console.debug('All dashboard data loaded');
        });
    } catch (error) {
        console.error('Error initializing dashboard:', error);
    }

    showSection('dashboard');
    updateGrandTotal();
    if (productIdInput) productIdInput.value = await generateProductId();
}

// --- Add Product Dynamic Data Functions ---
async function loadAddProductDynamicData() {
    try {
        const items = await getItems();
        updateProductStatistics(items);
        renderRecentProducts(items);
        renderProductTypes(items);
        updateTypeSuggestions();
    } catch (error) {
        // Silent fail
    }
}

function updateProductStatistics(items) {
    if (!items || items.length === 0) {
        document.getElementById('statsTotalProducts').textContent = '0';
        document.getElementById('statsProductTypes').textContent = '0';
        document.getElementById('statsAvgPrice').textContent = formatRupee(0);
        document.getElementById('statsPriceRange').textContent = 'N/A';
        document.getElementById('statsThisMonth').textContent = '0';
        return;
    }

    // Total products
    document.getElementById('statsTotalProducts').textContent = items.length;

    // Unique product types
    const types = new Set(items.map(item => item.type).filter(Boolean));
    document.getElementById('statsProductTypes').textContent = types.size;

    // Average price
    const prices = items.map(item => parseFloat(item.price) || 0).filter(p => p > 0);
    const avgPrice = prices.length > 0 ? prices.reduce((a, b) => a + b, 0) / prices.length : 0;
    document.getElementById('statsAvgPrice').textContent = formatRupee(avgPrice);

    // Price range
    if (prices.length > 0) {
        const minPrice = Math.min(...prices);
        const maxPrice = Math.max(...prices);
        document.getElementById('statsPriceRange').textContent = `${formatRupee(minPrice)} - ${formatRupee(maxPrice)}`;
    } else {
        document.getElementById('statsPriceRange').textContent = 'N/A';
    }

    // Products added this month
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    
    const monthlyItems = items.filter(item => {
        try {
            let itemDate;
            if (item.dateAdded) {
                if (typeof item.dateAdded === 'string' && item.dateAdded.includes('/')) {
                    const parts = item.dateAdded.split('/');
                    if (parts.length === 3) {
                        itemDate = new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
                    } else {
                        itemDate = new Date(item.dateAdded);
                    }
                } else {
                    itemDate = new Date(item.dateAdded);
                }
            } else if (item.created_at) {
                itemDate = new Date(item.created_at);
            } else {
                return false;
            }
            return itemDate.getMonth() === currentMonth && itemDate.getFullYear() === currentYear;
        } catch (e) {
            return false;
        }
    });
    
    document.getElementById('statsThisMonth').textContent = monthlyItems.length;
}

function renderRecentProducts(items) {
    const listDiv = document.getElementById('recentProductsList');
    if (!listDiv) return;

    if (!items || items.length === 0) {
        listDiv.innerHTML = '<p class="muted" style="text-align:center; padding:20px;">No products yet.</p>';
        return;
    }

    // Sort by date (most recent first) and take top 5
    const recentItems = items
        .slice()
        .sort((a, b) => {
            const dateA = new Date(a.dateAdded || a.created_at || 0);
            const dateB = new Date(b.dateAdded || b.created_at || 0);
            return dateB - dateA;
        })
        .slice(0, 5);

    listDiv.innerHTML = recentItems.map(item => {
        const itemDate = new Date(item.dateAdded || item.created_at || Date.now());
        const date = itemDate.toLocaleDateString('en-IN', {
            day: '2-digit',
            month: 'short',
            year: 'numeric'
        });
        
        return `
            <div style="padding: 8px; border-bottom: 1px solid #f2f6fb; cursor: pointer;" 
                 onclick="editItem('${item.productId}')"
                 onmouseover="this.style.backgroundColor='#f8f9fa'" 
                 onmouseout="this.style.backgroundColor='transparent'">
                <div style="display: flex; align-items: flex-start; gap: 8px;">
                    <i class="fas fa-box" style="color: #3A648C; font-size: 14px; margin-top: 2px;"></i>
                    <div style="flex: 1;">
                        <div style="font-weight: bold; color: #34495E; font-size: 13px;">${item.productName || 'N/A'}</div>
                        <div style="font-size: 11px; color: #7f8c8d; margin-top: 2px;">
                            <span style="color: #27AE60; font-weight: bold;">${formatRupee(item.price || 0)}</span>
                            <span style="margin: 0 6px;">•</span>
                            ${item.type || 'N/A'}
                        </div>
                        <div style="font-size: 10px; color: #95a5a6; margin-top: 2px;">
                            ${item.productId || 'N/A'} • ${date}
                        </div>
                    </div>
                </div>
            </div>
        `;
    }).join('');

    if (recentItems.length === 0) {
        listDiv.innerHTML = '<p class="muted" style="text-align:center; padding:20px;">No products yet.</p>';
    }
}

function renderProductTypes(items) {
    const listDiv = document.getElementById('productTypesList');
    if (!listDiv) return;

    if (!items || items.length === 0) {
        listDiv.innerHTML = '<p class="muted" style="text-align:center; padding:20px;">No product types yet.</p>';
        return;
    }

    // Count products by type
    const typeCounts = {};
    items.forEach(item => {
        if (item.type) {
            typeCounts[item.type] = (typeCounts[item.type] || 0) + 1;
        }
    });

    const sortedTypes = Object.entries(typeCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10);

    if (sortedTypes.length === 0) {
        listDiv.innerHTML = '<p class="muted" style="text-align:center; padding:20px;">No product types yet.</p>';
        return;
    }

    listDiv.innerHTML = sortedTypes.map(([type, count]) => `
        <div style="padding: 6px 8px; border-bottom: 1px solid #f2f6fb; display: flex; justify-content: space-between; align-items: center;">
            <span style="font-size: 13px; color: #34495E;">${type}</span>
            <span style="font-size: 12px; color: #7f8c8d; background: #f8f9fa; padding: 2px 8px; border-radius: 12px;">${count}</span>
        </div>
    `).join('');
}

let allProductTypes = [];

async function updateTypeSuggestions() {
    try {
        const items = await getItems();
        allProductTypes = [...new Set(items.map(item => item.type).filter(Boolean))];
        
        // Base categories that should always be available
        const baseCategories = [
            'MONITOR',
            'KEYBOARD&MOUSE',
            'ACCESSORIES',
            'UPS',
            'LAPTOP',
            'PRINTERS',
            'NETWORKING PRODUCTS',
            'OTHERS'
        ];
        
        // Combine base categories with existing types, removing duplicates
        const allTypes = [...new Set([...baseCategories, ...allProductTypes])];
        
        const datalist = document.getElementById('product-types');
        datalist.innerHTML = '';
        allTypes.forEach(type => {
            const option = document.createElement('option');
            option.value = type;
            datalist.appendChild(option);
        });

        const typeInput = document.getElementById('type');
        const suggestionsDiv = document.getElementById('type-suggestions');
        const inputValue = typeInput.value.toLowerCase().trim();

        if (inputValue && allTypes.length > 0) {
            const matches = allTypes.filter(type => 
                type.toLowerCase().includes(inputValue)
            ).slice(0, 5);

            if (matches.length > 0 && !matches.some(m => m.toLowerCase() === inputValue)) {
                suggestionsDiv.innerHTML = `<i class="fas fa-lightbulb"></i> Suggestions: ${matches.join(', ')}`;
            } else {
                suggestionsDiv.innerHTML = '';
            }
        } else {
            suggestionsDiv.innerHTML = '';
        }
    } catch (error) {
        // Silent fail
    }
}

async function suggestSimilarProducts() {
    const productNameInput = document.getElementById('product-name');
    const suggestionsDiv = document.getElementById('similar-products-suggestions');
    const inputValue = productNameInput.value.toLowerCase().trim();

    if (inputValue.length < 2) {
        suggestionsDiv.innerHTML = '';
        return;
    }

    try {
        const items = await getItems();
        const similar = items
            .filter(item => 
                item.productName && 
                item.productName.toLowerCase().includes(inputValue) &&
                item.productName.toLowerCase() !== inputValue
            )
            .slice(0, 3);

        if (similar.length > 0) {
            suggestionsDiv.innerHTML = `
                <div style="background: #f8f9fa; padding: 8px; border-radius: 4px; margin-top: 4px;">
                    <div style="font-size: 11px; color: #7f8c8d; margin-bottom: 4px;">
                        <i class="fas fa-info-circle"></i> Similar products:
                    </div>
                    ${similar.map(item => `
                        <div style="font-size: 12px; color: #34495E; padding: 2px 0;">
                            ${item.productName} (${formatRupee(item.price)}) - ${item.type || 'N/A'}
                        </div>
                    `).join('')}
                </div>
            `;
        } else {
            suggestionsDiv.innerHTML = '';
        }
    } catch (error) {
        // Silent fail
    }
}

async function validateProductUrl() {
    const urlInput = document.getElementById('item-url');
    const validationDiv = document.getElementById('url-validation');
    const url = urlInput.value.trim();

    if (!url) {
        validationDiv.innerHTML = '';
        urlInput.style.borderColor = '';
        return;
    }

    // Validate URL format - only accept proper URLs with http:// or https://
    let isValidUrl = false;
    
    try {
        // Try to create a URL object - this will throw if invalid
        const urlObj = new URL(url);
        // Only accept http or https protocols
        isValidUrl = urlObj.protocol === 'http:' || urlObj.protocol === 'https:';
        
        // Additional validation: must have a valid hostname
        if (isValidUrl) {
            const hostname = urlObj.hostname;
            // Hostname must contain at least one dot (for TLD) and valid characters
            const hostnamePattern = /^([\da-z]([\da-z-]*[\da-z])?\.)+[a-z]{2,}$/i;
            isValidUrl = hostnamePattern.test(hostname) && hostname.length > 0;
        }
    } catch (e) {
        // URL constructor failed - not a valid URL
        isValidUrl = false;
    }

    // If URL format is invalid, show error immediately
    if (!isValidUrl) {
        validationDiv.innerHTML = `<span style="color: #E74C3C;"><i class="fas fa-exclamation-triangle"></i> Invalid URL format. Please enter a valid URL starting with http:// or https:// (e.g., https://example.com)</span>`;
        urlInput.style.borderColor = '#E74C3C';
        return;
    }

    // If URL format is valid, check for duplicates
    try {
        const items = await getItems();
        const duplicate = items.find(item => item.itemUrl && item.itemUrl.toLowerCase() === url.toLowerCase());

        if (duplicate) {
            validationDiv.innerHTML = `<span style="color: #E74C3C;"><i class="fas fa-exclamation-triangle"></i> URL already exists (${duplicate.productName})</span>`;
            urlInput.style.borderColor = '#E74C3C';
        } else {
            validationDiv.innerHTML = `<span style="color: #27AE60;"><i class="fas fa-check-circle"></i> URL is available</span>`;
            urlInput.style.borderColor = '#27AE60';
        }
    } catch (error) {
        validationDiv.innerHTML = '';
        urlInput.style.borderColor = '';
    }
}

// Debounce timer for product name validation
let productNameValidationTimer = null;

async function validateProductName(excludeProductId = null) {
    const nameInput = document.getElementById('product-name');
    const validationDiv = document.getElementById('product-name-validation');
    const name = nameInput.value.trim();

    if (!name) {
        validationDiv.innerHTML = '';
        nameInput.style.borderColor = '';
        return false;
    }

    // Clear any existing timer
    if (productNameValidationTimer) {
        clearTimeout(productNameValidationTimer);
    }

    // Show loading state while checking
    validationDiv.innerHTML = `<span style="color: #7f8c8d;"><i class="fas fa-spinner fa-spin"></i> Checking availability...</span>`;
    nameInput.style.borderColor = '#95a5a6';

    try {
        const items = await getItems();
        const duplicate = items.find(item => {
            // Exclude current product when editing
            if (excludeProductId && (item.productId === excludeProductId || item.id === excludeProductId)) {
                return false;
            }
            return item.productName && item.productName.toLowerCase() === name.toLowerCase();
        });

        if (duplicate) {
            validationDiv.innerHTML = `<span style="color: #E74C3C;"><i class="fas fa-exclamation-triangle"></i> Product name already exists (ID: ${duplicate.productId || duplicate.id})</span>`;
            nameInput.style.borderColor = '#E74C3C';
            return false;
        } else {
            validationDiv.innerHTML = `<span style="color: #27AE60;"><i class="fas fa-check-circle"></i> Product name is available</span>`;
            nameInput.style.borderColor = '#27AE60';
            return true;
        }
    } catch (error) {
        validationDiv.innerHTML = '';
        nameInput.style.borderColor = '';
        return false;
    }
}

// Debounced version for oninput events
function validateProductNameDebounced(excludeProductId = null) {
    // Clear any existing timer
    if (productNameValidationTimer) {
        clearTimeout(productNameValidationTimer);
    }
    
    // Set a new timer to validate after user stops typing (500ms delay)
    productNameValidationTimer = setTimeout(() => {
        validateProductName(excludeProductId);
    }, 500);
}

// Debounce timer for edit product name validation
let editProductNameValidationTimer = null;

async function validateEditProductName() {
    const nameInput = document.getElementById('edit-product-name');
    const validationDiv = document.getElementById('edit-product-name-validation');
    const productIdInput = document.getElementById('edit-product-id');
    const name = nameInput.value.trim();

    if (!name) {
        validationDiv.innerHTML = '';
        nameInput.style.borderColor = '';
        return false;
    }

    // Clear any existing timer
    if (editProductNameValidationTimer) {
        clearTimeout(editProductNameValidationTimer);
    }

    // Show loading state while checking
    validationDiv.innerHTML = `<span style="color: #7f8c8d;"><i class="fas fa-spinner fa-spin"></i> Checking availability...</span>`;
    nameInput.style.borderColor = '#95a5a6';

    try {
        const items = await getItems();
        const currentProductId = productIdInput ? productIdInput.value : null;
        const duplicate = items.find(item => {
            // Exclude current product when editing
            if (currentProductId && (item.productId === currentProductId || item.id === currentProductId)) {
                return false;
            }
            return item.productName && item.productName.toLowerCase() === name.toLowerCase();
        });

        if (duplicate) {
            validationDiv.innerHTML = `<span style="color: #E74C3C;"><i class="fas fa-exclamation-triangle"></i> Product name already exists (ID: ${duplicate.productId || duplicate.id})</span>`;
            nameInput.style.borderColor = '#E74C3C';
            return false;
        } else {
            validationDiv.innerHTML = `<span style="color: #27AE60;"><i class="fas fa-check-circle"></i> Product name is available</span>`;
            nameInput.style.borderColor = '#27AE60';
            return true;
        }
    } catch (error) {
        validationDiv.innerHTML = '';
        nameInput.style.borderColor = '';
        return false;
    }
}

// Debounced version for oninput events in edit form
function validateEditProductNameDebounced() {
    // Clear any existing timer
    if (editProductNameValidationTimer) {
        clearTimeout(editProductNameValidationTimer);
    }
    
    // Set a new timer to validate after user stops typing (500ms delay)
    editProductNameValidationTimer = setTimeout(() => {
        validateEditProductName();
    }, 500);
}

function validatePrice() {
    const priceInput = document.getElementById('price');
    const validationDiv = document.getElementById('price-validation');
    const priceRangeDiv = document.getElementById('price-range-info');
    const price = parseFloat(priceInput.value);

    if (isNaN(price) || price < 0) {
        validationDiv.innerHTML = '';
        priceRangeDiv.innerHTML = '<i class="fas fa-info-circle"></i> Enter price to see comparison';
        return;
    }

    // Validate price
    if (price <= 0) {
        validationDiv.innerHTML = `<span style="color: #E74C3C;"><i class="fas fa-exclamation-triangle"></i> Price must be greater than 0</span>`;
        priceInput.style.borderColor = '#E74C3C';
    } else {
        validationDiv.innerHTML = `<span style="color: #27AE60;"><i class="fas fa-check-circle"></i> Valid price</span>`;
        priceInput.style.borderColor = '#27AE60';
    }

    // Show price comparison
    getItems().then(items => {
        const prices = items.map(item => parseFloat(item.price) || 0).filter(p => p > 0);
        if (prices.length > 0) {
            const avgPrice = prices.reduce((a, b) => a + b, 0) / prices.length;
            const minPrice = Math.min(...prices);
            const maxPrice = Math.max(...prices);
            
            let comparison = '';
            if (price < minPrice) {
                comparison = `<span style="color: #E67E22;">Below minimum (${formatRupee(minPrice)})</span>`;
            } else if (price > maxPrice) {
                comparison = `<span style="color: #3498DB;">Above maximum (${formatRupee(maxPrice)})</span>`;
            } else if (price < avgPrice) {
                comparison = `<span style="color: #F39C12;">Below average (${formatRupee(avgPrice)})</span>`;
            } else {
                comparison = `<span style="color: #27AE60;">Above average (${formatRupee(avgPrice)})</span>`;
            }
            
            priceRangeDiv.innerHTML = `
                <div style="margin-bottom: 4px;"><strong>${formatRupee(price)}</strong></div>
                <div style="font-size: 11px;">${comparison}</div>
                <div style="font-size: 10px; color: #95a5a6; margin-top: 4px;">
                    Range: ${formatRupee(minPrice)} - ${formatRupee(maxPrice)}
                </div>
            `;
        }
    }).catch(() => {});
}

function validateDescription() {
    const descInput = document.getElementById('description');
    const validationDiv = document.getElementById('description-validation');
    const desc = descInput.value.trim();

    if (desc.length > 0 && desc.length < 10) {
        validationDiv.innerHTML = `<span style="color: #F39C12;"><i class="fas fa-info-circle"></i> Consider adding more details (${desc.length}/10+ chars)</span>`;
    } else if (desc.length >= 10) {
        validationDiv.innerHTML = `<span style="color: #27AE60;"><i class="fas fa-check-circle"></i> Good description (${desc.length} chars)</span>`;
    } else {
        validationDiv.innerHTML = '';
    }
}

function resetAddProductForm() {
    // Clear all validation messages
    document.getElementById('url-validation').innerHTML = '';
    document.getElementById('product-name-validation').innerHTML = '';
    document.getElementById('similar-products-suggestions').innerHTML = '';
    document.getElementById('type-suggestions').innerHTML = '';
    document.getElementById('price-validation').innerHTML = '';
    document.getElementById('description-validation').innerHTML = '';
    document.getElementById('price-range-info').innerHTML = '<i class="fas fa-info-circle"></i> Enter price to see comparison';
    
    // Reset border colors
    document.getElementById('item-url').style.borderColor = '';
    document.getElementById('product-name').style.borderColor = '';
    document.getElementById('price').style.borderColor = '';
    
    // Reload dynamic data
    loadAddProductDynamicData();
}

// --- Logout Functionality ---
async function handleLogout() {
    if (!confirm('Are you sure you want to logout?')) {
        return;
    }

    try {
        // Call logout API
        const response = await fetch(`${API_BASE}/logout`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                email: CURRENT_USER_EMAIL
            })
        });

        // Clear all localStorage data
        const allKeys = [
            LS_KEYS.role,
            LS_KEYS.user,
            'rolewise_userEmail',
            'rolewise_user_name',
            'rolewise_user_id',
            'rolewise_session_expiry',
            'rolewise_session_timeout'
        ];
        
        allKeys.forEach(key => {
            localStorage.removeItem(key);
        });

        // Redirect to login page
        window.location.href = '/index.html';
    } catch (error) {
        // Even if API call fails, clear local storage and redirect
        const allKeys = [
            LS_KEYS.role,
            LS_KEYS.user,
            'rolewise_userEmail',
            'rolewise_user_name',
            'rolewise_user_id',
            'rolewise_session_expiry',
            'rolewise_session_timeout'
        ];
        
        allKeys.forEach(key => {
            localStorage.removeItem(key);
        });
        
        window.location.href = '/index.html';
    }
}

window.onload = function() {
    // Validate session before initializing dashboard
    if (!validateSession()) {
        alert('Your session has expired or you are not logged in. Please login again.');
        window.location.href = '/index.html';
        return;
    }

    // Add event listener for logout button
    document.getElementById('logoutBtn')?.addEventListener('click', handleLogout);
    
    // Connect search input to filter products (by Name/ID, respecting current type filter)
    const searchInput = document.getElementById('productListSearchInput');
    if (searchInput) {
        searchInput.addEventListener('input', function(e) {
            const filter = e.target.value.trim();
            // Reset to first page whenever search changes
            itemsCurrentPage = 1;
            itemsPreviousSearchFilter = filter; // Update previous filter to prevent double reset
            renderItemsList(filter);
        });
    }
    
    // Initial load: render type filters and dashboard (prioritize critical rendering)
    // Load dashboard first, then type filters (non-critical)
    initializeDashboard().then(() => {
        // After dashboard loads, render type filters (non-blocking)
        renderItemsTypeFilters().catch(err => console.error('Error rendering item type filters:', err));
    }).catch(err => {
        console.error('Error initializing dashboard:', err);
        // Still try to render type filters even if dashboard fails
        renderItemsTypeFilters().catch(e => console.error('Error rendering item type filters:', e));
    });
    
    // Clear cache asynchronously after page load (non-blocking, runs in background)
    // This helps prevent stale cache issues without affecting performance
    clearCacheAsync();
};

