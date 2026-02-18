
        /*
            RoleWise Dashboard - Accountant Interface (HTML + CSS + JS)
            This is a single-page application prototype using basic DOM manipulation and localStorage for data persistence.
        */

        // --- Constants & Global State ---
        const LS_KEYS = {
            items: 'rolewise_items',
            quotations: 'rolewise_quotations',
            logs: 'rolewise_logs',
            user: 'rolewise_user_email',
            role: 'rolewise_user_role',
            roleStandard: 'rolewise_role', // Standard key used by login
            userStandard: 'rolewise_user', // Standard key used by login
            sessionExpiry: 'rolewise_session_expiry',
            logo: 'rolewise_company_logo',
            brand: 'rolewise_brand_name',
            companyGstId: 'rolewise_company_gst_id',
            validityDays: 'rolewise_quotation_validity_days',
            gst: 'rolewise_default_gst',
            gstRules: 'rolewise_gst_rules',
            pdfTheme: 'rolewise_pdf_theme'
        };

        const DEFAULT_ROLE = 'Accountant';
        const API_BASE = '/api';

        // Accountant Role Permissions (Based on the structure)
        const AUTHORIZED_TO_EDIT_ITEMS = ['Owner', 'Admin', 'Manager', 'Accountant'];
        const AUTHORIZED_TO_CREATE_QUOTATIONS = ['Owner', 'Admin', 'Manager', 'Accountant'];
        const AUTHORIZED_TO_VIEW_CUSTOMERS = ['Owner', 'Admin', 'Manager', 'Accountant']; 
        const AUTHORIZED_TO_VIEW_LOGS = ['Owner', 'Admin', 'Manager']; // Logs not for Accountant
        const AUTHORIZED_TO_DELETE_LOGS = ['Owner', 'Admin', 'Manager'];
        const AUTHORIZED_TO_VIEW_SETTINGS = ['Owner', 'Admin', 'Manager']; 
        // Accountant should not be able to fix GST/Financial settings (consistent with settings removal)
        const AUTHORIZED_TO_FIX_GST = ['Owner', 'Admin', 'Manager'];
        const AUTHORIZED_TO_DELETE_ITEMS = ['Owner', 'Admin', 'Manager']; // Accountant cannot delete products
        const AUTHORIZED_TO_DELETE_QUOTATIONS = ['Owner', 'Admin', 'Manager']; // Accountant cannot delete quotations

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
                // Check standard keys first (from login.js)
                const userRole = localStorage.getItem(LS_KEYS.roleStandard) || readLS(LS_KEYS.role);
                const userDataStr = localStorage.getItem(LS_KEYS.userStandard);
                
                // Check if session data exists
                if (!userRole || !userDataStr) {
                    return false;
                }
                
                // Check if session has expired
                if (isSessionExpired()) {
                    // Clear session
                    localStorage.removeItem(LS_KEYS.roleStandard);
                    localStorage.removeItem(LS_KEYS.userStandard);
                    localStorage.removeItem(LS_KEYS.sessionExpiry);
                    writeLS(LS_KEYS.role, null);
                    writeLS(LS_KEYS.user, null);
                    return false;
                }
                
                // CRITICAL: For accountant dashboard, only Accountant role is allowed
                if (userRole !== 'Accountant') {
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
                
                // Double-check that userData.role is Accountant
                if (userData.role !== 'Accountant') {
                    return false;
                }
                
                return true;
            } catch (error) {
                return false;
            }
        }

        let CURRENT_USER_ROLE = readLS(LS_KEYS.role) || localStorage.getItem(LS_KEYS.roleStandard) || DEFAULT_ROLE;
        // MODIFIED: Default user is now accountant@rolewise.app
        // Get email from userEmail key, or parse from user object, or use default
        let userEmailFromStorage = readLS(LS_KEYS.userEmail) || localStorage.getItem('rolewise_user_email');
        let userObjFromStorage = readLS(LS_KEYS.user);
        let CURRENT_USER_EMAIL = userEmailFromStorage || (userObjFromStorage ? (() => {
            try {
                const userData = typeof userObjFromStorage === 'string' ? JSON.parse(userObjFromStorage) : userObjFromStorage;
                return userData.email || `${DEFAULT_ROLE.toLowerCase()}@rolewise.app`;
            } catch (e) {
                return `${DEFAULT_ROLE.toLowerCase()}@rolewise.app`;
            }
        })() : `${DEFAULT_ROLE.toLowerCase()}@rolewise.app`);

        let quotationItems = [];
        const DEFAULT_QUOTATION_ITEM_TYPE_ORDER = ['all', 'cpu', 'cpu cooler', 'motherboard', 'memory', 'storage', 'graphic card', 'case', 'monitor', '19500', 'amd cpu', 'amd mobo', 'cabinet', 'cooler', 'fan', 'fan controller', 'gpu', 'gpu cable', 'gpu holder', 'hdd', 'intel cpu', 'intel mobo', 'keyboard&mouse', 'memory module radiator', 'mod cable', 'ram', 'smps', 'ssd', 'ups'];
        function getQuotationCategorySortIndex(type, order) {
            const arr = order && order.length ? order : DEFAULT_QUOTATION_ITEM_TYPE_ORDER;
            const t = (type || '').toLowerCase().trim();
            if (!t) return arr.length + 1;
            for (let i = 0; i < arr.length; i++) {
                const cat = (arr[i] || '').toLowerCase().trim();
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
            return arr.length + 1;
        }
        let currentEditQuotationId = null; // When editing via create section (like resume drafts)
        let isCreatingNewQuotation = true; // Track if we're creating a new quotation (true) or editing existing (false)
        let itemsCurrentPage = 1;
        const itemsPerPage = 5;
        let itemsCurrentPriceSort = 'none';
        let itemsCurrentTotalValueSort = 'none';
        let itemsCurrentNameSort = 'none';
        let historyCurrentPage = 1;
        const historyPerPage = 10;
        let customersCurrentPage = 1;
        const customersPerPage = 10;
        let customerDetailsCurrentPage = 1;
        const customerDetailsPerPage = 10;

        const defaultPlaceholderImage = '<svg style="width:48px;height:48px;color:#9aa4ad" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#ccc" width="24px" height="24px"><path d="M0 0h24v24H0z" fill="none"/><path d="M22 16V4a2 2 0 00-2-2H4a2 2 0 00-2 2v12a2 2 0 002 2h16a2 2 0 002-2zm-11.5-3c.83 0 1.5-.67 1.5-1.5S11.33 10 10.5 10 9 10.67 9 11.5s.67 1.5 1.5 1.5zM20 18H4v-1.5l3.5-3.5 4.5 6 4-4 4 4z"/></svg>';

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
            return str.replace(/\w\S*/g, function(txt) {
                return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase();
            });
        }

        // Simple LocalStorage Wrapper
        function readLS(key) {
            try {
                const data = localStorage.getItem(key);
                if (!data) return null;
                
                // Try to parse as JSON first
                try {
                    return JSON.parse(data);
                } catch (parseError) {
                    // If parsing fails, it might be a plain string stored directly
                    // Check if it looks like a quoted string (e.g., '"value"')
                    if (data.startsWith('"') && data.endsWith('"') && data.length > 1) {
                        // Remove the outer quotes and return
                        return data.slice(1, -1);
                    }
                    // Otherwise, return the raw value (it's a plain string)
                    return data;
                }
            } catch (e) {
                return null;
            }
        }

        function writeLS(key, data) {
            try {
                localStorage.setItem(key, JSON.stringify(data));
            } catch (e) {
                // Silent fail for localStorage write errors
            }
        }

        // --- API Helper Functions ---

        async function apiFetch(endpoint, options = {}) {
            try {
                // Ensure credentials (cookies/sessions) are sent with requests
                const fetchOptions = {
                    ...options,
                    credentials: 'include'  // Send cookies with cross-origin requests
                };
                const url = endpoint.startsWith('/_') ? endpoint : `${API_BASE}${endpoint}`;
                const response = await fetch(url, fetchOptions);
                
                // Check content type before parsing
                const contentType = response.headers.get("content-type");
                const isJson = contentType && contentType.includes("application/json");
                
                if (!response.ok) {
                    // Try to parse error response as JSON
                    if (isJson) {
                        const errorData = await response.json().catch(() => ({}));
                        const errorMessage = errorData.error || errorData.message || `API Error: ${response.statusText}`;
                        throw new Error(errorMessage);
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
                // For POST/PUT/DELETE operations, throw the error so caller can handle it
                // For GET operations, return null to allow fallback to local data
                const method = (options.method || 'GET').toUpperCase();
                if (method === 'POST' || method === 'PUT' || method === 'DELETE' || method === 'PATCH') {
                    throw error;
                }
                // For GET requests, fail silently and use local data
                return null;
            }
        }

        // --- Data Getters/Setters ---

        // Synchronous versions (for backward compatibility with existing code)
        function getItemsSync() { return readLS(LS_KEYS.items) || []; }
        function getQuotationsSync() { return readLS(LS_KEYS.quotations) || []; }
        function getLogsSync() { return readLS(LS_KEYS.logs) || []; }

        // Async versions (for API calls with localStorage fallback)
        async function getItems() {
            try {
                const response = await apiFetch('/items');
                if (!response) return getItemsSync(); // Fallback to localStorage
                return Array.isArray(response) ? response : (response.data || getItemsSync());
            } catch (error) {
                return getItemsSync();
            }
        }

        function writeItems(items) { writeLS(LS_KEYS.items, items); updateSummary(); }

        async function getQuotations() {
            try {
                const response = await apiFetch('/quotations');
                if (!response) return getQuotationsSync(); // Fallback to localStorage
                return Array.isArray(response) ? response : (response.data || getQuotationsSync());
            } catch (error) {
                return getQuotationsSync();
            }
        }

        async function getCustomers() {
            try {
                const response = await apiFetch('/customers');
                return Array.isArray(response) ? response : (response?.data || []);
            } catch (error) {
                return [];
            }
        }

        function writeQuotations(quotations) { writeLS(LS_KEYS.quotations, quotations); updateSummary(); renderHistoryList(); renderCustomersList(); renderCustomerDetailsList(); }

        async function getLogs() {
            try {
                const response = await apiFetch('/logs');
                if (!response) return getLogsSync(); // Fallback to localStorage
                return Array.isArray(response) ? response : (response.data || getLogsSync());
            } catch (error) {
                return getLogsSync();
            }
        }

        function writeLogs(logs) { writeLS(LS_KEYS.logs, logs); updateSummary(); renderLogsList(); }

        function getGstRules() { return readLS(LS_KEYS.gstRules) || []; }
        function writeGstRules(rules) { writeLS(LS_KEYS.gstRules, rules); renderSettings(); }

        function generateProductId() {
            const items = getItemsSync();
            const lastId = items.length > 0 ? items[items.length - 1].productId : 'P0000000';
            const num = parseInt(lastId.substring(1)) + 1;
            return 'P' + String(num).padStart(7, '0');
        }

        function addLog(action, role, details) {
            let logs = getLogsSync();
            const logId = Date.now();
            const timestamp = new Date().toLocaleString('en-IN');
            logs.unshift({ id: logId, timestamp, user: CURRENT_USER_EMAIL, role, action, details });
            // Keep logs to a reasonable limit, e.g., 500 entries
            if (logs.length > 500) {
                logs = logs.slice(0, 500);
            }
            writeLogs(logs);
        }

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

        // --- UI Logic ---

        // Tab/Section Switching
        async function showSection(sectionId) {
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

            document.querySelectorAll('.nav a').forEach(a => {
                a.classList.remove('active');
            });
            document.querySelectorAll('.tab-btn').forEach(btn => {
                btn.classList.remove('active');
            });

            // Set main navigation active state
            const navLink = document.querySelector(`#sideNav a[data-tab="${sectionId}"]`);
            if (navLink) navLink.classList.add('active');

            // Set section tab active state (for the active section)
            const tabBtn = document.querySelector(`#${sectionId} .section-tabs .tab-btn[data-tab="${sectionId}"]`);
            if (tabBtn) tabBtn.classList.add('active');


            // Update Header
            const sectionTitles = {
                dashboard: 'Accountant Dashboard',
                itemsList: 'Product List',
                addItem: 'Add New Product',
                createQuotation: 'Create Customer Quotation',
                viewHistory: 'Quotation History',
                viewCustomers: 'Customer Database',
                viewLogs: 'User Activity Logs',
                settings: 'System Settings'
            };
            const sectionSubtitles = {
                itemsList: 'Manage products for quotations.',
                addItem: 'Register new products with unique details.',
                createQuotation: 'Generate and send quotations to customers.',
                viewHistory: 'Review past quotations.',
                viewCustomers: 'List of customers compiled from quotations.',
                viewLogs: 'Review chronological user actions.',
                settings: 'Configure company logo, brand, and financial rules.'
            };

            // Run render functions for the shown section
            if (sectionId === 'itemsList') {
                renderItemsList().catch(err => console.error('Error rendering items list:', err));
            } else if (sectionId === 'viewHistory') {
                renderHistoryList();
            } else if (sectionId === 'viewLogs') {
                renderLogsList();
            } else if (sectionId === 'viewCustomers') {
                renderCustomersList();
                showCustomerSubtab('customerHistory');
            } else if (sectionId === 'settings') {
                renderSettings();
            } else if (sectionId === 'addItem') {
                document.getElementById('product-id').value = generateProductId();
                handleItemEditReset();
                updateCompatFieldsVisibility('type', 'compatFieldsContainer');
            } else if (sectionId === 'createQuotation') {
                if (!currentEditQuotationId) quotationItems = [];
                renderQuotationItems();
                updateGrandTotal();
                renderQuotationTypeFilters(window.cachedItems);
                renderAvailableItemsForQuotation('', '', window.cachedItems);
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
                    document.querySelectorAll('#sideNav a[data-tab="createQuotation"], .tab-btn[data-tab="createQuotation"]').forEach(el => { if (el.tagName === 'A') el.innerHTML = '<i class="fas fa-file-invoice-dollar"></i> Create quotation'; else el.textContent = 'Create quotation'; });
                    const sectionTitle = document.getElementById('createQuotationSectionTitle');
                    if (sectionTitle) sectionTitle.textContent = 'Create Quotation';
                    const cancelEditBtn = document.getElementById('cancelEditInCreateSectionBtn');
                    if (cancelEditBtn) cancelEditBtn.style.display = 'none';
                }
            }
        }

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
        document.querySelectorAll('.sidebar, .main').forEach(container => {
            container.addEventListener('click', function(e) {
                const subtabBtn = e.target.closest('.section-tabs .tab-btn[data-subtab]');
                if (subtabBtn) {
                    e.preventDefault();
                    showCustomerSubtab(subtabBtn.getAttribute('data-subtab'));
                    return;
                }
                const target = e.target.closest('a[data-tab], button[data-tab]');
                if (target) {
                    e.preventDefault();
                    showSection(target.getAttribute('data-tab'));
                }
            });
        });

        // Role Switching (Simulated for Demo)
        function switchRole(newRole) {
            writeLS(LS_KEYS.role, newRole);
            writeLS(LS_KEYS.user, `${newRole.toLowerCase()}@rolewise.app`);
            CURRENT_USER_ROLE = newRole;
            CURRENT_USER_EMAIL = `${newRole.toLowerCase()}@rolewise.app`;

            document.getElementById('userRoleDisplay').textContent = newRole;
            document.getElementById('userEmailDisplay').textContent = CURRENT_USER_EMAIL;
            document.getElementById('userAvatar').textContent = newRole.charAt(0).toUpperCase();

            addLog('Role Switched', newRole, `Switched to role: ${newRole}`);
            initializeDashboard(); // Re-initialize to apply new restrictions and views
        }

        function safeSetDisplay(id, value) {
            const el = document.getElementById(id);
            if (el) el.style.display = value;
        }

        function applyRoleRestrictions() {
            // Manage visibility of Logs and Settings for non-Owner/Admin/Manager roles
            const isOwnerAdminOrManager = AUTHORIZED_TO_VIEW_LOGS.includes(CURRENT_USER_ROLE);
            const isAuthorizedToEditItems = AUTHORIZED_TO_EDIT_ITEMS.includes(CURRENT_USER_ROLE);
            const isAuthorizedToViewCustomers = AUTHORIZED_TO_VIEW_CUSTOMERS.includes(CURRENT_USER_ROLE);
            const isAuthorizedToDeleteLogs = AUTHORIZED_TO_DELETE_LOGS.includes(CURRENT_USER_ROLE);
            const isAuthorizedToViewSettings = AUTHORIZED_TO_VIEW_SETTINGS.includes(CURRENT_USER_ROLE);
            const isAuthorizedToFixGst = AUTHORIZED_TO_FIX_GST.includes(CURRENT_USER_ROLE);

            // Side Navigation
            safeSetDisplay('navViewCustomers', isAuthorizedToViewCustomers ? 'flex' : 'none');
            safeSetDisplay('navSettings', isAuthorizedToViewSettings ? 'flex' : 'none');

            // Tab Buttons (may not exist on accountant layout)
            safeSetDisplay('tabViewCustomers', isAuthorizedToViewCustomers ? 'block' : 'none');

            // Logs Card in Dashboard
            safeSetDisplay('summaryLogsCard', isOwnerAdminOrManager ? 'block' : 'none');

            // Add Item section visibility (Accountant has access)
            if (!isAuthorizedToEditItems) {
                const addItemEl = document.getElementById('addItem');
                if (addItemEl) {
                    const wasVisible = addItemEl.style.display !== 'none';
                    addItemEl.style.display = 'none';
                    if (wasVisible) showSection('dashboard');
                }
            }

            // Delete Log Button visibility
            document.querySelectorAll('.delete-log-btn').forEach(btn => {
                if (btn) btn.style.display = isAuthorizedToDeleteLogs ? 'inline-flex' : 'none';
            });
            
            // Edit/Delete Item buttons
            // Handled within renderItemsList but relies on AUTHORIZED_TO_EDIT_ITEMS
        }

        // --- Product/Item Management ---

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

        function saveItem(event) {
            event.preventDefault();

            if (!AUTHORIZED_TO_EDIT_ITEMS.includes(CURRENT_USER_ROLE)) {
                alert('You are not authorized to add/edit products.');
                addLog('Unauthorized Attempt', CURRENT_USER_ROLE, `Tried to add/edit product`);
                return;
            }

            const form = event.target;
            const productId = document.getElementById('product-id').value.trim();
            const itemUrl = document.getElementById('item-url').value.trim();
            const productName = document.getElementById('product-name').value.trim();
            const type = document.getElementById('type').value.trim();
            const price = parseFloat(document.getElementById('price').value);
            const gstInput = document.getElementById('gst');
            const gst = gstInput ? (parseFloat(gstInput.value) || null) : null;
            const description = document.getElementById('description').value.trim();
            const dateAdded = new Date().toLocaleDateString('en-IN');
            const addedBy = CURRENT_USER_EMAIL;

            if (isNaN(price) || price < 0) {
                alert('Please enter a valid price.');
                return;
            }

            let items = getItemsSync();
            const isUpdate = items.some(item => item.productId === productId);

            if (isUpdate) {
                // Handle update
                const index = items.findIndex(item => item.productId === productId);
                if (index > -1) {
                    const originalItem = items[index];
                    // Check URL duplication for update (excluding the current item's original URL)
                    if (items.some((item, i) => i !== index && item.itemUrl === itemUrl)) {
                        alert('The website URL must be unique.');
                        return;
                    }

                    items[index] = {
                        ...originalItem,
                        itemUrl,
                        productName: toTitleCase(productName),
                        type: toTitleCase(type),
                        price,
                        description,
                        ...getCompatPayload('')
                    };
                    const origPrice = parseFloat(originalItem.price);
                    if (!isNaN(origPrice) && origPrice !== price) {
                        addLog('Price Updated', CURRENT_USER_ROLE, `Updated price of ${productName} (${productId}): ₹${origPrice} → ₹${price}`);
                    } else {
                        addLog('Edited', CURRENT_USER_ROLE, `Edited product: ${productName} (${productId})`);
                    }
                }
            } else {
                // Check URL duplication for a new item
                if (items.some(item => item.itemUrl === itemUrl)) {
                    alert('The website URL must be unique.');
                    return;
                }
                const newItem = { 
                    productId, 
                    itemUrl, 
                    productName: toTitleCase(productName), 
                    type: toTitleCase(type), 
                    price, 
                    description, 
                    dateAdded, 
                    addedBy, 
                    photo: '',
                    ...getCompatPayload('')
                }; 
                items.push(newItem);
                addLog('Product Added', CURRENT_USER_ROLE, `Added new product: ${productName} (${productId})`);
            }

            writeItems(items);
            
            // Create/update GST rule if GST is provided
            if (gst !== null && !isNaN(gst) && gst >= 0) {
                let rules = getGstRules();
                const existingRuleIndex = rules.findIndex(r => r.productName.toLowerCase() === productName.toLowerCase());
                
                if (existingRuleIndex > -1) {
                    // Update existing rule
                    rules[existingRuleIndex].percent = gst;
                } else {
                    // Create new rule
                    rules.push({ productName: toTitleCase(productName), percent: gst });
                }
                writeGstRules(rules);
            }
            
            alert(`Product ${isUpdate ? 'updated' : 'added'} successfully!`);
            form.reset();
            document.getElementById('product-id').value = generateProductId();
            // Switch to itemsList after adding/updating
            showSection('itemsList');
            document.querySelector('#sideNav a[data-tab="itemsList"]').click();
        }

        function deleteItem(productId) {
            if (!confirm(`Are you sure you want to delete product ID ${productId}?`)) return;

            if (!AUTHORIZED_TO_DELETE_ITEMS.includes(CURRENT_USER_ROLE)) {
                alert('You are not authorized to delete products.');
                addLog('Unauthorized Attempt', CURRENT_USER_ROLE, `Tried to delete product: ${productId}`);
                return;
            }

            let items = getItemsSync();
            const index = items.findIndex(item => item.productId === productId);
            if (index > -1) {
                const deletedItem = items.splice(index, 1)[0];
                writeItems(items);
                addLog('Product Deleted', CURRENT_USER_ROLE, `Deleted product: ${deletedItem.productName} (${productId})`);
            }
            renderItemsList().catch(err => console.error('Error rendering items list:', err));
        }

        function editItem(productId) {
            if (!AUTHORIZED_TO_EDIT_ITEMS.includes(CURRENT_USER_ROLE)) {
                alert('You are not authorized to edit products.');
                addLog('Unauthorized Attempt', CURRENT_USER_ROLE, `Tried to edit product: ${productId}`);
                return;
            }

            const items = getItemsSync();
            const item = items.find(i => i.productId === productId);
            if (!item) return;

            // Populate modal form fields
            document.getElementById('edit-product-id').value = item.productId;
            document.getElementById('edit-item-url').value = item.itemUrl || '';
            document.getElementById('edit-product-name').value = item.productName || '';
            document.getElementById('edit-type').value = item.type || '';
            document.getElementById('edit-price').value = item.price || '';
            document.getElementById('edit-description').value = item.description || '';
            
            // Fetch and populate GST rate
            const gstRate = getGstRateForItem(item.productName);
            const gstInput = document.getElementById('edit-gst');
            if (gstInput) {
                gstInput.value = gstRate || item.gst || '';
            }

            setCompatFields('edit-', item);
            updateCompatFieldsVisibility('edit-type', 'editCompatFieldsContainer');

            // Show modal
            const modal = document.getElementById('editProductModal');
            if (modal) {
                modal.style.display = 'block';
            }
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

        function handleItemEditReset() {
            // Reset button text
            const submitBtn = document.querySelector('#addItemForm button[type="submit"]');
            if (submitBtn) {
                submitBtn.textContent = 'Add Product';
                submitBtn.classList.remove('update-mode');
            }
            const productIdInput = document.getElementById('product-id');
            if (productIdInput) {
                productIdInput.value = generateProductId();
            }
            // Clear photo preview (if elements exist)
            const photoPreviewContainer = document.getElementById('itemPhotoPreviewContainer');
            if (photoPreviewContainer) {
                photoPreviewContainer.style.display = 'none';
            }
            const photoPreview = document.getElementById('itemPhotoPreview');
            if (photoPreview) {
                photoPreview.src = '';
            }
            const photoUploadInput = document.getElementById('photoUploadInput');
            if (photoUploadInput) {
                photoUploadInput.value = '';
            }
        }

        async function renderItemsList(searchTerm = '') {
            const items = await getItems();
            const body = document.getElementById('itemsListBody');
            const noItemsMessage = document.getElementById('noItemsMessage');
            body.innerHTML = '';
            
            if (!Array.isArray(items) || items.length === 0) {
                noItemsMessage.style.display = 'block';
                const paginationDiv = document.getElementById('itemsPagination');
                if (paginationDiv) paginationDiv.style.display = 'none';
                return;
            }
            
            searchTerm = searchTerm.toLowerCase().trim();
            let filteredItems = items.filter(item => 
                (item.productName && item.productName.toLowerCase().includes(searchTerm)) || 
                (item.productId && item.productId.toLowerCase().includes(searchTerm))
            );

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
                const paginationDiv = document.getElementById('itemsPagination');
                if (paginationDiv) paginationDiv.style.display = 'none';
                return;
            }
            noItemsMessage.style.display = 'none';
            const paginationDiv = document.getElementById('itemsPagination');
            if (paginationDiv) paginationDiv.style.display = 'flex';

            // Reset to page 1 if search term changed
            if (searchTerm !== '') {
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
            const isAuthorizedToDeleteItems = AUTHORIZED_TO_DELETE_ITEMS.includes(CURRENT_USER_ROLE);

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
                // Date Added - use created_at if available, otherwise dateAdded
                const dateAdded = item.created_at ? new Date(item.created_at).toLocaleDateString('en-IN') : (item.dateAdded || 'N/A');
                row.insertCell().textContent = dateAdded;

                const actionsCell = row.insertCell();
                if (isAuthorizedToEdit || isAuthorizedToDeleteItems) {
                    let actionsHtml = '';
                    if (isAuthorizedToEdit) actionsHtml += `<button class="btn" style="padding: 5px 8px; margin-right: 5px;" onclick="editItem('${item.productId}')"><i class="fas fa-edit"></i></button>`;
                    if (isAuthorizedToDeleteItems) actionsHtml += `<button class="btn danger" style="padding: 5px 8px;" onclick="deleteItem('${item.productId}')"><i class="fas fa-trash-alt"></i></button>`;
                    actionsCell.innerHTML = actionsHtml;
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
                        const searchTerm = searchInput ? searchInput.value : '';
                        renderItemsList(searchTerm).catch(err => console.error('Error rendering items list:', err));
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
                        const searchTerm = searchInput ? searchInput.value : '';
                        renderItemsList(searchTerm).catch(err => console.error('Error rendering items list:', err));
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
                        const searchTerm = searchInput ? searchInput.value : '';
                        renderItemsList(searchTerm).catch(err => console.error('Error rendering items list:', err));
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
            const searchTerm = searchInput ? searchInput.value : '';
            
            itemsCurrentPage += direction;
            if (itemsCurrentPage < 1) itemsCurrentPage = 1;
            
            // Get total pages to limit max page
            const allItems = getItems();
            const filteredItems = Array.isArray(allItems) ? allItems : (allItems?.data || []);
            const filtered = searchTerm ? filteredItems.filter(item => {
                const searchLower = searchTerm.toLowerCase();
                return (item.productName && item.productName.toLowerCase().includes(searchLower)) ||
                       (item.productId && item.productId.toLowerCase().includes(searchLower));
            }) : filteredItems;
            const totalPages = Math.ceil(filtered.length / itemsPerPage);
            if (itemsCurrentPage > totalPages) itemsCurrentPage = totalPages;
            
            renderItemsList(searchTerm).catch(err => console.error('Error rendering items list:', err));
        }

        document.getElementById('productListSearchInput')?.addEventListener('input', (e) => renderItemsList(e.target.value).catch(err => console.error('Error rendering items list:', err)));

        // Connect customer list search input
        document.getElementById('customerListSearchInput')?.addEventListener('input', function(e) {
            const filter = e.target.value.trim();
            customersCurrentPage = 1; // Reset to first page when searching
            renderCustomersList(filter);
        });

        // Connect customer details search input
        document.getElementById('customerDetailsSearchInput')?.addEventListener('input', function(e) {
            const filter = e.target.value.trim();
            customerDetailsCurrentPage = 1; // Reset to first page when searching
            renderCustomerDetailsList(filter);
        });

        // --- CSV Import/Export ---

        function convertToCsv(data, headers) {
            const csvRows = [];
            csvRows.push(headers.join(','));
            
            data.forEach(item => {
                const values = headers.map(header => {
                    const value = item[header.toLowerCase().replace(/ /g, '')] || '';
                    // Handle values that contain commas or double quotes
                    let stringValue = String(value).replace(/"/g, '""');
                    if (stringValue.includes(',') || stringValue.includes('\n')) {
                        stringValue = `"${stringValue}"`;
                    }
                    return stringValue;
                });
                csvRows.push(values.join(','));
            });

            return csvRows.join('\n');
        }

        function exportItemsToCsv() {
            const items = getItemsSync();
            if (items.length === 0) {
                alert('No products to export.');
                return;
            }

            const headers = ['Product ID', 'Product Name', 'Type', 'Price', 'Description', 'Website URL', 'Added By', 'Date Added'];
            const dataToExport = items.map(item => ({
                'productid': item.productId,
                'productname': item.productName,
                'type': item.type,
                'price': item.price,
                'description': item.description,
                'websiteurl': item.itemUrl,
                'addedby': item.addedBy,
                'dateadded': item.dateAdded,
            }));

            const csvData = convertToCsv(dataToExport, headers);
            const blob = new Blob([csvData], { type: 'text/csv;charset=utf-8;' });
            const link = document.createElement('a');
            
            link.href = URL.createObjectURL(blob);
            link.download = 'products_export.csv';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);

            addLog('Exported Data', CURRENT_USER_ROLE, 'Exported all product data to CSV');
        }

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

        function handleCsvImport(event) {
            if (!AUTHORIZED_TO_EDIT_ITEMS.includes(CURRENT_USER_ROLE)) {
                alert('You are not authorized to import products.');
                addLog('Unauthorized Attempt', CURRENT_USER_ROLE, `Tried to import product CSV`);
                return;
            }

            const file = event.target.files[0];
            if (!file) return;

            const reader = new FileReader();
            reader.onload = function(e) {
                try {
                    const csvData = e.target.result;
                    processCsvData(csvData);
                } catch (error) {
                    alert('Error reading CSV file.');
                }
            };
            reader.readAsText(file);
        }

        function processCsvData(csvData) {
            const lines = csvData.trim().split('\n');
            if (lines.length < 2) {
                alert('CSV file is empty or missing headers.');
                return;
            }

            const headers = parseCsvLine(lines[0]).map(h => h.toLowerCase().trim().replace(/"/g, ''));
            const requiredHeaders = ["product id", "product name", "type", "price", "description"];
            const hasWebsite = headers.includes('website url') || headers.includes('website link');
            if (!requiredHeaders.every(h => headers.includes(h)) || !hasWebsite) {
                alert('CSV file must include: Product ID, Product Name, Type, Price, Description, and either Website URL or Website Link (matching Products table).');
                return;
            }

            let items = getItemsSync();
            let importCount = 0;
            const existingUrls = new Set(items.map(i => i.itemUrl));

            for (let i = 1; i < lines.length; i++) {
                if (!lines[i].trim()) continue;

                const values = parseCsvLine(lines[i]);
                if (values.length !== headers.length) {
                    continue;
                }

                const itemData = {};
                headers.forEach((header, index) => {
                    itemData[header.replace(/\s/g, '')] = values[index];
                });
                // Support "GST (%)" column (key becomes "gst(%)")
                const gstKey = headers.find(h => h.replace(/\s/g, '').toLowerCase().startsWith('gst'));
                const gstVal = gstKey ? itemData[gstKey.replace(/\s/g, '')] : null;

                const productId = (itemData.productid || '').trim();
                const productName = toTitleCase((itemData.productname || '').trim());
                const type = toTitleCase((itemData.type || '').trim());
                const price = parseFloat((itemData.price || '0').toString().trim());
                const description = (itemData.description || '').trim();
                const itemUrl = (itemData.websitelink || itemData.websiteurl || '').trim();
                const gstStr = String(gstVal || itemData.gst || '').replace('%', '').trim();
                const gst = gstStr ? (parseFloat(gstStr) || 0) : 0;
                const addedBy = (itemData.addedby || CURRENT_USER_EMAIL || '').trim() || CURRENT_USER_EMAIL;

                if (!productId || !productName || !type || isNaN(price) || price < 0 || !itemUrl) {
                    continue;
                }

                // Check for unique URL
                if (existingUrls.has(itemUrl)) {
                    continue;
                }

                // Check if product ID already exists (to update or skip)
                const existingItemIndex = items.findIndex(item => item.productId === productId);
                const newItem = {
                    productId,
                    itemUrl,
                    productName,
                    type,
                    price,
                    gst: gst,
                    description,
                    dateAdded: new Date().toLocaleDateString('en-IN'),
                    addedBy: addedBy,
                    photo: '' // Empty photo for imported items
                };

                if (existingItemIndex > -1) {
                    // Update existing item (merge with new data, keep original date/addedBy/photo if not provided)
                    const originalItem = items[existingItemIndex];
                    items[existingItemIndex] = { ...originalItem, ...newItem };
                    importCount++;
                } else {
                    // Add new item
                    items.push(newItem);
                    existingUrls.add(itemUrl);
                    importCount++;
                }
            }

            writeItems(items);
            alert(`${importCount} products imported/updated successfully!`);
            addLog('Data Imported', CURRENT_USER_ROLE, `Imported/Updated ${importCount} products from CSV`);
            showSection('itemsList');
        }

        // Custom CSV line parsing to handle commas and quotes inside fields
        function parseCsvLine(line) {
            const result = [];
            let current = '';
            let inQuotes = false;
            for (let i = 0; i < line.length; i++) {
                const char = line[i];
                if (char === '"') {
                    if (inQuotes && line[i + 1] === '"') {
                        // Escaped quote: "" -> "
                        current += '"';
                        i++;
                    } else {
                        inQuotes = !inQuotes;
                    }
                } else if (char === ',' && !inQuotes) {
                    result.push(current.trim());
                    current = '';
                } else {
                    current += char;
                }
            }
            result.push(current.trim());
            // Remove leading/trailing quotes from final values
            return result.map(s => {
                if (s.startsWith('"') && s.endsWith('"') && s.length > 1) {
                    return s.substring(1, s.length - 1).replace(/""/g, '"');
                }
                return s;
            });
        }

        // --- Customer Management ---
        async function renderCustomersList(searchFilter = '') {
            if (!AUTHORIZED_TO_VIEW_CUSTOMERS.includes(CURRENT_USER_ROLE)) return;

            let customers = [];
            try {
                const customersResponse = await getCustomers();
                customers = Array.isArray(customersResponse) ? customersResponse : (customersResponse?.data || []);
            } catch (e) {
                // Fallback: derive from quotations in localStorage
                const quotations = getQuotationsSync();
                const customersMap = new Map();
                if (Array.isArray(quotations)) {
                    quotations.forEach(q => {
                        const phone = q.customer?.phone || q.customerPhone;
                        if (!phone) return;
                        customersMap.set(phone, {
                            name: q.customer?.name || q.customerName || 'N/A',
                            email: q.customer?.email || q.customerEmail || 'N/A',
                            phone: phone,
                            address: q.customer?.address || q.customerAddress || 'N/A',
                            lastQuotationDate: q.dateCreated || q.created_at || 'N/A'
                        });
                    });
                }
                customers = Array.from(customersMap.values());
            }

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
                row.insertCell().textContent = customer.lastQuotationDate || 'N/A';
            });
        }

        // --- Customer Quotation Details Management ---
        async function renderCustomerDetailsList(searchFilter = '') {
            if (!AUTHORIZED_TO_VIEW_CUSTOMERS.includes(CURRENT_USER_ROLE)) return;

            let customers = [];
            try {
                const customersResponse = await getCustomers();
                customers = Array.isArray(customersResponse) ? customersResponse : (customersResponse?.data || []);
            } catch (e) {
                // Fallback: derive from quotations in localStorage
                const quotations = getQuotationsSync();
                const customersMap = new Map();
                if (Array.isArray(quotations)) {
                    quotations.forEach(q => {
                        const phone = q.customer?.phone || q.customerPhone;
                        if (!phone) return;
                        customersMap.set(phone, {
                            name: q.customer?.name || q.customerName || 'N/A',
                            email: q.customer?.email || q.customerEmail || 'N/A',
                            phone: phone,
                            address: q.customer?.address || q.customerAddress || 'N/A',
                            lastQuotationDate: q.dateCreated || q.created_at || 'N/A'
                        });
                    });
                }
                customers = Array.from(customersMap.values());
            }

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
                const allQuotations = getQuotationsSync();
                const customerQuotationCount = allQuotations.filter(q => {
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

                if (pageInfo) {
                    const startItem = (customersCurrentPage - 1) * customersPerPage + 1;
                    const endItem = Math.min(customersCurrentPage * customersPerPage, totalItems);
                    pageInfo.textContent = `Page ${customersCurrentPage} of ${totalPages} • Showing ${startItem}-${endItem} of ${totalItems}`;
                }

                const maxPagesToShow = 7;
                let startPage, endPage;
                let showStartEllipsis = false;
                let showEndEllipsis = false;
                
                if (totalPages <= maxPagesToShow) {
                    startPage = 1;
                    endPage = totalPages;
                } else {
                    if (customersCurrentPage <= 4) {
                        startPage = 1;
                        endPage = maxPagesToShow - 1;
                        showEndEllipsis = true;
                    } else if (customersCurrentPage >= totalPages - 3) {
                        startPage = totalPages - (maxPagesToShow - 2);
                        endPage = totalPages;
                        showStartEllipsis = true;
                    } else {
                        startPage = customersCurrentPage - 2;
                        endPage = customersCurrentPage + 2;
                        showStartEllipsis = true;
                        showEndEllipsis = true;
                    }
                }

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

            if (prevBtn) {
                prevBtn.disabled = customersCurrentPage <= 1;
            }
            if (nextBtn) {
                nextBtn.disabled = customersCurrentPage >= totalPages;
            }
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

                if (pageInfo) {
                    const startItem = (customerDetailsCurrentPage - 1) * customerDetailsPerPage + 1;
                    const endItem = Math.min(customerDetailsCurrentPage * customerDetailsPerPage, totalItems);
                    pageInfo.textContent = `Page ${customerDetailsCurrentPage} of ${totalPages} • Showing ${startItem}-${endItem} of ${totalItems}`;
                }

                const maxPagesToShow = 7;
                let startPage, endPage;
                let showStartEllipsis = false;
                let showEndEllipsis = false;
                
                if (totalPages <= maxPagesToShow) {
                    startPage = 1;
                    endPage = totalPages;
                } else {
                    if (customerDetailsCurrentPage <= 4) {
                        startPage = 1;
                        endPage = maxPagesToShow - 1;
                        showEndEllipsis = true;
                    } else if (customerDetailsCurrentPage >= totalPages - 3) {
                        startPage = totalPages - (maxPagesToShow - 2);
                        endPage = totalPages;
                        showStartEllipsis = true;
                    } else {
                        startPage = customerDetailsCurrentPage - 2;
                        endPage = customerDetailsCurrentPage + 2;
                        showStartEllipsis = true;
                        showEndEllipsis = true;
                    }
                }

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

            if (prevBtn) {
                prevBtn.disabled = customerDetailsCurrentPage <= 1;
            }
            if (nextBtn) {
                nextBtn.disabled = customerDetailsCurrentPage >= totalPages;
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
                const allQuotations = getQuotationsSync();
                
                // Filter quotations for this customer
                const customerQuotations = allQuotations.filter(q => {
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
                    <td colspan="8">
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


        // --- Quotation Creation ---

        // Dynamic type filters for "Add Items to Quotation" — fetched from database (GET /settings → quotationTypeFilters)
        async function renderQuotationTypeFilters(items = null) {
            const container = document.getElementById('quotationTypeFilters');
            if (!container) return;

            if (container.hasAttribute('data-rendered') && container.children.length > 0) {
                return;
            }

            const itemsData = items || window.cachedItems || [];
            let settings = {};
            try {
                const r = await apiFetch('/settings');
                settings = (r && r.data) ? r.data : (r || {});
            } catch (e) { /* use defaults */ }
            const DEFAULT_ORDER = ['cpu', 'cpu cooler', 'motherboard', 'memory', 'storage', 'graphic card', 'case', 'monitor'];
            let filtersFromDb = Array.isArray(settings.quotationTypeFilters) ? settings.quotationTypeFilters.slice() : [];
            if (filtersFromDb.length === 0) {
                const orderFromSettings = Array.isArray(settings.quotationItemTypeOrder) && settings.quotationItemTypeOrder.length > 0
                    ? settings.quotationItemTypeOrder.slice()
                    : DEFAULT_ORDER.slice();
                const productTypesFromSettings = Array.isArray(settings.productTypes) ? settings.productTypes.slice() : [];
                const seenMerge = new Set();
                orderFromSettings.forEach(function (t) {
                    const v = String(t).toLowerCase().trim();
                    if (v && !seenMerge.has(v)) { seenMerge.add(v); filtersFromDb.push(String(t).trim()); }
                });
                productTypesFromSettings.forEach(function (t) {
                    const v = String(t).toLowerCase().trim();
                    if (v && !seenMerge.has(v)) { seenMerge.add(v); filtersFromDb.push(String(t).trim()); }
                });
            }
            const typesFromItems = [...new Set(itemsData.map(item => item.type).filter(Boolean))];
            const seen = new Set();
            const orderedPairs = [];
            orderedPairs.push({ value: '', label: 'All' });
            seen.add('');
            filtersFromDb.forEach(function (t) {
                const v = String(t).toLowerCase().trim();
                if (v && !seen.has(v)) { seen.add(v); orderedPairs.push({ value: v, label: String(t).trim() }); }
            });
            typesFromItems.sort((a, b) => String(a).localeCompare(String(b), 'en-IN', { sensitivity: 'base' }));
            typesFromItems.forEach(function (t) {
                const v = String(t).toLowerCase().trim();
                if (v && !seen.has(v)) { seen.add(v); orderedPairs.push({ value: v, label: String(t).trim() }); }
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
                btn.style.fontWeight = '500';
                btn.style.transition = 'all 0.2s';
                btn.style.display = 'inline-flex';
                btn.style.alignItems = 'center';
                btn.style.justifyContent = 'center';
                btn.style.minWidth = 'fit-content';
                return btn;
            }

            orderedPairs.forEach(function (p, idx) {
                const isActive = idx === 0;
                container.appendChild(createButton(p.label, p.value, isActive));
            });

            container.setAttribute('data-rendered', 'true');
        }

        async function renderAvailableItemsForQuotation(searchTerm = '', typeFilter = '', items = null) {
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

                const normalizedFilter = searchTerm.toLowerCase();
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

                let order = DEFAULT_QUOTATION_ITEM_TYPE_ORDER;
                try {
                    const s = await apiFetch('/settings');
                    const data = s && (s.data || s);
                    if (data && Array.isArray(data.quotationItemTypeOrder) && data.quotationItemTypeOrder.length > 0) order = data.quotationItemTypeOrder;
                } catch (e) { }
                const sortOrder = order;
                filteredItems.sort((a, b) => {
                    const catA = getQuotationCategorySortIndex(a.type, sortOrder);
                    const catB = getQuotationCategorySortIndex(b.type, sortOrder);
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
                            <br><span class="muted" style="font-size:12px">${item.type || 'N/A'} | ${formatRupee(price)}</span>
                        </div>
                        <button class="btn primary" onclick="addItemToQuotation('${productId}')"><i class="fas fa-plus"></i> Add</button>
                    `;

                    listDiv.appendChild(itemDiv);
                });
            } catch (error) {
                console.error('Error in renderAvailableItemsForQuotation:', error);
                const listDiv = document.getElementById('availableItemsList');
                if (listDiv) {
                    listDiv.innerHTML = '<p class="muted" style="padding:10px;text-align:center">Error loading products.</p>';
                }
            }
        }

        async function addItemToQuotation(productId) {
            // Always use items table for create quotation section (not temp table)
            const items = await getItems();
            const itemToAdd = items.find(i => i.productId === productId);
            
            if (!itemToAdd) return;

            const existingItem = quotationItems.find(qi => qi.productId === productId);
            if (existingItem) {
                existingItem.quantity += 1;
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
                        // For now, we'll keep the edited price in the quotation
                    }
                } catch (tempError) {
                    console.warn('Failed to save to temp table:', tempError);
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

            const sortedItems = [...quotationItems].sort((a, b) => getQuotationCategorySortIndex(a.type, DEFAULT_QUOTATION_ITEM_TYPE_ORDER) - getQuotationCategorySortIndex(b.type, DEFAULT_QUOTATION_ITEM_TYPE_ORDER));
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

                // Actions column – delete item
                const actionsCell = row.insertCell();
                const removeBtn = document.createElement('button');
                removeBtn.className = 'btn danger';
                removeBtn.style.padding = '5px 8px';
                removeBtn.title = 'Remove item from quotation';
                removeBtn.innerHTML = '<i class="fas fa-trash-alt"></i> Delete';
                removeBtn.onclick = function () { removeItemFromQuotation(item.productId); };
                actionsCell.appendChild(removeBtn);
            });
        }

        function updateGrandTotal() {
            let subTotal = quotationItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);

            const discountPercent = parseFloat(document.getElementById('discount-percent')?.value || 0);

            let discountAmount = (subTotal * (discountPercent / 100));
            let totalAfterDiscount = subTotal - discountAmount;

            let totalGstAmount = quotationItems.reduce((sum, item) => {
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

        /** Redirect to create quotation section with quotation data loaded (like owner – API first, then local fallback). */
        async function editQuotationInCreateSection(quotationId) {
            if (!AUTHORIZED_TO_CREATE_QUOTATIONS.includes(CURRENT_USER_ROLE) && !AUTHORIZED_TO_EDIT_ITEMS.includes(CURRENT_USER_ROLE)) {
                alert('You are not authorized to edit quotations.');
                return;
            }
            try {
                let quote = null;
                const data = await apiFetch(`/quotations/${quotationId}`);
                if (data) quote = data?.data || data;
                if (!quote || (!quote.quotationId && !quote.id)) {
                    const local = getQuotationsSync();
                    const found = Array.isArray(local) ? local.find(q => (q.quotationId || q.id) === quotationId) : null;
                    if (found) {
                        quote = {
                            quotationId: found.quotationId || found.id,
                            id: found.id || found.quotationId,
                            customer: found.customer || { name: found.customerName, phone: found.customerPhone, email: found.customerEmail, address: found.customerAddress },
                            customerName: found.customerName,
                            customerPhone: found.customerPhone,
                            customerEmail: found.customerEmail,
                            customerAddress: found.customerAddress,
                            items: found.items || [],
                            discountPercent: found.discountPercent != null ? found.discountPercent : 0,
                            images: Array.isArray(found.images) ? found.images : []
                        };
                    }
                }
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
                if (typeof setAccountantUploadedImages === 'function') setAccountantUploadedImages(Array.isArray(quote.images) && quote.images.length > 0 ? [quote.images[0]] : []);
                renderQuotationItems();
                updateGrandTotal();
                const createBtn = document.getElementById('createQuotationBtn');
                if (createBtn) createBtn.innerHTML = '<i class="fas fa-edit"></i> Edit Quotation';
                document.querySelectorAll('#sideNav a[data-tab="createQuotation"], .tab-btn[data-tab="createQuotation"]').forEach(el => { el.innerHTML = el.tagName === 'A' ? '<i class="fas fa-file-invoice-dollar"></i> Edit Quotation' : 'Edit Quotation'; });
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

        function cancelEditInCreateSection() {
            if (!currentEditQuotationId) return;
            currentEditQuotationId = null;
            const createBtn = document.getElementById('createQuotationBtn');
            if (createBtn) createBtn.textContent = 'Create Quotation';
            document.querySelectorAll('#sideNav a[data-tab="createQuotation"], .tab-btn[data-tab="createQuotation"]').forEach(el => { if (el.tagName === 'A') el.innerHTML = '<i class="fas fa-file-invoice-dollar"></i> Create quotation'; else el.textContent = 'Create quotation'; });
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
            if (typeof setAccountantUploadedImages === 'function') setAccountantUploadedImages([]);
            renderQuotationItems();
            updateGrandTotal();
        }

        async function createQuotation() {
            if (!AUTHORIZED_TO_CREATE_QUOTATIONS.includes(CURRENT_USER_ROLE)) {
                alert('You are not authorized to create quotations.');
                addLog('Unauthorized Attempt', CURRENT_USER_ROLE, `Tried to create quotation`);
                return;
            }

            // Edit mode: update existing quotation via create section (same flow as resume drafts)
            if (currentEditQuotationId) {
                const qid = currentEditQuotationId;
                const customerName = document.getElementById('cust-name')?.value.trim() || null;
                const phoneNumber = document.getElementById('phone-number')?.value.trim();
                const customerEmail = document.getElementById('cust-email')?.value.trim() || null;
                const customerAddress = document.getElementById('cust-address')?.value.trim() || null;
                if (!phoneNumber || phoneNumber.length !== 10) {
                    alert('Please enter a valid 10-digit phone number for the customer.');
                    return;
                }
                if (quotationItems.length === 0) {
                    alert('Please add at least one item to the quotation.');
                    return;
                }
                const discountPercent = parseFloat(document.getElementById('discount-percent')?.value || 0);
                const cust = { name: customerName || '', phone: phoneNumber, email: customerEmail || null, address: customerAddress || null };
                const itemsForUpdate = quotationItems.filter(it => it.productName && (parseFloat(it.price) || 0) > 0).map((it, idx) => ({
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
                const imagesForSave = (typeof getAccountantUploadedImages === 'function' ? getAccountantUploadedImages() : []) || [];
                const applyEditSuccess = () => {
                    currentEditQuotationId = null;
                    const createBtn = document.getElementById('createQuotationBtn');
                    if (createBtn) createBtn.innerHTML = '<i class="fas fa-file-invoice-dollar"></i> Create Quotation';
                    document.querySelectorAll('#sideNav a[data-tab="createQuotation"], .tab-btn[data-tab="createQuotation"]').forEach(el => { el.innerHTML = el.tagName === 'A' ? '<i class="fas fa-file-invoice-dollar"></i> Create quotation' : 'Create quotation'; });
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
                    if (typeof clearAccountantImageUpload === 'function') clearAccountantImageUpload();
                    renderQuotationItems();
                    updateGrandTotal();
                    renderHistoryList();
                    renderCustomerDetailsList();
                    addLog('Quotation Updated', CURRENT_USER_ROLE, `Updated quotation: ${qid}`);
                    alert('Quotation updated successfully.');
                };
                try {
                    const headers = { 'Content-Type': 'application/json' };
                    if (CURRENT_USER_EMAIL) headers['X-User-Email'] = CURRENT_USER_EMAIL;
                    const res = await apiFetch(`/quotations/${qid}/update`, {
                        method: 'POST',
                        headers,
                        body: JSON.stringify({ customer: cust, items: itemsForUpdate, discountPercent, images: imagesForSave })
                    });
                    if (res && (res.success !== false)) {
                        try {
                            const list = await apiFetch('/quotations');
                            const arr = Array.isArray(list) ? list : (list && list.data);
                            if (arr) writeQuotations(arr);
                        } catch (e) { /* sync from API */ }
                        applyEditSuccess();
                    } else {
                        alert(res?.message || 'Failed to update quotation.');
                    }
                } catch (e) {
                    const list = getQuotationsSync();
                    const idx = Array.isArray(list) ? list.findIndex(q => (q.quotationId || q.id) === qid) : -1;
                    if (idx >= 0) {
                        let subTotal = itemsForUpdate.reduce((s, it) => s + it.price * (it.quantity || 1), 0);
                        const discountAmount = subTotal * (discountPercent / 100);
                        const totalAfterDiscount = subTotal - discountAmount;
                        const totalGst = itemsForUpdate.reduce((s, it) => s + (it.price * (it.quantity || 1) * (it.gstRate || 0) / 100), 0);
                        const grandTotal = totalAfterDiscount + totalGst;
                        const updated = {
                            ...list[idx],
                            quotationId: qid,
                            id: list[idx].id || qid,
                            customer: cust,
                            customerName: cust.name,
                            customerPhone: cust.phone,
                            customerEmail: cust.email,
                            customerAddress: cust.address,
                            items: itemsForUpdate,
                            discountPercent,
                            images: imagesForSave,
                            grandTotal,
                            dateCreated: list[idx].dateCreated || list[idx].created_at,
                            created_at: list[idx].created_at || list[idx].dateCreated
                        };
                        const newList = list.slice();
                        newList[idx] = updated;
                        writeQuotations(newList);
                        applyEditSuccess();
                    } else {
                        console.error('Update quotation error:', e);
                        alert('Failed to update quotation.');
                    }
                }
                return;
            }

            const customerName = document.getElementById('cust-name')?.value.trim() || null;
            const phoneNumber = document.getElementById('phone-number')?.value.trim();
            const customerEmail = document.getElementById('cust-email')?.value.trim() || null;
            const customerAddress = document.getElementById('cust-address')?.value.trim() || null;
            const items = quotationItems.map(item => ({...item})); // Deep copy

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

            const quotationId = generateProductId().replace('P', 'Q');
            const dateCreated = new Date().toLocaleDateString('en-IN'); 
            
            // Recalculate totals for storage
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
            
            const validityDays = readLS(LS_KEYS.validityDays) || 3;

            const newQuotation = {
                quotationId,
                dateCreated,
                customer: {
                    name: customerName || null,
                    phone: phoneNumber,
                    email: customerEmail || null,
                    address: customerAddress || null
                },
                items,
                images: (typeof getAccountantUploadedImages === 'function' ? getAccountantUploadedImages() : []) || [],
                subTotal,
                discountPercent,
                discountAmount,
                totalGstAmount,
                grandTotal,
                createdBy: CURRENT_USER_EMAIL,
                validityDays 
            };

            let quotations = getQuotationsSync();
            quotations.push(newQuotation);
            writeQuotations(quotations);

            addLog('Quotation Created', CURRENT_USER_ROLE, `Created quotation ${quotationId} for ${customerName || phoneNumber}`);
            
            // Download as PDF
            await downloadQuotationAsPdfDirect(newQuotation).catch(() => {
                // Silent fail for PDF generation
            });

            // Reset form and view
            quotationItems = [];
            isCreatingNewQuotation = true; // Reset to create mode for next quotation
            document.getElementById('cust-name').value = '';
            document.getElementById('phone-number').value = '';
            document.getElementById('cust-email').value = '';
            document.getElementById('cust-address').value = '';
            const discountPercentInput = document.getElementById('discount-percent');
            if (discountPercentInput) discountPercentInput.value = 0;
            if (typeof clearAccountantImageUpload === 'function') clearAccountantImageUpload();
            renderQuotationItems();
            updateGrandTotal();
            showSection('viewHistory');
        }

        // --- History & PDF Generation ---

        function renderHistoryList() {
            const quotations = getQuotationsSync();
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

            const isAuthorizedToDeleteQuotations = AUTHORIZED_TO_DELETE_QUOTATIONS.includes(CURRENT_USER_ROLE);

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
                let actionsHtml = `
                    <button class="btn primary" style="padding: 5px 8px; margin-right: 5px;" onclick="viewQuotationPdf('${quoteId}')" title="Download PDF"><i class="fas fa-download"></i></button>
                    <button class="btn secondary" style="padding: 5px 8px; margin-right: 5px;" onclick="viewQuotationDetails('${quoteId}')" title="View"><i class="fas fa-eye"></i></button>
                    <button class="btn" style="padding: 5px 8px; margin-right: 5px;" onclick="editQuotationInCreateSection('${quoteId}')" title="Edit"><i class="fas fa-edit"></i></button>
                `;
                if (isAuthorizedToDeleteQuotations) {
                    actionsHtml += `<button class="btn danger" style="padding: 5px 8px;" onclick="deleteQuotation('${quoteId}')" title="Delete Quotation"><i class="fas fa-trash-alt"></i></button>`;
                }
                actionsCell.innerHTML = actionsHtml;
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
            const quotations = getQuotationsSync();
            const totalPages = Math.ceil(quotations.length / historyPerPage);
            if (historyCurrentPage > totalPages) historyCurrentPage = totalPages;
            renderHistoryList();
        }

        async function viewQuotationPdf(quotationId) {
            try {
                const quotations = getQuotationsSync();
                let quotation = Array.isArray(quotations) ? quotations.find(q => (q.quotationId || q.id) === quotationId) : null;
                if (!quotation) {
                    const response = await apiFetch(`/quotations/${quotationId}`);
                    if (response) quotation = Array.isArray(response) ? response[0] : (response.data || response);
                }
                
                if (!quotation) {
                    alert('Quotation not found.');
                    return;
                }
                
                // Download as PDF
                await downloadQuotationAsPdfDirect(quotation);
            } catch (error) {
                console.error('Error downloading quotation PDF:', error);
                alert('Failed to download quotation as PDF.');
            }
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

                const PRODUCTS_PER_PAGE = 8;
                const rawItems = quotation.items || quotation.products || quotation.lineItems || [];
                const itemsCount = Array.isArray(rawItems) ? rawItems.length : 0;
                const totalPages = Math.max(1, Math.ceil(itemsCount / PRODUCTS_PER_PAGE));

                const { jsPDF } = window.jspdf;
                const doc = new jsPDF({ unit: 'pt', format: 'a4', compress: true });
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
                const quotations = getQuotationsSync();
                let quote = Array.isArray(quotations) ? quotations.find(q => (q.quotationId || q.id) === quotationId) : null;
                if (!quote) {
                    const response = await apiFetch(`/quotations/${quotationId}`);
                    if (response) quote = Array.isArray(response) ? response[0] : (response.data || response);
                }

                if (!quote) {
                    alert('Quotation not found.');
                    return;
                }

                // Generate quotation HTML with logo for modal view (same as owner.js)
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
            } catch (error) {
                console.error('Error viewing quotation:', error);
                alert('Failed to fetch quotation details.');
            }
        }

        async function generateQuotationPdf(quotation) {
            const pdfTemplate = document.getElementById('quotationPdfTemplate');
            
            if (!pdfTemplate) {
                alert('PDF template element not found.');
                return;
            }

            const templateHtml = await generateQuotationHtml(quotation);
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
                
                const { jsPDF } = window.jspdf;
                
                // Always use A4 size
                const imgWidth = 595.28; // A4 width in pt
                const pageHeight = 841.89; // A4 height in pt (minimum)
                const imgHeight = (canvas.height * imgWidth) / canvas.width;
                
                // Create A4 document
                const doc = new jsPDF({
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

                // Get customer name for filename (same as owner.js)
                const customer = quotation?.customer || {};
                const customerName = customer?.name || customer?.phone || quotation?.quotationId || quotation?.id || 'Unknown';
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

        async function getSettings() {
            try {
                const response = await apiFetch('/settings');
                if (response && response.data) {
                    return response.data;
                }
            } catch (error) {
                // Fallback to localStorage
            }
            // Fallback to localStorage
            return {
                logo: readLS(LS_KEYS.logo) || '',
                brand: readLS(LS_KEYS.brand) || 'RoleWise Tech',
                companyGstId: readLS(LS_KEYS.companyGstId) || 'N/A',
                validityDays: readLS(LS_KEYS.validityDays) || 3,
                companyAddress: '1102, second Floor, Before Atithi Satkar Hotel OTC Road, Bangalore 560002',
                companyEmail: 'advanceinfotech21@gmail.com'
            };
        }

        async function generateQuotationHtml(quotation, options = {}) {
            const settings = await getSettings();
            const logoBase64 = settings.logo || '';
            const brandName = settings.brand || 'TECHTITANS';
            const companyGstId = settings.companyGstId || 'N/A';
            const validityDays = quotation.validityDays || settings.validityDays || 3;

            // Get PDF theme colors and fonts (same as owner.js)
            const pdfThemeName = getEffectivePdfThemeKey(settings);
            const themeMap = getEffectivePdfThemes();
            const theme = themeMap[pdfThemeName] || themeMap.default;
            const pdfFontPrimary = getPdfFontFamilyCss(getEffectivePdfFontPrimary());
            const pdfFontSecondary = getPdfFontFamilyCss(getEffectivePdfFontSecondary());
            const pdfFontTertiary = getPdfFontFamilyCss(getEffectivePdfFontTertiary());
            
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
            let items = quotation.items || quotation.products || quotation.lineItems || [];
            items = Array.isArray(items) ? items : [];
            
            // Fetch temp items and replace quotation items with temp table data
            let priceUpdated = false;
            try {
                const tempItemsResponse = await apiFetch('/temp');
                const tempItems = Array.isArray(tempItemsResponse) ? tempItemsResponse : (tempItemsResponse?.data || []);
                const tempItemsMap = new Map(tempItems.map(item => [item.productId, item]));
                
                // Replace items with temp table data if available, otherwise keep original
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

    // Apply Quotation Items display order from Settings to PDF (same order as Create/Edit UI; persists after product edits)
    const rawOrder = (settings && (settings.quotationItemTypeOrder || settings.quotationTypeFilters)) || [];
    const displayOrder = Array.isArray(rawOrder) && rawOrder.length > 0
        ? rawOrder.map(function (x) { return (x || '').toString().toLowerCase().trim(); }).filter(Boolean)
        : DEFAULT_QUOTATION_ITEM_TYPE_ORDER.slice();
    if (displayOrder.length > 0) {
        items = items.slice().sort(function (a, b) {
            return getQuotationCategorySortIndex(a.type, displayOrder) - getQuotationCategorySortIndex(b.type, displayOrder);
        });
    }
    
    // ALWAYS recalculate totals from items (same as owner.js)
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
    subTotal = newSubTotal;
    discountAmount = newDiscountAmount;
    totalAfterDiscount = newTotalAfterDiscount;
    totalGstAmount = newTotalGstAmount;
    grandTotal = newGrandTotal;
    
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

            const fallbackLogoUrl = (typeof window !== 'undefined' && window.location && window.location.pathname) ? (window.location.pathname.replace(/\/[^/]*$/, '') || '') + '/images/Logo.png' : 'images/Logo.png';
            const logoImgHtml = options.includeLogo ? `<div style="position: absolute; top: 20px; left: 56px; z-index: 10;"><img src="${logoBase64 || fallbackLogoUrl}" alt="Logo" style="width: 200px; height: auto; object-fit: contain;"></div>` : '';
            const customerImageSrc = (Array.isArray(quotation.images) && quotation.images[0]) ? (quotation.images[0].startsWith('data:') || quotation.images[0].startsWith('http') ? quotation.images[0] : (typeof window !== 'undefined' && window.location ? window.location.origin + (quotation.images[0].startsWith('/') ? '' : '/') + quotation.images[0] : quotation.images[0])) : null;
            const customerImageHtml = customerImageSrc ? `<div style="position: absolute; top: 20px; right: 56px; z-index: 10;"><img src="${customerImageSrc}" alt="Customer Image" style="width: 200px; height: auto; max-height: 200px; object-fit: contain; border-radius: 8px; border: 1px solid ${theme.border}; box-shadow: 0 2px 4px rgba(0,0,0,0.1);"></div>` : '';
            const headerLogoHtml = showHeaderSection ? logoImgHtml : '';
            const headerCustomerImageHtml = showHeaderSection ? customerImageHtml : '';

            if (options.page2Images && options.page2Images.length > 0) {
                const imagesGridHtml = options.page2Images.map(item => {
                    const imgSrc = item.image || '';
                    if (!imgSrc) return '';
                    return `<div style="margin-bottom: 24px; width: 100%; position: relative;"><img src="${imgSrc}" alt="Preview" style="width: 90%; max-height: 650px; margin: 0 auto; object-fit: contain; border: 1px solid ${theme.border}; border-radius: 8px; display: block;"><div style="position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; pointer-events: none;"><span style="font-size: 48px; font-weight: 700; color: rgba(255,255,255,0.45); letter-spacing: 0.15em; transform: rotate(-35deg); white-space: nowrap; text-shadow: 0 1px 3px rgba(0,0,0,0.4);">TECHTITANS</span></div></div>`;
                }).join('');
                return `<div style="width: 800px; min-height: 1123px; margin: 0; background: ${theme.pastelBg}; font-family: ${pdfFontTertiary}; padding: 48px 56px; position: relative; color: #1f2937; box-sizing: border-box;"><style>.theme-border { border-color: ${theme.border} !important; }</style>${headerLogoHtml}${headerCustomerImageHtml}${showHeaderSection ? `<div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 40px; margin-top: 120px;"><div><div style="font-size: 14px; font-weight: 600; color: ${theme.primary}; margin-top: 8px; margin-bottom: 4px;">AdvanceInfoTech</div><div style="font-size: 12px; color: #6b7280;">${companyAddress}</div><div style="font-size: 12px; color: #6b7280;">${companyEmail}</div><div style="font-size: 12px; color: #6b7280;">${companyPhone}</div></div><div style="flex: 1; text-align: center;"><h1 style="margin: 0; font-size: 26px; font-weight: 600; color: ${theme.primary}; letter-spacing: -0.02em; font-family: ${pdfFontPrimary};">Project Preview</h1></div><div style="width: 200px;"></div></div><div style="display: flex; justify-content: space-between; margin-bottom: 32px; padding-bottom: 24px; border-bottom: 1px solid ${theme.border};"><div>${(function() { const line1 = [customer?.name, customer?.phone, customer?.email].filter(Boolean); const addr = customer?.address; if (!line1.length && !addr) return ''; return `<div style="font-size: 14px; font-weight: 600; color: ${theme.primary}; margin-bottom: 4px;">Quotation to</div><div style="font-size: 12px; color: #374151;"><span style="font-weight: 600;">${line1.map((part, i) => (i ? ' <span style="font-weight: 700; margin: 0 0.35em;">|</span> ' : '') + part).join('')}</span>${addr ? '<br><span style="font-weight: 600;">' + addr + '</span>' : ''}</div>`; })()}</div><div style="text-align: right;"><div style="font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; color: #6b7280;">Date</div><div style="font-size: 14px;">${dateCreated}</div></div></div>` : ''}<div style="margin-top: 24px; margin-bottom: 24px;">${imagesGridHtml}</div>${showFooterSection ? `<div style="position: absolute; bottom: 48px; left: 56px; right: 56px; font-size: 14px; text-align: center; line-height: 1.7; color: #5c5c5c;"><div>All prices are valid for <span style="color: ${theme.primary}">${validityDays} days</span> from the date of quotation.</div><div>"<span style="color: ${theme.primary}">Free</span> pan India warranty" • <span style="color: ${theme.primary}">3-year</span> call support <span style="color: ${theme.accent}">Monday to Saturday 12pm to 7pm</span></div><div>All products from <span style="color: ${theme.primary}">direct manufacture</span> or <span style="color: ${theme.primary}">store warranty</span></div></div>` : ''}</div>`;
            }

            return `
                <div style="width: 800px; min-height: 1123px; margin: 0; background: ${theme.pastelBg}; font-family: ${pdfFontTertiary}; padding: 48px 56px; position: relative; color: #1f2937; box-sizing: border-box;">
                    <style>.q-table { width: 100%; border-collapse: collapse; margin: 24px 0; font-size: 14px; font-family: ${pdfFontSecondary}; }.q-table th { text-align: left; padding: 14px 12px; border-bottom: 2px solid ${theme.primary}; color: ${theme.secondary}; font-weight: 600; }.q-table td { padding: 14px 12px; border-bottom: 1px solid ${theme.border}; }.q-table .text-right { text-align: right; }.theme-header { color: ${theme.primary}; }.theme-accent { color: ${theme.accent}; }.theme-border { border-color: ${theme.border} !important; }</style>
                    ${headerLogoHtml}${headerCustomerImageHtml}
                    ${showHeaderSection ? `<div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 40px; margin-top: 120px;"><div><div style="font-size: 14px; font-weight: 600; color: ${theme.primary}; margin-top: 8px; margin-bottom: 4px;">AdvanceInfoTech</div><div style="font-size: 12px; color: #6b7280;">${companyAddress}</div><div style="font-size: 12px; color: #6b7280;">${companyEmail}</div><div style="font-size: 12px; color: #6b7280;">${companyPhone}</div></div><div style="flex: 1; text-align: center;"><h1 style="margin: 0; font-size: 26px; font-weight: 600; color: ${theme.primary}; letter-spacing: -0.02em; font-family: ${pdfFontPrimary};">Quotation</h1></div><div style="width: 200px;"></div></div>
                    <div style="display: flex; justify-content: space-between; margin-bottom: 32px; padding-bottom: 24px; border-bottom: 1px solid ${theme.border};"><div>${(function() { const line1 = [customer?.name, customer?.phone, customer?.email].filter(Boolean); const addr = customer?.address; if (!line1.length && !addr) return ''; return `<div style="font-size: 14px; font-weight: 600; color: ${theme.primary}; margin-bottom: 4px;">Quotation to</div><div style="font-size: 12px; color: #374151; "><span style="font-weight: 600;">${line1.map((part, i) => (i ? ' <span style="font-weight: 700; margin: 0 0.35em;">|</span> ' : '') + part).join('')}</span>${addr ? '<br><span style="font-weight: 600;">' + addr + '</span>' : ''}</div>`; })()}</div><div style="text-align: right;"><div style="font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; color: #6b7280;">Date</div><div style="font-size: 14px;">${dateCreated}</div></div></div>` : ''}
                    <table class="q-table"><thead><tr><th>S.No</th><th>Type</th><th>Description</th><th class="text-right">Qty</th><th class="text-right">Amount</th></tr></thead><tbody>${itemsForTable.length > 0 ? itemsForTable.map((item, idx) => { const itemPrice = parseFloat(item.price || 0); const itemQuantity = parseInt(item.quantity || 1); const itemTotal = itemPrice * itemQuantity; return `<tr><td>${snoOffset + idx + 1}</td><td>${item.type || 'N/A'}</td><td>${item.productName || 'N/A'}</td><td class="text-right">${itemQuantity}</td><td class="text-right">${formatRupee(itemTotal)}</td></tr>`; }).join('') : '<tr><td colspan="5" style="text-align: center; padding: 24px; color: #9ca3af;">No items</td></tr>'}</tbody></table>
                    ${showTotals ? `<div style="margin-top: 24px; text-align: right; padding-bottom: 24px; border-bottom: 1px solid ${theme.border};"><div style="display: inline-block; width: 260px; text-align: right;"><div style="display: flex; justify-content: space-between; padding: 8px 0; font-size: 14px;"><span style="color: #6b7280;">Subtotal (excl). GST)</span><span>${formatRupee(totalAfterDiscount)}</span></div><div style="display: flex; justify-content: space-between; padding: 12px 0; margin-top: 8px; border-top: 2px solid ${theme.primary}; font-size: 16px; font-weight: 600;"><span>Total</span><span>${formatRupee(grandTotal)}</span></div></div></div>` : ''}
                    ${showFooterSection ? `<div style="position: absolute; bottom: 48px; left: 56px; right: 56px; font-size: 14px; text-align: center; line-height: 1.7; color: #5c5c5c;">${pageNumFooter ? `<div style="margin-bottom: 8px; font-weight: 600;">${pageNumFooter}</div>` : ''}<div>All prices are valid for <span style="color: ${theme.primary}">${validityDays} days</span> from the date of quotation.</div><div>"<span style="color: ${theme.primary}">Free</span> pan India warranty" • <span style="color: ${theme.primary}">3-year</span> call support <span style="color: ${theme.accent}">Monday to Saturday 12pm to 7pm</span></div><div>All products from <span style="color: ${theme.primary}">direct manufacture</span> or <span style="color: ${theme.primary}">store warranty</span></div></div>` : ''}
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

        // --- Logo Handling (Settings) ---

        function handleLogoUpload(event) {
            if (!AUTHORIZED_TO_VIEW_SETTINGS.includes(CURRENT_USER_ROLE)) return; // Only those who can view settings can change logo

            const file = event.target.files[0];
            if (!file) return;

            const reader = new FileReader();
            reader.onload = function(e) {
                // Store as Base64 string
                writeLS(LS_KEYS.logo, e.target.result);
                renderSettings();
                const logoEl = document.querySelector('.sidebar .brand img');
                if (logoEl) logoEl.src = e.target.result;
                addLog('Setting Changed', CURRENT_USER_ROLE, 'Uploaded company logo');
                alert('Company logo uploaded successfully!');
            };
            reader.readAsDataURL(file);
        }

        // --- Log Management ---

        function renderLogsList() {
            if (!AUTHORIZED_TO_VIEW_LOGS.includes(CURRENT_USER_ROLE)) return;

            const logs = getLogsSync();
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
                row.insertCell().textContent = log.role;
                row.insertCell().textContent = log.action;
                row.insertCell().textContent = log.details;
            });
        }

        function deleteLog(logId) {
            logId = parseInt(logId);
            if (!AUTHORIZED_TO_DELETE_LOGS.includes(CURRENT_USER_ROLE)) {
                alert('You are not authorized to delete logs.');
                addLog('Unauthorized Attempt', CURRENT_USER_ROLE, `Tried to delete log entry: ${logId}`);
                return;
            }
            if (!confirm(`Are you sure you want to delete log entry: ${logId}?`)) return;

            let logs = getLogsSync();
            const index = logs.findIndex(l => l.id === logId);
            if (index > -1) {
                logs.splice(index, 1);
                writeLogs(logs);
                addLog('Log Deleted', CURRENT_USER_ROLE, `Deleted log entry: ${logId}`);
            }
        }

        // --- Settings Management ---

        function renderSettings() {
            const settingsEl = document.getElementById('settings');
            if (!settingsEl) return; // Settings section not on this page (e.g. accountant)
            if (!AUTHORIZED_TO_VIEW_SETTINGS.includes(CURRENT_USER_ROLE)) {
                // If not authorized, ensure the settings section remains hidden
                settingsEl.style.display = 'none';
                return;
            }
            
            const defaultGst = readLS(LS_KEYS.gst) || 18;
            const brandName = readLS(LS_KEYS.brand) || 'RoleWise';
            const companyGstId = readLS(LS_KEYS.companyGstId) || '';
            const validityDays = readLS(LS_KEYS.validityDays) || 3;
            const logoBase64 = readLS(LS_KEYS.logo) || '';
            const gstLastUpdated = readLS('rolewise_gst_updated') || 'N/A';
            const pdfTheme = readLS(LS_KEYS.pdfTheme) || 'default';
            
            const isAuthorized = AUTHORIZED_TO_FIX_GST.includes(CURRENT_USER_ROLE); // Only Owner/Admin/Manager can change these

            document.getElementById('settings-brand-name').value = brandName;
            document.getElementById('settings-company-gst-id').value = companyGstId;
            document.getElementById('settings-validity-days').value = validityDays;
            document.getElementById('validityDaysDisplay').textContent = validityDays;
            
            // PDF Theme
            document.getElementById('settings-pdf-theme').value = pdfTheme;
            updateThemePreview(pdfTheme);

            // Disable inputs if not authorized
            document.getElementById('settings')?.querySelectorAll('input, button, select, textarea').forEach(element => {
                element.disabled = !isAuthorized;
            });
            
            // Logo logic
            const logoPreview = document.getElementById('logoPreview');
            const noLogoText = document.getElementById('noLogoText');
            const removeLogoBtn = document.getElementById('removeLogoBtn');
            
            if (logoBase64) {
                logoPreview.src = logoBase64;
                logoPreview.style.display = 'block';
                noLogoText.style.display = 'none';
                removeLogoBtn.style.display = 'inline-flex';
                removeLogoBtn.disabled = !isAuthorized;
            } else {
                logoPreview.src = '';
                logoPreview.style.display = 'none';
                noLogoText.style.display = 'inline';
                removeLogoBtn.style.display = 'none';
            }

            // Re-enable the upload button (needs special handling since the parent div has the disabled loop above)
            document.getElementById('logoUploadInput').closest('div').querySelector('.btn').disabled = !isAuthorized;

        }


        document.getElementById('saveBrandNameBtn')?.addEventListener('click', function() {
            if (!AUTHORIZED_TO_VIEW_SETTINGS.includes(CURRENT_USER_ROLE)) {
                alert('You are not authorized to manage settings.');
                return;
            }
            
            const brandNameInput = document.getElementById('settings-brand-name');
            const brandName = brandNameInput.value.trim();

            if (!brandName) {
                alert('Brand name cannot be empty.');
                return;
            }

            writeLS(LS_KEYS.brand, brandName);
            alert('Brand name saved successfully!');
            addLog('Setting Changed', CURRENT_USER_ROLE, `Updated brand name to ${brandName}`);
        });

        document.getElementById('saveCompanyGstIdBtn')?.addEventListener('click', function() {
            if (!AUTHORIZED_TO_VIEW_SETTINGS.includes(CURRENT_USER_ROLE)) {
                alert('You are not authorized to manage settings.');
                return;
            }
            
            const gstIdInput = document.getElementById('settings-company-gst-id');
            const gstId = gstIdInput.value.trim().toUpperCase();

            // Simple validation: 15 alphanumeric characters
            if (!/^[A-Z0-9]{15}$/.test(gstId)) {
                alert('Please enter a valid 15-character alphanumeric GSTIN.');
                return;
            }

            writeLS(LS_KEYS.companyGstId, gstId);
            alert('Company GST ID saved successfully!');
            addLog('Setting Changed', CURRENT_USER_ROLE, `Updated Company GST ID`);
        });

        document.getElementById('saveValidityBtn')?.addEventListener('click', function() {
            if (!AUTHORIZED_TO_VIEW_SETTINGS.includes(CURRENT_USER_ROLE)) {
                alert('You are not authorized to manage settings.');
                return;
            }
            
            const validityInput = document.getElementById('settings-validity-days');
            const validityDays = parseInt(validityInput.value);

            if (isNaN(validityDays) || validityDays < 1 || validityDays > 365) {
                alert('Please enter a valid number of days (1-365).');
                return;
            }

            writeLS(LS_KEYS.validityDays, validityDays);
            document.getElementById('validityDaysDisplay').textContent = validityDays;
            alert('Quotation validity saved successfully!');
            addLog('Setting Changed', CURRENT_USER_ROLE, `Updated quotation validity to ${validityDays} days`);
        });

        document.getElementById('removeLogoBtn')?.addEventListener('click', function() {
            if (!AUTHORIZED_TO_VIEW_SETTINGS.includes(CURRENT_USER_ROLE)) {
                alert('You are not authorized to manage settings.');
                return;
            }
            if (confirm('Are you sure you want to remove the company logo?')) {
                localStorage.removeItem(LS_KEYS.logo);
                renderSettings();
                const logoEl = document.querySelector('.sidebar .brand img');
                if (logoEl) logoEl.src = 'images/Logo.svg';
                addLog('Setting Changed', CURRENT_USER_ROLE, 'Removed company logo');
                alert('Company logo removed.');
            }
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

        const PDF_CUSTOM_THEMES_KEY = 'owner_pdf_custom_themes';
        const PDF_THEME_OVERRIDE_KEY = 'owner_pdf_theme_override';
        const PDF_FONT_PRIMARY_KEY = 'owner_pdf_font_primary';
        const PDF_FONT_SECONDARY_KEY = 'owner_pdf_font_secondary';
        const PDF_FONT_TERTIARY_KEY = 'owner_pdf_font_tertiary';
        function getEffectivePdfFontPrimary() { try { return localStorage.getItem(PDF_FONT_PRIMARY_KEY) || 'segoe'; } catch (e) { return 'segoe'; } }
        function getEffectivePdfFontSecondary() { try { return localStorage.getItem(PDF_FONT_SECONDARY_KEY) || 'segoe'; } catch (e) { return 'segoe'; } }
        function getEffectivePdfFontTertiary() { try { return localStorage.getItem(PDF_FONT_TERTIARY_KEY) || 'segoe'; } catch (e) { return 'segoe'; } }
        function getPdfFontFamilyCss(fontKey) {
            const key = fontKey || 'segoe';
            const map = { segoe: "'Segoe UI', system-ui, -apple-system, sans-serif", arial: "Arial, Helvetica, sans-serif", helvetica: "Helvetica, Arial, sans-serif", verdana: "Verdana, Geneva, sans-serif", georgia: "Georgia, serif", times: "'Times New Roman', Times, serif", system: "system-ui, -apple-system, sans-serif" };
            return map[key] || map.segoe;
        }
        function getCustomPdfThemes() { try { const raw = localStorage.getItem(PDF_CUSTOM_THEMES_KEY); return raw ? JSON.parse(raw) : []; } catch (e) { return []; } }
        function getPdfThemeOverride() { try { return localStorage.getItem(PDF_THEME_OVERRIDE_KEY) || null; } catch (e) { return null; } }
        function getEffectivePdfThemes() {
            const custom = getCustomPdfThemes();
            const map = { ...PDF_THEMES };
            custom.forEach(function (t) { map[t.id] = { name: t.name, primary: t.primary, secondary: t.secondary, border: t.border, accent: t.accent || t.primary, pastelBg: t.pastelBg || '#f9fafb' }; });
            return map;
        }
        function getEffectivePdfThemeKey(settings) {
            const override = getPdfThemeOverride();
            if (override) return override;
            return (settings && settings.pdfTheme) ? settings.pdfTheme : (readLS(LS_KEYS.pdfTheme) || 'default');
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
                img.onload = function () { try { const c = document.createElement('canvas'); c.width = img.naturalWidth || 200; c.height = img.naturalHeight || 60; const ctx = c.getContext('2d'); ctx.drawImage(img, 0, 0); resolve(c.toDataURL('image/png')); } catch (_) { resolve(dataUrl); } };
                img.onerror = () => resolve(dataUrl);
                img.src = dataUrl;
            });
        }

        // Update theme preview when selection changes
        document.getElementById('settings-pdf-theme')?.addEventListener('change', function() {
            updateThemePreview(this.value);
        });

        // Save PDF theme
        document.getElementById('savePdfThemeBtn')?.addEventListener('click', function() {
            if (!AUTHORIZED_TO_VIEW_SETTINGS.includes(CURRENT_USER_ROLE)) {
                alert('You are not authorized to manage settings.');
                return;
            }
            const selectedTheme = document.getElementById('settings-pdf-theme').value;
            writeLS(LS_KEYS.pdfTheme, selectedTheme);
            addLog('Setting Changed', CURRENT_USER_ROLE, `Changed PDF theme to: ${selectedTheme}`);
            alert('PDF theme saved successfully!');
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


        /* ---------- Other Actions (UNCHANGED) ---------- */

        function deleteQuotation(quotationId) {
            if (!confirm(`Are you sure you want to delete quotation ID ${quotationId}?`)) return;

            if (!AUTHORIZED_TO_DELETE_QUOTATIONS.includes(CURRENT_USER_ROLE)) {
                alert('You are not authorized to delete quotations.');
                addLog('Unauthorized Attempt', CURRENT_USER_ROLE, `Tried to delete quotation: ${quotationId}`);
                return;
            }

            let quotations = getQuotationsSync();
            const index = quotations.findIndex(q => q.quotationId === quotationId);
            
            if (index > -1) {
                quotations.splice(index, 1);
                writeQuotations(quotations);
                addLog('Quotation Deleted', CURRENT_USER_ROLE, `Deleted quotation: ${quotationId}`);
            }
        }

        // --- Dashboard Summary ---

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
                const itemsCountEl = document.getElementById('summaryItemsCount');
                if (itemsCountEl) itemsCountEl.textContent = items.length || 0;

                const quotationsCountEl = document.getElementById('summaryQuotationsCount');
                if (quotationsCountEl) quotationsCountEl.textContent = quotations.length || 0;

                const logsCountEl = document.getElementById('summaryLogsCount');
                if (logsCountEl) logsCountEl.textContent = logs.length || 0;

                // Calculate total value
                const totalValue = quotations.reduce((sum, q) => {
                    const grandTotal = parseFloat(q.grandTotal) || 0;
                    return sum + grandTotal;
                }, 0);
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

                // Render recent quotations
                renderRecentQuotations(quotations);

                // Render recent activity
                renderRecentActivity(logs);
            } catch (error) {
                console.error('Error updating summary:', error);
                // Set default values on error
                const itemsCountEl = document.getElementById('summaryItemsCount');
                const quotationsCountEl = document.getElementById('summaryQuotationsCount');
                const logsCountEl = document.getElementById('summaryLogsCount');
                const totalValueElement = document.getElementById('summaryTotalValue');
                const customersCountElement = document.getElementById('summaryCustomersCount');
                const monthlyQuotationsCountElement = document.getElementById('summaryMonthlyQuotations');
                const monthlyValueElement = document.getElementById('summaryMonthlyValue');
                const avgQuotationElement = document.getElementById('summaryAvgQuotation');
                
                if (itemsCountEl) itemsCountEl.textContent = '0';
                if (quotationsCountEl) quotationsCountEl.textContent = '0';
                if (logsCountEl) logsCountEl.textContent = '0';
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
                const customerName = quote.customer?.name || quote.customerName || 'N/A';
                const customerPhone = quote.customer?.phone || quote.customerPhone || '';
                const grandTotal = parseFloat(quote.grandTotal) || 0;
                const itemsCount = quote.items?.length || 0;
                const quotationId = quote.quotationId || quote.id || 'N/A';
                
                return `
                    <div style="padding: 10px; border-bottom: 1px solid #f2f6fb; cursor: pointer;" 
                         onclick="viewQuotationPdf('${quotationId}')"
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
                const action = log.action || 'Unknown Action';
                const user = log.user || log.userEmail || 'Unknown';
                const role = log.role || 'Unknown';
                const details = log.details || '';
                const truncatedDetails = details.length > 50 ? details.substring(0, 50) + '...' : details;
                
                // Get icon based on action type
                let icon = 'fa-info-circle';
                let iconColor = '#3498DB';
                if (action.toLowerCase().includes('price')) {
                    icon = 'fa-rupee-sign';
                    iconColor = '#8E44AD';
                } else if (action.toLowerCase().includes('create') || action.toLowerCase().includes('add')) {
                    icon = 'fa-plus-circle';
                    iconColor = '#27AE60';
                } else if (action.toLowerCase().includes('delete') || action.toLowerCase().includes('remove')) {
                    icon = 'fa-trash-alt';
                    iconColor = '#E74C3C';
                } else if (action.toLowerCase().includes('update') || action.toLowerCase().includes('edit')) {
                    icon = 'fa-edit';
                    iconColor = '#F39C12';
                }
                
                return `
                    <div style="padding: 10px; border-bottom: 1px solid #f2f6fb;">
                        <div style="display: flex; align-items: flex-start; gap: 10px;">
                            <i class="fas ${icon}" style="color: ${iconColor}; font-size: 16px; margin-top: 2px;"></i>
                            <div style="flex: 1;">
                                <div style="font-weight: bold; color: #34495E; font-size: 13px;">${action}</div>
                                <div style="font-size: 11px; color: #7f8c8d; margin-top: 4px;">
                                    ${truncatedDetails ? `<span>${truncatedDetails}</span>` : ''}
                                </div>
                                <div style="font-size: 10px; color: #95a5a6; margin-top: 4px;">
                                    <i class="fas fa-user" style="margin-right: 4px;"></i>${user} (${role})
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

        document.getElementById('type')?.addEventListener('input', () => updateCompatFieldsVisibility('type', 'compatFieldsContainer'));
        document.getElementById('type')?.addEventListener('change', () => updateCompatFieldsVisibility('type', 'compatFieldsContainer'));
        document.getElementById('edit-type')?.addEventListener('input', () => updateCompatFieldsVisibility('edit-type', 'editCompatFieldsContainer'));
        document.getElementById('edit-type')?.addEventListener('change', () => updateCompatFieldsVisibility('edit-type', 'editCompatFieldsContainer'));
        document.getElementById('addItemForm')?.addEventListener('submit', saveItem);
        document.getElementById('editProductForm')?.addEventListener('submit', saveEditProduct);
        document.getElementById('closeEditProductModal')?.addEventListener('click', closeEditProductModal);
        document.getElementById('cancelEditProductBtn')?.addEventListener('click', closeEditProductModal);
        // Initialize edit product modal
        initEditProductModal();
        document.getElementById('addItemForm')?.addEventListener('reset', handleItemEditReset);
        document.getElementById('createQuotationBtn')?.addEventListener('click', createQuotation);
        document.getElementById('cancelEditInCreateSectionBtn')?.addEventListener('click', cancelEditInCreateSection);

        // --- Accountant Image Upload ---
        const ACC_MAX_IMAGE_MB = 10;
        const ACC_MAX_IMAGES = 1;
        const ACC_ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/jpg', 'image/gif', 'image/webp'];
        let accountantUploadedImages = [];
        function validateAccountantImageFile(file) {
            if (!ACC_ALLOWED_TYPES.includes(file.type)) return 'Invalid format. Use PNG, JPG, GIF or WebP.';
            if (file.size > ACC_MAX_IMAGE_MB * 1024 * 1024) return `File too large. Max ${ACC_MAX_IMAGE_MB}MB.`;
            return null;
        }
        function renderAccountantImagePreviews() {
            const c = document.getElementById('imagePreviewList');
            const p = document.getElementById('imagePreview');
            if (!c || !p) return;
            if (accountantUploadedImages.length === 0) { p.style.display = 'none'; return; }
            c.innerHTML = accountantUploadedImages.map((d, i) => `<div style="position:relative;"><img src="${d}" style="width:80px;height:80px;object-fit:cover;border-radius:6px;"><button type="button" class="acc-rm" data-i="${i}" style="position:absolute;top:-6px;right:-6px;width:22px;height:22px;border-radius:50%;border:none;background:#dc3545;color:white;cursor:pointer;">×</button></div>`).join('');
            p.style.display = 'block';
            c.querySelectorAll('.acc-rm').forEach(b => { b.onclick = () => { accountantUploadedImages.splice(parseInt(b.dataset.i), 1); renderAccountantImagePreviews(); }; });
        }
        function getAccountantUploadedImages() { return [...(accountantUploadedImages || [])]; }
        function setAccountantUploadedImages(arr) { accountantUploadedImages = Array.isArray(arr) ? arr : []; if (typeof renderAccountantImagePreviews === 'function') renderAccountantImagePreviews(); }
        function clearAccountantImageUpload() { accountantUploadedImages = []; const el = document.getElementById('quotation-image'); if (el) el.value = ''; renderAccountantImagePreviews(); }
        document.getElementById('quotation-image')?.addEventListener('change', function(e) {
            const file = e.target.files?.[0];
            if (!file) return;
            const err = validateAccountantImageFile(file);
            if (err) { alert(err); e.target.value = ''; return; }
            const r = new FileReader();
            r.onload = (ev) => { accountantUploadedImages = [ev.target.result]; renderAccountantImagePreviews(); };
            r.readAsDataURL(file);
            e.target.value = '';
        });
        document.getElementById('removeAllImagesBtn')?.addEventListener('click', clearAccountantImageUpload);
        document.getElementById('itemSearchInput')?.addEventListener('input', (e) => {
            const activeTypeFilter = document.querySelector('.type-filter-btn.active')?.dataset.type || '';
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
            const activeTypeFilter = document.querySelector('.type-filter-btn.active')?.dataset.type || '';
            renderAvailableItemsForQuotation(searchValue, activeTypeFilter);
        });

        document.getElementById('compatibleFilterToggle')?.addEventListener('change', function() {
            const hint = document.getElementById('compatibleFilterHint');
            if (hint) hint.style.display = this.checked ? 'block' : 'none';
            const searchValue = document.getElementById('itemSearchInput')?.value || '';
            const activeTypeFilter = document.querySelector('.type-filter-btn.active')?.dataset.type || '';
            renderAvailableItemsForQuotation(searchValue, activeTypeFilter);
        });

        // Initial type filters for quotation section - wait for cached data
        if (window.cachedItems) {
            renderQuotationTypeFilters(window.cachedItems);
            renderAvailableItemsForQuotation('', '', window.cachedItems);
        } else {
            // If no cached data yet, fetch it once
            getItems().then(items => {
                renderQuotationTypeFilters(items);
                renderAvailableItemsForQuotation('', '', items);
            }).catch(err => {
                console.error('Error loading initial items:', err);
            });
        }

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

        document.getElementById('phone-number')?.addEventListener('input', function(e) {
            // Simple validation to show customer details if found in history
            const phone = e.target.value.trim();
            const detailDisplay = document.getElementById('customer-details-display');
            const customers = Array.from(readLS(LS_KEYS.quotations) || []).map(q => q.customer);
            const customer = customers.reverse().find(c => c.phone === phone); // Get most recent details

            const custDisplayName = document.getElementById('cust-display-name');
            const custDisplayPhone = document.getElementById('cust-display-phone');
            const custDisplayEmail = document.getElementById('cust-display-email');
            const custDisplayAddress = document.getElementById('cust-display-address');
            if (custDisplayName) custDisplayName.textContent = customer?.name || 'New Customer';
            if (custDisplayPhone) custDisplayPhone.textContent = `Phone: ${customer?.phone || 'N/A'}`;
            if (custDisplayEmail) custDisplayEmail.textContent = `Email: ${customer?.email || 'N/A'}`;
            if (custDisplayAddress) custDisplayAddress.textContent = `Address: ${customer?.address || 'N/A'}`;
            
            // Auto-fill other fields if customer is found and fields are empty
            if (customer) {
                if (!document.getElementById('cust-name').value.trim()) document.getElementById('cust-name').value = customer.name;
                if (!document.getElementById('cust-email').value.trim()) document.getElementById('cust-email').value = customer.email;
                if (!document.getElementById('cust-address').value.trim()) document.getElementById('cust-address').value = customer.address;
            }
        });
        
        // Modal logic
        const photoModal = document.getElementById("photoModal");
        const closeModalBtn = document.getElementById("closeModalBtn");

        closeModalBtn.onclick = function() {
            photoModal.style.display = "none";
        }

        window.onclick = function(event) {
            if (event.target === photoModal) {
                photoModal.style.display = "none";
            }
        }

        // --- Number to Words Converter (Simplified for Rupee in Lakhs/Crores) ---

        const numberToWords = {
            toWords: function(num) {
                if (num === 0) return 'zero';
                num = Math.round(num); // Ensure integer for word conversion
                const a = ['', 'one ', 'two ', 'three ', 'four ', 'five ', 'six ', 'seven ', 'eight ', 'nine ', 'ten ', 'eleven ', 'twelve ', 'thirteen ', 'fourteen ', 'fifteen ', 'sixteen ', 'seventeen ', 'eighteen ', 'nineteen '];
                const b = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];
                const numString = String(num);
                
                // Indian Numbering System Logic (Lakhs and Crores)
                let s = numString;
                let finalWords = '';

                // Helper to convert up to 999
                const helper = (n) => {
                    let str = '';
                    if (n < 20) {
                        str = a[n];
                    } else if (n < 100) {
                        str = b[Math.floor(n / 10)] + (n % 10 !== 0 ? ' ' + a[n % 10] : '');
                    } else {
                        str = a[Math.floor(n / 100)] + 'hundred ' + helper(n % 100);
                    }
                    return str.trim();
                };

                // Crores
                if (s.length > 7) {
                    const crorePart = parseInt(s.substring(0, s.length - 7));
                    finalWords += helper(crorePart) + 'crore ';
                    s = s.substring(s.length - 7);
                }

                // Lakhs
                if (s.length > 5 && parseInt(s.substring(0, 2)) !== 0) {
                    const lakhPart = parseInt(s.substring(0, 2));
                    finalWords += helper(lakhPart) + 'lakh ';
                    s = s.substring(2);
                }

                // Thousands
                if (s.length > 3 && parseInt(s.substring(0, 2)) !== 0) {
                    const thousandPart = parseInt(s.substring(0, 2));
                    finalWords += helper(thousandPart) + 'thousand ';
                    s = s.substring(2);
                }

                // Hundreds, Tens, Ones
                if (parseInt(s) !== 0) {
                    finalWords += helper(parseInt(s));
                }

                return finalWords.trim();
            }
        };


        /* ---------- Initializers ---------- */

        async function initializeDashboard() {
            // Set initial user info
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
                if (logoEl && s && s.logo) logoEl.src = s.logo;
            }).catch(() => {});

            try {
                // Sync all quotations from API so Customer Quotation Details and History show every quotation (not just accountant-added)
                const qList = await getQuotations();
                if (Array.isArray(qList)) writeQuotations(qList);

                await Promise.all([
                    Promise.resolve(renderItemsList()).catch(err => console.error('Error rendering items list:', err)),
                    Promise.resolve(renderHistoryList()).catch(err => console.error('Error rendering history:', err)),
                    Promise.resolve(renderLogsList()).catch(err => console.error('Error rendering logs:', err)),
                    Promise.resolve(renderSettings()).catch(err => console.error('Error rendering settings:', err)),
                    Promise.resolve(updateSummary()).catch(err => console.error('Error updating summary:', err)),
                    Promise.resolve(renderCustomersList()).catch(err => console.error('Error rendering customers:', err)),
                    Promise.resolve(renderCustomerDetailsList()).catch(err => console.error('Error rendering customer details:', err))
                ]);
            } catch (error) {
                console.error('Error initializing dashboard:', error);
            }
            
            showSection('dashboard');
            
            updateGrandTotal(); 
            if (productIdInput) productIdInput.value = generateProductId();
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
                    'rolewise_session_timeout',
                    'rolewise_session_start'
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
                    'rolewise_session_timeout',
                    'rolewise_session_start'
                ];
                
                allKeys.forEach(key => {
                    localStorage.removeItem(key);
                });
                
                window.location.href = '/login.html';
            }
        }

        // Function to handle unauthorized access
        function redirectToLogin() {
            // Clear all session data (both standard and custom keys)
            localStorage.removeItem(LS_KEYS.roleStandard);
            localStorage.removeItem(LS_KEYS.userStandard);
            localStorage.removeItem(LS_KEYS.sessionExpiry);
            localStorage.removeItem('rolewise_user_email');
            localStorage.removeItem('rolewise_user_name');
            localStorage.removeItem('rolewise_user_id');
            localStorage.removeItem('rolewise_session_timeout');
            localStorage.removeItem('rolewise_session_start');
            writeLS(LS_KEYS.role, null);
            writeLS(LS_KEYS.user, null);
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
            
            // Expose functions to global scope for onclick handlers
            window.addItemToQuotation = addItemToQuotation;
            window.removeItemFromQuotation = removeItemFromQuotation;
            window.viewQuotationDetails = viewQuotationDetails;
            window.togglePriceSort = togglePriceSort;
            window.toggleTotalValueSort = toggleTotalValueSort;
            window.toggleNameSort = toggleNameSort;
            window.downloadSampleProductsCsv = downloadSampleProductsCsv;
            
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
    

