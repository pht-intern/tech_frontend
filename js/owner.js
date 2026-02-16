
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
const DRAFT_AUTO_SAVE_MS = 10000; // Auto-save draft every 10 seconds
const DRAFT_DEBOUNCE_MS = 2500;   // Save 2.5s after user stops typing
let draftQuotationIntervalId = null;
let draftItemIntervalId = null;
let currentQuotationDraftId = null; // When resuming, track so we update same draft
let currentItemDraftId = null;
let currentSectionId = '';
let draftQuotationDebounceId = null;
let draftItemDebounceId = null;
let itemsCurrentPage = 1;
const itemsPerPage = 5;
// Current type filter for Products table (items list)
let itemsCurrentTypeFilter = '';
// Current price sort state: 'none', 'asc', 'desc'
let itemsCurrentPriceSort = 'none';
// Track previous search filter to detect changes
let itemsPreviousSearchFilter = '';
let historyCurrentPage = 1;
const historyPerPage = 10;
let customersCurrentPage = 1;
const customersPerPage = 10;
let customerDetailsCurrentPage = 1;
const customerDetailsPerPage = 10;

function formatRupee(amount) {
    const numAmount = parseFloat(amount) || 0;
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(numAmount);
}

// Toggle price sorting for products
function togglePriceSort() {
    const sortBtn = document.getElementById('priceSortBtn');
    const sortText = document.getElementById('priceSortText');
    
    // Cycle through: none -> asc -> desc -> none
    if (itemsCurrentPriceSort === 'none') {
        itemsCurrentPriceSort = 'asc';
        sortText.textContent = 'Low to High';
        sortBtn.classList.remove('secondary');
        sortBtn.classList.add('primary');
    } else if (itemsCurrentPriceSort === 'asc') {
        itemsCurrentPriceSort = 'desc';
        sortText.textContent = 'High to Low';
        sortBtn.classList.remove('primary');
        sortBtn.classList.add('primary');
    } else {
        itemsCurrentPriceSort = 'none';
        sortText.textContent = 'Low to High';
        sortBtn.classList.remove('primary');
        sortBtn.classList.add('secondary');
    }
    
    // Reset to first page and re-render
    itemsCurrentPage = 1;
    const searchInput = document.getElementById('productListSearchInput');
    const filter = searchInput ? searchInput.value.trim() : '';
    renderItemsList(filter);
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
        // For FormData: never set Content-Type (browser sets multipart boundary)
        const isFormData = options.body instanceof FormData;
        const headers = (isFormData || !options.body) ? {} : { 'Content-Type': 'application/json' };
        const fetchOptions = {
            ...options,
            credentials: 'include',
            headers: { ...headers, ...(options.headers || {}) }
        };
        // If FormData, don't override body's content-type by omitting it from final headers
        if (isFormData) delete fetchOptions.headers['Content-Type'];

        const cacheParam = getCacheBustingParam();
        // Use full path for alternate API URLs so they are not affected by catch-all routing
        const url = endpoint.startsWith('/_') ? (endpoint + cacheParam) : `${API_BASE}${endpoint}${cacheParam}`;
        const response = await fetch(url, fetchOptions);
        
        // Check content type before parsing
        const contentType = response.headers.get("content-type");
        const isJson = contentType && contentType.includes("application/json");
        
        if (!response.ok) {
            // Try to parse error response as JSON
            if (isJson) {
                const errorData = await response.json().catch(() => ({}));
                let msg = errorData.error || errorData.message || `API Error: ${response.statusText}`;
                // In dev, backend may include _debug with the real cause (e.g. missing DB column)
                if (errorData._debug) {
                    msg += ` [Debug: ${errorData._debug}]`;
                    console.error('API error (backend details):', errorData._debug);
                }
                throw new Error(msg);
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

async function getCustomers() {
    const response = await apiFetch('/customers');
    // API returns {success: true, data: [...]} or just the array
    return Array.isArray(response) ? response : (response.data || []);
}

async function getLogs() {
    const response = await apiFetch('/logs');
    // API returns {success: true, data: [...]} or just the array
    return Array.isArray(response) ? response : (response.data || []);
}

async function getContactRequests() {
    const response = await apiFetch('/contact-requests');
    return Array.isArray(response) ? response : (response.data || []);
}

async function getGstRules() {
    const response = await apiFetch('/gst_rules');
    // API returns {success: true, data: [...]} or just the array
    return Array.isArray(response) ? response : (response.data || []);
}

async function getSettings() {
    try {
        const response = await apiFetch('/settings');
        // API returns { success, data: { pdfTheme, gstRate, ... } } - unwrap so settings.pdfTheme works
        const data = response?.data ?? response ?? {};
        return typeof data === 'object' && data !== null ? data : {};
    } catch (error) {
        console.error('getSettings() error:', error);
        throw error;
    }
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
        if (userRoleDisplay) userRoleDisplay.textContent = newRole;
        if (userEmailDisplay) userEmailDisplay.textContent = CURRENT_USER_EMAIL;
        if (userAvatar) userAvatar.textContent = newRole.charAt(0).toUpperCase();
        addLog('Role Switched', newRole, `Switched to role: ${newRole}`);
    }
}

function applyRoleRestrictions() {
    const isAdmin = CURRENT_USER_ROLE === 'Admin';
    const isOwnerOrAdmin = AUTHORIZED_TO_VIEW_LOGS.includes(CURRENT_USER_ROLE);
    const isAuthorizedToEditItems = AUTHORIZED_TO_EDIT_ITEMS.includes(CURRENT_USER_ROLE);
    const isAuthorizedToViewCustomers = AUTHORIZED_TO_VIEW_CUSTOMERS.includes(CURRENT_USER_ROLE);

    const navViewLogs = document.getElementById('navViewLogs');
    const navViewContactRequests = document.getElementById('navViewContactRequests');
    const navSettings = document.getElementById('navSettings');
    const navViewCustomers = document.getElementById('navViewCustomers');
    const tabViewLogs = document.getElementById('tabViewLogs');
    const tabSettings = document.getElementById('tabSettings');
    const tabViewCustomers = document.getElementById('tabViewCustomers');
    const summaryLogsCard = document.getElementById('summaryLogsCard');
    const addItem = document.getElementById('addItem');

    // Admin has superior access to all features
    if (navViewLogs) navViewLogs.style.display = (isAdmin || isOwnerOrAdmin) ? 'flex' : 'none';
    if (navViewContactRequests) navViewContactRequests.style.display = (CURRENT_USER_ROLE === 'Owner' || CURRENT_USER_ROLE === 'Admin') ? 'flex' : 'none';
    const summaryContactRequestsCard = document.getElementById('summaryContactRequestsCard');
    if (summaryContactRequestsCard) summaryContactRequestsCard.style.display = (CURRENT_USER_ROLE === 'Owner' || CURRENT_USER_ROLE === 'Admin') ? 'block' : 'none';
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
function getCompatPayload(prefix) {
    const p = prefix || '';
    const v = (id) => { const el = document.getElementById(p + id); return el ? el.value.trim() : ''; };
    const n = (id) => { const val = v(id); return val === '' ? undefined : (isNaN(parseFloat(val)) ? val : (val.includes('.') ? parseFloat(val) : parseInt(val, 10))); };
    const payload = {};
    if (v('compat-socket')) payload.socket = v('compat-socket');
    if (n('compat-tdp') !== undefined) payload.tdp = n('compat-tdp');
    if (v('compat-memory-type')) payload.memoryType = v('compat-memory-type');
    if (v('compat-max-memory-speed')) payload.maxMemorySpeed = v('compat-max-memory-speed');
    if (v('compat-pcie-version')) payload.pcieVersion = v('compat-pcie-version');
    if (v('compat-generation')) payload.generation = v('compat-generation');
    if (v('compat-bios-version')) payload.biosVersionRequired = v('compat-bios-version');
    if (v('compat-chipset')) payload.chipset = v('compat-chipset');
    if (v('compat-form-factor')) payload.formFactor = v('compat-form-factor');
    if (n('compat-memory-slots') !== undefined) payload.memorySlots = n('compat-memory-slots');
    if (v('compat-max-memory')) payload.maxMemory = v('compat-max-memory');
    if (n('compat-pcie-x16-slots') !== undefined) payload.pcieX16Slots = n('compat-pcie-x16-slots');
    if (n('compat-m2-slots') !== undefined) payload.m2Slots = n('compat-m2-slots');
    if (n('compat-sata-ports') !== undefined) payload.sataPorts = n('compat-sata-ports');
    if (v('compat-supported-cpu-generations')) payload.supportedCpuGenerations = v('compat-supported-cpu-generations');
    if (v('compat-wifi-support')) payload.wifiSupport = v('compat-wifi-support');
    if (v('compat-capacity-per-module')) payload.capacityPerModule = v('compat-capacity-per-module');
    if (n('compat-modules-count') !== undefined) payload.modulesCount = n('compat-modules-count');
    if (v('compat-speed')) payload.speed = v('compat-speed');
    if (v('compat-voltage')) payload.voltage = v('compat-voltage');
    if (n('compat-length-mm') !== undefined) payload.lengthMm = n('compat-length-mm');
    if (n('compat-height-mm') !== undefined) payload.heightMm = n('compat-height-mm');
    if (n('compat-thickness-slots') !== undefined) payload.thicknessSlots = n('compat-thickness-slots');
    if (v('compat-required-pcie')) payload.requiredPcieConnectors = v('compat-required-pcie');
    if (n('compat-recommended-psu-wattage') !== undefined) payload.recommendedPsuWattage = n('compat-recommended-psu-wattage');
    if (n('compat-wattage') !== undefined) payload.wattage = n('compat-wattage');
    if (v('compat-pcie-connectors')) payload.pcieConnectors = v('compat-pcie-connectors');
    if (v('compat-cpu-power-connectors')) payload.cpuPowerConnectors = v('compat-cpu-power-connectors');
    if (n('compat-sata-connectors') !== undefined) payload.sataConnectors = n('compat-sata-connectors');
    if (v('compat-modular-type')) payload.modularType = v('compat-modular-type');
    if (v('compat-supported-form-factors')) payload.supportedFormFactors = v('compat-supported-form-factors');
    if (n('compat-max-gpu-length') !== undefined) payload.maxGpuLength = n('compat-max-gpu-length');
    if (n('compat-max-cpu-cooler-height') !== undefined) payload.maxCpuCoolerHeight = n('compat-max-cpu-cooler-height');
    if (v('compat-psu-support')) payload.psuSupport = v('compat-psu-support');
    if (n('compat-drive-bays-25') !== undefined) payload.driveBays25 = n('compat-drive-bays-25');
    if (n('compat-drive-bays-35') !== undefined) payload.driveBays35 = n('compat-drive-bays-35');
    if (v('compat-supported-sockets')) payload.supportedSockets = v('compat-supported-sockets');
    if (n('compat-tdp-rating') !== undefined) payload.tdpRating = n('compat-tdp-rating');
    if (v('compat-radiator-size')) payload.radiatorSize = v('compat-radiator-size');
    if (v('compat-interface-type')) payload.interfaceType = v('compat-interface-type');
    if (v('compat-storage-form-factor')) payload.storageFormFactor = v('compat-storage-form-factor');
    return payload;
}

function normalizeTypeForCompat(typeVal) {
    if (!typeVal) return '';
    const t = String(typeVal).trim().toLowerCase();
    if (t.includes('cpu') || t === 'processor') return 'cpu';
    if (t.includes('motherboard') || t === 'mb') return 'motherboard';
    if (t.includes('ram') || t === 'memory') return 'ram';
    if (t.includes('gpu') || t.includes('graphics')) return 'gpu';
    if (t.includes('psu') || t.includes('power supply')) return 'psu';
    if (t.includes('case') || t === 'cabinet') return 'case';
    if (t.includes('cooler') || t.includes('cooling')) return 'cooler';
    if (t.includes('storage') || t === 'ssd' || t === 'hdd') return 'storage';
    return '';
}

function updateCompatFieldsVisibility(typeElId, containerId) {
    const typeEl = document.getElementById(typeElId);
    const cId = containerId || 'compatFieldsContainer';
    const container = document.getElementById(cId);
    const hintId = cId === 'editCompatFieldsContainer' ? 'editCompatTypeHint' : 'compatTypeHint';
    const hint = document.getElementById(hintId);
    if (!typeEl || !container) return;
    const normType = normalizeTypeForCompat(typeEl.value);
    const fields = container.querySelectorAll('.compat-field');
    let visibleCount = 0;
    fields.forEach(f => {
        const forTypes = (f.getAttribute('data-compat-for') || '').split(/\s+/).filter(Boolean);
        const show = normType && forTypes.includes(normType);
        f.style.display = show ? '' : 'none';
        if (show) visibleCount++;
    });
    if (hint) {
        hint.textContent = normType
            ? `Showing ${visibleCount} field(s) for ${normType}.`
            : 'Select a product type to see compatibility fields.';
    }
}

function setCompatFields(prefix, item) {
    const p = prefix || '';
    const s = (id, val) => { const el = document.getElementById(p + id); if (el && val != null) el.value = val; };
    s('compat-socket', item?.socket); s('compat-tdp', item?.tdp); s('compat-memory-type', item?.memoryType);
    s('compat-max-memory-speed', item?.maxMemorySpeed); s('compat-pcie-version', item?.pcieVersion);
    s('compat-generation', item?.generation); s('compat-bios-version', item?.biosVersionRequired);
    s('compat-chipset', item?.chipset); s('compat-form-factor', item?.formFactor);
    s('compat-memory-slots', item?.memorySlots); s('compat-max-memory', item?.maxMemory);
    s('compat-pcie-x16-slots', item?.pcieX16Slots); s('compat-m2-slots', item?.m2Slots);
    s('compat-sata-ports', item?.sataPorts); s('compat-supported-cpu-generations', item?.supportedCpuGenerations);
    s('compat-wifi-support', item?.wifiSupport); s('compat-capacity-per-module', item?.capacityPerModule);
    s('compat-modules-count', item?.modulesCount); s('compat-speed', item?.speed); s('compat-voltage', item?.voltage);
    s('compat-length-mm', item?.lengthMm); s('compat-height-mm', item?.heightMm);
    s('compat-thickness-slots', item?.thicknessSlots); s('compat-required-pcie', item?.requiredPcieConnectors);
    s('compat-recommended-psu-wattage', item?.recommendedPsuWattage); s('compat-wattage', item?.wattage);
    s('compat-pcie-connectors', item?.pcieConnectors); s('compat-cpu-power-connectors', item?.cpuPowerConnectors);
    s('compat-sata-connectors', item?.sataConnectors); s('compat-modular-type', item?.modularType);
    s('compat-supported-form-factors', item?.supportedFormFactors); s('compat-max-gpu-length', item?.maxGpuLength);
    s('compat-max-cpu-cooler-height', item?.maxCpuCoolerHeight); s('compat-psu-support', item?.psuSupport);
    s('compat-drive-bays-25', item?.driveBays25); s('compat-drive-bays-35', item?.driveBays35);
    s('compat-supported-sockets', item?.supportedSockets); s('compat-tdp-rating', item?.tdpRating);
    s('compat-radiator-size', item?.radiatorSize); s('compat-interface-type', item?.interfaceType);
    s('compat-storage-form-factor', item?.storageFormFactor);
}

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
    Object.assign(payload, getCompatPayload(''));

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

        if (currentItemDraftId) {
            try {
                await apiFetch(`/drafts/items/${currentItemDraftId}`, { method: 'DELETE' });
            } catch (e) {
                console.warn('Delete draft after add product failed:', e);
            }
            currentItemDraftId = null;
            loadItemDrafts();
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

            setCompatFields('edit-', item);
            updateCompatFieldsVisibility('edit-type', 'editCompatFieldsContainer');

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
    const originalItem = items.find(i => i.productId === productId);
    const originalPrice = originalItem != null ? parseFloat(originalItem.price) : NaN;
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
    Object.assign(payload, getCompatPayload('edit-'));

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
        
        // Log: Price Updated if price changed, otherwise Edited
        if (originalItem && !isNaN(originalPrice) && originalPrice !== price) {
            addLog('Price Updated', CURRENT_USER_ROLE, `Updated price of ${productName} (${productId}): ₹${originalPrice} → ₹${price}`);
        } else {
            addLog('Edited', CURRENT_USER_ROLE, `Edited product: ${productName} (${productId})`);
        }
        
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
async function exportCustomerHistoryToCsv() {
    try {
        const customersResponse = await getCustomers();
        const customers = Array.isArray(customersResponse) ? customersResponse : (customersResponse?.data || []);
        if (customers.length === 0) {
            alert('No customer data to export.');
            return;
        }
        customers.sort((a, b) => {
            try {
                const dateA = new Date(a.lastQuotationDate);
                const dateB = new Date(b.lastQuotationDate);
                return dateB - dateA;
            } catch (e) { return 0; }
        });
        const headers = ['Name', 'Email', 'Phone', 'Address', 'Last Quotation Date'];
        const escapeCsv = (v) => {
            const s = String(v ?? '').replace(/"/g, '""');
            return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s}"` : s;
        };
        const rows = customers.map(c => [c.name, c.email, c.phone, c.address, c.lastQuotationDate]);
        const csvContent = '\uFEFF' + [headers.map(escapeCsv).join(','), ...rows.map(r => r.map(escapeCsv).join(','))].join('\r\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `customers_export_${new Date().toISOString().slice(0,10)}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    } catch (e) {
        console.error('Export failed:', e);
        alert('Failed to export customer data. Please try again.');
    }
}

async function renderCustomersList() {
    const customersResponse = await getCustomers();
    const customers = Array.isArray(customersResponse) ? customersResponse : (customersResponse?.data || []);
    const body = document.getElementById('customersListBody');
    const customersTable = document.getElementById('customersTable');
    const paginationDiv = document.getElementById('customersPagination');
    if (!body) return;
    
    body.innerHTML = '';

    if (customers.length === 0) {
        body.innerHTML = '<tr><td colspan="6" class="muted" style="text-align:center">No customer data available.</td></tr>';
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
        row.insertCell().textContent = customer.lastQuotationDate || 'N/A';
        const actionsCell = row.insertCell();
        const phoneEscaped = (customer.phone || '').replace(/\\/g, '\\\\').replace(/'/g, "\\'");
        actionsCell.innerHTML = `<button class="btn" style="padding: 5px 8px;" onclick="openEditCustomerModal('${phoneEscaped}')" title="Edit customer"><i class="fas fa-edit"></i></button>`;
    });
}

let currentEditCustomerPhone = null;

async function openEditCustomerModal(phone) {
    if (!AUTHORIZED_TO_CREATE_QUOTATIONS.includes(CURRENT_USER_ROLE) && !AUTHORIZED_TO_EDIT_ITEMS.includes(CURRENT_USER_ROLE)) {
        alert('You are not authorized to edit customers.');
        return;
    }
    try {
        const customersResponse = await getCustomers();
        const customers = Array.isArray(customersResponse) ? customersResponse : (customersResponse?.data || []);
        const cust = customers.find(c => c.phone === phone);
        if (!cust) {
            alert('Customer data not found.');
            return;
        }
        currentEditCustomerPhone = phone;
        document.getElementById('edit-cust-phone').value = cust.phone || phone;
        document.getElementById('edit-cust-name').value = cust.name || '';
        document.getElementById('edit-cust-email').value = cust.email || '';
        document.getElementById('edit-cust-address').value = cust.address || '';
        const modal = document.getElementById('editCustomerModal');
        if (modal) modal.style.display = 'block';
    } catch (e) {
        console.error('Error loading customer for edit:', e);
        alert('Failed to load customer data.');
    }
}

async function saveEditCustomer(event) {
    event.preventDefault();
    const phone = currentEditCustomerPhone;
    if (!phone) return;
    const name = document.getElementById('edit-cust-name').value.trim();
    const email = document.getElementById('edit-cust-email').value.trim() || null;
    const address = document.getElementById('edit-cust-address').value.trim() || null;
    if (!name) {
        alert('Name is required.');
        return;
    }
    try {
        const res = await apiFetch('/customers/update-by-phone', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ phone, name, email, address })
        });
        if (res && (res.success !== false)) {
            closeEditCustomerModal();
            renderCustomersList();
            renderCustomerDetailsList();
            alert('Customer updated successfully.');
        } else {
            alert(res?.message || 'Failed to update customer.');
        }
    } catch (e) {
        console.error('Save customer error:', e);
        alert('Failed to update customer.');
    }
}

function closeEditCustomerModal() {
    const modal = document.getElementById('editCustomerModal');
    if (modal) modal.style.display = 'none';
    currentEditCustomerPhone = null;
}

function initEditCustomerModal() {
    const modal = document.getElementById('editCustomerModal');
    if (!modal) return;
    document.getElementById('editCustomerForm')?.addEventListener('submit', saveEditCustomer);
    document.getElementById('closeEditCustomerModal')?.addEventListener('click', closeEditCustomerModal);
    document.getElementById('cancelEditCustomerBtn')?.addEventListener('click', closeEditCustomerModal);
    modal.onclick = (e) => { if (e.target === modal) closeEditCustomerModal(); };
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape' && modal.style.display === 'block') closeEditCustomerModal();
    });
}

// Alias for backward compatibility (create quotation with customer pre-filled)
async function editCustomer(phone) {
    openEditCustomerModal(phone);
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
    
    getCustomers().then(customers => {
        const arr = Array.isArray(customers) ? customers : (customers?.data || []);
        const totalPages = Math.ceil(arr.length / customersPerPage);
        if (customersCurrentPage > totalPages) customersCurrentPage = totalPages;
        renderCustomersList();
    });
}

async function getCustomerByPhone(phoneNumber) {
    const customers = await getCustomers();
    const arr = Array.isArray(customers) ? customers : (customers?.data || []);
    return arr.find(c => c.phone === phoneNumber) || null;
}

// --- Customer Details Management ---
async function renderCustomerDetailsList() {
    const customersResponse = await getCustomers();
    const customers = Array.isArray(customersResponse) ? customersResponse : (customersResponse?.data || []);
    const body = document.getElementById('customerDetailsListBody');
    const customersTable = document.getElementById('customerDetailsTable');
    const paginationDiv = document.getElementById('customerDetailsPagination');
    if (!body) return;
    
    body.innerHTML = '';

    if (customers.length === 0) {
        body.innerHTML = '<tr><td colspan="7" class="muted" style="text-align:center">No customer data available.</td></tr>';
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
    const totalPages = Math.ceil(customers.length / customerDetailsPerPage);
    const startIndex = (customerDetailsCurrentPage - 1) * customerDetailsPerPage;
    const endIndex = startIndex + customerDetailsPerPage;
    const paginatedCustomers = customers.slice(startIndex, endIndex);

    // Update pagination controls
    updateCustomerDetailsPaginationControls(totalPages, customers.length);

        paginatedCustomers.forEach((customer, index) => {
        const row = body.insertRow();
        row.className = 'customer-row';
        const phoneEscaped = (customer.phone || '').replace(/\\/g, '\\\\').replace(/'/g, "\\'");
        row.innerHTML = `
            <td>${startIndex + index + 1}</td>
            <td>${(customer.name || 'N/A').replace(/</g, '&lt;')}</td>
            <td>${(customer.email || 'N/A').replace(/</g, '&lt;')}</td>
            <td>${(customer.phone || 'N/A').replace(/</g, '&lt;')}</td>
            <td>${(customer.address || 'N/A').replace(/</g, '&lt;')}</td>
            <td>${(customer.lastQuotationDate || '').replace(/</g, '&lt;')}</td>
            <td><button class="btn" style="padding: 5px 8px;" onclick="event.stopPropagation(); editCustomer('${phoneEscaped}')" title="Create quotation for this customer"><i class="fas fa-edit"></i></button></td>
        `;
        
        // Add click event to toggle quotations
        row.addEventListener('click', () => toggleCustomerQuotations(customer.phone, row));
    });
}

function updateCustomerDetailsPaginationControls(totalPages, totalItems) {
    const pageNumbersDiv = document.getElementById('customerDetailsPageNumbers');
    const nextBtn = document.getElementById('customerDetailsNextBtn');
    const prevBtn = document.getElementById('customerDetailsPrevBtn');
    const pageInfo = document.getElementById('customerDetailsPageInfo');

    if (pageNumbersDiv) {
        pageNumbersDiv.innerHTML = '';
        
        if (totalPages === 0) {
            if (pageInfo) pageInfo.textContent = '';
            return;
        }

        // Update page info
        if (pageInfo) {
            const startItem = (customerDetailsCurrentPage - 1) * customerDetailsPerPage + 1;
            const endItem = Math.min(customerDetailsCurrentPage * customerDetailsPerPage, totalItems);
            pageInfo.textContent = `Page ${customerDetailsCurrentPage} of ${totalPages} • Showing ${startItem}-${endItem} of ${totalItems}`;
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
            if (customerDetailsCurrentPage <= 4) {
                // Show first pages
                startPage = 1;
                endPage = maxPagesToShow - 1;
                showEndEllipsis = true;
            } else if (customerDetailsCurrentPage >= totalPages - 3) {
                // Show last pages
                startPage = totalPages - (maxPagesToShow - 2);
                endPage = totalPages;
                showStartEllipsis = true;
            } else {
                // Show pages around current
                startPage = customerDetailsCurrentPage - 2;
                endPage = customerDetailsCurrentPage + 2;
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
                customerDetailsCurrentPage = 1;
                renderCustomerDetailsList();
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
            if (i === customerDetailsCurrentPage) {
                pageBtn.classList.add('active');
            }
            pageBtn.textContent = i;
            
            pageBtn.onclick = () => {
                customerDetailsCurrentPage = i;
                renderCustomerDetailsList();
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
                customerDetailsCurrentPage = totalPages;
                renderCustomerDetailsList();
            };
            pageNumbersDiv.appendChild(lastBtn);
        }
    }

    // Update Previous and Next buttons
    if (prevBtn) {
        prevBtn.disabled = customerDetailsCurrentPage <= 1;
    }
    if (nextBtn) {
        nextBtn.disabled = customerDetailsCurrentPage >= totalPages;
    }
}

function goToCustomerDetailsPage(direction) {
    const body = document.getElementById('customerDetailsListBody');
    if (!body) return;
    
    customerDetailsCurrentPage += direction;
    if (customerDetailsCurrentPage < 1) customerDetailsCurrentPage = 1;
    
    getCustomers().then(customers => {
        const arr = Array.isArray(customers) ? customers : (customers?.data || []);
        const totalPages = Math.ceil(arr.length / customerDetailsPerPage);
        if (customerDetailsCurrentPage > totalPages) customerDetailsCurrentPage = totalPages;
        renderCustomerDetailsList();
    });
}

// Toggle customer quotations dropdown
async function toggleCustomerQuotations(customerPhone, customerRow) {
    const existingQuotationsRow = customerRow.nextElementSibling;
    const isExpanded = customerRow.classList.contains('expanded');
    
    // Close all other expanded rows
    document.querySelectorAll('.customer-row.expanded').forEach(row => {
        row.classList.remove('expanded');
        const nextRow = row.nextElementSibling;
        if (nextRow && nextRow.classList.contains('customer-quotation-row')) {
            nextRow.remove();
        }
    });
    
    if (isExpanded) {
        // Close current row
        customerRow.classList.remove('expanded');
        if (existingQuotationsRow && existingQuotationsRow.classList.contains('customer-quotation-row')) {
            existingQuotationsRow.remove();
        }
        return;
    }
    
    // Expand current row
    customerRow.classList.add('expanded');
    
    try {
        const quotationsResponse = await getQuotations();
        const quotations = Array.isArray(quotationsResponse) ? quotationsResponse : (quotationsResponse?.data || []);
        
        // Filter quotations for this customer
        const customerQuotations = quotations.filter(q => {
            const phone = q.customer?.phone || q.customerPhone;
            return phone === customerPhone;
        });
        
        if (customerQuotations.length === 0) {
            return;
        }
        
        // Get customer serial number from the table
        const customerRows = Array.from(document.querySelectorAll('#customerDetailsListBody .customer-row'));
        const customerIndex = customerRows.findIndex(row => {
            const rowPhone = row.cells[3]?.textContent; // Phone is in 4th column (index 3)
            return rowPhone === customerPhone;
        });
        const customerSerialNumber = customerIndex + 1;
        
        // Create quotations row
        const quotationsRow = document.createElement('tr');
        quotationsRow.className = 'customer-quotation-row';
        quotationsRow.innerHTML = `
            <td colspan="6">
                <div class="quotation-details">
                    <table class="data-table" style="margin: 0; background: white;">
                        <thead>
                            <tr>
                                <th>Quotation ID</th>
                                <th>Date</th>
                                <th>Timestamp</th>
                                <th>Total Amount</th>
                                <th>Items Count</th>
                                <th>Created By</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${customerQuotations.map((quotation, qIndex) => `
                                <tr>
                                    <td>${customerSerialNumber}.${qIndex + 1}</td>
                                    <td>${new Date(quotation.dateCreated || quotation.created_at).toLocaleDateString()}</td>
                                    <td>${quotation.created_at ? new Date(quotation.created_at).toLocaleString() : new Date(quotation.dateCreated).toLocaleString()}</td>
                                    <td>${formatRupee(quotation.totalAmount || quotation.total)}</td>
                                    <td>${quotation.items ? quotation.items.length : 0}</td>
                                    <td>${quotation.createdBy || quotation.user || 'N/A'}</td>
                                </tr>
                                ${quotation.items && quotation.items.length > 0 ? `
                                    <tr>
                                        <td colspan="6" style="padding: 0;">
                                            <table class="data-table" style="margin: 10px 0 0 20px; width: calc(100% - 20px); background: #fafafa;">
                                                <thead>
                                                    <tr>
                                                        <th style="text-align: left; padding-left: 20px;">Item Details</th>
                                                        <th>Quantity</th>
                                                        <th>Unit Price</th>
                                                        <th>Total</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    ${quotation.items.map((item, itemIndex) => `
                                                        <tr>
                                                            <td style="text-align: left; padding-left: 20px;">
                                                                <div>${customerSerialNumber}.${qIndex + 1}.${itemIndex + 1}. ${item.productName || item.name}</div>
                                                            </td>
                                                            <td>${item.quantity || item.qty}</td>
                                                            <td>${formatRupee(item.unitPrice || item.price)}</td>
                                                            <td>${formatRupee((item.unitPrice || item.price) * (item.quantity || item.qty))}</td>
                                                        </tr>
                                                    `).join('')}
                                                </tbody>
                                            </table>
                                        </td>
                                    </tr>
                                ` : ''}
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            </td>
        `;
        
        // Insert after customer row
        customerRow.parentNode.insertBefore(quotationsRow, customerRow.nextSibling);
        
    } catch (error) {
        console.error('Error loading customer quotations:', error);
    }
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
        { label: 'CPU', value: 'cpu' },
        { label: 'Motherboard', value: 'motherboard' },
        { label: 'RAM', value: 'ram' },
        { label: 'SSD', value: 'ssd' },
        { label: 'GPU', value: 'gpu' },
        { label: 'SMPS', value: 'smps' },
        { label: 'Cooler', value: 'cooler' },
        { label: 'Cabinet', value: 'cabinet' },
        { label: 'Monitor', value: 'monitor' },
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
    let items;
    const compatibleOnly = document.getElementById('compatibleFilterToggle')?.checked;
    const refIds = Array.isArray(quotationItems) ? quotationItems.map(qi => qi.productId).filter(Boolean) : [];
    if (compatibleOnly && refIds.length > 0) {
        try {
            const resp = await apiFetch('/items/compatible?with=' + encodeURIComponent(refIds.join(',')));
            items = (resp && resp.data) ? resp.data : (resp && Array.isArray(resp) ? resp : []);
        } catch (e) {
            console.warn('Compatible filter failed, showing all items:', e);
            items = await getItems();
        }
    } else {
        items = await getItems();
    }
    const listDiv = document.getElementById('availableItemsList');
    listDiv.innerHTML = '';

    const normalizedFilter = (filter || '').toLowerCase();
    const normalizedTypeFilter = (typeFilter || '').toLowerCase();
    const filteredItems = items.filter(item => {
        const productName = (item.productName || item.name || '').toLowerCase();
        const productId = (item.productId || item.id || '').toString().toLowerCase();
        const matchesSearch = !normalizedFilter || 
            productName.includes(normalizedFilter) ||
            productId.includes(normalizedFilter);
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
            type: itemToAdd.type,
            price: price,
            quantity: 1,
            gstRate: gstRate,
            description: itemToAdd.description,
        });
    }

    renderQuotationItems();
    updateGrandTotal();
    scheduleQuotationDraftSave();
    if (document.getElementById('compatibleFilterToggle')?.checked) {
        const searchValue = document.getElementById('itemSearchInput')?.value || '';
        const activeTypeFilter = document.querySelector('.type-filter-btn.active')?.dataset.type || '';
        renderAvailableItemsForQuotation(searchValue, activeTypeFilter);
    }
}

function removeItemFromQuotation(productId) {
    quotationItems = quotationItems.filter(item => item.productId !== productId);
    renderQuotationItems();
    updateGrandTotal();
    scheduleQuotationDraftSave();
    if (document.getElementById('compatibleFilterToggle')?.checked) {
        const searchValue = document.getElementById('itemSearchInput')?.value || '';
        const activeTypeFilter = document.querySelector('.type-filter-btn.active')?.dataset.type || '';
        renderAvailableItemsForQuotation(searchValue, activeTypeFilter);
    }
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
    scheduleQuotationDraftSave();
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
    scheduleQuotationDraftSave();
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
    scheduleQuotationDraftSave();
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
                            addedBy: addedBy,
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
        images: await ensureImagesAreUrls(getUploadedImages()),
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
        
        // Download as PDF
        await downloadQuotationAsPdfDirect(quotationData);

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
        clearImageUpload();
        renderQuotationItems();
        updateGrandTotal();
        document.getElementById('itemSearchInput').value = '';
        renderAvailableItemsForQuotation();

        if (currentQuotationDraftId) {
            try {
                await apiFetch(`/drafts/quotations/${currentQuotationDraftId}`, { method: 'DELETE' });
            } catch (e) {
                console.warn('Delete draft after create failed:', e);
            }
            currentQuotationDraftId = null;
            loadQuotationDrafts();
        }
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
            backgroundColor: '#ffffff', // Dark background to match template
            width: 800,
            height: pdfTemplate.scrollHeight || pdfTemplate.offsetHeight,
            x: 0,
            y: 0,
            scrollX: 0,
            scrollY: 0,
            onclone: (clonedDoc) => {
                const clonedElement = clonedDoc.querySelector('#quotationPdfTemplate > div');
                if (clonedElement) {
                    clonedElement.style.backgroundImage = 'none';
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

async function generateQuotationHtml(quotation, options = {}) {
    if (!quotation) {
        console.error('Quotation data is missing');
        return '<div>Error: Quotation data not available</div>';
    }
    
    const settings = await getSettings();
    const logoBase64 = settings.logo || '';
    const brandName = settings.brand || 'TECHTITANS';
    const companyGstId = settings.companyGstId || 'N/A';
    const validityDays = quotation.validityDays || settings.validityDays || settings.defaultValidityDays || 3;
    
    // Get PDF theme colors
    const pdfThemeName = settings.pdfTheme || 'default';
    const theme = PDF_THEMES[pdfThemeName] || PDF_THEMES.default;
    
    // Company details - using defaults if not in settings
    const companyAddress = settings.companyAddress || '1102, second Floor, Before Atithi Satkar<br>Hotel OTC Road, Bangalore 560002';
    const companyEmail = settings.companyEmail || 'advanceinfotech21@gmail.com';
    const companyPhone = settings.companyPhone || '+91 63626 18184';

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
                    type: tempItem.type || item.type,
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

    const fallbackLogoUrl = (typeof window !== 'undefined' && window.location && window.location.pathname)
        ? (window.location.pathname.replace(/\/[^/]*$/, '') || '') + '/images/Logo.png'
        : 'images/Logo.png';
    const logoImgHtml = options.includeLogo
        ? `<div style="position: absolute; top: 20px; left: 56px; z-index: 10;"><img src="${logoBase64 || fallbackLogoUrl}" alt="Logo" style="width: 200px; height: auto; object-fit: contain;"></div>`
        : '';
    const customerImageSrc = (Array.isArray(quotation.images) && quotation.images[0])
        ? (quotation.images[0].startsWith('data:') || quotation.images[0].startsWith('http') ? quotation.images[0] : (typeof window !== 'undefined' && window.location ? window.location.origin + (quotation.images[0].startsWith('/') ? '' : '/') + quotation.images[0] : quotation.images[0]))
        : null;
    const customerImageHtml = customerImageSrc ? `<div style="position: absolute; top: 20px; right: 56px; z-index: 10;"><img src="${customerImageSrc}" alt="Customer Image" style="width: 200px; height: auto; max-height: 200px; object-fit: contain; border-radius: 8px; border: 1px solid ${theme.border}; box-shadow: 0 2px 4px rgba(0,0,0,0.1);"></div>` : '';

    // Page 2: Images attached to quotation (same header/footer, images instead of table)
    if (options.page2Images && options.page2Images.length > 0) {
        const imagesGridHtml = options.page2Images.map(item => {
            const imgSrc = item.image || '';
            if (!imgSrc) return '';
            return `
                <div style="margin-bottom: 24px; width: 100%; position: relative;">
                    <img src="${imgSrc}" alt="Preview" style="width: 90%; max-height: 650px; margin: 0 auto; object-fit: contain; border: 1px solid ${theme.border}; border-radius: 8px; display: block;">
                    <div style="position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; pointer-events: none;">
                        <span style="font-size: 48px; font-weight: 700; color: rgba(255,255,255,0.45); letter-spacing: 0.15em; transform: rotate(-35deg); white-space: nowrap; text-shadow: 0 1px 3px rgba(0,0,0,0.4);">TECHTITANS</span>
                    </div>
                </div>
            `;
        }).join('');
        return `
                <div style="width: 800px; min-height: 1123px; margin: 0; background: ${theme.pastelBg}; font-family: 'Segoe UI', system-ui, -apple-system, sans-serif; padding: 48px 56px; position: relative; color: #1f2937; box-sizing: border-box;">
                    <style>.theme-border { border-color: ${theme.border} !important; }</style>
                    ${logoImgHtml}
                    ${customerImageHtml}
                    <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 40px; margin-top: 120px;">
                        <div>
                            <div style="font-size: 14px; font-weight: 600; color: ${theme.primary}; margin-top: 8px; margin-bottom: 4px;">AdvanceInfoTech</div>
                            <div style="font-size: 12px; color: #6b7280;">${companyAddress}</div>
                            <div style="font-size: 12px; color: #6b7280;">${companyEmail}</div>
                            <div style="font-size: 12px; color: #6b7280;">${companyPhone}</div>
                        </div>
                        <div style="flex: 1; text-align: center;"><h1 style="margin: 0; font-size: 26px; font-weight: 600; color: ${theme.primary}; letter-spacing: -0.02em;">Project Preview</h1></div>
                        <div style="width: 200px;"></div>
                    </div>
                    <div style="display: flex; justify-content: space-between; margin-bottom: 32px; padding-bottom: 24px; border-bottom: 1px solid ${theme.border};">
                        <div>${(function() { const p = [customer?.name, customer?.phone, customer?.email, customer?.address].filter(Boolean); if (!p.length) return ''; return `<div style="font-size: 14px; font-weight: 600; color: ${theme.primary}; margin-bottom: 4px;">Quotation to</div><div style="font-size: 12px; color: #374151;"><span style="font-weight: 600;">${p.map((part, i) => (i ? ' <span style="font-weight: 700; margin: 0 0.35em;">|</span> ' : '') + part).join('')}</span></div>`; })()}</div>
                        <div style="text-align: right;"><div style="font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; color: #6b7280;">Date</div><div style="font-size: 14px;">${dateCreated}</div></div>
                    </div>
                    <div style="margin-top: 24px; margin-bottom: 24px;">
                        ${imagesGridHtml}
                    </div>
                    <div style="position: absolute; bottom: 48px; left: 56px; right: 56px; font-size: 14px; text-align: center; line-height: 1.7; color: #5c5c5c;">
                        <div>All prices are valid for <span style="color: ${theme.primary}">${validityDays} days</span> from the date of quotation.</div>
                        <div>"<span style="color: ${theme.primary}">Free</span> pan India warranty" • <span style="color: ${theme.primary}">3-year</span> call support <span style="color: ${theme.accent}">Monday to Saturday 12pm to 7pm</span></div>
                        <div>All products from <span style="color: ${theme.primary}">direct manufacture</span> or <span style="color: ${theme.primary}">store warranty</span></div>
                    </div>
                </div>
        `;
    }

    return `
                <div style="width: 800px; min-height: 1123px; margin: 0; background: ${theme.pastelBg}; font-family: 'Segoe UI', system-ui, -apple-system, sans-serif; padding: 48px 56px; position: relative; color: #1f2937; box-sizing: border-box;">
                    <style>
                        .q-table { width: 100%; border-collapse: collapse; margin: 24px 0; font-size: 14px; }
                        .q-table th { text-align: left; padding: 14px 12px; border-bottom: 2px solid ${theme.primary}; color: ${theme.secondary}; font-weight: 600; }
                        .q-table td { padding: 14px 12px; border-bottom: 1px solid ${theme.border}; }
                        .q-table .text-right { text-align: right; }
                        .theme-header { color: ${theme.primary}; }
                        .theme-accent { color: ${theme.accent}; }
                        .theme-border { border-color: ${theme.border} !important; }
                    </style>
                    ${logoImgHtml}
                    ${customerImageHtml}
                    <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 40px; margin-top: 120px;">
                        <div>
                            <div style="font-size: 14px; font-weight: 600; color: ${theme.primary}; margin-top: 8px; margin-bottom: 4px;">AdvanceInfoTech</div>
                            <div style="font-size: 12px; color: #6b7280;">${companyAddress}</div>
                            <div style="font-size: 12px; color: #6b7280;">${companyEmail}</div>
                            <div style="font-size: 12px; color: #6b7280;">${companyPhone}</div>
                        </div>
                        <div style="flex: 1; text-align: center;">
                            <h1 style="margin: 0; font-size: 26px; font-weight: 600; color: ${theme.primary}; letter-spacing: -0.02em;">Quotation</h1>
                        </div>
                        <div style="width: 200px;"></div>
                    </div>
                    <div style="display: flex; justify-content: space-between; margin-bottom: 32px; padding-bottom: 24px; border-bottom: 1px solid ${theme.border};">
                        <div>
                            ${(function() { const p = [customer?.name, customer?.phone, customer?.email, customer?.address].filter(Boolean); if (!p.length) return ''; return `<div style="font-size: 14px; font-weight: 600; color: ${theme.primary}; margin-bottom: 4px;">Quotation to</div><div style="font-size: 12px; color: #374151; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;"><span style="font-weight: 600;">${p.map((part, i) => (i ? ' <span style="font-weight: 700; margin: 0 0.35em;">|</span> ' : '') + part).join('')}</span></div>`; })()}
                        </div>
                        <div style="text-align: right;">
                            <div style="font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; color: #6b7280;">Date</div>
                            <div style="font-size: 14px;">${dateCreated}</div>
                        </div>
                    </div>
                    <table class="q-table">
                        <thead>
                            <tr>
                                <th>S.No</th>
                                <th>Type</th>
                                <th>Description</th>
                                <th class="text-right">Qty</th>
                                <th class="text-right">Amount</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${items.length > 0 ? items.map((item, idx) => {
                                const itemPrice = parseFloat(item.price || 0);
                                const itemQuantity = parseInt(item.quantity || 1);
                                const itemTotal = itemPrice * itemQuantity;
                                return `
                                    <tr>
                                        <td>${idx + 1}</td>
                                        <td>${item.type || 'N/A'}</td>
                                        <td>${item.productName || 'N/A'}</td>
                                        <td class="text-right">${itemQuantity}</td>
                                        <td class="text-right">${formatRupee(itemTotal)}</td>
                                    </tr>
                                `;
                            }).join('') : '<tr><td colspan="5" style="text-align: center; padding: 24px; color: #9ca3af;">No items</td></tr>'}
                        </tbody>
                    </table>
                    <div style="margin-top: 24px; text-align: right; padding-bottom: 24px; border-bottom: 1px solid ${theme.border};">
                        <div style="display: inline-block; width: 260px; text-align: right;">
                            <div style="display: flex; justify-content: space-between; padding: 8px 0; font-size: 14px;">
                                <span style="color: #6b7280;">Subtotal (excl). GST)</span>
                                <span>${formatRupee(totalAfterDiscount)}</span>
                            </div>
                            <div style="display: flex; justify-content: space-between; padding: 12px 0; margin-top: 8px; border-top: 2px solid ${theme.primary}; font-size: 16px; font-weight: 600;">
                                <span>Total</span>
                                <span>${formatRupee(grandTotal)}</span>
                            </div>
                        </div>
                    </div>
                    <div style="position: absolute; bottom: 48px; left: 56px; right: 56px; font-size: 14px; text-align: center; line-height: 1.7; color: #5c5c5c;">
                        <div>All prices are valid for <span style="color: ${theme.primary}">${validityDays} days</span> from the date of quotation.</div>
                        <div>"<span style="color: ${theme.primary}">Free</span> pan India warranty" • <span style="color: ${theme.primary}">3-year</span> call support <span style="color: ${theme.accent}">Monday to Saturday 12pm to 7pm</span></div>
                        <div>All products from <span style="color: ${theme.primary}">direct manufacture</span> or <span style="color: ${theme.primary}">store warranty</span></div>
                    </div>
                </div>
    `;
}

// --- PDF Download Logic (modal; keep name for backward compatibility) ---
async function downloadQuotationAsPng(quotation) {
    const content = document.getElementById('quotationViewContent');
    if (!content) {
        alert('Quotation content not found.');
        return;
    }
    const quotationDiv = content.querySelector('div[style*="width: 800px"]');
    if (!quotationDiv) {
        alert('Quotation template not found in modal.');
        return;
    }
    try {
        const downloadBtn = document.getElementById('downloadQuotationPng');
        const originalBtnText = downloadBtn?.innerHTML || downloadBtn?.textContent;
        if (downloadBtn) {
            downloadBtn.disabled = true;
            downloadBtn.innerHTML = 'Generating...';
        }
        const images = quotationDiv.querySelectorAll('img');
        const imagePromises = Array.from(images).map(img => {
            if (img.complete) return Promise.resolve();
            return new Promise((resolve) => {
                img.onload = resolve;
                img.onerror = resolve;
                setTimeout(resolve, 2000);
            });
        });
        await Promise.all(imagePromises);
        await new Promise(resolve => setTimeout(resolve, 500));
        const canvas = await html2canvas(quotationDiv, { 
            scale: 2, 
            logging: false, 
            useCORS: true,
            allowTaint: true,
            backgroundColor: '#ffffff',
            width: 800,
            height: quotationDiv.scrollHeight || quotationDiv.offsetHeight,
            x: 0,
            y: 0,
            scrollX: 0,
            scrollY: 0,
            onclone: (clonedDoc) => {
                const clonedElement = clonedDoc.querySelector('div[style*="width: 800px"]');
                if (clonedElement) {
                    clonedElement.style.backgroundImage = 'none';
                }
            }
        });
        if (!canvas || canvas.width === 0 || canvas.height === 0) {
            throw new Error('Canvas is empty');
        }
        const doc = new window.jspdf.jsPDF({ unit: 'pt', format: 'a4', compress: true });
        const imgWidth = 595.28;
        const pageHeight = 841.89;
        const imgHeight = (canvas.height * imgWidth) / canvas.width;
        const imgData = canvas.toDataURL('image/png', 1.0);
        const itemsCount = quotation.items ? (Array.isArray(quotation.items) ? quotation.items.length : 0) : 0;
        const needsMultiplePages = itemsCount > 7 || imgHeight > pageHeight;
        if (needsMultiplePages) {
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
            const contentHeight = Math.min(imgHeight, pageHeight);
            doc.addImage(imgData, 'PNG', 0, 0, imgWidth, contentHeight, undefined, 'FAST');
        }
        const customerName = quotation.customer?.name || quotation.customerName || 'Quotation';
        const sanitizedName = customerName.toString().replace(/[^a-zA-Z0-9]/g, '_').replace(/_+/g, '_').trim();
        const quotationIdVal = quotation.quotationId || quotation.id || 'N/A';
        doc.save(`Quotation_${sanitizedName}_${quotationIdVal}.pdf`);
        if (downloadBtn) {
            downloadBtn.disabled = false;
            downloadBtn.innerHTML = originalBtnText || '<i class="fas fa-file-pdf"></i> PDF';
        }
    } catch (error) {
        console.error('PDF generation error:', error);
        alert('Failed to generate PDF. Please try again.');
        const downloadBtn = document.getElementById('downloadQuotationPng');
        if (downloadBtn) {
            downloadBtn.disabled = false;
            downloadBtn.innerHTML = '<i class="fas fa-file-pdf"></i> PDF';
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

    // Apply price sorting if enabled
    if (itemsCurrentPriceSort === 'asc') {
        filteredItems.sort((a, b) => parseFloat(a.price || 0) - parseFloat(b.price || 0));
    } else if (itemsCurrentPriceSort === 'desc') {
        filteredItems.sort((a, b) => parseFloat(b.price || 0) - parseFloat(a.price || 0));
    }

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
        const quoteId = quote.quotationId || quote.id;
        actionsCell.innerHTML = `
                    <button class="btn primary" style="padding: 5px 8px; margin-right: 5px;" onclick="fetchQuotationAndGeneratePdf('${quoteId}')" title="Download PDF"><i class="fas fa-download"></i></button>
                    <button class="btn secondary" style="padding: 5px 8px; margin-right: 5px;" onclick="viewQuotationDetails('${quoteId}')" title="View"><i class="fas fa-eye"></i></button>
                    <button class="btn" style="padding: 5px 8px; margin-right: 5px;" onclick="openEditQuotationModal('${quoteId}')" title="Edit"><i class="fas fa-edit"></i></button>
                    <button class="btn danger" style="padding: 5px 8px;" onclick="deleteQuotation('${quoteId}')" title="Delete"><i class="fas fa-trash-alt"></i></button>
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
        { label: 'CPU', value: 'cpu' },
        { label: 'Motherboard', value: 'motherboard' },
        { label: 'RAM', value: 'ram' },
        { label: 'SSD', value: 'ssd' },
        { label: 'GPU', value: 'gpu' },
        { label: 'SMPS', value: 'smps' },
        { label: 'Cooler', value: 'cooler' },
        { label: 'Cabinet', value: 'cabinet' },
        { label: 'Monitor', value: 'monitor' },
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
            
            // Reset price sort when type filter changes
            itemsCurrentPriceSort = 'none';
            const sortBtn = document.getElementById('priceSortBtn');
            const sortText = document.getElementById('priceSortText');
            if (sortBtn && sortText) {
                sortText.textContent = 'Low to High';
                sortBtn.classList.remove('primary');
                sortBtn.classList.add('secondary');
            }

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

async function exportQuotationHistoryToCsv() {
    try {
        const quotationsResponse = await getQuotations();
        const quotations = Array.isArray(quotationsResponse) ? quotationsResponse : (quotationsResponse?.data || []);
        if (!Array.isArray(quotations) || quotations.length === 0) {
            alert('No quotations to export.');
            return;
        }
        quotations.sort((a, b) => {
            try {
                const dateA = new Date(a.dateCreated || a.created_at || 0);
                const dateB = new Date(b.dateCreated || b.created_at || 0);
                return dateB - dateA;
            } catch (e) { return 0; }
        });
        const headers = ['Quotation ID', 'Customer Name', 'Customer Phone', 'Customer Email', 'Date Created', 'Sub Total', 'Discount %', 'Discount Amount', 'Total GST', 'Grand Total', 'Items Count', 'Created By'];
        const escapeCsv = (v) => {
            const s = String(v ?? '').replace(/"/g, '""');
            return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s}"` : s;
        };
        const rows = quotations.map(q => {
            const cust = q.customer || {};
            const name = cust.name || q.customerName || 'N/A';
            const phone = cust.phone || q.customerPhone || '';
            const email = cust.email || q.customerEmail || '';
            const date = q.dateCreated || q.created_at || 'N/A';
            const subTotal = parseFloat(q.subTotal) || 0;
            const discountPct = parseFloat(q.discountPercent) || 0;
            const discountAmt = parseFloat(q.discountAmount) || 0;
            const totalGst = parseFloat(q.totalGstAmount) || 0;
            const grandTotal = parseFloat(q.grandTotal) || 0;
            const itemsCount = Array.isArray(q.items) ? q.items.length : 0;
            const createdBy = q.createdBy || q.created_by || 'N/A';
            return [q.quotationId || q.id || 'N/A', name, phone, email, date, subTotal, discountPct, discountAmt, totalGst, grandTotal, itemsCount, createdBy];
        });
        const csvContent = '\uFEFF' + [headers.map(escapeCsv).join(','), ...rows.map(r => r.map(escapeCsv).join(','))].join('\r\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `quotations_export_${new Date().toISOString().slice(0,10)}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    } catch (e) {
        console.error('Export failed:', e);
        alert('Failed to export quotations. Please try again.');
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
        
        // Download as PDF
        await downloadQuotationAsPdfDirect(quotationData);
    } catch (e) {
        console.error('Error fetching quotation for PDF:', e);
        alert('Failed to fetch quotation for PDF download');
    }
}

function showPdfLoadingOverlay() {
    let el = document.getElementById('pdfLoadingOverlay');
    if (el) return;
    el = document.createElement('div');
    el.id = 'pdfLoadingOverlay';
    el.setAttribute('aria-live', 'polite');
    el.setAttribute('aria-busy', 'true');
    el.style.cssText = 'position:fixed;inset:0;z-index:99999;background:rgba(0,0,0,0.5);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:16px;';
    el.innerHTML = '<i class="fas fa-file-pdf" style="font-size:48px;color:#fff;opacity:0.9;"></i><i class="fas fa-spinner fa-spin" style="font-size:32px;color:#fff;"></i><span style="color:#fff;font-size:16px;font-weight:500;">Generating PDF...</span>';
    document.body.appendChild(el);
}
function hidePdfLoadingOverlay() {
    const el = document.getElementById('pdfLoadingOverlay');
    if (el && el.parentNode) el.parentNode.removeChild(el);
}

function imageDataUrlToPng(dataUrl) {
    return new Promise((resolve) => {
        if (!dataUrl || typeof dataUrl !== 'string') { resolve(null); return; }
        const isSvg = dataUrl.indexOf('image/svg+xml') !== -1 || dataUrl.indexOf('data:image/svg') !== -1;
        if (!isSvg) { resolve(dataUrl); return; }
        const img = new Image();
        img.onload = function () {
            try {
                const c = document.createElement('canvas');
                c.width = img.naturalWidth || 200;
                c.height = img.naturalHeight || 60;
                const ctx = c.getContext('2d');
                ctx.drawImage(img, 0, 0);
                resolve(c.toDataURL('image/png'));
            } catch (_) { resolve(dataUrl); }
        };
        img.onerror = () => resolve(dataUrl);
        img.src = dataUrl;
    });
}

async function downloadQuotationAsPdfDirect(quotation) {
    let tempContainer;
    showPdfLoadingOverlay();
    try {
        const settings = await getSettings();
        let logoDataUrl = settings.logo || null;
        if (!logoDataUrl && typeof window !== 'undefined' && window.location) {
            const basePath = (window.location.pathname || '').replace(/\/[^/]*$/, '') || '';
            const base = window.location.origin + (basePath ? basePath + '/' : '/') + 'images/Logo.';
            try {
                const r = await fetch(base + 'svg');
                if (r.ok) { logoDataUrl = await r.text(); logoDataUrl = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(logoDataUrl))); }
            } catch (_) {}
            if (!logoDataUrl) {
                try {
                    const r = await fetch(base + 'png');
                    if (r.ok) { const blob = await r.blob(); logoDataUrl = await new Promise((res, rej) => { const fr = new FileReader(); fr.onload = () => res(fr.result); fr.onerror = rej; fr.readAsDataURL(blob); }); }
                } catch (_) {}
            }
        }
        const logoPng = logoDataUrl ? await imageDataUrlToPng(logoDataUrl) : null;

        const quotationHtml = await generateQuotationHtml(quotation);
        tempContainer = document.createElement('div');
        tempContainer.style.cssText = 'position:fixed;left:0;top:0;width:800px;z-index:-1;opacity:0.01;pointer-events:none;overflow:visible;';
        tempContainer.innerHTML = quotationHtml;
        document.body.appendChild(tempContainer);

        const quotationDiv = tempContainer.querySelector('div[style*="width: 800px"]');
        if (!quotationDiv) {
            document.body.removeChild(tempContainer);
            alert('Failed to generate quotation template');
            return;
        }

        const images = quotationDiv.querySelectorAll('img');
        await Promise.all(Array.from(images).map((img) => {
            if (img.complete && img.naturalWidth > 0) return Promise.resolve();
            return new Promise((resolve) => {
                img.onload = () => resolve();
                img.onerror = () => resolve();
                setTimeout(resolve, 3000);
            });
        }));
        await new Promise(r => setTimeout(r, 400));

        const contentHeight = quotationDiv.scrollHeight || quotationDiv.offsetHeight;
        const canvas = await html2canvas(quotationDiv, {
            scale: 2,
            logging: false,
            useCORS: false,
            allowTaint: true,
            backgroundColor: '#ffffff',
            width: 800,
            height: contentHeight,
            windowWidth: 800,
            windowHeight: contentHeight,
            x: 0,
            y: 0,
            scrollX: 0,
            scrollY: 0,
            imageTimeout: 0
        });

        if (!canvas || canvas.width === 0 || canvas.height === 0) {
            document.body.removeChild(tempContainer);
            throw new Error('Canvas is empty');
        }

        const doc = new window.jspdf.jsPDF({ unit: 'pt', format: 'a4', compress: true });
        const imgWidth = 595.28;
        const pageHeight = 841.89;
        const imgHeight = (canvas.height * imgWidth) / canvas.width;
        const imgData = canvas.toDataURL('image/png', 1.0);
        const itemsCount = quotation.items ? (Array.isArray(quotation.items) ? quotation.items.length : 0) : 0;
        const needsMultiplePages = itemsCount > 7 || imgHeight > pageHeight;
        if (needsMultiplePages) {
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
            const contentHeightPdf = Math.min(imgHeight, pageHeight);
            doc.addImage(imgData, 'PNG', 0, 0, imgWidth, contentHeightPdf, undefined, 'FAST');
        }

        doc.setPage(1);
        if (logoPng) {
            try { doc.addImage(logoPng, 'PNG', 42, 12, 100, 68); } catch (e) { try { doc.addImage(logoPng, 'JPEG', 42, 12, 100, 68); } catch (_) {} }
        }

        const customerName = quotation.customer?.name || quotation.customerName || 'Quotation';
        const sanitizedName = customerName.toString().replace(/[^a-zA-Z0-9]/g, '_').replace(/_+/g, '_').trim();
        const quotationIdVal = quotation.quotationId || quotation.id || 'N/A';
        doc.save(`Quotation_${sanitizedName}_${quotationIdVal}.pdf`);
    } catch (error) {
        console.error('PDF generation error:', error);
        alert('Failed to generate PDF. Please try again.');
    } finally {
        hidePdfLoadingOverlay();
        if (tempContainer && tempContainer.parentNode) tempContainer.parentNode.removeChild(tempContainer);
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

        // Generate quotation HTML with logo for modal view
        const quotationHtml = await generateQuotationHtml(quote, { includeLogo: true });
        
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

let currentEditQuotationId = null;
let editQuotationItems = [];
let editQuoteImagesArray = [];

function recalcEditQuotationTotal() {
    let subTotal = 0;
    let totalGst = 0;
    editQuotationItems.forEach(it => {
        const price = parseFloat(it.price) || 0;
        const qty = parseInt(it.quantity, 10) || 1;
        const gstRate = parseFloat(it.gstRate) || 0;
        subTotal += price * qty;
        totalGst += price * qty * (gstRate / 100);
    });
    const discountPct = parseFloat(document.getElementById('edit-quote-discount')?.value || 0);
    const discountAmt = subTotal * (discountPct / 100);
    const grandTotal = (subTotal - discountAmt) + totalGst;
    const el = document.getElementById('editQuotationGrandTotal');
    if (el) el.textContent = grandTotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function renderEditQuotationItems() {
    const tbody = document.getElementById('editQuotationItemsBody');
    if (!tbody) return;
    tbody.innerHTML = '';
    editQuotationItems.forEach((it, idx) => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><input type="text" value="${(it.productName || '').replace(/"/g, '&quot;')}" data-field="productName" data-idx="${idx}" style="width:100%;padding:6px;border:1px solid #ddd;border-radius:4px;" placeholder="Product name"></td>
            <td><input type="number" value="${it.price || 0}" data-field="price" data-idx="${idx}" min="0" step="0.01" style="width:80px;padding:6px;border:1px solid #ddd;border-radius:4px;"></td>
            <td><input type="number" value="${it.quantity || 1}" data-field="quantity" data-idx="${idx}" min="1" style="width:60px;padding:6px;border:1px solid #ddd;border-radius:4px;"></td>
            <td><input type="number" value="${it.gstRate || 0}" data-field="gstRate" data-idx="${idx}" min="0" max="100" step="0.01" style="width:60px;padding:6px;border:1px solid #ddd;border-radius:4px;"></td>
            <td><button type="button" class="btn danger" style="padding:4px 8px;" data-remove-idx="${idx}"><i class="fas fa-trash-alt"></i></button></td>
        `;
        tbody.appendChild(tr);
    });
    tbody.querySelectorAll('input').forEach(inp => {
        inp.addEventListener('input', () => {
            const idx = parseInt(inp.dataset.idx, 10);
            const field = inp.dataset.field;
            if (editQuotationItems[idx]) {
                editQuotationItems[idx][field] = field === 'quantity' ? parseInt(inp.value, 10) || 1 : (field === 'price' || field === 'gstRate' ? parseFloat(inp.value) || 0 : inp.value);
                recalcEditQuotationTotal();
            }
        });
    });
    tbody.querySelectorAll('[data-remove-idx]').forEach(btn => {
        btn.addEventListener('click', () => {
            const idx = parseInt(btn.dataset.removeIdx, 10);
            editQuotationItems.splice(idx, 1);
            renderEditQuotationItems();
            recalcEditQuotationTotal();
        });
    });
    recalcEditQuotationTotal();
}

async function openEditQuotationModal(quotationId) {
    if (!AUTHORIZED_TO_CREATE_QUOTATIONS.includes(CURRENT_USER_ROLE) && !AUTHORIZED_TO_EDIT_ITEMS.includes(CURRENT_USER_ROLE)) {
        alert('You are not authorized to edit quotations.');
        return;
    }
    try {
        const data = await apiFetch(`/quotations/${quotationId}`);
        const quote = data?.data || data;
        if (!quote || (!quote.quotationId && !quote.id)) {
            alert('Quotation not found.');
            return;
        }
        const qid = quote.quotationId || quote.id;
        currentEditQuotationId = qid;
        document.getElementById('editQuotationIdLabel').textContent = qid;
        const cust = quote.customer || {};
        document.getElementById('edit-quote-name').value = cust.name || quote.customerName || '';
        document.getElementById('edit-quote-phone').value = cust.phone || quote.customerPhone || '';
        document.getElementById('edit-quote-email').value = cust.email || quote.customerEmail || '';
        document.getElementById('edit-quote-address').value = cust.address || quote.customerAddress || '';
        document.getElementById('edit-quote-discount').value = quote.discountPercent ?? 0;
        editQuotationItems = (quote.items || []).map(it => ({
            productId: it.productId,
            productName: it.productName,
            price: it.price,
            quantity: it.quantity || 1,
            gstRate: it.gstRate ?? 0
        }));
        editQuoteImagesArray = Array.isArray(quote.images) && quote.images.length > 0 ? [quote.images[0]] : [];
        renderEditQuoteImagePreviews();
        renderEditQuotationItems();
        const modal = document.getElementById('editQuotationModal');
        if (modal) modal.style.display = 'block';
    } catch (e) {
        console.error('Error loading quotation for edit:', e);
        alert('Failed to load quotation.');
    }
}

document.getElementById('editQuoteAddItemBtn')?.addEventListener('click', () => {
    editQuotationItems.push({ productId: '', productName: '', price: 0, quantity: 1, gstRate: 0 });
    renderEditQuotationItems();
});

document.getElementById('edit-quote-discount')?.addEventListener('input', recalcEditQuotationTotal);

function renderEditQuoteImagePreviews() {
    const container = document.getElementById('editQuoteImagePreviewList');
    const previewDiv = document.getElementById('editQuoteImagePreview');
    if (!container || !previewDiv) return;
    if (!editQuoteImagesArray || editQuoteImagesArray.length === 0) {
        previewDiv.style.display = 'none';
        return;
    }
    container.innerHTML = editQuoteImagesArray.map((dataUrl, idx) => `
        <div style="position:relative; flex-shrink:0;">
            <div style="position:relative;">
                <img src="${dataUrl}" style="width:60px; height:60px; object-fit:cover; border-radius:6px; border:1px solid #e5e7eb;">
                <div style="position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; pointer-events: none;">
                    <span style="font-size: 9px; font-weight: 700; color: rgba(255,255,255,0.45); letter-spacing: 0.05em; transform: rotate(-35deg); white-space: nowrap; text-shadow: 0 1px 2px rgba(0,0,0,0.4);">TECHTITANS</span>
                </div>
            </div>
            <button type="button" class="edit-remove-img" data-idx="${idx}" style="position:absolute; top:-4px; right:-4px; width:20px; height:20px; border-radius:50%; border:none; background:#dc3545; color:white; cursor:pointer; font-size:12px; line-height:1;">×</button>
        </div>
    `).join('');
    previewDiv.style.display = 'block';
    container.querySelectorAll('.edit-remove-img').forEach(btn => {
        btn.onclick = () => { editQuoteImagesArray.splice(parseInt(btn.dataset.idx), 1); renderEditQuoteImagePreviews(); };
    });
}

document.getElementById('edit-quote-image')?.addEventListener('change', function(e) {
    const files = Array.from(e.target.files || []);
    const file = files[0];
    if (file) {
        const err = validateImageFile(file);
        if (err) { alert(err); e.target.value = ''; return; }
        const reader = new FileReader();
        reader.onload = (ev) => {
            editQuoteImagesArray = [ev.target.result];
            renderEditQuoteImagePreviews();
        };
        reader.readAsDataURL(file);
    }
    e.target.value = '';
});

document.getElementById('editQuoteRemoveAllImages')?.addEventListener('click', () => {
    editQuoteImagesArray = [];
    renderEditQuoteImagePreviews();
});

async function saveEditQuotation(event) {
    event.preventDefault();
    const qid = currentEditQuotationId;
    if (!qid) return;
    const cust = {
        name: document.getElementById('edit-quote-name').value.trim() || '',
        phone: document.getElementById('edit-quote-phone').value.trim() || '',
        email: document.getElementById('edit-quote-email').value.trim() || null,
        address: document.getElementById('edit-quote-address').value.trim() || null
    };
    if (!cust.phone || cust.phone.length < 10) {
        alert('Valid phone number is required.');
        return;
    }
    const items = editQuotationItems.filter(it => it.productName && (parseFloat(it.price) || 0) > 0).map((it, idx) => ({
        productId: it.productId || `custom-${Date.now()}-${idx}`,
        productName: it.productName,
        price: parseFloat(it.price) || 0,
        quantity: parseInt(it.quantity, 10) || 1,
        gstRate: parseFloat(it.gstRate) || 0
    }));
    if (items.length === 0) {
        alert('Add at least one item with a valid price.');
        return;
    }
    const discountPercent = parseFloat(document.getElementById('edit-quote-discount')?.value || 0);
    try {
        const imagesForSave = await ensureImagesAreUrls(editQuoteImagesArray || []);
        const res = await apiFetch(`/quotations/${qid}/update`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ customer: cust, items, discountPercent, images: imagesForSave })
        });
        if (res && (res.success !== false)) {
            closeEditQuotationModal();
            renderHistoryList();
            renderCustomersList();
            renderCustomerDetailsList();
            alert('Quotation updated successfully.');
        } else {
            alert(res?.message || 'Failed to update quotation.');
        }
    } catch (e) {
        console.error('Save quotation error:', e);
        alert('Failed to update quotation.');
    }
}

function closeEditQuotationModal() {
    const modal = document.getElementById('editQuotationModal');
    if (modal) modal.style.display = 'none';
    currentEditQuotationId = null;
    editQuotationItems = [];
    editQuoteImagesArray = [];
}

function initEditQuotationModal() {
    const modal = document.getElementById('editQuotationModal');
    if (!modal) return;
    document.getElementById('editQuotationForm')?.addEventListener('submit', saveEditQuotation);
    document.getElementById('closeEditQuotationModal')?.addEventListener('click', closeEditQuotationModal);
    document.getElementById('cancelEditQuotationBtn')?.addEventListener('click', closeEditQuotationModal);
    modal.onclick = (e) => { if (e.target === modal) closeEditQuotationModal(); };
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape' && modal.style.display === 'block') closeEditQuotationModal();
    });
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

async function renderContactRequestsList() {
    if (!['Owner', 'Admin'].includes(CURRENT_USER_ROLE)) return;

    const body = document.getElementById('contactRequestsListBody');
    const noMsg = document.getElementById('noContactRequestsMessage');
    if (!body) return;
    body.innerHTML = '';

    try {
        const requests = await getContactRequests();
        if (requests.length === 0) {
            noMsg.style.display = 'block';
            return;
        }
        noMsg.style.display = 'none';

        requests.forEach(r => {
            const row = body.insertRow();
            const created = r.created_at ? new Date(r.created_at).toLocaleString('en-IN') : '—';
            const msgShort = (r.message || '').length > 60 ? (r.message.substring(0, 60) + '…') : (r.message || '—');
            const status = r.isRead ? '<span style="color:#27AE60;">Read</span>' : '<span style="color:#E74C3C;">New</span>';
            row.insertCell().textContent = created;
            row.insertCell().textContent = r.name || '—';
            row.insertCell().innerHTML = `<a href="mailto:${r.email || ''}">${r.email || '—'}</a>`;
            row.insertCell().textContent = r.phone || '—';
            row.insertCell().innerHTML = `<span title="${(r.message || '').replace(/"/g, '&quot;')}">${msgShort}</span>`;
            row.insertCell().innerHTML = status;
            const actionsCell = row.insertCell();
            if (!r.isRead) {
                const markBtn = document.createElement('button');
                markBtn.className = 'btn';
                markBtn.style.cssText = 'padding:4px 8px; font-size:12px; margin-right:4px;';
                markBtn.textContent = 'Mark Read';
                markBtn.setAttribute('data-action', 'mark-contact-read');
                markBtn.setAttribute('data-id', r.id);
                actionsCell.appendChild(markBtn);
            }
            const delBtn = document.createElement('button');
            delBtn.className = 'btn danger';
            delBtn.style.cssText = 'padding:4px 8px; font-size:12px;';
            delBtn.textContent = 'Delete';
            delBtn.setAttribute('data-action', 'delete-contact-request');
            delBtn.setAttribute('data-id', r.id);
            actionsCell.appendChild(delBtn);
        });
    } catch (e) {
        noMsg.textContent = 'Failed to load contact requests.';
        noMsg.style.display = 'block';
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

async function renderSettings() {
    console.log('renderSettings() called - starting to render settings...');
    try {
        const settings = await getSettings();
        console.log('renderSettings() - settings received:', settings);

        document.getElementById('settings-brand-name').value = settings.brand || '';
    document.getElementById('settings-company-gst-id').value = settings.companyGstId || '';
    document.getElementById('settings-validity-days').value = settings.validityDays ?? settings.defaultValidityDays ?? 3;
    document.getElementById('validityDaysDisplay').textContent = settings.validityDays ?? settings.defaultValidityDays ?? 3;

    // PDF Theme
    const pdfTheme = settings.pdfTheme || 'default';
    document.getElementById('settings-pdf-theme').value = pdfTheme;
    updateThemePreview(pdfTheme);

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
    
    } catch (error) {
        console.error('renderSettings() error:', error);
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

        // Contact requests count (Owner/Admin only)
        if (['Owner', 'Admin'].includes(CURRENT_USER_ROLE)) {
            try {
                const contactRequests = await getContactRequests();
                const crCountEl = document.getElementById('summaryContactRequestsCount');
                if (crCountEl) crCountEl.textContent = contactRequests.length || 0;
            } catch (e) { /* silent */ }
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
        const summaryContactRequestsCount = document.getElementById('summaryContactRequestsCount');
        
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
        if (summaryContactRequestsCount) summaryContactRequestsCount.textContent = '0';
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
            if (actionLower.includes('price')) actionIcon = 'fa-rupee-sign';
            else if (actionLower.includes('product') || actionLower.includes('item')) actionIcon = 'fa-box';
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
document.getElementById('type')?.addEventListener('input', () => updateCompatFieldsVisibility('type', 'compatFieldsContainer'));
document.getElementById('type')?.addEventListener('change', () => updateCompatFieldsVisibility('type', 'compatFieldsContainer'));
document.getElementById('edit-type')?.addEventListener('input', () => updateCompatFieldsVisibility('edit-type', 'editCompatFieldsContainer'));
document.getElementById('edit-type')?.addEventListener('change', () => updateCompatFieldsVisibility('edit-type', 'editCompatFieldsContainer'));
document.getElementById('editProductForm')?.addEventListener('submit', saveEditProduct);
document.getElementById('closeEditProductModal')?.addEventListener('click', closeEditProductModal);
document.getElementById('cancelEditProductBtn')?.addEventListener('click', closeEditProductModal);
// Initialize edit product modal
initEditProductModal();
// Initialize edit customer and quotation modals
initEditCustomerModal();
initEditQuotationModal();
document.getElementById('createQuotationBtn')?.addEventListener('click', createQuotation);
document.getElementById('itemSearchInput')?.addEventListener('input', (e) => {
    const activeTypeFilter = document.querySelector('.type-filter-btn.active')?.dataset.type || '';
    renderAvailableItemsForQuotation(e.target.value, activeTypeFilter);
});

document.getElementById('compatibleFilterToggle')?.addEventListener('change', function() {
    const hint = document.getElementById('compatibleFilterHint');
    if (hint) hint.style.display = this.checked ? 'block' : 'none';
    const searchValue = document.getElementById('itemSearchInput')?.value || '';
    const activeTypeFilter = document.querySelector('.type-filter-btn.active')?.dataset.type || '';
    renderAvailableItemsForQuotation(searchValue, activeTypeFilter);
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

// --- Draft system: load and render for sidebar and Drafts page ---
async function loadQuotationDrafts(alsoRefreshPageList) {
    try {
        const res = await apiFetch('/drafts/quotations');
        const list = Array.isArray(res) ? res : (res.data || []);
        renderQuotationDraftsList(list, 'quotationDraftsList');
        if (alsoRefreshPageList || currentSectionId === 'quotationDrafts') {
            renderQuotationDraftsList(list, 'quotationDraftsPageList');
        }
    } catch (e) {
        console.warn('Load quotation drafts failed:', e);
        renderQuotationDraftsList([], 'quotationDraftsList');
        if (currentSectionId === 'quotationDrafts') renderQuotationDraftsList([], 'quotationDraftsPageList');
    }
}

function renderQuotationDraftsList(drafts, containerId) {
    const el = document.getElementById(containerId);
    if (!el) return;
    if (!drafts || drafts.length === 0) {
        el.innerHTML = '<p class="muted" style="text-align:center; padding:12px; font-size:13px;">No drafts</p>';
        return;
    }
    el.innerHTML = drafts.map(d => {
        const label = (d.customer && d.customer.phone) ? `${d.customer.phone}` : (d.draftQuotationId || `Draft #${d.id}`);
        const dateStr = d.updated_at ? new Date(d.updated_at).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' }) : '';
        return `
            <div class="draft-row" data-draft-id="${d.id}" style="padding:10px; border:1px solid #e5e7eb; border-radius:8px; margin-bottom:8px; background:#fafafa;">
                <div style="font-weight:500; font-size:13px;">${label}</div>
                <div class="muted" style="font-size:11px; margin-top:4px;">${dateStr} · ${(d.items || []).length} items</div>
                <div style="margin-top:8px; display:flex; gap:6px; flex-wrap:wrap;">
                    <button type="button" class="btn" style="padding:4px 10px; font-size:12px;" data-action="resume-quotation-draft" data-id="${d.id}">Resume</button>
                    <button type="button" class="btn primary" style="padding:4px 10px; font-size:12px;" data-action="convert-quotation-draft" data-id="${d.id}">Convert to quotation</button>
                    <button type="button" class="btn" style="padding:4px 10px; font-size:12px; color:#dc3545;" data-action="delete-quotation-draft" data-id="${d.id}">Delete</button>
                </div>
            </div>`;
    }).join('');
}

async function resumeQuotationDraft(draftId) {
    try {
        const res = await apiFetch(`/drafts/quotations/${draftId}`);
        const d = res.data || res;
        if (!d) return;
        currentQuotationDraftId = d.id;
        document.getElementById('cust-name').value = (d.customer && d.customer.name) ? d.customer.name : '';
        document.getElementById('phone-number').value = (d.customer && d.customer.phone) ? d.customer.phone : '';
        document.getElementById('cust-email').value = (d.customer && d.customer.email) ? d.customer.email : '';
        document.getElementById('cust-address').value = (d.customer && d.customer.address) ? d.customer.address : '';
        const discountPercentInput = document.getElementById('discount-percent');
        if (discountPercentInput) discountPercentInput.value = d.discountPercent != null ? d.discountPercent : 0;
        quotationItems = (d.items || []).map(it => ({
            productId: it.productId,
            productName: it.productName,
            price: it.price,
            quantity: it.quantity || 1,
            gstRate: it.gstRate != null ? it.gstRate : 0
        }));
        uploadedImagesArray = Array.isArray(d.images) && d.images.length > 0 ? [d.images[0]] : [];
        renderCreateImagePreviews();
        renderQuotationItems();
        updateGrandTotal();
        showSection('createQuotation');
        loadQuotationDrafts(true);
    } catch (e) {
        console.warn('Resume draft failed:', e);
        alert('Failed to load draft.');
    }
}

async function convertQuotationDraft(draftId) {
    try {
        await apiFetch(`/drafts/quotations/${draftId}/convert`, { method: 'POST' });
        if (currentQuotationDraftId === draftId) currentQuotationDraftId = null;
        loadQuotationDrafts(true);
        alert('Quotation created from draft successfully.');
        renderHistoryList();
    } catch (e) {
        alert(e.message || 'Failed to convert draft.');
    }
}

async function deleteQuotationDraft(draftId) {
    if (!confirm('Delete this draft?')) return;
    try {
        await apiFetch(`/drafts/quotations/${draftId}`, { method: 'DELETE' });
        if (currentQuotationDraftId === draftId) currentQuotationDraftId = null;
        loadQuotationDrafts(true);
    } catch (e) {
        console.warn('Delete draft failed:', e);
    }
}

async function loadItemDrafts(alsoRefreshPageList) {
    try {
        const res = await apiFetch('/drafts/items');
        const list = Array.isArray(res) ? res : (res.data || []);
        renderItemDraftsList(list, 'productDraftsList');
        if (alsoRefreshPageList || currentSectionId === 'itemDrafts') {
            renderItemDraftsList(list, 'productDraftsPageList');
        }
    } catch (e) {
        console.warn('Load product drafts failed:', e);
        renderItemDraftsList([], 'productDraftsList');
        if (currentSectionId === 'itemDrafts') renderItemDraftsList([], 'productDraftsPageList');
    }
}

function renderItemDraftsList(drafts, containerId) {
    const el = document.getElementById(containerId);
    if (!el) return;
    if (!drafts || drafts.length === 0) {
        el.innerHTML = '<p class="muted" style="text-align:center; padding:12px; font-size:13px;">No drafts</p>';
        return;
    }
    el.innerHTML = drafts.map(d => {
        const label = d.productName || d.productId || `Draft #${d.id}`;
        const dateStr = d.updated_at ? new Date(d.updated_at).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' }) : '';
        return `
            <div class="draft-row" data-draft-id="${d.id}" style="padding:10px; border:1px solid #e5e7eb; border-radius:8px; margin-bottom:8px; background:#fafafa;">
                <div style="font-weight:500; font-size:13px;">${label}</div>
                <div class="muted" style="font-size:11px; margin-top:4px;">${dateStr}</div>
                <div style="margin-top:8px; display:flex; gap:6px; flex-wrap:wrap;">
                    <button type="button" class="btn" style="padding:4px 10px; font-size:12px;" data-action="resume-item-draft" data-id="${d.id}">Resume</button>
                    <button type="button" class="btn primary" style="padding:4px 10px; font-size:12px;" data-action="convert-item-draft" data-id="${d.id}">Convert to product</button>
                    <button type="button" class="btn" style="padding:4px 10px; font-size:12px; color:#dc3545;" data-action="delete-item-draft" data-id="${d.id}">Delete</button>
                </div>
            </div>`;
    }).join('');
}

async function resumeItemDraft(draftId) {
    try {
        const res = await apiFetch(`/drafts/items/${draftId}`);
        const d = res.data || res;
        if (!d) return;
        currentItemDraftId = d.id;
        document.getElementById('product-id').value = d.productId || '';
        document.getElementById('item-url').value = d.itemUrl || '';
        document.getElementById('product-name').value = d.productName || '';
        document.getElementById('type').value = d.type || '';
        document.getElementById('price').value = d.price != null ? d.price : '';
        document.getElementById('gst').value = d.gst != null ? d.gst : '';
        document.getElementById('description').value = d.description || '';
        showSection('addItem');
        loadItemDrafts(true);
    } catch (e) {
        console.warn('Resume product draft failed:', e);
        alert('Failed to load draft.');
    }
}

async function convertItemDraft(draftId) {
    try {
        await apiFetch(`/drafts/items/${draftId}/convert`, { method: 'POST' });
        if (currentItemDraftId === draftId) currentItemDraftId = null;
        loadItemDrafts(true);
        alert('Product created from draft successfully.');
        renderItemsList();
        updateSummary();
    } catch (e) {
        alert(e.message || 'Failed to convert draft.');
    }
}

async function deleteItemDraft(draftId) {
    if (!confirm('Delete this draft?')) return;
    try {
        await apiFetch(`/drafts/items/${draftId}`, { method: 'DELETE' });
        if (currentItemDraftId === draftId) currentItemDraftId = null;
        loadItemDrafts(true);
    } catch (e) {
        console.warn('Delete draft failed:', e);
    }
}

function buildQuotationDraftPayload() {
    const customerName = document.getElementById('cust-name')?.value.trim() || '';
    const phoneNumber = document.getElementById('phone-number')?.value.trim() || '';
    const customerEmail = document.getElementById('cust-email')?.value.trim() || '';
    const customerAddress = document.getElementById('cust-address')?.value.trim() || '';
    const items = getQuotationItems();
    const hasAnyContent = phoneNumber || customerName || customerEmail || customerAddress || items.length > 0;
    if (!hasAnyContent) return null;
    let subTotal = items.reduce((sum, item) => sum + (parseFloat(item.price || 0) * (item.quantity || 1)), 0);
    const discountPercent = parseFloat(document.getElementById('discount-percent')?.value || 0);
    let discountAmount = subTotal * (discountPercent / 100);
    let totalGstAmount = items.reduce((sum, item) => sum + (item.price * item.quantity * (parseFloat(item.gstRate || 0) / 100)), 0);
    let grandTotal = (subTotal - discountAmount) + totalGstAmount;
    const itemsForApi = items.map(item => ({
        productId: String(item.productId || item.id),
        productName: String(item.productName || item.name),
        price: String(parseFloat(item.price || 0).toFixed(2)),
        quantity: parseInt(item.quantity || 1),
        gstRate: String(parseFloat(item.gstRate || 0).toFixed(2))
    }));
    return {
        draftId: currentQuotationDraftId || undefined,
        dateCreated: new Date().toLocaleDateString('en-IN'),
        customer: { name: customerName || '—', phone: phoneNumber || '0', email: customerEmail || null, address: customerAddress || null },
        items: itemsForApi,
        images: getUploadedImages(),
        subTotal: String(subTotal.toFixed(2)),
        discountPercent: String(discountPercent.toFixed(2)),
        discountAmount: String(discountAmount.toFixed(2)),
        totalGstAmount: String(totalGstAmount.toFixed(2)),
        grandTotal: String(grandTotal.toFixed(2)),
        createdBy: CURRENT_USER_EMAIL ? CURRENT_USER_EMAIL.split('@')[0] : ''
    };
}

async function saveQuotationDraftToServer() {
    const payload = buildQuotationDraftPayload();
    if (!payload) return;
    try {
        payload.images = await ensureImagesAreUrls(payload.images || []);
        const res = await apiFetch('/drafts/quotations', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const data = res.data || res;
        if (data && data.id) currentQuotationDraftId = data.id;
    } catch (e) {
        console.warn('Draft save failed:', e);
    }
}

/** Fire-and-forget draft save that survives page unload (use when closing/switching tab). */
function saveDraftWithKeepalive() {
    if (currentSectionId === 'createQuotation') {
        const payload = buildQuotationDraftPayload();
        if (payload) {
            const url = `${API_BASE}/drafts/quotations`;
            fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
                credentials: 'include',
                keepalive: true
            }).catch(() => {});
        }
    }
    if (currentSectionId === 'addItem') {
        const payload = buildItemDraftPayload();
        if (payload) {
            const url = `${API_BASE}/drafts/items`;
            fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
                credentials: 'include',
                keepalive: true
            }).catch(() => {});
        }
    }
}

function buildItemDraftPayload() {
    const productId = document.getElementById('product-id')?.value?.trim();
    const productName = document.getElementById('product-name')?.value?.trim();
    const itemUrl = document.getElementById('item-url')?.value?.trim();
    const type = document.getElementById('type')?.value?.trim();
    const description = document.getElementById('description')?.value?.trim();
    const hasAnyContent = productId || productName || itemUrl || type || description || document.getElementById('price')?.value;
    if (!hasAnyContent) return null;
    const price = parseFloat(document.getElementById('price')?.value) || 0;
    const gst = document.getElementById('gst')?.value ? parseFloat(document.getElementById('gst').value) : 0;
    const totalPrice = price + (price * (gst / 100));
    return {
        draftId: currentItemDraftId || undefined,
        productId: productId || `DRAFT-P-${Date.now()}`,
        itemUrl: itemUrl || '',
        productName: productName || '',
        type: type || '',
        price: String(price.toFixed(2)),
        gst: String(gst),
        totalPrice: String(totalPrice.toFixed(2)),
        description: document.getElementById('description')?.value?.trim() || '',
        addedBy: CURRENT_USER_EMAIL ? CURRENT_USER_EMAIL.split('@')[0] : ''
    };
}

async function saveItemDraftToServer() {
    const payload = buildItemDraftPayload();
    if (!payload) return;
    try {
        const res = await apiFetch('/drafts/items', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const data = res.data || res;
        if (data && data.id) currentItemDraftId = data.id;
    } catch (e) {
        console.warn('Product draft save failed:', e);
    }
}

async function showSection(sectionId) {
    currentSectionId = sectionId || '';
    if (draftQuotationIntervalId) {
        clearInterval(draftQuotationIntervalId);
        draftQuotationIntervalId = null;
    }
    if (draftItemIntervalId) {
        clearInterval(draftItemIntervalId);
        draftItemIntervalId = null;
    }
    if (draftQuotationDebounceId) {
        clearTimeout(draftQuotationDebounceId);
        draftQuotationDebounceId = null;
    }
    if (draftItemDebounceId) {
        clearTimeout(draftItemDebounceId);
        draftItemDebounceId = null;
    }
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
    const curSection = document.getElementById(sectionId);
    const tabInSection = curSection?.querySelector(`.section-tabs .tab-btn[data-tab="${sectionId}"]`);
    if (tabInSection) tabInSection.classList.add('active');

    if (sectionId === 'addItem') {
        await handleItemEditReset();
        updateCompatFieldsVisibility('type', 'compatFieldsContainer');
        loadAddProductDynamicData();
        loadItemDrafts();
        draftItemIntervalId = setInterval(() => { saveItemDraftToServer(); loadItemDrafts(); }, DRAFT_AUTO_SAVE_MS);
    }
    if (sectionId === 'itemsList') {
        renderItemsTypeFilters();
        renderItemsList();
    }
    if (sectionId === 'createQuotation') {
        renderQuotationTypeFilters();
        renderAvailableItemsForQuotation();
        renderQuotationItems();
        updateGrandTotal();
        loadQuotationDrafts();
        draftQuotationIntervalId = setInterval(() => { saveQuotationDraftToServer(); loadQuotationDrafts(); }, DRAFT_AUTO_SAVE_MS);
    }
    if (sectionId === 'quotationDrafts') {
        loadQuotationDrafts(true);
    }
    if (sectionId === 'itemDrafts') {
        loadItemDrafts(true);
    }
    if (sectionId === 'viewHistory') renderHistoryList();
    if (sectionId === 'viewLogs') renderLogsList();
    if (sectionId === 'viewContactRequests') renderContactRequestsList();
    if (sectionId === 'viewCustomers') {
        renderCustomersList();
        showCustomerSubtab('customerHistory');
    }
}

document.querySelectorAll('[data-tab]').forEach(el => {
    el.addEventListener('click', function (e) {
        e.preventDefault();
        const sectionId = this.getAttribute('data-tab');
        showSection(sectionId);
    });
});

// Event delegation for draft buttons (works even after dynamic list re-renders)
document.addEventListener('click', async function (e) {
    const btn = e.target.closest('[data-action][data-id]');
    if (!btn) return;
    const action = btn.getAttribute('data-action');
    const id = parseInt(btn.getAttribute('data-id'), 10);
    if (action === 'resume-quotation-draft') { resumeQuotationDraft(id); return; }
    if (action === 'convert-quotation-draft') { convertQuotationDraft(id); return; }
    if (action === 'delete-quotation-draft') { deleteQuotationDraft(id); return; }
    if (action === 'resume-item-draft') { resumeItemDraft(id); return; }
    if (action === 'convert-item-draft') { convertItemDraft(id); return; }
    if (action === 'delete-item-draft') { deleteItemDraft(id); return; }
    if (action === 'mark-contact-read') {
        try {
            const res = await apiFetch(`/contact-requests/${id}/read`, { method: 'PUT' });
            if (res && res.success !== false) renderContactRequestsList();
        } catch (err) { console.error(err); }
        return;
    }
    if (action === 'delete-contact-request') {
        if (!confirm('Delete this contact request?')) return;
        try {
            const res = await apiFetch(`/contact-requests/${id}`, { method: 'DELETE' });
            if (res && res.success !== false) renderContactRequestsList();
        } catch (err) { console.error(err); }
        return;
    }
});

function scheduleQuotationDraftSave() {
    if (draftQuotationDebounceId) clearTimeout(draftQuotationDebounceId);
    draftQuotationDebounceId = setTimeout(function () {
        draftQuotationDebounceId = null;
        if (currentSectionId === 'createQuotation') saveQuotationDraftToServer();
    }, DRAFT_DEBOUNCE_MS);
}
function scheduleItemDraftSave() {
    if (draftItemDebounceId) clearTimeout(draftItemDebounceId);
    draftItemDebounceId = setTimeout(function () {
        draftItemDebounceId = null;
        if (currentSectionId === 'addItem') saveItemDraftToServer();
    }, DRAFT_DEBOUNCE_MS);
}

document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'hidden') {
        saveDraftWithKeepalive();
    }
});
window.addEventListener('beforeunload', function () {
    saveDraftWithKeepalive();
});

(function setupDraftDebounceListeners() {
    var qIds = ['cust-name', 'phone-number', 'cust-email', 'cust-address', 'discount-percent'];
    qIds.forEach(function (id) {
        var el = document.getElementById(id);
        if (el) {
            el.addEventListener('input', scheduleQuotationDraftSave);
            el.addEventListener('change', scheduleQuotationDraftSave);
        }
    });
    var itemIds = ['product-id', 'item-url', 'product-name', 'type', 'price', 'gst', 'description'];
    itemIds.forEach(function (id) {
        var el = document.getElementById(id);
        if (el) {
            el.addEventListener('input', scheduleItemDraftSave);
            el.addEventListener('change', scheduleItemDraftSave);
        }
    });
})();

// Customer page sub-tabs: Customer history | Customer details
function showCustomerSubtab(subtabId) {
    const historyView = document.getElementById('customerHistoryView');
    const detailsView = document.getElementById('customerDetailsView');
    const section = document.getElementById('viewCustomers');
    if (!section || !historyView || !detailsView) return;
    section.querySelectorAll('.section-tabs .tab-btn[data-subtab]').forEach(btn => {
        btn.classList.toggle('active', btn.getAttribute('data-subtab') === subtabId);
    });
    if (subtabId === 'customerHistory') {
        historyView.style.display = '';
        detailsView.style.display = 'none';
    } else {
        historyView.style.display = 'none';
        detailsView.style.display = '';
        renderCustomerDetailsList(); // Load customer details when tab is selected
    }
}
document.querySelector('.main')?.addEventListener('click', function (e) {
    const btn = e.target.closest('.section-tabs .tab-btn[data-subtab]');
    if (btn) {
        e.preventDefault();
        showCustomerSubtab(btn.getAttribute('data-subtab'));
    }
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

// PDF Theme color definitions
const PDF_THEMES = {
    default: {
        name: 'Default (Blue)',
        primary: '#3A648C',
        secondary: '#111827',
        border: '#e5e7eb',
        accent: '#35b3e7',
        pastelBg: '#f0f7ff'
    },
    green: {
        name: 'Green',
        primary: '#059669',
        secondary: '#064e3b',
        border: '#d1fae5',
        accent: '#10b981',
        pastelBg: '#f0fdf4'
    },
    red: {
        name: 'Red',
        primary: '#dc2626',
        secondary: '#7f1d1d',
        border: '#fee2e2',
        accent: '#ef4444',
        pastelBg: '#fef2f2'
    },
    purple: {
        name: 'Purple',
        primary: '#7c3aed',
        secondary: '#4c1d95',
        border: '#ede9fe',
        accent: '#8b5cf6',
        pastelBg: '#faf5ff'
    },
    orange: {
        name: 'Orange',
        primary: '#ea580c',
        secondary: '#7c2d12',
        border: '#fed7aa',
        accent: '#f97316',
        pastelBg: '#fff7ed'
    },
    teal: {
        name: 'Teal',
        primary: '#0d9488',
        secondary: '#134e4a',
        border: '#ccfbf1',
        accent: '#14b8a6',
        pastelBg: '#f0fdfa'
    },
    gray: {
        name: 'Gray',
        primary: '#374151',
        secondary: '#111827',
        border: '#f3f4f6',
        accent: '#6b7280',
        pastelBg: '#f8fafc'
    }
};

// Initialize PDF Theme functionality
function initializePdfThemeSettings() {
    const themeSelect = document.getElementById('settings-pdf-theme');
    const saveBtn = document.getElementById('savePdfThemeBtn');
    
    if (!themeSelect || !saveBtn) {
        console.warn('PDF theme elements not found');
        return;
    }
    
    // Update theme preview when selection changes
    themeSelect.addEventListener('change', function() {
        updateThemePreview(this.value);
    });
    
    // Save PDF theme
    saveBtn.addEventListener('click', async function () {
        const selectedTheme = themeSelect.value;
        const saveBtn = this;
        
        // Show loading state
        const originalText = saveBtn.innerHTML;
        saveBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';
        saveBtn.disabled = true;
        
        try {
            const response = await apiFetch('/settings', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ pdfTheme: selectedTheme })
            });
            
            // Show success message
            alert('PDF theme saved successfully!');
            
            // Update any current theme display if needed
            console.log('PDF theme updated to:', selectedTheme);
            
        } catch (error) {
            console.error('Failed to save PDF theme:', error);
            alert('Failed to save PDF theme. Please try again.');
        } finally {
            // Restore button state
            saveBtn.innerHTML = originalText;
            saveBtn.disabled = false;
        }
    });
}

// Auto-initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializePdfThemeSettings);
} else {
    initializePdfThemeSettings();
}

// Function to update theme preview
function updateThemePreview(themeName) {
    const theme = PDF_THEMES[themeName];
    if (!theme) return;
    
    const previewHeader = document.getElementById('previewHeader');
    const previewAccent = document.getElementById('previewAccent');
    const previewBorder = document.getElementById('previewBorder');
    
    if (previewHeader) previewHeader.style.background = theme.primary;
    if (previewAccent) previewAccent.style.background = theme.secondary;
    if (previewBorder) previewBorder.style.background = theme.border;
}

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
    if (!confirm('Are you sure you want to remove the company logo?')) return;
    try {
        await apiFetch('/settings', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ logo: null }) });
        renderSettings();
        alert('Company logo removed.');
    } catch (e) {
        alert('Failed to remove logo.');
    }
});

/* ---------- Product Management ---------- */
/* addItemForm submit is handled by saveItem - single listener only to avoid double submission */

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
    const productIdInput = document.getElementById('product-id');

    if (userRoleDisplay) userRoleDisplay.textContent = CURRENT_USER_ROLE;
    if (userEmailDisplay) userEmailDisplay.textContent = CURRENT_USER_EMAIL;
    if (userAvatar) userAvatar.textContent = CURRENT_USER_ROLE.charAt(0).toUpperCase();

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
        // Type is now a select dropdown - suggestions no longer needed
        if (!document.getElementById('product-types')) return;
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
    const typeSuggestionsEl = document.getElementById('type-suggestions');
    if (typeSuggestionsEl) typeSuggestionsEl.innerHTML = '';
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
        window.location.href = '/login.html';
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
        
        window.location.href = '/login.html';
    }
}

window.onload = function() {
    // Validate session before initializing dashboard
    if (!validateSession()) {
        alert('Your session has expired or you are not logged in. Please login again.');
        window.location.href = '/login.html';
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

// --- Image Upload: Create Quotation (Production: upload file, store URL) ---
const MAX_IMAGE_SIZE_MB = 2;
const MAX_IMAGES = 1;
const ALLOWED_IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'];
let uploadedImagesArray = [];  // Stores URL paths from /api/upload-image, not base64

function validateImageFile(file) {
    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
        return `Invalid format. Use PNG, JPG or WebP.`;
    }
    if (file.size > MAX_IMAGE_SIZE_MB * 1024 * 1024) {
        return `File too large. Max ${MAX_IMAGE_SIZE_MB}MB per image.`;
    }
    return null;
}

async function uploadImageFile(file) {
    const formData = new FormData();
    formData.append('image', file);
    const response = await fetch(`${API_BASE}/upload-image`, {
        method: 'POST',
        body: formData,
        credentials: 'include'
    });
    const data = await response.json();
    if (!response.ok || !data.success) {
        throw new Error(data.error || 'Image upload failed');
    }
    return (data.data && data.data.url) || data.url || data.path;
}

async function uploadImageDataUrl(dataUrl) {
    const res = await apiFetch('/upload-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dataUrl: dataUrl })
    });
    const data = res.data || res;
    const url = (data && data.url) || (data && data.path);
    if (!url) throw new Error('Upload failed: no URL returned');
    return url;
}

/** Convert base64 images to URLs before save (migration for old drafts/quotes) */
async function ensureImagesAreUrls(images) {
    if (!Array.isArray(images) || images.length === 0) return [];
    const out = [];
    for (const img of images) {
        if (typeof img === 'string' && img.startsWith('data:image/')) {
            out.push(await uploadImageDataUrl(img));
        } else if (typeof img === 'string') {
            out.push(img);
        }
    }
    return out;
}

function imageSrcForDisplay(urlOrDataUrl) {
    if (!urlOrDataUrl) return '';
    if (urlOrDataUrl.startsWith('data:')) return urlOrDataUrl;
    return urlOrDataUrl.startsWith('/') ? urlOrDataUrl : '/' + urlOrDataUrl;
}

function renderCreateImagePreviews() {
    const container = document.getElementById('imagePreviewList');
    const previewDiv = document.getElementById('imagePreview');
    if (!container || !previewDiv) return;
    if (uploadedImagesArray.length === 0) {
        previewDiv.style.display = 'none';
        return;
    }
    container.innerHTML = uploadedImagesArray.map((url, idx) => `
        <div style="position:relative; flex-shrink:0;">
            <div style="position:relative;">
                <img src="${imageSrcForDisplay(url)}" style="width:80px; height:80px; object-fit:cover; border-radius:6px; border:1px solid #e5e7eb;">
                <div style="position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; pointer-events: none;">
                    <span style="font-size: 11px; font-weight: 700; color: rgba(255,255,255,0.45); letter-spacing: 0.1em; transform: rotate(-35deg); white-space: nowrap; text-shadow: 0 1px 2px rgba(0,0,0,0.4);">TECHTITANS</span>
                </div>
            </div>
            <button type="button" class="remove-single-img" data-idx="${idx}" style="position:absolute; top:-6px; right:-6px; width:22px; height:22px; border-radius:50%; border:none; background:#dc3545; color:white; cursor:pointer; font-size:14px; line-height:1; padding:0;">×</button>
        </div>
    `).join('');
    previewDiv.style.display = 'block';
    container.querySelectorAll('.remove-single-img').forEach(btn => {
        btn.onclick = () => { uploadedImagesArray.splice(parseInt(btn.dataset.idx), 1); renderCreateImagePreviews(); };
    });
}

document.getElementById('quotation-image')?.addEventListener('change', async function(e) {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    const file = files[0];
    if (!file) return;
    const err = validateImageFile(file);
    if (err) { alert(err); return; }
    try {
        const url = await uploadImageFile(file);
        uploadedImagesArray = [url];
        renderCreateImagePreviews();
    } catch (ex) {
        alert(ex.message || 'Image upload failed. Please try again.');
    }
    e.target.value = '';
});

document.getElementById('removeAllImagesBtn')?.addEventListener('click', () => clearImageUpload());

function clearImageUpload() {
    uploadedImagesArray = [];
    const el = document.getElementById('quotation-image');
    if (el) el.value = '';
    renderCreateImagePreviews();
}

function getUploadedImages() {
    return Array.isArray(uploadedImagesArray) ? [...uploadedImagesArray] : [];
}
