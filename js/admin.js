
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
const DEFAULT_ROLE = 'Admin';
const AUTHORIZED_TO_EDIT_ITEMS = ['Owner', 'Admin', 'Manager'];
const AUTHORIZED_TO_CREATE_QUOTATIONS = ['Owner', 'Admin', 'Manager', 'Sales'];
const AUTHORIZED_TO_VIEW_CUSTOMERS = ['Owner', 'Admin', 'Manager', 'Sales'];
const AUTHORIZED_TO_VIEW_LOGS = ['Owner', 'Admin', 'Manager'];
const AUTHORIZED_TO_DELETE_LOGS = ['Owner'];
const AUTHORIZED_TO_VIEW_SETTINGS = ['Owner', 'Admin', 'Manager'];
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
        
        // CRITICAL: For admin.html, only Admin role is allowed
        if (userRole !== 'Admin') {
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
        
        // Double-check that userData.role is Admin
        if (userData.role !== 'Admin') {
            return false;
        }
        
        return true;
    } catch (error) {
        return false;
    }
}

let CURRENT_USER_ROLE = localStorage.getItem(LS_KEYS.role) || DEFAULT_ROLE;
// Get email from userEmail key, or parse from user object, or use default
let userEmailFromStorage = localStorage.getItem(LS_KEYS.userEmail);
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
// --- Quotation draft (save drafts in Create Quotation) ---
const DRAFT_AUTO_SAVE_MS = 10000;
const DRAFT_DEBOUNCE_MS = 2500;
let draftQuotationIntervalId = null;
let draftQuotationDebounceId = null;
let currentQuotationDraftId = null;
let currentSectionId = '';
var EXCLUDED_ITEM_TYPES = ['cpu', 'motherboard', 'case', 'storage', 'others', '19500', 'graphic card', 'memory'];
function isExcludedType(t) { var v = String(t).toLowerCase().trim(); return EXCLUDED_ITEM_TYPES.indexOf(v) !== -1; }
const DEFAULT_QUOTATION_ITEM_TYPE_ORDER = ['all', 'cpu cooler', 'monitor', 'amd cpu', 'amd mobo', 'cabinet', 'cooler', 'fan', 'fan controller', 'gpu', 'gpu cable', 'gpu holder', 'hdd', 'intel cpu', 'intel mobo', 'keyboard&mouse', 'memory module radiator', 'mod cable', 'ram', 'smps', 'ssd', 'ups'];
let quotationItemTypeOrder = DEFAULT_QUOTATION_ITEM_TYPE_ORDER.slice();
var quotationOrderDraggedLi = null;
function getQuotationCategorySortIndex(type) {
    const t = (type || '').toLowerCase().trim();
    if (!t) return quotationItemTypeOrder.length + 1;
    const order = quotationItemTypeOrder || DEFAULT_QUOTATION_ITEM_TYPE_ORDER;
    for (let i = 0; i < order.length; i++) {
        const cat = (order[i] || '').toLowerCase().trim();
        if (!cat) continue;
        if (t === cat || t.indexOf(cat) >= 0 || cat.indexOf(t) >= 0) return i;
        if (cat === 'graphic card' && (t.indexOf('graphic') >= 0 || t.indexOf('gpu') >= 0)) return i;
        if (cat === 'cpu' && t === 'cpu') return i;
        if (cat === 'cpu cooler' && (t.indexOf('cpu cooler') >= 0 || (t.indexOf('cooler') >= 0 && t.indexOf('cpu') >= 0))) return i;
        if (cat === 'motherboard' && (t.indexOf('motherboard') >= 0 || t === 'mb')) return i;
        if (cat === 'memory' && (t.indexOf('memory') >= 0 || t === 'ram')) return i;
        if (cat === 'storage' && (t.indexOf('storage') >= 0 || t.indexOf('hdd') >= 0 || t.indexOf('ssd') >= 0)) return i;
        if (cat === 'case' && (t.indexOf('case') >= 0 || t.indexOf('cabinet') >= 0 || t.indexOf('chassis') >= 0)) return i;
        if (cat === 'monitor' && (t.indexOf('monitor') >= 0 || t.indexOf('display') >= 0)) return i;
    }
    return order.length + 1;
}
let isCreatingNewQuotation = true; // Track if we're creating a new quotation (true) or editing existing (false)
let itemsCurrentPage = 1;
const itemsPerPage = 5;
// Current type filter for Products table (items list)
let itemsCurrentTypeFilter = '';
// Current price sort state: 'none', 'asc', 'desc'
let itemsCurrentPriceSort = 'none';
// Current total value sort state: 'none', 'asc', 'desc'
let itemsCurrentTotalValueSort = 'none';
// Current name sort state: 'none', 'asc', 'desc' (A–Z / Z–A)
let itemsCurrentNameSort = 'none';
let historyCurrentPage = 1;
const historyPerPage = 10;
let customersCurrentPage = 1;
const customersPerPage = 10;
let customerDetailsCurrentPage = 1;
const customerDetailsPerPage = 10;

// --- Utility Functions ---
function formatRupee(amount) {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(amount);
}

function updatePriceSortHeader() {
    const arrowsEl = document.getElementById('priceSortArrows');
    if (!arrowsEl) return;
    if (itemsCurrentPriceSort === 'asc') {
        arrowsEl.innerHTML = ' <i class="fas fa-sort-up" aria-hidden="true"></i>';
    } else if (itemsCurrentPriceSort === 'desc') {
        arrowsEl.innerHTML = ' <i class="fas fa-sort-down" aria-hidden="true"></i>';
    } else {
        arrowsEl.innerHTML = ' <i class="fas fa-sort" aria-hidden="true"></i>';
    }
}

function updateTotalValueSortHeader() {
    const arrowsEl = document.getElementById('totalValueSortArrows');
    if (!arrowsEl) return;
    if (itemsCurrentTotalValueSort === 'asc') {
        arrowsEl.innerHTML = ' <i class="fas fa-sort-up" aria-hidden="true"></i>';
    } else if (itemsCurrentTotalValueSort === 'desc') {
        arrowsEl.innerHTML = ' <i class="fas fa-sort-down" aria-hidden="true"></i>';
    } else {
        arrowsEl.innerHTML = ' <i class="fas fa-sort" aria-hidden="true"></i>';
    }
}

function updateNameSortHeader() {
    const arrowsEl = document.getElementById('nameSortArrows');
    if (!arrowsEl) return;
    if (itemsCurrentNameSort === 'asc') {
        arrowsEl.innerHTML = ' <i class="fas fa-sort-up" aria-hidden="true"></i>';
    } else if (itemsCurrentNameSort === 'desc') {
        arrowsEl.innerHTML = ' <i class="fas fa-sort-down" aria-hidden="true"></i>';
    } else {
        arrowsEl.innerHTML = ' <i class="fas fa-sort" aria-hidden="true"></i>';
    }
}

function togglePriceSort() {
    itemsCurrentNameSort = 'none';
    itemsCurrentTotalValueSort = 'none';
    updateNameSortHeader();
    updateTotalValueSortHeader();
    if (itemsCurrentPriceSort === 'none') {
        itemsCurrentPriceSort = 'asc';
    } else if (itemsCurrentPriceSort === 'asc') {
        itemsCurrentPriceSort = 'desc';
    } else {
        itemsCurrentPriceSort = 'none';
    }
    updatePriceSortHeader();
    itemsCurrentPage = 1;
    const searchInput = document.getElementById('productListSearchInput');
    const filter = searchInput ? searchInput.value.trim() : '';
    renderItemsList(filter);
}

function toggleTotalValueSort() {
    itemsCurrentNameSort = 'none';
    itemsCurrentPriceSort = 'none';
    updateNameSortHeader();
    updatePriceSortHeader();
    if (itemsCurrentTotalValueSort === 'none') {
        itemsCurrentTotalValueSort = 'asc';
    } else if (itemsCurrentTotalValueSort === 'asc') {
        itemsCurrentTotalValueSort = 'desc';
    } else {
        itemsCurrentTotalValueSort = 'none';
    }
    updateTotalValueSortHeader();
    itemsCurrentPage = 1;
    const searchInput = document.getElementById('productListSearchInput');
    const filter = searchInput ? searchInput.value.trim() : '';
    renderItemsList(filter);
}

function toggleNameSort() {
    itemsCurrentPriceSort = 'none';
    itemsCurrentTotalValueSort = 'none';
    updatePriceSortHeader();
    updateTotalValueSortHeader();
    if (itemsCurrentNameSort === 'none') {
        itemsCurrentNameSort = 'asc';
    } else if (itemsCurrentNameSort === 'asc') {
        itemsCurrentNameSort = 'desc';
    } else {
        itemsCurrentNameSort = 'none';
    }
    updateNameSortHeader();
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

function generateProductId() {
    const today = new Date();
    const dateStr = today.toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' }).replace(/\//g, '');
    const timeStr = today.toLocaleTimeString('en-IN', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' }).replace(/:/g, '');
    // Add milliseconds and random component to ensure uniqueness
    const ms = today.getMilliseconds().toString().padStart(3, '0');
    const random = Math.random().toString(36).substring(2, 5).toUpperCase();
    return `P${dateStr}${timeStr}${ms}${random}`;
}

// --- API Helper Functions ---
async function apiFetch(endpoint, options = {}) {
    try {
        const isFormData = options.body instanceof FormData;
        const headers = (isFormData || !options.body) ? {} : { 'Content-Type': 'application/json' };
        const fetchOptions = {
            ...options,
            credentials: 'include',
            headers: { ...headers, ...(options.headers || {}) }
        };
        if (isFormData) delete fetchOptions.headers['Content-Type'];
        const url = endpoint.startsWith('/_') ? endpoint : `${API_BASE}${endpoint}`;
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

async function getCustomers() {
    const response = await apiFetch('/customers');
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
    // API returns {success: true, data: [...]}
    return Array.isArray(response) ? response : (response.data || []);
}

// --- Add Product dynamic data (Product Statistics, Recent Products, Product Types) ---
async function loadAddProductDynamicData() {
    try {
        const items = await getItems();
        updateProductStatistics(items);
        renderRecentProducts(items);
        renderProductTypes(items);
        await populateAddProductTypeDropdown(items);
    } catch (error) {
        if (document.getElementById('recentProductsList'))
            document.getElementById('recentProductsList').innerHTML = '<p class="muted" style="text-align:center; padding:20px;">Unable to load.</p>';
        if (document.getElementById('productTypesList'))
            document.getElementById('productTypesList').innerHTML = '<p class="muted" style="text-align:center; padding:20px;">Unable to load.</p>';
    }
}

async function populateEditProductTypeDropdown(items) {
    const typeSelect = document.getElementById('edit-type');
    if (!typeSelect) return;
    try {
        const settings = await getSettings();
        const savedOrder = Array.isArray(settings.quotationItemTypeOrder) ? settings.quotationItemTypeOrder.slice() : [];
        const productTypesList = Array.isArray(settings.productTypes) ? settings.productTypes.slice() : [];
        const arr = Array.isArray(items) ? items : (items && items.data) || [];
        const typesFromItems = [...new Set(arr.map(function (item) { return item.type; }).filter(Boolean))].map(function (t) { return String(t).toLowerCase().trim(); });
        const order = mergeQuotationOrderWithAllTypes(savedOrder, productTypesList, typesFromItems).filter(function (t) { return t !== 'all'; });
        typeSelect.innerHTML = '<option value="">Select Product Type</option>';
        order.forEach(function (t) {
            typeSelect.appendChild(new Option(String(t).toUpperCase(), t));
        });
    } catch (e) {
        console.error('Failed to load edit product type dropdown:', e);
        typeSelect.innerHTML = '<option value="">Select Product Type</option>';
    }
}

async function populateAddProductTypeDropdown(items) {
    const typeSelect = document.getElementById('type');
    if (!typeSelect) return;
    try {
        const settings = await getSettings();
        // Type dropdown: only from database (settings) and existing items (API)
        const savedOrder = Array.isArray(settings.quotationItemTypeOrder) ? settings.quotationItemTypeOrder.slice() : [];
        const productTypesList = Array.isArray(settings.productTypes) ? settings.productTypes.slice() : [];
        const arr = Array.isArray(items) ? items : (items && items.data) || [];
        const typesFromItems = [...new Set(arr.map(function (item) { return item.type; }).filter(Boolean))];
        const order = mergeQuotationOrderWithAllTypes(savedOrder, productTypesList, typesFromItems).filter(function (t) { return t !== 'all'; });
        typeSelect.innerHTML = '<option value="">Select Product Type</option>';
        order.forEach(function (t) {
            const label = String(t).toUpperCase();
            typeSelect.appendChild(new Option(label, t));
        });
    } catch (e) {
        console.error('Failed to load product types for dropdown:', e);
        typeSelect.innerHTML = '<option value="">Select Product Type</option>';
    }
}

function updateProductStatistics(items) {
    const el = id => document.getElementById(id);
    if (!el('statsTotalProducts')) return;
    if (!items || items.length === 0) {
        el('statsTotalProducts').textContent = '0';
        el('statsProductTypes').textContent = '0';
        el('statsAvgPrice').textContent = formatRupee(0);
        el('statsPriceRange').textContent = 'N/A';
        if (el('statsThisMonth')) el('statsThisMonth').textContent = '0';
        return;
    }
    el('statsTotalProducts').textContent = items.length;
    const types = new Set(items.map(item => item.type).filter(Boolean));
    el('statsProductTypes').textContent = types.size;
    const prices = items.map(item => parseFloat(item.price) || 0).filter(p => p > 0);
    const avgPrice = prices.length > 0 ? prices.reduce((a, b) => a + b, 0) / prices.length : 0;
    el('statsAvgPrice').textContent = formatRupee(avgPrice);
    if (prices.length > 0) {
        const minPrice = Math.min(...prices);
        const maxPrice = Math.max(...prices);
        el('statsPriceRange').textContent = `${formatRupee(minPrice)} - ${formatRupee(maxPrice)}`;
    } else {
        el('statsPriceRange').textContent = 'N/A';
    }
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    const monthlyItems = items.filter(item => {
        try {
            let itemDate;
            if (item.dateAdded) {
                if (typeof item.dateAdded === 'string' && item.dateAdded.includes('/')) {
                    const parts = item.dateAdded.split('/');
                    if (parts.length === 3)
                        itemDate = new Date(parseInt(parts[2], 10), parseInt(parts[1], 10) - 1, parseInt(parts[0], 10));
                    else
                        itemDate = new Date(item.dateAdded);
                } else itemDate = new Date(item.dateAdded);
            } else if (item.created_at) itemDate = new Date(item.created_at);
            else return false;
            return itemDate.getMonth() === currentMonth && itemDate.getFullYear() === currentYear;
        } catch (e) { return false; }
    });
    if (el('statsThisMonth')) el('statsThisMonth').textContent = monthlyItems.length;
}

function renderRecentProducts(items) {
    const listDiv = document.getElementById('recentProductsList');
    if (!listDiv) return;
    if (!items || items.length === 0) {
        listDiv.innerHTML = '<p class="muted" style="text-align:center; padding:20px;">No products yet.</p>';
        return;
    }
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
        const date = itemDate.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
        const pid = String(item.productId || '').replace(/\\/g, '\\\\').replace(/'/g, "\\'");
        return `
            <div style="padding: 8px; border-bottom: 1px solid #f2f6fb; cursor: pointer;"
                 onclick="editItem('${pid}')"
                 onmouseover="this.style.backgroundColor='#f8f9fa'"
                 onmouseout="this.style.backgroundColor='transparent'">
                <div style="display: flex; align-items: flex-start; gap: 8px;">
                    <i class="fas fa-box" style="color: #3A648C; font-size: 14px; margin-top: 2px;"></i>
                    <div style="flex: 1;">
                        <div style="font-weight: bold; color: #34495E; font-size: 13px;">${(item.productName || 'N/A').replace(/</g, '&lt;')}</div>
                        <div style="font-size: 11px; color: #7f8c8d; margin-top: 2px;">
                            <span style="color: #27AE60; font-weight: bold;">${formatRupee(item.price || 0)}</span>
                            <span style="margin: 0 6px;">•</span>
                            ${(item.type || 'N/A').replace(/</g, '&lt;')}
                        </div>
                        <div style="font-size: 10px; color: #95a5a6; margin-top: 2px;">
                            ${(item.productId || 'N/A').replace(/</g, '&lt;')} • ${date}
                        </div>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

function renderProductTypes(items) {
    const listDiv = document.getElementById('productTypesList');
    if (!listDiv) return;
    if (!items || items.length === 0) {
        listDiv.innerHTML = '<p class="muted" style="text-align:center; padding:20px;">No product types yet.</p>';
        return;
    }
    const typeCounts = {};
    items.forEach(item => {
        if (item.type) typeCounts[item.type] = (typeCounts[item.type] || 0) + 1;
    });
    const sortedTypes = Object.entries(typeCounts).sort((a, b) => b[1] - a[1]).slice(0, 10);
    if (sortedTypes.length === 0) {
        listDiv.innerHTML = '<p class="muted" style="text-align:center; padding:20px;">No product types yet.</p>';
        return;
    }
    listDiv.innerHTML = sortedTypes.map(([type, count]) => `
        <div style="padding: 6px 8px; border-bottom: 1px solid #f2f6fb; display: flex; justify-content: space-between; align-items: center;">
            <span style="font-size: 13px; color: #34495E;">${type.replace(/</g, '&lt;')}</span>
            <span style="font-size: 12px; color: #7f8c8d; background: #f8f9fa; padding: 2px 8px; border-radius: 12px;">${count}</span>
        </div>
    `).join('');
}

async function getSettings() {
    const response = await apiFetch('/settings');
    // API returns { success, data: { pdfTheme, gstRate, ... } } - unwrap so settings.pdfTheme works
    const data = response?.data ?? response ?? {};
    return typeof data === 'object' && data !== null ? data : {};
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
let isSubmittingItem = false; // Prevent double submissions

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

    // Prevent double submissions
    if (isSubmittingItem) {
        return;
    }

    const form = event.target;
    const productId = form.elements['product-id'].value;
    const itemUrl = form.elements['item-url'].value;
    const productName = form.elements['product-name'].value;
    const type = form.elements['type'].value;
    const price = parseFloat(form.elements['price'].value);
    const gst = form.elements['gst'] ? parseFloat(form.elements['gst'].value) || null : null;
    const description = form.elements['description'].value;
    // Ensure addedBy is just the email prefix, not a JSON string
    let addedBy = CURRENT_USER_EMAIL;
    if (addedBy && addedBy.includes('@')) {
        addedBy = addedBy.split('@')[0];
    } else if (addedBy && addedBy.startsWith('{')) {
        // If it's a JSON string, try to parse it
        try {
            const userObj = JSON.parse(addedBy);
            addedBy = userObj.email ? userObj.email.split('@')[0] : 'unknown';
        } catch (e) {
            addedBy = 'unknown';
        }
    } else {
        addedBy = addedBy || 'unknown';
    }

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

    // Disable submit button and set flag
    isSubmittingItem = true;
    const originalBtnText = submitBtn.textContent;
    submitBtn.disabled = true;
    submitBtn.textContent = isUpdate ? 'Updating...' : 'Adding...';

    try {
        if (isUpdate) {
            await apiFetch(`/items/${productId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            alert('Product updated successfully!');
            addLog('Product Updated', CURRENT_USER_ROLE, `Updated product: ${productName} (${productId})`);
        } else {
            await apiFetch('/items', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            alert('Product added successfully!');
            addLog('Product Created', CURRENT_USER_ROLE, `Created new product: ${productName} (${productId})`);
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
        document.getElementById('product-id').value = generateProductId();
        showSection('itemsList');
        document.querySelector('#sideNav a[data-tab="itemsList"]').click();
        renderItemsList(); // Refresh list
    } catch (error) {
        // Check if it's a duplicate entry error
        const errorMessage = error.message || error.toString();
        if (errorMessage.includes('Duplicate entry') || errorMessage.includes('already exists') || errorMessage.includes('product_id')) {
            alert(`Product ID "${productId}" already exists. A new Product ID has been generated. Please try again.`);
            // Generate new product ID
            document.getElementById('product-id').value = generateProductId();
        } else {
            // Other errors are already handled in apiFetch, but show user-friendly message
            alert(`Error: ${errorMessage}`);
        }
    } finally {
        // Re-enable submit button
        isSubmittingItem = false;
        submitBtn.disabled = false;
        submitBtn.textContent = originalBtnText;
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
        addLog('Product Deleted', CURRENT_USER_ROLE, `Deleted product: ${productId}`);
        renderItemsList();
        updateSummary();
        alert('Product deleted successfully!');
    } catch (error) {
        // Error handled in apiFetch
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
            await populateEditProductTypeDropdown(items);
            // Populate modal form fields
            document.getElementById('edit-product-id').value = item.productId;
            document.getElementById('edit-item-url').value = item.itemUrl || '';
            document.getElementById('edit-product-name').value = item.productName || '';
            const editTypeEl = document.getElementById('edit-type');
            editTypeEl.value = (item.type || '').toLowerCase().trim();
            if (!editTypeEl.value && item.type) editTypeEl.value = item.type;
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

function handleItemEditReset() {
    const submitBtn = document.querySelector('#addItemForm button[type="submit"]');
    submitBtn.textContent = 'Add Product';
    document.getElementById('product-id').value = generateProductId();
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
    const itemUrl = form.elements['edit-item-url'].value;
    const productName = form.elements['edit-product-name'].value;
    const type = form.elements['edit-type'].value;
    const price = parseFloat(form.elements['edit-price'].value);
    const gst = form.elements['edit-gst'] ? parseFloat(form.elements['edit-gst'].value) || null : null;
    const description = form.elements['edit-description'].value;
    
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

    const items = await getItems();
    const originalItem = items.find(i => i.productId === productId);
    const originalPrice = originalItem != null ? parseFloat(originalItem.price) : NaN;

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
        addLog('Product Updated', CURRENT_USER_ROLE, `Updated product: ${productName} (${productId})`);
        
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
/** Download a sample CSV with column headers matching the Products table (for bulk import). */
function downloadSampleProductsCsv() {
    const headers = ['Product ID', 'Product Name', 'Type', 'Description', 'Website Link', 'Price', 'GST (%)', 'Total Value (₹)', 'Added By', 'Date Added'];
    const example = ['P01012025120000', 'Sample Product', 'Laptop', 'Sample description', 'https://example.com/product', '50000', '18', '', 'user', ''];
    const escape = (v) => (v == null || v === '' ? '' : '"' + String(v).replace(/"/g, '""') + '"');
    const csv = '\uFEFF' + [headers.map(escape).join(','), example.map(escape).join(',')].join('\r\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'products_sample.csv';
    a.click();
    URL.revokeObjectURL(a.href);
}

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
        const errDetails = result.error_details;
        addLog('Data Imported', CURRENT_USER_ROLE, `Imported/Updated ${total} products from CSV`);
        let msg = `CSV import complete. ${imported} products imported, ${updated} products updated (${total} total).`;
        if (errDetails && errDetails.length) msg += '\n\nDetails: ' + errDetails.join('; ');
        alert(msg);
        renderItemsList();
        updateSummary();
        
        // Reset file input
        event.target.value = '';
    } catch (error) {
        alert(error.message || 'Failed to import CSV file. Please try again.');
    }
}

// --- Customer Management ---
async function renderCustomersList(searchFilter = '') {
    const customersResponse = await getCustomers();
    let customers = Array.isArray(customersResponse) ? customersResponse : (customersResponse?.data || []);
    
    // Apply search filter
    if (searchFilter.trim()) {
        const filter = searchFilter.toLowerCase().trim();
        customers = customers.filter(customer => {
            return (customer.name && customer.name.toLowerCase().includes(filter)) ||
                   (customer.email && customer.email.toLowerCase().includes(filter)) ||
                   (customer.phone && customer.phone.toLowerCase().includes(filter)) ||
                   (customer.address && customer.address.toLowerCase().includes(filter));
        });
    }
    
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
                const searchInput = document.getElementById('customerListSearchInput');
                const filter = searchInput ? searchInput.value.trim() : '';
                renderCustomersList(filter);
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
                const searchInput = document.getElementById('customerListSearchInput');
                const filter = searchInput ? searchInput.value.trim() : '';
                renderCustomersList(filter);
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
                const searchInput = document.getElementById('customerListSearchInput');
                const filter = searchInput ? searchInput.value.trim() : '';
                renderCustomersList(filter);
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
    
    // Get current search filter
    const searchInput = document.getElementById('customerListSearchInput');
    const filter = searchInput ? searchInput.value.trim() : '';
    
    renderCustomersList(filter);
}

// --- Customer Quotation Details Management ---
async function renderCustomerDetailsList(searchFilter = '') {
    const customersResponse = await getCustomers();
    let customers = Array.isArray(customersResponse) ? customersResponse : (customersResponse?.data || []);
    const quotationsResponse = await getQuotations();
    const quotations = Array.isArray(quotationsResponse) ? quotationsResponse : (quotationsResponse?.data || []);
    
    // Apply search filter
    if (searchFilter.trim()) {
        const filter = searchFilter.toLowerCase().trim();
        customers = customers.filter(customer => {
            return (customer.name && customer.name.toLowerCase().includes(filter)) ||
                   (customer.email && customer.email.toLowerCase().includes(filter)) ||
                   (customer.phone && customer.phone.toLowerCase().includes(filter)) ||
                   (customer.address && customer.address.toLowerCase().includes(filter));
        });
    }
    
    const body = document.getElementById('customerDetailsListBody');
    const customersTable = document.getElementById('customerDetailsTable');
    const paginationDiv = document.getElementById('customerDetailsPagination');
    if (!body) return;
    
    body.innerHTML = '';

    if (customers.length === 0) {
        body.innerHTML = '<tr><td colspan="8" class="muted" style="text-align:center">No customer data available.</td></tr>';
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
        // Count quotations for this customer
        const customerQuotationCount = quotations.filter(q => {
            const phone = q.customer?.phone || q.customerPhone;
            return phone === customer.phone;
        }).length;

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
            <td>${customerQuotationCount}</td>
            <td><button class="btn" style="padding: 5px 8px;" onclick="event.stopPropagation(); openEditCustomerModal('${phoneEscaped}')" title="Edit customer"><i class="fas fa-edit"></i></button></td>
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
                const searchInput = document.getElementById('customerDetailsSearchInput');
                const filter = searchInput ? searchInput.value.trim() : '';
                renderCustomerDetailsList(filter);
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
                const searchInput = document.getElementById('customerDetailsSearchInput');
                const filter = searchInput ? searchInput.value.trim() : '';
                renderCustomerDetailsList(filter);
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
                const searchInput = document.getElementById('customerDetailsSearchInput');
                const filter = searchInput ? searchInput.value.trim() : '';
                renderCustomerDetailsList(filter);
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
    
    // Get current search filter
    const searchInput = document.getElementById('customerDetailsSearchInput');
    const filter = searchInput ? searchInput.value.trim() : '';
    
    renderCustomerDetailsList(filter);
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
            <td colspan="7">
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
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${customerQuotations.map((quotation, qIndex) => `
                                <tr style="border-bottom: 2px solid #e0e0e0; background-color: #f8f9fa;">
                                    <td style="font-weight: bold; color: #2196f3;">${customerSerialNumber}.${qIndex + 1}</td>
                                    <td>${new Date(quotation.dateCreated || quotation.created_at).toLocaleDateString()}</td>
                                    <td>${quotation.created_at ? new Date(quotation.created_at).toLocaleString() : new Date(quotation.dateCreated).toLocaleString()}</td>
                                    <td style="font-weight: bold; color: #27ae60;">${formatRupee(quotation.totalAmount || quotation.total)}</td>
                                    <td>${quotation.items ? quotation.items.length : 0}</td>
                                    <td>${quotation.createdBy || quotation.user || 'N/A'}</td>
                                    <td><button class="btn" style="padding: 4px 8px; font-size: 12px;" onclick="event.stopPropagation(); editQuotationInCreateSection('${quotation.quotationId || quotation.id}')" title="Edit quotation"><i class="fas fa-edit"></i></button></td>
                                </tr>
                                ${quotation.items && quotation.items.length > 0 ? `
                                    <tr>
                                        <td colspan="7" style="padding: 0; border-bottom: 1px solid #e0e0e0;">
                                            <div style="background: #ffffff; margin: 8px; padding: 12px; border-radius: 8px; border-left: 4px solid #2196f3; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                                                <h4 style="margin: 0 0 10px 0; color: #34495e; font-size: 14px;">Items Details</h4>
                                                <table class="data-table" style="margin: 0; width: 100%; background: transparent;">
                                                    <thead>
                                                        <tr>
                                                            <th style="text-align: left; padding-left: 8px; font-size: 12px;">Item Details</th>
                                                            <th style="font-size: 12px;">Quantity</th>
                                                            <th style="font-size: 12px;">Unit Price</th>
                                                            <th style="font-size: 12px;">Total</th>
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
                                            </div>
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
    try {
        const rulesResponse = await getGstRules();
        const rules = Array.isArray(rulesResponse) ? rulesResponse : (rulesResponse?.data || []);
        const settingsResponse = await getSettings();
        const settings = settingsResponse?.data || settingsResponse || {};
        const defaultGst = settings.defaultGst || 18;

        const rule = Array.isArray(rules) ? rules.find(r => r.productName && r.productName.toLowerCase() === itemName.toLowerCase()) : null;
        return rule ? parseFloat(rule.percent) : parseFloat(defaultGst);
    } catch (e) {
        // Default to 18% if there's an error
        return 18;
    }
}


// --- Quotation Creation Logic ---
function getQuotationItems() {
    return quotationItems;
}

function invalidateQuotationTypeFiltersCache() {
    const el = document.getElementById('quotationTypeFilters');
    if (el) { el.removeAttribute('data-rendered'); }
}

// Dynamic type filters for "Add Items to Quotation" — synced from Settings (quotationItemTypeOrder + productTypes) + item types
async function renderQuotationTypeFilters(items = null) {
    console.trace('🔍 renderQuotationTypeFilters called');
    const container = document.getElementById('quotationTypeFilters');
    if (!container) return;

    // Prevent unnecessary re-renders
    if (container.hasAttribute('data-rendered') && container.children.length > 0) {
        console.log('⚠️ renderQuotationTypeFilters skipped - already rendered');
        return;
    }

    let itemsData = items || window.cachedItems || [];
    if (!itemsData || itemsData.length === 0) {
        try {
            const raw = await getItems();
            itemsData = Array.isArray(raw) ? raw : (raw?.data || []);
        } catch (e) { itemsData = []; }
    }
    let settings = {};
    try {
        settings = await getSettings();
    } catch (e) { /* use defaults */ }
    // Use quotationTypeFilters from database (GET /settings); fallback to merging order + productTypes
    let filtersFromDb = Array.isArray(settings.quotationTypeFilters) ? settings.quotationTypeFilters.slice() : [];
    if (filtersFromDb.length === 0) {
        const orderFromSettings = Array.isArray(settings.quotationItemTypeOrder) && settings.quotationItemTypeOrder.length > 0
            ? settings.quotationItemTypeOrder.slice()
            : DEFAULT_QUOTATION_ITEM_TYPE_ORDER.slice();
        const productTypesFromSettings = Array.isArray(settings.productTypes) ? settings.productTypes.slice() : [];
        const seen = new Set();
        orderFromSettings.forEach(function (t) {
            const v = String(t).toLowerCase().trim();
            if (v && !seen.has(v) && !isExcludedType(v)) { seen.add(v); filtersFromDb.push(String(t).trim()); }
        });
        productTypesFromSettings.forEach(function (t) {
            const v = String(t).toLowerCase().trim();
            if (v && !seen.has(v) && !isExcludedType(v)) { seen.add(v); filtersFromDb.push(String(t).trim()); }
        });
    } else {
        filtersFromDb = filtersFromDb.filter(function (t) { return !isExcludedType(t); });
    }
    const typesFromItems = [...new Set(itemsData.map(item => item.type).filter(Boolean))].filter(function (t) { return !isExcludedType(t); });
    const seen = new Set();
    const orderedPairs = [];
    orderedPairs.push({ value: '', label: 'All' });
    seen.add('');
    seen.add('all');
    filtersFromDb.forEach(function (t) {
        const v = String(t).toLowerCase().trim();
        if (v && !seen.has(v)) { seen.add(v); orderedPairs.push({ value: v, label: String(t).trim() }); }
    });
    typesFromItems.sort((a, b) => String(a).localeCompare(String(b), 'en-IN', { sensitivity: 'base' }));
    typesFromItems.forEach(function (t) {
        const v = String(t).toLowerCase().trim();
        if (v && !seen.has(v)) { seen.add(v); orderedPairs.push({ value: v, label: String(t).trim() }); }
    });
    // Sort by Quotation Products display order from Settings (filtersFromDb); keep "All" first
    var displayOrderLower = (filtersFromDb || []).map(function (x) { return String(x).toLowerCase().trim(); });
    orderedPairs.sort(function (a, b) {
        if ((a.value || '') === '') return -1;
        if ((b.value || '') === '') return 1;
        var ia = displayOrderLower.indexOf((a.value || '').toLowerCase().trim());
        var ib = displayOrderLower.indexOf((b.value || '').toLowerCase().trim());
        if (ia < 0) ia = displayOrderLower.length;
        if (ib < 0) ib = displayOrderLower.length;
        if (ia !== ib) return ia - ib;
        return String(a.value || '').localeCompare(String(b.value || ''), 'en-IN', { sensitivity: 'base' });
    });

    container.innerHTML = '';

    function createButton(label, value, isActive) {
        const btn = document.createElement('button');
        btn.className = 'type-filter-btn';
        if (isActive) btn.classList.add('active');
        btn.dataset.type = value;
        btn.textContent = (label || '').toUpperCase();
        btn.style.padding = '6px 12px';
        btn.style.border = '1px solid var(--border)';
        btn.style.borderRadius = '6px';
        btn.style.background = '#fff';
        btn.style.cursor = 'pointer';
        btn.style.fontSize = '12px';
        btn.style.transition = 'all 0.2s';
        return btn;
    }

    orderedPairs.forEach(function (p, idx) {
        const isActive = idx === 0;
        container.appendChild(createButton(p.label, p.value, isActive));
    });

    container.setAttribute('data-rendered', 'true');
}

async function renderAvailableItemsForQuotation(filter = '', typeFilter = '', items = null) {
    console.trace('🔍 renderAvailableItemsForQuotation called');
    try {
        let itemsData;
        const compatibleOnly = document.getElementById('compatibleFilterToggle')?.checked;
        const refIds = Array.isArray(quotationItems) ? quotationItems.map(qi => qi.productId).filter(Boolean) : [];

        if (compatibleOnly && refIds.length > 0) {
            try {
                const resp = await apiFetch('/items/compatible?with=' + encodeURIComponent(refIds.join(',')));
                itemsData = (resp && resp.data) ? resp.data : (resp && Array.isArray(resp) ? resp : []);
            } catch (e) {
                console.warn('Compatible filter failed, showing all items:', e);
                itemsData = items || window.cachedItems || await getItems();
            }
        } else {
            itemsData = items || window.cachedItems || await getItems();
        }

        const listDiv = document.getElementById('availableItemsList');
        
        if (!listDiv) return;
        listDiv.innerHTML = '';

        if (!Array.isArray(itemsData) || itemsData.length === 0) {
            listDiv.innerHTML = '<p class="muted" style="padding:10px;text-align:center">No products available in database. Please add products through the admin panel.</p>';
            return;
        }

        const normalizedFilter = filter.toLowerCase();
        const normalizedTypeFilter = typeFilter.toLowerCase();
        const filteredItems = itemsData.filter(item => {
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

        // Primary sort: category order (CPU, CPU Cooler, Motherboard, Memory, Storage, Graphic card, Case, Monitor)
        filteredItems.sort((a, b) => {
            const catA = getQuotationCategorySortIndex(a.type);
            const catB = getQuotationCategorySortIndex(b.type);
            if (catA !== catB) return catA - catB;
            const priceSort = document.getElementById('quotationPriceSortBtn')?.getAttribute('data-price-sort') || 'none';
            if (priceSort === 'lowToHigh') return (parseFloat(a.price) || 0) - (parseFloat(b.price) || 0);
            if (priceSort === 'highToLow') return (parseFloat(b.price) || 0) - (parseFloat(a.price) || 0);
            return 0;
        });

        if (filteredItems.length === 0) {
            listDiv.innerHTML = '<p class="muted" style="padding:10px;text-align:center">No products found matching your search.</p>';
            return;
        }

        filteredItems.forEach(item => {
            const itemDiv = document.createElement('div');
            itemDiv.style.cssText = 'display:flex; justify-content:space-between; align-items:center; padding:10px; border-bottom:1px solid #f2f6fb;';

            const productId = item.productId || item.id;
            const productName = item.productName || item.name;
            const price = item.price || 0;

            itemDiv.innerHTML = `
                        <div>
                            <strong>${productName}</strong> <span class="muted" style="font-size:12px">(${productId})</span>
                            <div style="font-size:13px;">${formatRupee(price)}</div>
                        </div>
                        <button class="btn primary" onclick="addItemToQuotation('${productId}')"><i class="fas fa-plus"></i> Add</button>
                    `;
            listDiv.appendChild(itemDiv);
        });
    } catch (error) {
        console.error('Error rendering available items:', error);
        const listDiv = document.getElementById('availableItemsList');
        if (!listDiv) return;
        
        listDiv.innerHTML = '<p class="muted" style="padding:10px;text-align:center">Error loading products. Please refresh the page.</p>';
    }
}

async function addItemToQuotation(productId) {
    // Always use items table for create quotation section (not temp table)
    const itemsResponse = await getItems();
    const items = Array.isArray(itemsResponse) ? itemsResponse : (itemsResponse?.data || []);
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
            type: itemToAdd.type || '',
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
        const activeTypeFilter = document.querySelector('#quotationTypeFilters .type-filter-btn.active')?.dataset.type || '';
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
        const activeTypeFilter = document.querySelector('#quotationTypeFilters .type-filter-btn.active')?.dataset.type || '';
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

    const sortedItems = [...quotationItems].sort((a, b) => getQuotationCategorySortIndex(a.type) - getQuotationCategorySortIndex(b.type));
    sortedItems.forEach(item => {
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
        removeBtn.title = 'Remove item from quotation';
        removeBtn.innerHTML = '<i class="fas fa-trash-alt"></i> Delete';
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

    document.getElementById('subTotalDisplay').textContent = formatRupee(subTotal);
    const discountAmountDisplay = document.getElementById('discountAmountDisplay');
    if (discountAmountDisplay) discountAmountDisplay.textContent = formatRupee(discountAmount);
    const gstAmountDisplay = document.getElementById('gstAmountDisplay');
    if (gstAmountDisplay) gstAmountDisplay.textContent = formatRupee(totalGstAmount);
    document.getElementById('grandTotalDisplay').textContent = formatRupee(grandTotal);
}

async function createQuotation() {
    if (!AUTHORIZED_TO_CREATE_QUOTATIONS.includes(CURRENT_USER_ROLE)) {
        alert('You are not authorized to create quotations.');
        return;
    }

    // Edit mode: update existing quotation via create section (same flow as resume drafts)
    if (currentEditQuotationId) {
        const qid = currentEditQuotationId;
        const customerName = document.getElementById('cust-name')?.value.trim() || null;
        const phoneNumber = document.getElementById('phone-number')?.value.trim();
        const customerEmail = document.getElementById('cust-email')?.value.trim() || null;
        const customerAddress = document.getElementById('cust-address')?.value.trim() || null;
        const items = getQuotationItems();
        if (!phoneNumber || phoneNumber.length !== 10) {
            alert('Please enter a valid 10-digit phone number for the customer.');
            return;
        }
        if (items.length === 0) {
            alert('Please add at least one item to the quotation.');
            return;
        }
        const discountPercent = parseFloat(document.getElementById('discount-percent')?.value || 0);
        const cust = { name: customerName || '', phone: phoneNumber, email: customerEmail || null, address: customerAddress || null };
        const itemsForUpdate = items.filter(it => it.productName && (parseFloat(it.price) || 0) > 0).map((it, idx) => ({
            productId: it.productId || `custom-${Date.now()}-${idx}`,
            productName: it.productName,
            price: parseFloat(it.price) || 0,
            quantity: parseInt(it.quantity, 10) || 1,
            gstRate: parseFloat(it.gstRate) || 0
        }));
        if (itemsForUpdate.length === 0) {
            alert('Add at least one item with a valid price.');
            return;
        }
        try {
            const imagesForSave = await adminEnsureImagesAreUrls(getAdminUploadedImages() || []);
            const res = await apiFetch(`/quotations/${qid}/update`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ customer: cust, items: itemsForUpdate, discountPercent, images: imagesForSave })
            });
            if (res && (res.success !== false)) {
                currentEditQuotationId = null;
                const createBtn = document.getElementById('createQuotationBtn');
                if (createBtn) createBtn.textContent = 'Create Quotation';
                document.querySelectorAll('#sideNav a[data-tab="createQuotation"], .tab-btn[data-tab="createQuotation"]').forEach(el => { if (el.tagName === 'A') el.innerHTML = '<i class="fas fa-file-invoice-dollar"></i> Quotations'; else el.textContent = 'Quotations'; });
                const sectionTitle = document.getElementById('createQuotationSectionTitle');
                if (sectionTitle) sectionTitle.textContent = 'Create Quotation';
                const cancelEditBtn = document.getElementById('cancelEditInCreateSectionBtn');
                if (cancelEditBtn) cancelEditBtn.style.display = 'none';
                quotationItems = [];
                document.getElementById('cust-name').value = '';
                document.getElementById('phone-number').value = '';
                document.getElementById('cust-email').value = '';
                document.getElementById('cust-address').value = '';
                const discountPercentInput = document.getElementById('discount-percent');
                if (discountPercentInput) discountPercentInput.value = '0';
                if (typeof clearAdminImageUpload === 'function') clearAdminImageUpload();
                renderQuotationItems();
                updateGrandTotal();
                currentQuotationDraftId = null;
                loadQuotationDrafts();
                renderHistoryList();
                renderCustomersList();
                renderCustomerDetailsList();
                addLog('Quotation Updated', CURRENT_USER_ROLE, `Updated quotation: ${qid}`);
                alert('Quotation updated successfully.');
            } else {
                alert(res?.message || 'Failed to update quotation.');
            }
        } catch (e) {
            console.error('Update quotation error:', e);
            alert('Failed to update quotation.');
        }
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

    // Recalculate totals
    let subTotal = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const discountPercent = parseFloat(document.getElementById('discount-percent')?.value || 0);
    let discountAmount = (subTotal * (discountPercent / 100));
    let totalGstAmount = items.reduce((sum, item) => {
        return sum + (item.price * item.quantity * (item.gstRate / 100));
    }, 0);
    let grandTotal = (subTotal - discountAmount) + totalGstAmount;

    // Prepare items for API (remove description field as it's not in schema)
    const itemsForApi = items.map(item => ({
        productId: String(item.productId || item.id),
        productName: String(item.productName || item.name),
        price: String(parseFloat(item.price || 0).toFixed(2)),
        quantity: parseInt(item.quantity || 1),
        gstRate: String(parseFloat(item.gstRate || 0).toFixed(2))
    }));

    const payload = {
        quotationId: generateProductId().replace('P', 'Q'),
        dateCreated: new Date().toLocaleDateString('en-IN'),
        customer: {
            name: customerName || null,
            phone: phoneNumber,
            email: customerEmail || null,
            address: customerAddress || null
        },
        items: itemsForApi,
        images: await adminEnsureImagesAreUrls(typeof getAdminUploadedImages === 'function' ? getAdminUploadedImages() : []),
        subTotal: String(parseFloat(subTotal).toFixed(2)),
        discountPercent: String(parseFloat(discountPercent).toFixed(2)),
        discountAmount: String(parseFloat(discountAmount).toFixed(2)),
        totalGstAmount: String(parseFloat(totalGstAmount).toFixed(2)),
        grandTotal: String(parseFloat(grandTotal).toFixed(2)),
        createdBy: CURRENT_USER_EMAIL.split('@')[0]
    };

    // Disable submit button during submission (declare outside try block for finally access)
    const submitBtn = document.getElementById('createQuotationBtn');
    const originalBtnText = submitBtn?.textContent;
    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = 'Creating...';
    }

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
            quotationData.subTotal = parseFloat(quotationData.subTotal || 0);
            quotationData.discountAmount = parseFloat(quotationData.discountAmount || 0);
            quotationData.discountPercent = parseFloat(quotationData.discountPercent || 0);
            quotationData.totalGstAmount = parseFloat(quotationData.totalGstAmount || 0);
            quotationData.grandTotal = parseFloat(quotationData.grandTotal || 0);
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
        if (typeof clearAdminImageUpload === 'function') clearAdminImageUpload();
        renderQuotationItems();
        updateGrandTotal();
        document.getElementById('itemSearchInput').value = '';
        renderAvailableItemsForQuotation();

        currentQuotationDraftId = null;
        loadQuotationDrafts();
        alert('Quotation created successfully!');
        addLog('Quotation Created', CURRENT_USER_ROLE, `Created quotation: ${quotationId} for ${customerName || 'Customer'} (${phoneNumber})`);
    } catch (e) {
        // Error already handled in apiFetch, but show user-friendly message
        const errorMsg = e.message || 'Failed to create quotation. Please try again.';
        alert(`Error: ${errorMsg}`);
    } finally {
        // Re-enable submit button
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.textContent = originalBtnText || '<i class="fas fa-file-invoice-dollar"></i> Create Quotation';
        }
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
        
        const rawItemsForPdf = quotation.items || quotation.products || quotation.lineItems || [];
        const itemsCount = Array.isArray(rawItemsForPdf) ? rawItemsForPdf.length : 0;
        const needsMultiplePages = itemsCount > 8 || imgHeight > pageHeight;
        
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
        const sanitizedName = customerName.toString()
            .replace(/[^a-zA-Z0-9_ ]/g, '')
            .replace(/\s+/g, '_')
            .replace(/__+/g, '_')
            .trim() || 'Quotation';
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
    const logoBase64 = '';
    const brandName = settings.brand || 'TECHTITANS';
    const companyGstId = settings.companyGstId || 'N/A';
    const validityDays = quotation.validityDays || settings.validityDays || settings.defaultValidityDays || 3;
    
    // Get PDF theme colors and fonts (includes custom themes from localStorage)
    const pdfThemeName = getEffectivePdfThemeKey(settings);
    const themeMap = getEffectivePdfThemes();
    const theme = themeMap[pdfThemeName] || themeMap.default;
    const pdfFontPrimary = getPdfFontFamilyCss(getEffectivePdfFontPrimary());
    const pdfFontSecondary = getPdfFontFamilyCss(getEffectivePdfFontSecondary());
    const pdfFontTertiary = getPdfFontFamilyCss(getEffectivePdfFontTertiary());
    const pdfSizePrimary = getEffectivePdfFontSizePrimary();
    const pdfSizeSecondary = getEffectivePdfFontSizeSecondary();
    const pdfSizeTertiary = getEffectivePdfFontSizeTertiary();

    // Company details - using defaults if not in settings
    const companyAddress = settings.companyAddress || '1102, second Floor, Before Atithi Satkar<br>Hotel OTC Road, Bangalore 560002';
    const companyEmail = settings.companyEmail || 'advanceinfotech21@gmail.com';
    const companyPhone = settings.companyPhone || '+91 63626 18184 | +91 80507 02019';

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
    let items = quotation.items || quotation.products || quotation.lineItems || [];
    items = Array.isArray(items) ? [...items] : [];
    
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
                    quantity: item.quantity || 1,
                    itemUrl: tempItem.itemUrl || item.itemUrl || item.url || ''
                };
            }
            return item;
        });
    } catch (error) {
        console.warn('Failed to fetch temp items, using original items:', error);
    }
    
    // Use stored totals for footer; only the Amount column (per row) is calculated (Unit Price × Qty)
    grandTotal = parseFloat(quotation.grandTotal || quotation.totalAmount || quotation.total) || grandTotal;
    
    // Ensure quotation ID and date are available
    const quotationId = quotation.quotationId || quotation.id || 'N/A';
    const dateCreated = quotation.dateCreated || new Date().toLocaleDateString('en-IN');

    // PDF pagination: 8 products per page, with header only on first page and footer only on last page
    const pdfPage = options.pdfPage || null;
    let itemsForTable = items;
    let showTotals = true;
    let pageNumFooter = '';
    let snoOffset = 0;
    if (pdfPage) {
        const { pageIndex, itemsPerPage, totalPages, isLastPage } = pdfPage;
        const start = pageIndex * itemsPerPage;
        const end = Math.min(start + itemsPerPage, items.length);
        itemsForTable = items.slice(start, end);
        showTotals = isLastPage;
        snoOffset = start;
        pageNumFooter = `Page ${pageIndex + 1} of ${totalPages}`;
    }

    const pageIndex = pdfPage ? (Number(pdfPage.pageIndex) || 0) : 0;
    const totalPagesForPattern = pdfPage ? (Number(pdfPage.totalPages) || 1) : 1;
    const isLastPageForPattern = pdfPage ? !!pdfPage.isLastPage : true;
    const isFirstPageForPattern = !pdfPage || pageIndex === 0;
    const isSinglePageForPattern = !pdfPage || totalPagesForPattern === 1;
    const showHeaderSection = isSinglePageForPattern ? true : isFirstPageForPattern;
    const showFooterSection = isSinglePageForPattern ? true : isLastPageForPattern;

    if (!showFooterSection) pageNumFooter = '';

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

    const headerLogoHtml = showHeaderSection ? logoImgHtml : '';
    const headerCustomerImageHtml = showHeaderSection ? customerImageHtml : '';

    // Page 2: Images attached to quotation
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
        return (getCustomFontsCssForPdf() ? getCustomFontsCssForPdf() + '\n' : '') + `
                <div style="width: 800px; min-height: 1123px; margin: 0; background: ${theme.pastelBg}; font-family: ${pdfFontTertiary}; padding: 48px 56px ${showFooterSection ? '120px' : '48px'} 56px; position: relative; color: #1f2937; box-sizing: border-box;">
                    <style>.theme-border { border-color: ${theme.border} !important; }</style>
                    ${headerLogoHtml}
                    ${headerCustomerImageHtml}
                    ${showHeaderSection ? `
                    <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 40px; margin-top: 120px;">
                        <div>
                            <div style="font-size: ${pdfSizeTertiary}px; font-weight: 600; color: ${theme.primary}; margin-top: 8px; margin-bottom: 4px;">AdvanceInfoTech</div>
                            <div style="font-size: ${pdfSizeTertiary}px; color: #6b7280;">${companyAddress}</div>
                            <div style="font-size: ${pdfSizeTertiary}px; color: #6b7280;">${companyEmail}</div>
                            <div style="font-size: ${pdfSizeTertiary}px; color: #6b7280;">${companyPhone}</div>
                        </div>
                        <div style="flex: 1; text-align: center;"><h1 style="margin: 0; font-size: ${pdfSizePrimary}px; font-weight: 600; color: ${theme.primary}; letter-spacing: -0.02em; font-family: ${pdfFontPrimary};">Project Preview</h1></div>
                        <div style="width: 200px;"></div>
                    </div>
                    <div style="display: flex; justify-content: space-between; margin-bottom: 32px; padding-bottom: 24px; border-bottom: 1px solid ${theme.border};">
                        <div>${(function() { const line1 = [customer?.name, customer?.phone, customer?.email].filter(Boolean); const addr = customer?.address; if (!line1.length && !addr) return ''; return `<div style="font-size: ${pdfSizeTertiary}px; font-weight: 600; color: ${theme.primary}; margin-bottom: 4px;">Quotation to</div><div style="font-size: ${pdfSizeTertiary}px; color: #374151;"><span style="font-weight: 600;">${line1.map((part, i) => (i ? ' <span style="font-weight: 700; margin: 0 0.35em;">|</span> ' : '') + part).join('')}</span>${addr ? '<br><span style="font-weight: 600;">' + addr + '</span>' : ''}</div>`; })()}</div>
                        <div style="text-align: right;"><div style="font-size: ${pdfSizeTertiary}px; text-transform: uppercase; letter-spacing: 0.05em; color: #6b7280;">Date</div><div style="font-size: ${pdfSizeTertiary}px;">${dateCreated}</div></div>
                    </div>
                    ` : ''}
                    <div style="margin-top: 24px; margin-bottom: 24px;">
                        ${imagesGridHtml}
                    </div>
                    ${showFooterSection ? `
                    <div style="position: absolute; bottom: 48px; left: 56px; right: 56px;">
                        <hr style="border: none; border-top: 1px solid ${theme.border}; margin: 0 0 12px 0;">
                        <div style="font-size: ${pdfSizeTertiary}px; line-height: 1.4; color: #5c5c5c; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center;">
                            <div style="white-space: nowrap;">Free <span style="color: ${theme.primary}">Pan-India shipping</span> available, 100% genuine parts with proper GST invoice, and direct brand/manufacturer warranty on all components.</div>
                            <div style="white-space: nowrap;">Includes <span style="color: ${theme.primary}">3-year</span> technical call support <span style="color: ${theme.accent}">(Monday to Saturday, 12 PM–7 PM)</span> and Windows 11 Pro installation with lifetime license support.</div>
                            <div style="white-space: nowrap;">Prices valid for <span style="color: ${theme.primary}">limited time</span> due to frequent market changes in GPU/RAM/SSD.</div>
                        </div>
                    </div>
                    ` : ''}
                </div>
        `;
    }

    return (getCustomFontsCssForPdf() ? getCustomFontsCssForPdf() + '\n' : '') + `
                <div style="width: 800px; min-height: 1123px; margin: 0; background: ${theme.pastelBg}; font-family: ${pdfFontTertiary}; padding: 48px 56px ${showFooterSection ? '120px' : '48px'} 56px; position: relative; color: #1f2937; box-sizing: border-box;">
                    <style>
                        .q-table { width: 100%; border-collapse: collapse; margin: 24px 0; font-size: ${pdfSizeSecondary}px; font-family: ${pdfFontSecondary}; }
                        .q-table th { text-align: left; padding: 14px 12px; border-bottom: 2px solid ${theme.primary}; color: ${theme.secondary}; font-weight: 600; }
                        .q-table td { padding: 14px 12px; border-bottom: 1px solid ${theme.border}; }
                        .q-table .text-right { text-align: right; }
                        .theme-header { color: ${theme.primary}; }
                        .theme-accent { color: ${theme.accent}; }
                        .theme-border { border-color: ${theme.border} !important; }
                    </style>
                    ${headerLogoHtml}
                    ${headerCustomerImageHtml}
                    ${showHeaderSection ? `
                    <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 40px; margin-top: 120px;">
                        <div>
                            <div style="font-size: ${pdfSizeTertiary}px; font-weight: 600; color: ${theme.primary}; margin-top: 8px; margin-bottom: 4px;">Advance InfoTech</div>
                            <div style="font-size: ${pdfSizeTertiary}px; color: #6b7280;">${companyAddress}</div>
                            <div style="font-size: ${pdfSizeTertiary}px; color: #6b7280;">${companyEmail}</div>
                            <div style="font-size: ${pdfSizeTertiary}px; color: #6b7280;">${companyPhone}</div>
                        </div>
                        <div style="flex: 1; text-align: center;">
                            <h1 style="margin: 0; font-size: ${pdfSizePrimary}px; font-weight: 600; color: ${theme.primary}; letter-spacing: -0.02em; font-family: ${pdfFontPrimary};">Quotation</h1>
                        </div>
                        <div style="width: 200px;"></div>
                    </div>
                    <div style="display: flex; justify-content: space-between; margin-bottom: 32px; padding-bottom: 24px; border-bottom: 1px solid ${theme.border};">
                        <div>
                            ${(function() { const line1 = [customer?.name, customer?.phone, customer?.email].filter(Boolean); const addr = customer?.address; if (!line1.length && !addr) return ''; return `<div style="font-size: ${pdfSizeTertiary}px; font-weight: 600; color: ${theme.primary}; margin-bottom: 4px;">Quotation to</div><div style="font-size: ${pdfSizeTertiary}px; color: #374151;"><span style="font-weight: 600;">${line1.map((part, i) => (i ? ' <span style="font-weight: 700; margin: 0 0.35em;">|</span> ' : '') + part).join('')}</span>${addr ? '<br><span style="font-weight: 600;">' + addr + '</span>' : ''}</div>`; })()}
                        </div>
                        <div style="text-align: right;">
                            <div style="font-size: ${pdfSizeTertiary}px; text-transform: uppercase; letter-spacing: 0.05em; color: #6b7280;">Date</div>
                            <div style="font-size: ${pdfSizeTertiary}px;">${dateCreated}</div>
                        </div>
                    </div>
                    ` : ''}
                    <table class="q-table">
                        <thead>
                            <tr>
                                <th>S.No</th>
                                <th>Type</th>
                                <th>Description</th>
                                <th style="width:52px;font-size:11px;">Link</th>
                                <th class="text-right">Unit Price</th>
                                <th class="text-right">Qty</th>
                                <th class="text-right">Amount</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${itemsForTable.length > 0 ? itemsForTable.map((item, idx) => {
                                const itemPrice = parseFloat(item.price || item.unitPrice || 0);
                                const itemQuantity = parseInt(item.quantity || item.qty || 1, 10);
                                const itemTotal = itemPrice * itemQuantity;
                                const linkUrl = (item.itemUrl || item.url || '').trim();
                                const linkCell = linkUrl ? `<a href="${linkUrl}" style="color:${theme.primary};text-decoration:none;" title="${linkUrl}"><i class="fas fa-link" style="font-size:12px;"></i></a>` : '—';
                                return `
                                    <tr>
                                        <td>${snoOffset + idx + 1}</td>
                                        <td>${item.type || 'N/A'}</td>
                                        <td>${item.productName || 'N/A'}</td>
                                        <td style="text-align:center;">${linkCell}</td>
                                        <td class="text-right">${formatRupee(itemPrice)}</td>
                                        <td class="text-right">${itemQuantity}</td>
                                        <td class="text-right">${formatRupee(itemTotal)}</td>
                                    </tr>
                                `;
                            }).join('') : '<tr><td colspan="7" style="text-align: center; padding: 24px; color: #9ca3af;">No items</td></tr>'}
                        </tbody>
                    </table>
                    ${showTotals ? `<div style="margin-top: 24px; text-align: right; padding-bottom: 24px; border-bottom: 1px solid ${theme.border};">
                        <div style="display: inline-block; width: 260px; text-align: right;">
                            <div style="display: flex; justify-content: space-between; padding: 8px 0; font-size: ${pdfSizeTertiary}px;">
                                <span style="color: #6b7280;">Subtotal (excl). GST)</span>
                                <span>${formatRupee(totalAfterDiscount)}</span>
                            </div>
                            <div style="display: flex; justify-content: space-between; padding: 12px 0; margin-top: 8px; border-top: 2px solid ${theme.primary}; font-size: ${pdfSizeTertiary + 2}px; font-weight: 600;">
                                <span>Total</span>
                                <span>${formatRupee(grandTotal)}</span>
                            </div>
                        </div>
                    </div>` : ''}
                    ${showFooterSection ? `
                    <div style="position: absolute; bottom: 48px; left: 56px; right: 56px;">
                        <hr style="border: none; border-top: 1px solid ${theme.border}; margin: 0 0 12px 0;">
                        <div style="font-size: ${pdfSizeTertiary}px; line-height: 1.4; color: #5c5c5c; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center;">
                            <div style="white-space: nowrap;">Free <span style="color: ${theme.primary}">Pan-India shipping</span> available, 100% genuine parts with proper GST invoice, and direct brand/manufacturer warranty on all components.</div>
                            <div style="white-space: nowrap;">Includes <span style="color: ${theme.primary}">3-year</span> technical call support <span style="color: ${theme.accent}">(Monday to Saturday, 12 PM–7 PM)</span> and Windows 11 Pro installation with lifetime license support.</div>
                            <div style="white-space: nowrap;">Prices valid for <span style="color: ${theme.primary}">limited time</span> due to frequent market changes in GPU/RAM/SSD.</div>
                        </div>
                    </div>
                    ` : ''}
                </div>
    `;
}

// --- PDF Download Logic (modal; keep name for backward compatibility) ---
async function downloadQuotationAsPng(quotation) {
    if (!quotation) {
        alert('Quotation data not found.');
        return;
    }
    try {
        const downloadBtn = document.getElementById('downloadQuotationPng');
        const originalBtnText = downloadBtn?.innerHTML || downloadBtn?.textContent;
        if (downloadBtn) {
            downloadBtn.disabled = true;
            downloadBtn.innerHTML = 'Generating...';
        }
        await downloadQuotationAsPdfDirect(quotation);
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
    try {
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

            const matchesType =
                !typeFilter || itemType === typeFilter;

            return matchesSearch && matchesType;
        });

        if (itemsCurrentNameSort === 'asc') {
            filteredItems.sort((a, b) => (String(a.productName || '').localeCompare(String(b.productName || ''), 'en-IN', { sensitivity: 'base' })));
        } else if (itemsCurrentNameSort === 'desc') {
            filteredItems.sort((a, b) => (String(b.productName || '').localeCompare(String(a.productName || ''), 'en-IN', { sensitivity: 'base' })));
        }
        if (itemsCurrentPriceSort === 'asc') {
            filteredItems.sort((a, b) => parseFloat(a.price || 0) - parseFloat(b.price || 0));
        } else if (itemsCurrentPriceSort === 'desc') {
            filteredItems.sort((a, b) => parseFloat(b.price || 0) - parseFloat(a.price || 0));
        }
        if (itemsCurrentTotalValueSort === 'asc') {
            const totalVal = (item) => { const p = parseFloat(item.price) || 0; const g = parseFloat(item.gst) || 0; return p + (p * g / 100); };
            filteredItems.sort((a, b) => totalVal(a) - totalVal(b));
        } else if (itemsCurrentTotalValueSort === 'desc') {
            const totalVal = (item) => { const p = parseFloat(item.price) || 0; const g = parseFloat(item.gst) || 0; return p + (p * g / 100); };
            filteredItems.sort((a, b) => totalVal(b) - totalVal(a));
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

        // Reset to page 1 if filter changed
        if (filter !== '') {
            itemsCurrentPage = 1;
        }

        // Calculate pagination
        const totalPages = Math.ceil(filteredItems.length / itemsPerPage);
        const startIndex = (itemsCurrentPage - 1) * itemsPerPage;
        const endIndex = startIndex + itemsPerPage;
        const paginatedItems = filteredItems.slice(startIndex, endIndex);

        // Update pagination controls
        updateItemsPaginationControls(totalPages, filteredItems.length);
        updatePriceSortHeader();
        updateTotalValueSortHeader();
        updateNameSortHeader();

        const isAuthorizedToEdit = AUTHORIZED_TO_EDIT_ITEMS.includes(CURRENT_USER_ROLE);

        paginatedItems.forEach(item => {
            const row = body.insertRow();
            
            // Product ID
            row.insertCell().textContent = item.productId || 'N/A';
            
            // Product Name
            row.insertCell().textContent = item.productName || 'N/A';
            
            // Type
            row.insertCell().textContent = item.type || 'N/A';
            
            // Description
            const descCell = row.insertCell();
            descCell.textContent = item.description || 'N/A';
            descCell.style.maxWidth = '200px';
            descCell.style.overflow = 'hidden';
            descCell.style.textOverflow = 'ellipsis';
            descCell.title = item.description || '';

            // Website URL
            const urlCell = row.insertCell();
            if (item.itemUrl && item.itemUrl.trim()) {
                const url = item.itemUrl.trim();
                const displayUrl = url.length > 30 ? url.substring(0, 30) + '...' : url;
                urlCell.innerHTML = `<a href="${url}" target="_blank" rel="noopener noreferrer">${displayUrl} <i class="fas fa-external-link-alt" style="font-size:10px;"></i></a>`;
            } else {
                urlCell.textContent = 'N/A';
                urlCell.classList.add('muted');
            }

            // Price
            const priceCell = row.insertCell();
            const price = item.price ? parseFloat(item.price) : 0;
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

            // Added By
            row.insertCell().textContent = item.addedBy || 'N/A';

            // Date Added
            const dateCell = row.insertCell();
            if (item.created_at) {
                const date = new Date(item.created_at);
                dateCell.textContent = date.toLocaleDateString('en-IN', { 
                    day: '2-digit', 
                    month: 'short', 
                    year: 'numeric' 
                });
            } else if (item.dateAdded) {
                dateCell.textContent = item.dateAdded;
            } else {
                dateCell.textContent = 'N/A';
            }

            // Actions
            const actionsCell = row.insertCell();
            if (isAuthorizedToEdit) {
                actionsCell.innerHTML = `
                    <button class="btn" style="padding: 5px 8px; margin-right: 5px;" onclick="editItem('${item.productId}')" title="Edit Product">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn danger" style="padding: 5px 8px;" onclick="deleteItem('${item.productId}')" title="Delete Product">
                        <i class="fas fa-trash-alt"></i>
                    </button>
                `;
            } else {
                actionsCell.textContent = 'No Actions';
                actionsCell.classList.add('muted');
            }
        });
    } catch (error) {
        const body = document.getElementById('itemsListBody');
        const noItemsMessage = document.getElementById('noItemsMessage');
        body.innerHTML = '';
        noItemsMessage.style.display = 'block';
        noItemsMessage.textContent = 'Error loading products. Please refresh the page.';
        document.getElementById('itemsTable').style.display = 'none';
        const paginationDiv = document.getElementById('itemsPagination');
        if (paginationDiv) paginationDiv.style.display = 'none';
    }
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

function goToItemsPage(direction) {
    const items = document.getElementById('itemsListBody');
    if (!items) return;

    const searchInput = document.getElementById('productListSearchInput');
    const filter = searchInput ? searchInput.value : '';
    
    itemsCurrentPage += direction;
    if (itemsCurrentPage < 1) itemsCurrentPage = 1;
    
    // Get total pages to limit max page
    const allItems = getItems();
    const filteredItems = Array.isArray(allItems) ? allItems : (allItems?.data || []);
    const filtered = filter ? filteredItems.filter(item => {
        const searchLower = filter.toLowerCase();
        return (item.productName && item.productName.toLowerCase().includes(searchLower)) ||
               (item.productId && item.productId.toLowerCase().includes(searchLower));
    }) : filteredItems;
    const totalPages = Math.ceil(filtered.length / itemsPerPage);
    if (itemsCurrentPage > totalPages) itemsCurrentPage = totalPages;
    
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
            const dateA = new Date(a.updated_at || a.dateCreated || a.created_at || 0);
            const dateB = new Date(b.updated_at || b.dateCreated || b.created_at || 0);
            return dateB - dateA; // Most recent activity first (includes updates)
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
        const updatedAt = quote.updated_at;
        const lastUpdatedStr = updatedAt ? new Date(updatedAt).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' }) : '—';
        row.insertCell().textContent = lastUpdatedStr;
        row.insertCell().textContent = formatRupee(parseFloat(quote.grandTotal) || 0);
        row.insertCell().textContent = (quote.items?.length || 0);
        row.insertCell().textContent = quote.createdBy || quote.created_by || 'N/A';

        const actionsCell = row.insertCell();
        const quoteId = quote.quotationId || quote.id;
        actionsCell.innerHTML = `
                    <button class="btn primary" style="padding: 5px 8px; margin-right: 5px;" onclick="fetchQuotationAndGeneratePdf('${quoteId}')" title="Download PDF"><i class="fas fa-download"></i></button>
                    <button class="btn secondary" style="padding: 5px 8px; margin-right: 5px;" onclick="viewQuotationDetails('${quoteId}')" title="View"><i class="fas fa-eye"></i></button>
                    <button class="btn" style="padding: 5px 8px; margin-right: 5px;" onclick="editQuotationInCreateSection('${quoteId}')" title="Edit"><i class="fas fa-edit"></i></button>
                    <button class="btn danger" style="padding: 5px 8px;" onclick="deleteQuotation('${quoteId}')" title="Delete"><i class="fas fa-trash-alt"></i></button>
                `;
    });
}

// Order for itemsTypeFilters: from database (quotationTypeFilters); fallback when DB empty
var ITEMS_TYPE_FILTER_ORDER_FALLBACK = ['', 'intel cpu', 'amd cpu', 'intel mobo', 'amd mobo'];
function itemsTypeFilterSortIndex(value, orderFromDb) {
    var v = String(value || '').toLowerCase().trim();
    var order = Array.isArray(orderFromDb) && orderFromDb.length ? orderFromDb.map(function (x) { return String(x).toLowerCase().trim(); }) : ITEMS_TYPE_FILTER_ORDER_FALLBACK;
    var i = order.indexOf(v);
    return i >= 0 ? i : order.length;
}

// Render dynamic type filter buttons for Products (items list) — types and order from database (settings)
async function renderItemsTypeFilters() {
    const container = document.getElementById('itemsTypeFilters');
    if (!container) return;

    let typesFromItems = [];
    try {
        const items = await getItems();
        typesFromItems = [...new Set(items.map(item => item.type).filter(Boolean))]
            .filter(function (t) { return !isExcludedType(t); });
    } catch (error) {
        // Silent fail
    }

    // Fetch type order from database (same as Quotation Products display order / product types)
    var orderFromDb = [];
    try {
        var settingsRes = await getSettings();
        var settings = settingsRes && settingsRes.data ? settingsRes.data : (settingsRes || {});
        orderFromDb = Array.isArray(settings.quotationTypeFilters) && settings.quotationTypeFilters.length
            ? settings.quotationTypeFilters.slice()
            : (Array.isArray(settings.quotationItemTypeOrder) ? settings.quotationItemTypeOrder.slice() : []).concat(Array.isArray(settings.productTypes) ? settings.productTypes.map(function (x) { return String(x).trim(); }) : []);
        var seen = new Set();
        orderFromDb = orderFromDb.filter(function (t) {
            var v = String(t).toLowerCase().trim();
            if (!v || seen.has(v)) return false;
            seen.add(v);
            return true;
        });
    } catch (e) {
        // Fallback: no order from DB
    }

    // Build ordered list: All, then DB order, then types from items not in DB
    var orderLower = orderFromDb.map(function (t) { return String(t).toLowerCase().trim(); });
    var orderedPairs = [{ label: 'All', value: '' }];
    orderLower.forEach(function (t) {
        if (!t || isExcludedType(t)) return;
        var label = String(t).replace(/\b\w/g, function (c) { return c.toUpperCase(); });
        orderedPairs.push({ label: label, value: t });
    });
    typesFromItems.forEach(function (t) {
        var v = String(t).toLowerCase().trim();
        if (!v || isExcludedType(t)) return;
        if (orderLower.indexOf(v) !== -1) return;
        orderedPairs.push({ label: String(t).replace(/\b\w/g, function (c) { return c.toUpperCase(); }), value: v });
    });
    // Sort by Quotation Products display order from Settings (orderFromDb); keep "All" first
    var displayOrderLower = (orderFromDb || []).map(function (x) { return String(x).toLowerCase().trim(); });
    orderedPairs.sort(function (a, b) {
        if ((a.value || '') === '') return -1;
        if ((b.value || '') === '') return 1;
        var ia = displayOrderLower.indexOf((a.value || '').toLowerCase().trim());
        var ib = displayOrderLower.indexOf((b.value || '').toLowerCase().trim());
        if (ia < 0) ia = displayOrderLower.length;
        if (ib < 0) ib = displayOrderLower.length;
        if (ia !== ib) return ia - ib;
        return String(a.value || '').localeCompare(String(b.value || ''), 'en-IN', { sensitivity: 'base' });
    });

    container.innerHTML = '';

    // Same look as quotationTypeFilters (Add Items to Quotation section)
    function createButton(label, typeValue) {
        const btn = document.createElement('button');
        btn.className = 'type-filter-btn';
        if ((!itemsCurrentTypeFilter && typeValue === '') ||
            (itemsCurrentTypeFilter && typeValue.toLowerCase() === itemsCurrentTypeFilter.toLowerCase())) {
            btn.classList.add('active');
        }
        btn.dataset.type = typeValue;
        btn.textContent = (label || typeValue || '').toUpperCase();
        btn.style.padding = '6px 12px';
        btn.style.border = '1px solid var(--border)';
        btn.style.borderRadius = '6px';
        btn.style.background = '#fff';
        btn.style.cursor = 'pointer';
        btn.style.fontSize = '12px';
        btn.style.transition = 'all 0.2s';

        btn.addEventListener('click', () => {
            itemsCurrentTypeFilter = typeValue || '';
            itemsCurrentPriceSort = 'none';
            itemsCurrentTotalValueSort = 'none';
            itemsCurrentNameSort = 'none';
            updatePriceSortHeader();
            updateTotalValueSortHeader();
            updateNameSortHeader();
            container.querySelectorAll('.type-filter-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            itemsCurrentPage = 1;
            const searchInput = document.getElementById('productListSearchInput');
            const filter = searchInput ? searchInput.value.trim() : '';
            renderItemsList(filter);
        });

        return btn;
    }

    orderedPairs.forEach(function (t) {
        container.appendChild(createButton(t.label, t.value));
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
        if (response.data) {
            quotationData = response.data;
        } else if (Array.isArray(response) && response.length > 0) {
            quotationData = response[0];
        } else {
            quotationData = response;
        }
        
        if (!quotationData || (!quotationData.quotationId && !quotationData.id)) {
            console.error('Invalid quotation data:', quotationData);
            alert('Quotation not found or invalid data');
            return;
        }
        
        // Normalize data structure - ensure customer and items are objects/arrays
        if (typeof quotationData.customer === 'string') {
            try {
                quotationData.customer = JSON.parse(quotationData.customer);
            } catch (e) {
                quotationData.customer = {};
            }
        }
        if (typeof quotationData.items === 'string') {
            try {
                quotationData.items = JSON.parse(quotationData.items);
            } catch (e) {
                quotationData.items = [];
            }
        }
        
        // Ensure items is an array
        if (!Array.isArray(quotationData.items)) {
            quotationData.items = [];
        }
        
        // Download as PDF
        await downloadQuotationAsPdfDirect(quotationData);
    } catch (e) {
        console.error('Error fetching quotation for PDF:', e);
        alert('Failed to fetch quotation for PDF download: ' + (e.message || 'Unknown error'));
    }
}

async function downloadQuotationAsPdfDirect(quotation) {
    let tempContainer;
    showPdfLoadingOverlay();
    try {
        const settings = await getSettings();
        let logoDataUrl = null;
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

        const PRODUCTS_PER_PAGE = 8;
        const rawItems = quotation.items || quotation.products || quotation.lineItems || [];
        const itemsCount = Array.isArray(rawItems) ? rawItems.length : 0;
        const totalPages = Math.max(1, Math.ceil(itemsCount / PRODUCTS_PER_PAGE));

        const doc = new window.jspdf.jsPDF({ unit: 'pt', format: 'a4', compress: true });
        const imgWidth = 595.28;
        const pageHeight = 841.89;

        for (let p = 0; p < totalPages; p++) {
            const pageHtml = await generateQuotationHtml(quotation, {
                pdfPage: { pageIndex: p, itemsPerPage: PRODUCTS_PER_PAGE, totalPages, isLastPage: p === totalPages - 1 }
            });
            tempContainer = document.createElement('div');
            tempContainer.style.cssText = 'position:fixed;left:0;top:0;width:800px;z-index:-1;opacity:0.01;pointer-events:none;overflow:visible;';
            tempContainer.innerHTML = pageHtml;
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

            const imgHeight = (canvas.height * imgWidth) / canvas.width;
            const imgData = canvas.toDataURL('image/png', 1.0);
            const contentHeightPdf = Math.min(imgHeight, pageHeight);
            if (p > 0) doc.addPage();
            doc.addImage(imgData, 'PNG', 0, 0, imgWidth, contentHeightPdf, undefined, 'FAST');

            document.body.removeChild(tempContainer);
            tempContainer = null;
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
    const grandTotal = (subTotal - subTotal * (discountPct / 100)) + totalGst;
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

/** Redirect to create quotation section with quotation data loaded (like resume drafts). */
async function editQuotationInCreateSection(quotationId) {
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
        const cust = quote.customer || {};
        document.getElementById('cust-name').value = cust.name || quote.customerName || '';
        document.getElementById('phone-number').value = cust.phone || quote.customerPhone || '';
        document.getElementById('cust-email').value = cust.email || quote.customerEmail || '';
        document.getElementById('cust-address').value = cust.address || quote.customerAddress || '';
        const discountPercentInput = document.getElementById('discount-percent');
        if (discountPercentInput) discountPercentInput.value = quote.discountPercent != null ? quote.discountPercent : 0;
        quotationItems = (quote.items || []).map(it => ({
            productId: it.productId,
            productName: it.productName,
            type: it.type || '',
            price: it.price,
            quantity: it.quantity || 1,
            gstRate: it.gstRate != null ? it.gstRate : 0
        }));
        adminUploadedImagesArray = Array.isArray(quote.images) && quote.images.length > 0 ? [quote.images[0]] : [];
        if (typeof renderAdminImagePreviews === 'function') renderAdminImagePreviews();
        renderQuotationItems();
        updateGrandTotal();
        const createBtn = document.getElementById('createQuotationBtn');
        if (createBtn) createBtn.textContent = 'Edit Quotation';
        document.querySelectorAll('#sideNav a[data-tab="createQuotation"], .tab-btn[data-tab="createQuotation"]').forEach(el => { if (el.tagName === 'A') el.innerHTML = '<i class="fas fa-file-invoice-dollar"></i> Edit Quotation'; else el.textContent = 'Edit Quotation'; });
        const sectionTitle = document.getElementById('createQuotationSectionTitle');
        if (sectionTitle) sectionTitle.textContent = 'Edit Quotation';
        const cancelEditBtn = document.getElementById('cancelEditInCreateSectionBtn');
        if (cancelEditBtn) cancelEditBtn.style.display = '';
        showSection('createQuotation');
    } catch (e) {
        console.error('Error loading quotation for edit:', e);
        alert('Failed to load quotation.');
    }
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
        adminEditImagesArray = Array.isArray(quote.images) && quote.images.length > 0 ? [quote.images[0]] : [];
        if (typeof renderEditAdminQuoteImagePreviews === 'function') renderEditAdminQuoteImagePreviews();
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

// --- Admin Image Upload (Production: upload file, store URL) ---
const ADMIN_MAX_IMAGE_SIZE_MB = 2;
const ADMIN_MAX_IMAGES = 1;
const ADMIN_ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'];
let adminUploadedImagesArray = [];
let adminEditImagesArray = [];

function validateAdminImageFile(file) {
    if (!ADMIN_ALLOWED_TYPES.includes(file.type)) return 'Invalid format. Use PNG, JPG or WebP.';
    if (file.size > ADMIN_MAX_IMAGE_SIZE_MB * 1024 * 1024) return `File too large. Max ${ADMIN_MAX_IMAGE_SIZE_MB}MB.`;
    return null;
}

function adminImageSrcForDisplay(urlOrDataUrl) {
    if (!urlOrDataUrl) return '';
    if (typeof urlOrDataUrl === 'string' && urlOrDataUrl.startsWith('data:')) return urlOrDataUrl;
    return urlOrDataUrl.startsWith('/') ? urlOrDataUrl : '/' + urlOrDataUrl;
}

async function adminUploadImageFile(file) {
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

async function adminEnsureImagesAreUrls(images) {
    if (!Array.isArray(images) || images.length === 0) return [];
    const out = [];
    for (const img of images) {
        if (typeof img === 'string' && img.startsWith('data:image/')) {
            const res = await apiFetch('/upload-image', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ dataUrl: img }) });
            const d = res.data || res;
            out.push((d && d.url) || (d && d.path) || img);
        } else if (typeof img === 'string') out.push(img);
    }
    return out;
}

function renderAdminImagePreviews() {
    const container = document.getElementById('imagePreviewList');
    const previewDiv = document.getElementById('imagePreview');
    if (!container || !previewDiv) return;
    if (adminUploadedImagesArray.length === 0) { previewDiv.style.display = 'none'; return; }
    container.innerHTML = adminUploadedImagesArray.map((url, idx) => `
        <div style="position:relative;"><img src="${adminImageSrcForDisplay(url)}" style="width:80px;height:80px;object-fit:cover;border-radius:6px;border:1px solid #e5e7eb;">
        <button type="button" class="admin-rm-img" data-idx="${idx}" style="position:absolute;top:-6px;right:-6px;width:22px;height:22px;border-radius:50%;border:none;background:#dc3545;color:white;cursor:pointer;">×</button></div>
    `).join('');
    previewDiv.style.display = 'block';
    container.querySelectorAll('.admin-rm-img').forEach(btn => {
        btn.onclick = () => { adminUploadedImagesArray.splice(parseInt(btn.dataset.idx), 1); renderAdminImagePreviews(); };
    });
}

function renderEditAdminQuoteImagePreviews() {
    const container = document.getElementById('editQuoteImagePreviewList');
    const previewDiv = document.getElementById('editQuoteImagePreview');
    if (!container || !previewDiv) return;
    if (!adminEditImagesArray || adminEditImagesArray.length === 0) { previewDiv.style.display = 'none'; return; }
    container.innerHTML = adminEditImagesArray.map((url, idx) => `
        <div style="position:relative;"><img src="${adminImageSrcForDisplay(url)}" style="width:60px;height:60px;object-fit:cover;border-radius:6px;">
        <button type="button" class="admin-edit-rm" data-idx="${idx}" style="position:absolute;top:-4px;right:-4px;width:20px;height:20px;border-radius:50%;border:none;background:#dc3545;color:white;cursor:pointer;">×</button></div>
    `).join('');
    previewDiv.style.display = 'block';
    container.querySelectorAll('.admin-edit-rm').forEach(btn => {
        btn.onclick = () => { adminEditImagesArray.splice(parseInt(btn.dataset.idx), 1); renderEditAdminQuoteImagePreviews(); };
    });
}

function getAdminUploadedImages() { return [...(adminUploadedImagesArray || [])]; }
function clearAdminImageUpload() {
    adminUploadedImagesArray = [];
    const el = document.getElementById('quotation-image');
    if (el) el.value = '';
    renderAdminImagePreviews();
}

document.getElementById('quotation-image')?.addEventListener('change', async function(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const err = validateAdminImageFile(file);
    if (err) { alert(err); e.target.value = ''; return; }
    try {
        adminUploadedImagesArray = [await adminUploadImageFile(file)];
        renderAdminImagePreviews();
    } catch (ex) { alert(ex.message || 'Upload failed'); }
    e.target.value = '';
});

document.getElementById('removeAllImagesBtn')?.addEventListener('click', clearAdminImageUpload);

document.getElementById('edit-quote-image')?.addEventListener('change', async function(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const err = validateAdminImageFile(file);
    if (err) { alert(err); e.target.value = ''; return; }
    try {
        adminEditImagesArray = [await adminUploadImageFile(file)];
        renderEditAdminQuoteImagePreviews();
    } catch (ex) { alert(ex.message || 'Upload failed'); }
    e.target.value = '';
});

document.getElementById('editQuoteRemoveAllImages')?.addEventListener('click', () => { adminEditImagesArray = []; renderEditAdminQuoteImagePreviews(); });

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
        const imagesForSave = await adminEnsureImagesAreUrls(adminEditImagesArray || []);
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
            addLog('Quotation Updated', CURRENT_USER_ROLE, `Updated quotation: ${quotationId}`);
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
    adminEditImagesArray = [];
}

function cancelEditInCreateSection() {
    if (!currentEditQuotationId) return;
    currentEditQuotationId = null;
    const createBtn = document.getElementById('createQuotationBtn');
    if (createBtn) createBtn.textContent = 'Create Quotation';
    document.querySelectorAll('#sideNav a[data-tab="createQuotation"], .tab-btn[data-tab="createQuotation"]').forEach(el => { if (el.tagName === 'A') el.innerHTML = '<i class="fas fa-file-invoice-dollar"></i> Quotations'; else el.textContent = 'Quotations'; });
    const sectionTitle = document.getElementById('createQuotationSectionTitle');
    if (sectionTitle) sectionTitle.textContent = 'Create Quotation';
    const cancelEditBtn = document.getElementById('cancelEditInCreateSectionBtn');
    if (cancelEditBtn) cancelEditBtn.style.display = 'none';
    quotationItems = [];
    document.getElementById('cust-name').value = '';
    document.getElementById('phone-number').value = '';
    document.getElementById('cust-email').value = '';
    document.getElementById('cust-address').value = '';
    const discountPercentInput = document.getElementById('discount-percent');
    if (discountPercentInput) discountPercentInput.value = '0';
    if (typeof clearAdminImageUpload === 'function') clearAdminImageUpload();
    renderQuotationItems();
    updateGrandTotal();
    currentQuotationDraftId = null;
    loadQuotationDrafts();
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
        document.getElementById('cust-name').value = quote.customer.name || '';
        document.getElementById('phone-number').value = quote.customer.phone || '';
        document.getElementById('cust-email').value = quote.customer.email || '';
        document.getElementById('cust-address').value = quote.customer.address || '';
        const discountPercentInput = document.getElementById('discount-percent');
        if (discountPercentInput) discountPercentInput.value = quote.discountPercent || 0;

        // Load items
        quotationItems = quote.items.map(item => ({
            productId: item.productId,
            productName: item.productName,
            type: item.type || '',
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

async function renderUserSessions() {
    const loggedInAtEl = document.getElementById('sessionLoggedInAt');
    const durationEl = document.getElementById('sessionDuration');
    const expiresAtEl = document.getElementById('sessionExpiresAt');
    const body = document.getElementById('userSessionsListBody');
    const noMsg = document.getElementById('noUserSessionsMessage');
    if (!body) return;

    let startMs = parseInt(localStorage.getItem('rolewise_session_start'), 10);
    if (!startMs) {
        const expiry = localStorage.getItem('rolewise_session_expiry');
        const timeout = localStorage.getItem('rolewise_session_timeout');
        if (expiry && timeout) startMs = parseInt(expiry, 10) - (parseInt(timeout, 10) * 1000);
    }
    if (loggedInAtEl) {
        if (startMs) {
            const d = new Date(startMs);
            loggedInAtEl.textContent = 'Logged in at ' + d.toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
        } else {
            loggedInAtEl.textContent = 'Session start not available';
        }
    }
    if (durationEl) {
        if (startMs) {
            const elapsedMs = Date.now() - startMs;
            const hours = Math.floor(elapsedMs / (1000 * 60 * 60));
            const minutes = Math.floor((elapsedMs % (1000 * 60 * 60)) / (1000 * 60));
            durationEl.textContent = hours + 'h ' + minutes + 'm';
        } else {
            durationEl.textContent = '—';
        }
    }
    if (expiresAtEl) {
        const expiry = localStorage.getItem('rolewise_session_expiry');
        if (expiry) {
            const expDate = new Date(parseInt(expiry, 10));
            expiresAtEl.textContent = 'Expires ' + expDate.toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
        } else {
            expiresAtEl.textContent = '—';
        }
    }

    body.innerHTML = '';
    if (noMsg) noMsg.style.display = 'none';
    try {
        const response = await apiFetch('/admin/user-sessions');
        const list = Array.isArray(response) ? response : (response.data || []);
        if (list.length === 0) {
            if (noMsg) noMsg.style.display = 'block';
            return;
        }
        list.forEach(function (u) {
            const row = body.insertRow();
            const userLabel = (u.name && u.name.trim()) ? (u.name + ' (' + (u.email || '') + ')') : (u.email || '—');
            row.insertCell().textContent = userLabel;
            row.insertCell().textContent = u.role || '—';
            row.insertCell().textContent = (u.totalActiveHours != null) ? (Number(u.totalActiveHours).toFixed(2) + ' h') : '—';
            const lastStr = u.lastLoginAt ? (function () {
                try { return new Date(u.lastLoginAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }); } catch (e) { return u.lastLoginAt; }
            })() : '—';
            row.insertCell().textContent = lastStr;
            const currStr = u.currentSessionStartedAt ? (function () {
                try { return new Date(u.currentSessionStartedAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }); } catch (e) { return u.currentSessionStartedAt; }
            })() : '—';
            row.insertCell().textContent = currStr;
        });
    } catch (e) {
        if (noMsg) { noMsg.textContent = 'Unable to load user sessions.'; noMsg.style.display = 'block'; }
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

    logs.forEach(log => {
        const row = body.insertRow();
        row.insertCell().textContent = log.timestamp;
        row.insertCell().textContent = log.user;
        row.insertCell().textContent = log.ip_address || '—';
        row.insertCell().textContent = log.role;
        row.insertCell().textContent = log.action;
        row.insertCell().textContent = log.details;
    });

    filterLogsTable();
    if (!window._adminLogsSearchListenerAttached) {
        window._adminLogsSearchListenerAttached = true;
        const searchEl = document.getElementById('logsSearchInput');
        if (searchEl) searchEl.addEventListener('input', filterLogsTable);
    }
}

function filterLogsTable() {
    const body = document.getElementById('logsListBody');
    const noLogsMessage = document.getElementById('noLogsMessage');
    const searchInput = document.getElementById('logsSearchInput');
    if (!body || !noLogsMessage) return;
    const term = (searchInput && searchInput.value) ? searchInput.value.trim().toLowerCase() : '';
    const rows = Array.from(body.querySelectorAll('tr'));
    let visible = 0;
    rows.forEach(row => {
        const text = (row.textContent || '').toLowerCase();
        const show = !term || text.includes(term);
        row.style.display = show ? '' : 'none';
        if (show) visible++;
    });
    if (rows.length > 0 && visible === 0 && term) {
        noLogsMessage.textContent = 'No matching logs. Try a different search.';
        noLogsMessage.style.display = 'block';
    } else if (visible > 0) {
        noLogsMessage.style.display = 'none';
    }
}

function setValue(id, value) {
    const el = document.getElementById(id);
    if (!el) return;
    el.value = value ?? '';
}
function setText(id, value) {
    const el = document.getElementById(id);
    if (!el) return;
    el.textContent = value ?? '';
}

async function renderSettings() {
    renderQuotationItemsOrderList(quotationItemTypeOrder && quotationItemTypeOrder.length ? quotationItemTypeOrder : DEFAULT_QUOTATION_ITEM_TYPE_ORDER);
    try {
        const settings = await getSettings();

        setValue('settings-brand-name', settings.brand || '');
    setValue('settings-company-gst-id', settings.companyGstId || '');
    setValue('settings-validity-days', settings.validityDays ?? settings.defaultValidityDays ?? 3);
    setText('validityDaysDisplay', settings.validityDays ?? settings.defaultValidityDays ?? 3);

    // PDF Theme
    const pdfTheme = settings.pdfTheme || 'default';
    setValue('settings-pdf-theme', pdfTheme);
    updateThemePreview(pdfTheme);

    // PDF Fonts (localStorage, same keys as owner for consistency)
    try {
        refreshPdfCustomFontOptions();
        const fontPrimary = document.getElementById('settings-pdf-font-primary');
        const fontSecondary = document.getElementById('settings-pdf-font-secondary');
        const fontTertiary = document.getElementById('settings-pdf-font-tertiary');
        if (fontPrimary) fontPrimary.value = localStorage.getItem('owner_pdf_font_primary') || 'segoe';
        if (fontSecondary) fontSecondary.value = localStorage.getItem('owner_pdf_font_secondary') || 'segoe';
        if (fontTertiary) fontTertiary.value = localStorage.getItem('owner_pdf_font_tertiary') || 'segoe';
        const sizePrimary = document.getElementById('settings-pdf-font-size-primary');
        const sizeSecondary = document.getElementById('settings-pdf-font-size-secondary');
        const sizeTertiary = document.getElementById('settings-pdf-font-size-tertiary');
        if (sizePrimary) sizePrimary.value = getEffectivePdfFontSizePrimary();
        if (sizeSecondary) sizeSecondary.value = getEffectivePdfFontSizeSecondary();
        if (sizeTertiary) sizeTertiary.value = getEffectivePdfFontSizeTertiary();
    } catch (e) { }

    // Logo (admin may not have logo UI)
    const logoPreview = document.getElementById('logoPreview');
    const noLogoText = document.getElementById('noLogoText');
    const removeLogoBtn = document.getElementById('removeLogoBtn');
    if (logoPreview && noLogoText && removeLogoBtn) {
        const logoBase64 = '';
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

    // Quotation Products display order: saved order + all product types + any types from items
    const savedOrder = Array.isArray(settings.quotationItemTypeOrder) && settings.quotationItemTypeOrder.length > 0
        ? settings.quotationItemTypeOrder
        : DEFAULT_QUOTATION_ITEM_TYPE_ORDER.slice();
    const productTypesList = Array.isArray(settings.productTypes) ? settings.productTypes.slice() : [];
    let typesFromItems = [];
    try {
        const itemsData = await getItems();
        const arr = Array.isArray(itemsData) ? itemsData : (itemsData && itemsData.data) || [];
        typesFromItems = [...new Set(arr.map(function (item) { return item.type; }).filter(Boolean))];
    } catch (e) { }
    const order = mergeQuotationOrderWithAllTypes(savedOrder, productTypesList, typesFromItems);
    quotationItemTypeOrder = order.slice();
    renderQuotationItemsOrderList(order);

    } catch (error) {
        console.error('renderSettings() error:', error);
        quotationItemTypeOrder = DEFAULT_QUOTATION_ITEM_TYPE_ORDER.slice();
        renderQuotationItemsOrderList(DEFAULT_QUOTATION_ITEM_TYPE_ORDER);
    }
}

function mergeQuotationOrderWithAllTypes(savedOrder, productTypes, typesFromItems) {
    const seen = new Set();
    const out = [];
    const add = function (v) {
        const t = String(v).toLowerCase().trim();
        if (!t || seen.has(t) || isExcludedType(t)) return;
        seen.add(t);
        out.push(t);
    };
    (savedOrder || []).forEach(add);
    (productTypes || []).forEach(function (t) { add(t); });
    (typesFromItems || []).forEach(function (t) { add(t); });
    return out.length ? out : DEFAULT_QUOTATION_ITEM_TYPE_ORDER.slice();
}

function renderQuotationItemsOrderList(order) {
    const listEl = document.getElementById('settings-quotation-items-order-list');
    if (!listEl) return;
    let arr = Array.isArray(order) && order.length > 0 ? order.slice() : DEFAULT_QUOTATION_ITEM_TYPE_ORDER.slice();
    arr = arr.filter(function (t) { return !isExcludedType(t); }).filter(function (t) { return String(t).toLowerCase().trim() !== 'all'; });
    listEl.innerHTML = '';
    arr.forEach(function (label, idx) {
        const li = document.createElement('li');
        li.style.cssText = 'display:flex;align-items:center;gap:8px;padding:8px 0;border-bottom:1px solid #eee;';
        li.dataset.index = idx;
        li.dataset.value = label;
        const title = String(label).toUpperCase();
        const slNo = idx + 1;
        const slSpan = document.createElement('span');
        slSpan.style.cssText = 'min-width:28px;font-weight:600;color:#6b7280;';
        slSpan.textContent = slNo + '.';
        li.appendChild(slSpan);
        const titleSpan = document.createElement('span');
        titleSpan.style.flex = '1';
        titleSpan.textContent = title;
        li.appendChild(titleSpan);
        const cb = document.createElement('input');
        cb.type = 'checkbox';
        cb.className = 'order-row-select';
        cb.setAttribute('aria-label', 'Select ' + title);
        cb.style.marginLeft = 'auto';
        li.appendChild(cb);
        li.draggable = true;
        li.style.cursor = 'grab';
        li.setAttribute('aria-label', 'Drag to reorder: ' + title);
        li.addEventListener('dragstart', function (e) {
            if (e.target && e.target.type === 'checkbox') return;
            quotationOrderDraggedLi = li;
            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setData('text/plain', li.dataset.value || '');
            li.style.opacity = '0.5';
        });
        li.addEventListener('dragend', function () {
            li.style.opacity = '';
            quotationOrderDraggedLi = null;
            listEl.querySelectorAll('li').forEach(function (el) { el.style.backgroundColor = ''; });
        });
        li.addEventListener('dragover', function (e) {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
            if (quotationOrderDraggedLi && quotationOrderDraggedLi !== li) li.style.backgroundColor = '#e0f2fe';
        });
        li.addEventListener('dragleave', function () {
            li.style.backgroundColor = '';
        });
        li.addEventListener('drop', function (e) {
            e.preventDefault();
            li.style.backgroundColor = '';
            if (!quotationOrderDraggedLi || quotationOrderDraggedLi === li) return;
            listEl.insertBefore(quotationOrderDraggedLi, li);
            renumberQuotationItemsOrderList();
            refreshSettingsDeleteTypeSelect(getQuotationItemsOrderFromList());
            quotationOrderDraggedLi = null;
        });
        listEl.appendChild(li);
    });
    var selectAllEl = document.getElementById('settings-quotation-order-select-all');
    if (selectAllEl) {
        selectAllEl.checked = false;
        selectAllEl.onchange = function () {
            listEl.querySelectorAll('input.order-row-select').forEach(function (input) { input.checked = selectAllEl.checked; });
        };
    }
    if (!listEl.hasAttribute('data-order-list-change-bound')) {
        listEl.setAttribute('data-order-list-change-bound', '1');
        listEl.addEventListener('change', function (e) {
            if (!e.target || !e.target.classList.contains('order-row-select')) return;
            if (!selectAllEl) return;
            var checkboxes = listEl.querySelectorAll('input.order-row-select');
            var checked = listEl.querySelectorAll('input.order-row-select:checked');
            selectAllEl.checked = checkboxes.length > 0 && checked.length === checkboxes.length;
        });
    }
    var moveUpBtn = document.getElementById('settings-quotation-order-move-up');
    var moveDownBtn = document.getElementById('settings-quotation-order-move-down');
    if (moveUpBtn) {
        moveUpBtn.onclick = function () {
            var selected = Array.from(listEl.querySelectorAll('li')).filter(function (li) { return li.querySelector('input.order-row-select') && li.querySelector('input.order-row-select').checked; });
            if (!selected.length) { alert('Select at least one item to move.'); return; }
            var first = selected[0];
            var prev = first.previousElementSibling;
            if (!prev) return;
            selected.forEach(function (li) { li.remove(); });
            for (var i = 0; i < selected.length; i++) listEl.insertBefore(selected[i], prev);
            renumberQuotationItemsOrderList();
        };
    }
    if (moveDownBtn) {
        moveDownBtn.onclick = function () {
            var selected = Array.from(listEl.querySelectorAll('li')).filter(function (li) { return li.querySelector('input.order-row-select') && li.querySelector('input.order-row-select').checked; });
            if (!selected.length) { alert('Select at least one item to move.'); return; }
            var last = selected[selected.length - 1];
            var next = last.nextElementSibling;
            if (!next) return;
            selected.forEach(function (li) { li.remove(); });
            var ref = next.nextSibling;
            for (var i = selected.length - 1; i >= 0; i--) listEl.insertBefore(selected[i], ref);
            renumberQuotationItemsOrderList();
        };
    }
    refreshSettingsDeleteTypeSelect(arr);
}

function refreshSettingsDeleteTypeSelect(types) {
    const sel = document.getElementById('settings-delete-product-type');
    if (!sel) return;
    const current = (sel.value || '').toLowerCase().trim();
    sel.innerHTML = '<option value="">— Select type to delete —</option>';
    (types || []).forEach(function (t) {
        const v = String(t).toLowerCase().trim();
        if (!v) return;
        const label = String(t).replace(/\b\w/g, function (c) { return c.toUpperCase(); });
        const opt = document.createElement('option');
        opt.value = v;
        opt.textContent = label;
        sel.appendChild(opt);
    });
    if (current && Array.prototype.some.call(sel.options, function (o) { return o.value === current; })) sel.value = current;
}

function renumberQuotationItemsOrderList() {
    const listEl = document.getElementById('settings-quotation-items-order-list');
    if (!listEl) return;
    const items = listEl.querySelectorAll('li');
    items.forEach(function (li, idx) {
        var spans = li.querySelectorAll('span');
        if (spans.length > 0) spans[0].textContent = (idx + 1) + '.';
    });
}

function getQuotationItemsOrderFromList() {
    const listEl = document.getElementById('settings-quotation-items-order-list');
    if (!listEl) return quotationItemTypeOrder.slice();
    const items = listEl.querySelectorAll('li');
    return Array.from(items).map(function (li) { return (li.dataset.value || '').trim(); }).filter(Boolean);
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

        // Calculate total quotation value
        const totalValue = quotations.reduce((sum, q) => sum + (parseFloat(q.grandTotal) || 0), 0);
        const totalValueElement = document.getElementById('summaryTotalValue');
        if (totalValueElement) {
            totalValueElement.textContent = formatRupee(totalValue);
        }

        // Calculate unique customers count
        const customersMap = new Map();
        quotations.forEach(q => {
            const phone = q.customer?.phone || q.customerPhone;
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
                let quoteDate;
                if (q.dateCreated) {
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

        // Contact requests count (Admin only)
        try {
            const contactRequests = await getContactRequests();
            const crCountEl = document.getElementById('summaryContactRequestsCount');
            if (crCountEl) crCountEl.textContent = contactRequests.length || 0;
        } catch (e) { /* silent */ }

        // Display recent quotations (last 5)
        const recentQuotations = quotations
            .sort((a, b) => new Date(b.created_at || b.dateCreated) - new Date(a.created_at || a.dateCreated))
            .slice(0, 5);
        
        const recentQuotationsList = document.getElementById('recentQuotationsList');
        if (recentQuotationsList) {
            if (recentQuotations.length === 0) {
                recentQuotationsList.innerHTML = '<p class="muted" style="text-align:center; padding:20px;">No quotations yet.</p>';
            } else {
                recentQuotationsList.innerHTML = recentQuotations.map(q => {
                    const date = q.dateCreated || (q.created_at ? new Date(q.created_at).toLocaleDateString('en-IN') : 'N/A');
                    return `
                        <div style="padding:10px; border-bottom:1px solid var(--border); display:flex; justify-content:space-between; align-items:center;">
                            <div>
                                <div style="font-weight:500; color:#34495E;">${q.quotationId || 'N/A'}</div>
                                <div class="muted" style="font-size:12px;">${q.customer?.name || 'N/A'} • ${date}</div>
                            </div>
                            <div style="font-weight:bold; color:#27AE60;">${formatRupee(parseFloat(q.grandTotal) || 0)}</div>
                        </div>
                    `;
                }).join('');
            }
        }

        // Display recent activity (last 5 logs)
        const recentLogs = logs
            .sort((a, b) => new Date(b.timestamp || b.created_at) - new Date(a.timestamp || a.created_at))
            .slice(0, 5);
        
        const recentActivityList = document.getElementById('recentActivityList');
        if (recentActivityList) {
            if (recentLogs.length === 0) {
                recentActivityList.innerHTML = '<p class="muted" style="text-align:center; padding:20px;">No activity yet.</p>';
            } else {
                recentActivityList.innerHTML = recentLogs.map(log => {
                    const timestamp = log.timestamp || log.created_at;
                    const date = timestamp ? new Date(timestamp).toLocaleString('en-IN', { 
                        day: '2-digit', 
                        month: 'short', 
                        hour: '2-digit', 
                        minute: '2-digit' 
                    }) : 'N/A';
                    return `
                        <div style="padding:10px; border-bottom:1px solid var(--border);">
                            <div style="font-weight:500; color:#34495E; font-size:14px;">${log.action || 'N/A'}</div>
                            <div class="muted" style="font-size:12px; margin-top:4px;">
                                ${log.user || 'N/A'} (${log.role || 'N/A'}) • ${date}
                            </div>
                        </div>
                    `;
                }).join('');
            }
        }
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
document.getElementById('createQuotationBtn')?.addEventListener('click', createQuotation);
document.getElementById('cancelEditInCreateSectionBtn')?.addEventListener('click', cancelEditInCreateSection);
document.getElementById('itemSearchInput')?.addEventListener('input', (e) => {
    const activeTypeFilter = document.querySelector('#quotationTypeFilters .type-filter-btn.active')?.dataset.type || '';
    renderAvailableItemsForQuotation(e.target.value, activeTypeFilter);
});

document.getElementById('quotationPriceSortBtn')?.addEventListener('click', function() {
    const next = { none: 'lowToHigh', lowToHigh: 'highToLow', highToLow: 'none' };
    const labels = { none: 'Sort by price', lowToHigh: 'Price: Low to High', highToLow: 'Price: High to Low' };
    const current = this.getAttribute('data-price-sort') || 'none';
    const state = next[current];
    this.setAttribute('data-price-sort', state);
    this.textContent = labels[state];
    this.classList.toggle('active', state !== 'none');
    const searchValue = document.getElementById('itemSearchInput')?.value || '';
    const activeTypeFilter = document.querySelector('#quotationTypeFilters .type-filter-btn.active')?.dataset.type || '';
    renderAvailableItemsForQuotation(searchValue, activeTypeFilter);
});

document.getElementById('compatibleFilterToggle')?.addEventListener('change', function() {
    const hint = document.getElementById('compatibleFilterHint');
    if (hint) hint.style.display = this.checked ? 'block' : 'none';
    const searchValue = document.getElementById('itemSearchInput')?.value || '';
    const activeTypeFilter = document.querySelector('#quotationTypeFilters .type-filter-btn.active')?.dataset.type || '';
    renderAvailableItemsForQuotation(searchValue, activeTypeFilter);
});

// Event delegation for contact request and draft buttons
document.addEventListener('click', async function(e) {
    const btn = e.target.closest('[data-action][data-id]');
    if (btn) {
        const action = btn.getAttribute('data-action');
        const id = parseInt(btn.getAttribute('data-id'), 10);
        if (action === 'resume-quotation-draft') { resumeQuotationDraft(id); return; }
        if (action === 'convert-quotation-draft') { convertQuotationDraft(id); return; }
        if (action === 'delete-quotation-draft') { deleteQuotationDraft(id); return; }
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
                if (res && res.success !== false) {
                    addLog('Contact Request Deleted', CURRENT_USER_ROLE, `Deleted contact request: ${id}`);
                    renderContactRequestsList();
                }
            } catch (err) { console.error(err); }
            return;
        }
    }
});

// Type filter button handlers - use event delegation (only for Add Items to Quotation section)
document.addEventListener('click', function(e) {
    if (e.target.closest('#quotationTypeFilters') && e.target.classList.contains('type-filter-btn')) {
        document.querySelectorAll('#quotationTypeFilters .type-filter-btn').forEach(b => b.classList.remove('active'));
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
            document.getElementById('cust-name').value = customer.name || '';
            document.getElementById('cust-email').value = customer.email || '';
            document.getElementById('cust-address').value = customer.address || '';

            const custDisplayName = document.getElementById('cust-display-name');
            const custDisplayPhone = document.getElementById('cust-display-phone');
            const custDisplayEmail = document.getElementById('cust-display-email');
            const custDisplayAddress = document.getElementById('cust-display-address');
            if (custDisplayName) custDisplayName.textContent = customer.name || 'N/A';
            if (custDisplayPhone) custDisplayPhone.textContent = customer.phone;
            if (custDisplayEmail) custDisplayEmail.textContent = customer.email || 'N/A';
            if (custDisplayAddress) custDisplayAddress.textContent = customer.address || 'N/A';
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

// --- Quotation draft: save/load/resume (Create Quotation - Saved drafts) ---
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
        images: typeof getAdminUploadedImages === 'function' ? getAdminUploadedImages() : [],
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
        payload.images = await adminEnsureImagesAreUrls(payload.images || []);
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
        adminUploadedImagesArray = Array.isArray(d.images) && d.images.length > 0 ? [d.images[0]] : [];
        renderAdminImagePreviews();
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
        addLog('Quotation Created from Draft', CURRENT_USER_ROLE, `Converted quotation draft: ${draftId}`);
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
        addLog('Quotation Draft Deleted', CURRENT_USER_ROLE, `Deleted quotation draft: ${draftId}`);
        if (currentQuotationDraftId === draftId) currentQuotationDraftId = null;
        loadQuotationDrafts(true);
    } catch (e) {
        console.warn('Delete draft failed:', e);
    }
}

function saveDraftWithKeepalive() {
    if (currentSectionId === 'createQuotation') {
        const payload = buildQuotationDraftPayload();
        if (payload) {
            fetch(`${API_BASE}/drafts/quotations`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
                credentials: 'include',
                keepalive: true
            }).catch(() => {});
        }
    }
}

function scheduleQuotationDraftSave() {
    if (draftQuotationDebounceId) clearTimeout(draftQuotationDebounceId);
    draftQuotationDebounceId = setTimeout(function () {
        draftQuotationDebounceId = null;
        if (currentSectionId === 'createQuotation') saveQuotationDraftToServer().then(() => loadQuotationDrafts());
    }, DRAFT_DEBOUNCE_MS);
}

(function setupDraftDebounceListeners() {
    var qIds = ['cust-name', 'phone-number', 'cust-email', 'cust-address', 'discount-percent'];
    qIds.forEach(function (id) {
        var el = document.getElementById(id);
        if (el) {
            el.addEventListener('input', scheduleQuotationDraftSave);
            el.addEventListener('change', scheduleQuotationDraftSave);
        }
    });
})();

document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'hidden') saveDraftWithKeepalive();
});
window.addEventListener('beforeunload', function () { saveDraftWithKeepalive(); });

function showSection(sectionId) {
    currentSectionId = sectionId || '';
    if (draftQuotationIntervalId) {
        clearInterval(draftQuotationIntervalId);
        draftQuotationIntervalId = null;
    }
    if (draftQuotationDebounceId) {
        clearTimeout(draftQuotationDebounceId);
        draftQuotationDebounceId = null;
    }
    // When leaving Customers section, refresh search bars and reset pagination
    const prevSection = Array.from(document.querySelectorAll('.content-section')).find(s => s.style.display !== 'none');
    if (prevSection && prevSection.id === 'viewCustomers') {
        const listInp = document.getElementById('customerListSearchInput');
        const detailsInp = document.getElementById('customerDetailsSearchInput');
        if (listInp) listInp.value = '';
        if (detailsInp) detailsInp.value = '';
        customersCurrentPage = 1;
        customerDetailsCurrentPage = 1;
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

    let sideNavTab = sectionId;
    if (sectionId === 'viewHistory' || sectionId === 'quotationDrafts') sideNavTab = 'createQuotation';
    else if (sectionId === 'addItem' || sectionId === 'itemDrafts') sideNavTab = 'itemsList';
    document.querySelector(`#sideNav a[data-tab="${sideNavTab}"]`)?.classList.add('active');

    const tabBtn = document.querySelector(`#dashboardTabs button[data-tab="${sectionId}"]`);
    if (tabBtn) tabBtn.classList.add('active');
    const curSection = document.getElementById(sectionId);
    const tabInSection = curSection?.querySelector(`.section-tabs .tab-btn[data-tab="${sectionId}"]`);
    if (tabInSection) tabInSection.classList.add('active');

    if (sectionId === 'addItem') {
        handleItemEditReset();
        updateCompatFieldsVisibility('type', 'compatFieldsContainer');
        loadAddProductDynamicData();
    }
    if (sectionId === 'itemsList') {
        // Clear search when showing items list
        const searchInput = document.getElementById('productListSearchInput');
        if (searchInput) {
            searchInput.value = '';
        }
        // Reset type filter when switching back to Products tab
        itemsCurrentTypeFilter = '';
        renderItemsTypeFilters();
        renderItemsList();
    }
    if (sectionId === 'createQuotation') {
        // Initialize Create Quotation section
        renderQuotationTypeFilters();
        renderAvailableItemsForQuotation();
        renderQuotationItems();
        updateGrandTotal();
        loadQuotationDrafts();
        const createBtn = document.getElementById('createQuotationBtn');
        if (currentEditQuotationId) {
            if (createBtn) createBtn.textContent = 'Edit Quotation';
            document.querySelectorAll('#sideNav a[data-tab="createQuotation"], .tab-btn[data-tab="createQuotation"]').forEach(el => { if (el.tagName === 'A') el.innerHTML = '<i class="fas fa-file-invoice-dollar"></i> Edit Quotation'; else el.textContent = 'Edit Quotation'; });
            const sectionTitle = document.getElementById('createQuotationSectionTitle');
            if (sectionTitle) sectionTitle.textContent = 'Edit Quotation';
            const cancelEditBtn = document.getElementById('cancelEditInCreateSectionBtn');
            if (cancelEditBtn) cancelEditBtn.style.display = '';
        } else {
            if (createBtn) createBtn.textContent = 'Create Quotation';
            document.querySelectorAll('#sideNav a[data-tab="createQuotation"], .tab-btn[data-tab="createQuotation"]').forEach(el => { if (el.tagName === 'A') el.innerHTML = '<i class="fas fa-file-invoice-dollar"></i> Quotations'; else el.textContent = 'Quotations'; });
            const sectionTitle = document.getElementById('createQuotationSectionTitle');
            if (sectionTitle) sectionTitle.textContent = 'Create Quotation';
            const cancelEditBtn = document.getElementById('cancelEditInCreateSectionBtn');
            if (cancelEditBtn) cancelEditBtn.style.display = 'none';
            draftQuotationIntervalId = setInterval(function () { saveQuotationDraftToServer(); loadQuotationDrafts(); }, DRAFT_AUTO_SAVE_MS);
        }
        // Clear customer details display when not editing
        if (!currentEditQuotationId) {
            const custDisplay = document.getElementById('customer-details-display');
            const custDisplayName = document.getElementById('cust-display-name');
            const custDisplayPhone = document.getElementById('cust-display-phone');
            const custDisplayEmail = document.getElementById('cust-display-email');
            const custDisplayAddress = document.getElementById('cust-display-address');
            if (custDisplay) {
                if (custDisplayName) custDisplayName.textContent = '';
                if (custDisplayPhone) custDisplayPhone.textContent = '';
                if (custDisplayEmail) custDisplayEmail.textContent = '';
                if (custDisplayAddress) custDisplayAddress.textContent = '';
            }
        }
    }
    if (sectionId === 'quotationDrafts') loadQuotationDrafts(true);
    if (sectionId === 'viewHistory') renderHistoryList();
    if (sectionId === 'viewLogs') renderLogsList();
    if (sectionId === 'viewUserSessions') renderUserSessions();
    if (sectionId === 'viewContactRequests') renderContactRequestsList();
    if (sectionId === 'viewCustomers') {
        renderCustomersList();
        showCustomerSubtab('customerHistory');
    }
    if (sectionId === 'settings') {
        renderSettings();
    }
}

document.querySelectorAll('[data-tab]').forEach(el => {
    el.addEventListener('click', function (e) {
        e.preventDefault();
        const sectionId = this.getAttribute('data-tab');
        showSection(sectionId);
    });
});

function showCustomerSubtab(subtabId) {
    const historyView = document.getElementById('customerHistoryView');
    const detailsView = document.getElementById('customerDetailsView');
    const section = document.getElementById('viewCustomers');
    if (!section || !historyView || !detailsView) return;
    // Refresh search bar of the section we're leaving
    if (subtabId === 'customerHistory') {
        const detailsInp = document.getElementById('customerDetailsSearchInput');
        if (detailsInp) detailsInp.value = '';
        customerDetailsCurrentPage = 1;
    } else {
        const listInp = document.getElementById('customerListSearchInput');
        if (listInp) listInp.value = '';
        customersCurrentPage = 1;
    }
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
        addLog('Setting Changed', CURRENT_USER_ROLE, `Updated brand name to ${brandName}`);
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
        addLog('Setting Changed', CURRENT_USER_ROLE, 'Updated Company GST ID');
        alert('Company GST ID saved successfully!');
    } catch (e) { }
});

async function saveProductTypesToBackend() {
    const order = getQuotationItemsOrderFromList();
    if (order.length === 0) return false;
    await apiFetch('/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            quotationItemTypeOrder: order,
            productTypes: order.map(function (x) { return String(x).toUpperCase(); })
        })
    });
    quotationItemTypeOrder = order.slice();
    if (typeof invalidateQuotationTypeFiltersCache === 'function') invalidateQuotationTypeFiltersCache();
    return true;
}

document.getElementById('settingsAddProductTypeBtn')?.addEventListener('click', async function () {
    const input = document.getElementById('settings-new-product-type');
    if (!input) return;
    const raw = (input.value || '').trim();
    const value = raw.toUpperCase();
    if (!value) {
        alert('Please enter a product type.');
        return;
    }
    const orderLower = (value || '').toLowerCase().trim();
    if (quotationItemTypeOrder.indexOf(orderLower) !== -1) {
        alert('This type is already in the list.');
        return;
    }
    quotationItemTypeOrder.push(orderLower);
    renderQuotationItemsOrderList(quotationItemTypeOrder);
    input.value = '';
    try {
        await saveProductTypesToBackend();
        addLog('Setting Changed', CURRENT_USER_ROLE, 'Added product type: ' + value);
        alert('Product type added and saved.');
    } catch (e) {
        console.error('Failed to save product type:', e);
        alert('Type added to list but failed to save to database. Click "Save order" above to retry.');
    }
});

document.getElementById('settingsDeleteProductTypeBtn')?.addEventListener('click', async function () {
    const sel = document.getElementById('settings-delete-product-type');
    if (!sel || !sel.value) {
        alert('Please select a type to delete.');
        return;
    }
    const value = (sel.value || '').toLowerCase().trim();
    const idx = quotationItemTypeOrder.indexOf(value);
    if (idx === -1) return;
    quotationItemTypeOrder.splice(idx, 1);
    renderQuotationItemsOrderList(quotationItemTypeOrder);
    sel.value = '';
    try {
        await saveProductTypesToBackend();
        addLog('Setting Changed', CURRENT_USER_ROLE, 'Deleted product type: ' + value);
        alert('Product type removed and saved.');
    } catch (e) {
        console.error('Failed to save after delete:', e);
        alert('Type removed from list but failed to save to database. Click "Save order" above to retry.');
    }
});

document.getElementById('saveQuotationItemsOrderBtn')?.addEventListener('click', async function () {
    const order = getQuotationItemsOrderFromList();
    if (order.length === 0) {
        alert('Order list is empty.');
        return;
    }
    try {
        await saveProductTypesToBackend();
        addLog('Updated Quotation Products display order', CURRENT_USER_ROLE, 'Quotation Products display order saved.');
        alert('Quotation Items order saved successfully!');
    } catch (e) {
        console.error('Failed to save order:', e);
        alert('Failed to save order.');
    }
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
        addLog('Setting Changed', CURRENT_USER_ROLE, `Updated quotation validity to ${days} days`);
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

// Custom PDF themes (stored in localStorage for cPanel/production compatibility)
const PDF_CUSTOM_THEMES_KEY = 'owner_pdf_custom_themes';
const PDF_THEME_OVERRIDE_KEY = 'owner_pdf_theme_override';
const PDF_FONT_PRIMARY_KEY = 'owner_pdf_font_primary';
const PDF_FONT_SECONDARY_KEY = 'owner_pdf_font_secondary';
const PDF_FONT_TERTIARY_KEY = 'owner_pdf_font_tertiary';
const PDF_FONT_SIZE_PRIMARY_KEY = 'owner_pdf_font_size_primary';
const PDF_FONT_SIZE_SECONDARY_KEY = 'owner_pdf_font_size_secondary';
const PDF_FONT_SIZE_TERTIARY_KEY = 'owner_pdf_font_size_tertiary';
const PDF_CUSTOM_FONTS_KEY = 'owner_pdf_custom_fonts';

function getCustomPdfFonts() {
    try {
        const raw = localStorage.getItem(PDF_CUSTOM_FONTS_KEY);
        return raw ? JSON.parse(raw) : [];
    } catch (e) {
        return [];
    }
}

function setCustomPdfFonts(list) {
    try {
        localStorage.setItem(PDF_CUSTOM_FONTS_KEY, JSON.stringify(list));
    } catch (e) { }
}

function getEffectivePdfFontPrimary() {
    try { return localStorage.getItem(PDF_FONT_PRIMARY_KEY) || 'segoe'; } catch (e) { return 'segoe'; }
}
function getEffectivePdfFontSecondary() {
    try { return localStorage.getItem(PDF_FONT_SECONDARY_KEY) || 'segoe'; } catch (e) { return 'segoe'; }
}
function getEffectivePdfFontTertiary() {
    try { return localStorage.getItem(PDF_FONT_TERTIARY_KEY) || 'segoe'; } catch (e) { return 'segoe'; }
}

function getEffectivePdfFontSizePrimary() {
    try { const v = parseInt(localStorage.getItem(PDF_FONT_SIZE_PRIMARY_KEY), 10); return (v >= 8 && v <= 48) ? v : 26; } catch (e) { return 26; }
}
function getEffectivePdfFontSizeSecondary() {
    try { const v = parseInt(localStorage.getItem(PDF_FONT_SIZE_SECONDARY_KEY), 10); return (v >= 8 && v <= 48) ? v : 14; } catch (e) { return 14; }
}
function getEffectivePdfFontSizeTertiary() {
    try { const v = parseInt(localStorage.getItem(PDF_FONT_SIZE_TERTIARY_KEY), 10); return (v >= 8 && v <= 48) ? v : 12; } catch (e) { return 12; }
}

function getPdfFontFamilyCss(fontKey) {
    const key = fontKey || 'segoe';
    if (key.indexOf('custom_') === 0) {
        const custom = getCustomPdfFonts();
        const found = custom.find(function (f) { return f.id === key; });
        if (found && found.name) return "'" + found.name + "', sans-serif";
    }
    const map = {
        segoe: "'Segoe UI', system-ui, -apple-system, sans-serif",
        'segoe-variable': "'Segoe UI Variable', 'Segoe UI', system-ui, sans-serif",
        arial: "Arial, Helvetica, sans-serif",
        calibri: "Calibri, Candara, sans-serif",
        times: "'Times New Roman', Times, serif",
        verdana: "Verdana, Geneva, sans-serif",
        tahoma: "Tahoma, Geneva, sans-serif",
        trebuchet: "'Trebuchet MS', Helvetica, sans-serif",
        georgia: "Georgia, serif",
        cambria: "Cambria, 'Hoefler Text', serif",
        candara: "Candara, Calibri, sans-serif",
        consolas: "Consolas, 'Courier New', monospace",
        corbel: "Corbel, 'Lucida Grande', sans-serif",
        impact: "Impact, Charcoal, sans-serif",
        'comic-sans': "'Comic Sans MS', cursive, sans-serif",
        'lucida-console': "'Lucida Console', Monaco, monospace",
        palatino: "'Palatino Linotype', 'Book Antiqua', Palatino, serif",
        'book-antiqua': "'Book Antiqua', Palatino, serif",
        'franklin-gothic': "'Franklin Gothic Medium', 'Arial Narrow', sans-serif",
        helvetica: "Helvetica, Arial, sans-serif",
        system: "system-ui, -apple-system, sans-serif"
    };
    return map[key] || map.segoe;
}

function getCustomFontsCssForPdf() {
    const primary = getEffectivePdfFontPrimary();
    const secondary = getEffectivePdfFontSecondary();
    const tertiary = getEffectivePdfFontTertiary();
    const keys = [primary, secondary, tertiary];
    const custom = getCustomPdfFonts();
    const used = {};
    keys.forEach(function (k) {
        if (k && k.indexOf('custom_') === 0) used[k] = true;
    });
    const origin = (typeof window !== 'undefined' && window.location && window.location.origin) ? window.location.origin : '';
    const rules = [];
    custom.forEach(function (f) {
        if (!f.id || !used[f.id] || !f.url) return;
        const name = (f.name || 'CustomFont').replace(/'/g, "\\'");
        const url = (origin + f.url).replace(/'/g, "\\'");
        const format = f.url.indexOf('.woff2') !== -1 ? 'woff2' : f.url.indexOf('.woff') !== -1 ? 'woff' : f.url.indexOf('.otf') !== -1 ? 'opentype' : 'truetype';
        rules.push('@font-face{font-family:\'' + name + '\';src:url(\'' + url + '\') format(\'' + format + '\');}');
    });
    if (rules.length === 0) return '';
    return '<style>' + rules.join('') + '</style>';
}

function refreshPdfCustomFontOptions() {
    const custom = getCustomPdfFonts();
    let el = document.getElementById('pdf-custom-fonts-style');
    if (el) el.remove();
    if (custom.length > 0) {
        const sheet = document.createElement('style');
        sheet.id = 'pdf-custom-fonts-style';
        const origin = (typeof window !== 'undefined' && window.location && window.location.origin) ? window.location.origin : '';
        let css = '';
        custom.forEach(function (f) {
            if (!f.url || !f.name) return;
            const name = (f.name || 'CustomFont').replace(/'/g, "\\'");
            const url = (origin + f.url).replace(/'/g, "\\'");
            const format = f.url.indexOf('.woff2') !== -1 ? 'woff2' : f.url.indexOf('.woff') !== -1 ? 'woff' : f.url.indexOf('.otf') !== -1 ? 'opentype' : 'truetype';
            css += '@font-face{font-family:\'' + name + '\';src:url(\'' + url + '\') format(\'' + format + '\');}';
        });
        sheet.textContent = css;
        document.head.appendChild(sheet);
    }
    ['settings-pdf-font-primary', 'settings-pdf-font-secondary', 'settings-pdf-font-tertiary'].forEach(function (id) {
        const sel = document.getElementById(id);
        if (!sel) return;
        Array.from(sel.options).forEach(function (opt) {
            if (opt.value && opt.value.indexOf('custom_') === 0) opt.remove();
        });
        custom.forEach(function (f) {
            const opt = document.createElement('option');
            opt.value = f.id;
            opt.textContent = (f.name || 'Custom') + ' (uploaded)';
            sel.appendChild(opt);
        });
    });
    const listEl = document.getElementById('pdf-custom-fonts-list');
    if (listEl) {
        if (custom.length === 0) {
            listEl.innerHTML = '';
        } else {
            listEl.innerHTML = 'Uploaded: ' + custom.map(function (f) { return (f.name || f.id) + ' (' + f.id + ')'; }).join(', ');
        }
    }
}

function getCustomPdfThemes() {
    try {
        const raw = localStorage.getItem(PDF_CUSTOM_THEMES_KEY);
        return raw ? JSON.parse(raw) : [];
    } catch (e) {
        return [];
    }
}

function setCustomPdfThemes(themes) {
    try {
        localStorage.setItem(PDF_CUSTOM_THEMES_KEY, JSON.stringify(themes));
    } catch (e) { }
}

function getPdfThemeOverride() {
    try {
        return localStorage.getItem(PDF_THEME_OVERRIDE_KEY) || null;
    } catch (e) {
        return null;
    }
}

function setPdfThemeOverride(value) {
    try {
        if (value) localStorage.setItem(PDF_THEME_OVERRIDE_KEY, value);
        else localStorage.removeItem(PDF_THEME_OVERRIDE_KEY);
    } catch (e) { }
}

function getEffectivePdfThemes() {
    const custom = getCustomPdfThemes();
    const map = { ...PDF_THEMES };
    custom.forEach(function (t) {
        map[t.id] = {
            name: t.name,
            primary: t.primary,
            secondary: t.secondary,
            border: t.border,
            accent: t.accent || t.primary,
            pastelBg: t.pastelBg || '#f9fafb'
        };
    });
    return map;
}

function getEffectivePdfThemeKey(settings) {
    const override = getPdfThemeOverride();
    if (override) return override;
    return (settings && settings.pdfTheme) ? settings.pdfTheme : 'default';
}

// Update theme preview when selection changes
document.getElementById('settings-pdf-theme')?.addEventListener('change', function() {
    updateThemePreview(this.value);
});

// Save PDF theme
document.getElementById('savePdfThemeBtn')?.addEventListener('click', async function () {
    const selectedTheme = document.getElementById('settings-pdf-theme').value;
    try {
        await apiFetch('/settings', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ pdfTheme: selectedTheme })
        });
        addLog('Setting Changed', CURRENT_USER_ROLE, `Changed PDF theme to: ${selectedTheme}`);
        alert('PDF theme saved successfully!');
    } catch (e) { }
});

// PDF Font upload
document.getElementById('uploadPdfFontBtn')?.addEventListener('click', function () {
    const input = document.getElementById('settings-pdf-font-upload');
    if (!input || !input.files || !input.files[0]) {
        alert('Please select a font file (.ttf, .otf, .woff, or .woff2).');
        return;
    }
    const file = input.files[0];
    const ext = (file.name || '').toLowerCase();
    if (!/\.(ttf|otf|woff|woff2)$/.test(ext)) {
        alert('Invalid file type. Use .ttf, .otf, .woff, or .woff2');
        return;
    }
    const formData = new FormData();
    formData.append('font', file);
    const btn = this;
    btn.disabled = true;
    apiFetch('/upload-font', { method: 'POST', body: formData })
        .then(function (res) {
            const data = (res && res.data) ? res.data : res;
            if (data && data.url) {
                const custom = getCustomPdfFonts();
                const id = 'custom_' + (Date.now().toString(36) + Math.random().toString(36).slice(2));
                custom.push({ id: id, name: data.name || 'Custom Font', url: data.url });
                setCustomPdfFonts(custom);
                refreshPdfCustomFontOptions();
                input.value = '';
                alert('Font uploaded. Select it from the dropdowns above and save.');
            } else {
                alert((res && res.error) || (data && data.error) || 'Upload failed.');
            }
        })
        .catch(function (err) {
            alert(err && err.message ? err.message : 'Font upload failed.');
        })
        .finally(function () { btn.disabled = false; });
});

// Save PDF fonts (separate section: primary, secondary, tertiary; localStorage)
document.getElementById('savePdfFontBtn')?.addEventListener('click', function () {
    const primary = document.getElementById('settings-pdf-font-primary');
    const secondary = document.getElementById('settings-pdf-font-secondary');
    const tertiary = document.getElementById('settings-pdf-font-tertiary');
    const sizePrimary = document.getElementById('settings-pdf-font-size-primary');
    const sizeSecondary = document.getElementById('settings-pdf-font-size-secondary');
    const sizeTertiary = document.getElementById('settings-pdf-font-size-tertiary');
    if (!primary || !secondary || !tertiary) return;
    try {
        localStorage.setItem('owner_pdf_font_primary', primary.value || 'segoe');
        localStorage.setItem('owner_pdf_font_secondary', secondary.value || 'segoe');
        localStorage.setItem('owner_pdf_font_tertiary', tertiary.value || 'segoe');
        const p = parseInt(sizePrimary && sizePrimary.value ? sizePrimary.value : 26, 10);
        const s = parseInt(sizeSecondary && sizeSecondary.value ? sizeSecondary.value : 14, 10);
        const t = parseInt(sizeTertiary && sizeTertiary.value ? sizeTertiary.value : 12, 10);
        if (p >= 8 && p <= 48) localStorage.setItem(PDF_FONT_SIZE_PRIMARY_KEY, String(p));
        if (s >= 8 && s <= 48) localStorage.setItem(PDF_FONT_SIZE_SECONDARY_KEY, String(s));
        if (t >= 8 && t <= 48) localStorage.setItem(PDF_FONT_SIZE_TERTIARY_KEY, String(t));
        alert('PDF fonts saved successfully!');
    } catch (e) {
        alert('Failed to save PDF fonts.');
    }
});

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

function showPdfLoadingOverlay() {
    if (document.getElementById('pdfLoadingOverlay')) return;
    const el = document.createElement('div');
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
        await renderSettings();
        getSettings().then(s => {
            const logoEl = document.querySelector('.sidebar .brand img');
            if (logoEl) logoEl.src = 'images/Logo.svg';
        }).catch(() => {});
        addLog('Setting Changed', CURRENT_USER_ROLE, 'Uploaded company logo');
        alert('Company logo uploaded successfully!');
    } catch (e) { }
}

document.getElementById('removeLogoBtn')?.addEventListener('click', async function () {
    if (!confirm('Are you sure you want to remove the company logo?')) return;
    try {
        await apiFetch('/settings', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ logo: null }) });
        await renderSettings();
        const logoEl = document.querySelector('.sidebar .brand img');
        if (logoEl) logoEl.src = 'images/Logo.svg';
        addLog('Setting Changed', CURRENT_USER_ROLE, 'Removed company logo');
        alert('Company logo removed.');
    } catch (e) {
        alert('Failed to remove logo.');
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
    const gstInput = document.getElementById('gst');
    const gst = gstInput ? (parseFloat(gstInput.value) || null) : null;

    if (!productName || !itemUrl || isNaN(price)) {
        alert('Please fill in all required fields correctly.');
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
    
    if (gst !== null && !isNaN(gst)) {
        payload.gst = gst;
    }

    try {
        await apiFetch('/items', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        alert('Product added successfully!');
        
        // Create/update GST rule if GST is provided
        const gstInput = document.getElementById('gst');
        if (gstInput && gstInput.value) {
            const gst = parseFloat(gstInput.value);
            if (!isNaN(gst) && gst >= 0) {
                try {
                    await apiFetch('/gst_rules', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ productName: productName, percent: gst })
                    });
                } catch (gstError) {
                    // GST rule creation failed, but product was saved
                    console.warn('Failed to create GST rule:', gstError);
                }
            }
        }
        
        this.reset();
        document.getElementById('product-id').value = generateProductId();
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
        addLog('Quotation Deleted', CURRENT_USER_ROLE, `Deleted quotation: ${quotationId}`);
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
        addLog('Log Deleted', CURRENT_USER_ROLE, `Deleted log entry: ${logId}`);
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

    // Apply company logo in sidebar (from settings)
    getSettings().then(s => {
        const logoEl = document.querySelector('.sidebar .brand img');
        if (logoEl) logoEl.src = 'images/Logo.svg';
    }).catch(() => {});

    // Load initial data
    try {
        await Promise.all([
            renderItemsList().catch(err => console.error('Error rendering items:', err)),
            renderHistoryList().catch(err => console.error('Error rendering history:', err)),
            renderLogsList().catch(err => console.error('Error rendering logs:', err)),
            renderSettings().catch(err => console.error('Error rendering settings:', err)),
            updateSummary().catch(err => console.error('Error updating summary:', err)),
            renderCustomersList().catch(err => console.error('Error rendering customers:', err))
        ]);
    } catch (error) {
        console.error('Error initializing dashboard:', error);
    }

    showSection('dashboard');
    updateGrandTotal();
    if (productIdInput) productIdInput.value = generateProductId();
}

// Connect search input to filter products
// Initialize edit product modal
initEditProductModal();
// Initialize edit customer and quotation modals
initEditCustomerModal();
initEditQuotationModal();

document.addEventListener('DOMContentLoaded', function() {
    // Connect search input to filter products
    const searchInput = document.getElementById('productListSearchInput');
    if (searchInput) {
        searchInput.addEventListener('input', function(e) {
            const filter = e.target.value.trim();
            renderItemsList(filter);
        });
    }

    // Connect item search input for quotation creation
    const itemSearchInput = document.getElementById('itemSearchInput');
    if (itemSearchInput) {
        itemSearchInput.addEventListener('input', function(e) {
            const filter = e.target.value.trim();
            const typeFilter = document.querySelector('#quotationTypeFilters .type-filter-btn.active')?.dataset.type || '';
            renderAvailableItemsForQuotation(filter, typeFilter);
        });
    }

    // Connect customer list search input
    const customerListSearchInput = document.getElementById('customerListSearchInput');
    if (customerListSearchInput) {
        customerListSearchInput.addEventListener('input', function(e) {
            const filter = e.target.value.trim();
            customersCurrentPage = 1; // Reset to first page when searching
            renderCustomersList(filter);
        });
    }

    // Connect customer details search input
    const customerDetailsSearchInput = document.getElementById('customerDetailsSearchInput');
    if (customerDetailsSearchInput) {
        customerDetailsSearchInput.addEventListener('input', function(e) {
            const filter = e.target.value.trim();
            customerDetailsCurrentPage = 1; // Reset to first page when searching
            renderCustomerDetailsList(filter);
        });
    }

    // Event delegation for quotation type filters
    const quotationTypeFilters = document.getElementById('quotationTypeFilters');
    if (quotationTypeFilters) {
        quotationTypeFilters.addEventListener('click', function(e) {
            if (e.target.classList.contains('type-filter-btn')) {
                // Remove active class from all buttons
                quotationTypeFilters.querySelectorAll('.type-filter-btn').forEach(btn => {
                    btn.classList.remove('active');
                });
                // Add active class to clicked button
                e.target.classList.add('active');
                
                // Get current search filter
                const filter = document.getElementById('itemSearchInput')?.value.trim() || '';
                const typeFilter = e.target.dataset.type || '';
                
                // Render items with new filter
                renderAvailableItemsForQuotation(filter, typeFilter);
            }
        });
    }
});

// --- Logout Functionality ---
async function handleLogout() {
    if (!confirm('Are you sure you want to logout?')) {
        return;
    }

    try {
        // Call logout API (credentials: 'include' so session cookie is sent and server can clear it)
        const response = await fetch(`${API_BASE}/logout`, {
            method: 'POST',
            credentials: 'include',
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
            'rolewise_session_timeout',
            'rolewise_session_start'
        ];
        
        allKeys.forEach(key => {
            localStorage.removeItem(key);
        });

        // Redirect to index
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
            'rolewise_session_timeout',
            'rolewise_session_start'
        ];
        
        allKeys.forEach(key => {
            localStorage.removeItem(key);
        });
        
        window.location.href = '/index.html';
    }
}

// Function to handle unauthorized access
function redirectToLogin() {
    // Clear all session data
    localStorage.removeItem(LS_KEYS.role);
    localStorage.removeItem(LS_KEYS.user);
    localStorage.removeItem(LS_KEYS.userEmail);
    localStorage.removeItem(LS_KEYS.sessionExpiry);
    // Redirect to login
    window.location.href = '/login.html';
}

// Immediate session check before page loads (runs as soon as script loads)
(function immediateSessionCheck() {
    if (!validateSession()) {
        redirectToLogin();
        return;
    }
})();

window.onload = function() {
    // Validate session before initializing dashboard
    if (!validateSession()) {
        alert('Your session has expired or you are not logged in. Please login again.');
        redirectToLogin();
        return;
    }
    
    // Add event listener for logout button
    document.getElementById('logoutBtn')?.addEventListener('click', handleLogout);

    // Initial load: render type filters and dashboard
    renderItemsTypeFilters().catch(err => console.error('Error rendering item type filters:', err));
    initializeDashboard();
};

// Add session validation on page visibility changes (catches back/forward navigation)
document.addEventListener('visibilitychange', function() {
    if (document.visibilityState === 'visible') {
        if (!validateSession()) {
            alert('Your session has expired. Please login again.');
            redirectToLogin();
        }
    }
});

// Add session validation on window focus (catches when user switches back to tab)
window.addEventListener('focus', function() {
    if (!validateSession()) {
        alert('Your session has expired. Please login again.');
        redirectToLogin();
    }
});

// Prevent access via browser back button after logout
window.addEventListener('pageshow', function(event) {
    // If page was loaded from cache (back/forward button), validate session
    if (event.persisted) {
        if (!validateSession()) {
            redirectToLogin();
        }
    }
});

// Sidebar time display
function updateSidebarTime() {
    const el = document.getElementById('sidebarTimeText');
    if (el) {
        const d = new Date();
        const h = d.getHours();
        const h12 = h % 12 || 12;
        const ampm = h < 12 ? 'AM' : 'PM';
        const m = String(d.getMinutes()).padStart(2, '0');
        const s = String(d.getSeconds()).padStart(2, '0');
        el.textContent = h12 + ':' + m + ':' + s + ' ' + ampm;
    }
    const loggedEl = document.getElementById('sidebarLoggedTime');
    if (loggedEl) {
        let startMs = parseInt(localStorage.getItem('rolewise_session_start'), 10);
        if (!startMs) {
            const expiry = localStorage.getItem('rolewise_session_expiry');
            const timeout = localStorage.getItem('rolewise_session_timeout');
            if (expiry && timeout) startMs = parseInt(expiry, 10) - (parseInt(timeout, 10) * 1000);
        }
        if (startMs) {
            const elapsedMs = Date.now() - startMs;
            const hours = Math.floor(elapsedMs / (1000 * 60 * 60));
            const minutes = Math.floor((elapsedMs % (1000 * 60 * 60)) / (1000 * 60));
            loggedEl.textContent = hours + 'h ' + minutes + 'm';
        } else {
            loggedEl.textContent = '—';
        }
    }
}
document.addEventListener('DOMContentLoaded', function() {
    updateSidebarTime();
    setInterval(updateSidebarTime, 1000);
});

