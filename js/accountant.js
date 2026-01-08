
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
            gstRules: 'rolewise_gst_rules'
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
        let isCreatingNewQuotation = true; // Track if we're creating a new quotation (true) or editing existing (false)
        let itemsCurrentPage = 1;
        const itemsPerPage = 5;
        let historyCurrentPage = 1;
        const historyPerPage = 10;
        let logsCurrentPage = 1;
        const logsPerPage = 10;
        let customersCurrentPage = 1;
        const customersPerPage = 10;

        const defaultPlaceholderImage = '<svg style="width:48px;height:48px;color:#9aa4ad" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#ccc" width="24px" height="24px"><path d="M0 0h24v24H0z" fill="none"/><path d="M22 16V4a2 2 0 00-2-2H4a2 2 0 00-2 2v12a2 2 0 002 2h16a2 2 0 002-2zm-11.5-3c.83 0 1.5-.67 1.5-1.5S11.33 10 10.5 10 9 10.67 9 11.5s.67 1.5 1.5 1.5zM20 18H4v-1.5l3.5-3.5 4.5 6 4-4 4 4z"/></svg>';

        // --- Utility Functions ---

        function formatRupee(amount) {
            return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(amount);
        }

        function toTitleCase(str) {
            return str.toLowerCase().split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
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
                const response = await fetch(`${API_BASE}${endpoint}`, fetchOptions);
                
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

        function writeQuotations(quotations) { writeLS(LS_KEYS.quotations, quotations); updateSummary(); renderHistoryList(); renderCustomersList(); }

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

        function getGstRateForItem(productName) {
            const rules = getGstRules();
            const rule = rules.find(r => r.productName.toLowerCase() === productName.toLowerCase());
            if (rule) return rule.percent;
            return parseFloat(readLS(LS_KEYS.gst) || 18); // Default to 18%
        }

        // --- UI Logic ---

        // Tab/Section Switching
        function showSection(sectionId) {
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
            document.getElementById('headerTitle').textContent = sectionTitles[sectionId] || 'RoleWise Dashboard';

            // Run render functions for the shown section
            if (sectionId === 'itemsList') {
                renderItemsList().catch(err => console.error('Error rendering items list:', err));
            } else if (sectionId === 'viewHistory') {
                renderHistoryList();
            } else if (sectionId === 'viewLogs') {
                renderLogsList();
            } else if (sectionId === 'viewCustomers') {
                renderCustomersList();
            } else if (sectionId === 'settings') {
                renderSettings();
            } else if (sectionId === 'addItem') {
                document.getElementById('product-id').value = generateProductId();
                handleItemEditReset();
            } else if (sectionId === 'createQuotation') {
                quotationItems = [];
                renderQuotationItems();
                updateGrandTotal();
                renderAvailableItemsForQuotation('', '');
            }
        }

        document.querySelectorAll('.sidebar, .main').forEach(container => {
            container.addEventListener('click', function(e) {
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
            document.getElementById('headerTitle').textContent = `${newRole} Dashboard`;

            addLog('Role Switched', newRole, `Switched to role: ${newRole}`);
            initializeDashboard(); // Re-initialize to apply new restrictions and views
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
            document.getElementById('navViewCustomers').style.display = isAuthorizedToViewCustomers ? 'flex' : 'none';

            // Tab Buttons
            document.getElementById('tabViewCustomers').style.display = isAuthorizedToViewCustomers ? 'block' : 'none';

            // Logs Card in Dashboard
            document.getElementById('summaryLogsCard').style.display = isOwnerAdminOrManager ? 'block' : 'none';

            // Add Item section visibility (Accountant has access)
            if (!isAuthorizedToEditItems) {
                 document.getElementById('addItem').style.display = 'none';
                 // If the current view is addItem and they lose access, switch to dashboard
                 if (document.getElementById('addItem').style.display !== 'none') {
                     showSection('dashboard');
                 }
            }


            // Delete Log Button visibility
            document.querySelectorAll('.delete-log-btn').forEach(btn => {
                btn.style.display = isAuthorizedToDeleteLogs ? 'inline-flex' : 'none';
            });
            
            // Edit/Delete Item buttons
            // Handled within renderItemsList but relies on AUTHORIZED_TO_EDIT_ITEMS
        }

        // --- Product/Item Management ---

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
                        productId: originalItem.productId, // ID remains the same
                        itemUrl,
                        productName: toTitleCase(productName),
                        type: toTitleCase(type),
                        price,
                        description,
                        dateAdded: originalItem.dateAdded, // Date and addedBy remain the same
                        addedBy: originalItem.addedBy,
                        photo: originalItem.photo // Photo remains the same
                    };
                    addLog('Product Updated', CURRENT_USER_ROLE, `Updated product: ${productName} (${productId})`);
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
                    photo: '' // Add empty photo field
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

            if (!AUTHORIZED_TO_EDIT_ITEMS.includes(CURRENT_USER_ROLE)) {
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
            const filteredItems = items.filter(item => 
                (item.productName && item.productName.toLowerCase().includes(searchTerm)) || 
                (item.productId && item.productId.toLowerCase().includes(searchTerm))
            );

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
                // Date Added - use created_at if available, otherwise dateAdded
                const dateAdded = item.created_at ? new Date(item.created_at).toLocaleDateString('en-IN') : (item.dateAdded || 'N/A');
                row.insertCell().textContent = dateAdded;

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
            const requiredHeaders = ["product id", "product name", "type", "price", "description", "website url"];
            if (!requiredHeaders.every(h => headers.includes(h))) {
                alert('CSV file is missing required columns: Product ID, Product Name, Type, Price, Description, Website URL.');
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
                    itemData[header.replace(/ /g, '')] = values[index];
                });

                const productId = itemData.productid.trim();
                const productName = toTitleCase(itemData.productname.trim());
                const type = toTitleCase(itemData.type.trim());
                const price = parseFloat(itemData.price.trim());
                const description = itemData.description.trim();
                const itemUrl = itemData.websiteurl.trim();

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
                    description,
                    dateAdded: new Date().toLocaleDateString('en-IN'),
                    addedBy: CURRENT_USER_EMAIL,
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
        function renderCustomersList() {
            if (!AUTHORIZED_TO_VIEW_CUSTOMERS.includes(CURRENT_USER_ROLE)) return;

            const quotations = getQuotationsSync();
            const customersMap = new Map(); // Key: phone number

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
                        renderCustomersList();
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
                        renderCustomersList();
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
                        renderCustomersList();
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

        function goToCustomersPage(direction) {
            const body = document.getElementById('customersListBody');
            if (!body) return;
            
            customersCurrentPage += direction;
            if (customersCurrentPage < 1) customersCurrentPage = 1;
            
            const quotations = getQuotationsSync();
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
        }


        // --- Quotation Creation ---

        // Dynamic type filters for "Add Items to Quotation"
        function renderQuotationTypeFilters() {
            const container = document.getElementById('quotationTypeFilters');
            if (!container) return;

            let items = [];
            try {
                items = getItemsSync();
            } catch (error) {
                items = [];
            }

            const types = [...new Set(items.map(item => item.type).filter(Boolean))]
                .sort((a, b) => a.localeCompare(b, 'en-IN', { sensitivity: 'base' }));

            const baseTypes = [
                { label: 'All', value: '' },
                { label: 'RAM', value: 'ram' },
                { label: 'GPU', value: 'gpu' },
                { label: 'Intel', value: 'intel' },
                { label: 'AMD', value: 'amd' },
                { label: 'Cabinet', value: 'cabinet' },
                { label: 'Cooler', value: 'cooler' },
                { label: 'HDD', value: 'hdd' },
                { label: 'SSD', value: 'ssd' }
            ];

            const baseValues = new Set(baseTypes.map(t => String(t.value).toLowerCase()));
            const extraTypes = types.filter(t => !baseValues.has(String(t).toLowerCase()));

            container.innerHTML = '';

            function createButton(label, value, isActive) {
                const btn = document.createElement('button');
                btn.className = 'type-filter-btn';
                if (isActive) btn.classList.add('active');
                btn.dataset.type = value;
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

        function renderAvailableItemsForQuotation(searchTerm = '', typeFilter = '') {
            const items = getItemsSync();
            const list = document.getElementById('availableItemsList');
            
            if (!list) {
                console.error('availableItemsList element not found');
                return;
            }
            
            list.innerHTML = '';
            
            searchTerm = searchTerm.toLowerCase().trim();
            const normalizedTypeFilter = typeFilter.toLowerCase();
            const filteredItems = items.filter(item => {
                const matchesSearch = !searchTerm || 
                    item.productName.toLowerCase().includes(searchTerm) || 
                    item.productId.toLowerCase().includes(searchTerm) || 
                    (item.type && item.type.toLowerCase().includes(searchTerm));
                let matchesType = true;
                if (normalizedTypeFilter) {
                    if (normalizedTypeFilter === 'intel') {
                        // Check if type field matches Intel category (case-insensitive)
                        const productType = (item.type || '').toLowerCase();
                        matchesType = productType === 'intel' || productType === 'intel processor' || productType.startsWith('intel');
                    } else if (normalizedTypeFilter === 'amd') {
                        // Check if type field matches AMD category (case-insensitive)
                        const productType = (item.type || '').toLowerCase();
                        matchesType = productType === 'amd' || productType === 'amd processor' || productType.startsWith('amd');
                    } else {
                        matchesType = (item.type && item.type.toLowerCase() === normalizedTypeFilter);
                    }
                }
                return matchesSearch && matchesType;
            });

            if (filteredItems.length === 0) {
                list.innerHTML = '<p class="muted" style="text-align:center;padding:10px;">No products found.</p>';
                return;
            }

            filteredItems.forEach(item => {
                const itemDiv = document.createElement('div');
                itemDiv.style.cssText = 'display:flex; justify-content:space-between; align-items:center; padding:8px 0; border-bottom:1px dashed var(--border);';
                
                const gstRate = getGstRateForItem(item.productName);

                itemDiv.innerHTML = `
                    <div style="font-size:14px;">
                        <strong>${item.productName}</strong> <span class="muted" style="font-size:12px;">(${item.productId})</span><br>
                        <span class="muted">${item.type} | ${formatRupee(item.price)}</span>
                    </div>
                    <div>
                        <button class="btn primary" style="padding: 5px 8px;" onclick="addItemToQuotation('${item.productId}')">
                            <i class="fas fa-plus"></i> Add
                        </button>
                    </div>
                `;
                list.appendChild(itemDiv);
            });
        }

        async function addItemToQuotation(productId) {
            // Always use items table for create quotation section (not temp table)
            const items = getItemsSync();
            const itemToAdd = items.find(i => i.productId === productId);
            
            if (!itemToAdd) return;

            const existingItem = quotationItems.find(qi => qi.productId === productId);
            if (existingItem) {
                existingItem.quantity += 1;
            } else {
                // Get GST rate from GST rules or settings
                const gstRate = getGstRateForItem(itemToAdd.productName);
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
            
            // Save to temp table only (do not update items table)
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
                        const gstAmount = (parseFloat(newPrice) || 0) * (parseFloat(item.gstRate || 0) / 100);
                        const totalPrice = parseFloat(newPrice) || 0;
                        
                        // Save to temp table only (not items table)
                        await apiFetch('/temp', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                productId: dbItem.productId,
                                itemUrl: dbItem.itemUrl || '',
                                productName: dbItem.productName,
                                type: dbItem.type || '',
                                price: parseFloat(newPrice) || 0,
                                gst: gstAmount,
                                totalPrice: totalPrice,
                                description: dbItem.description || '',
                                addedBy: addedBy
                            })
                        });
                    }
                } catch (error) {
                    console.error('Failed to save to temp table:', error);
                }
            }
            
            renderQuotationItems();
            updateGrandTotal();
        }

        async function updateItemGstRate(productId, newGstRate) {
            const item = quotationItems.find(qi => qi.productId === productId);
            if (item) {
                item.gstRate = parseFloat(newGstRate) || 0;
            }
            
            // Save to temp table when GST is edited (do not update items table)
            if (AUTHORIZED_TO_EDIT_ITEMS.includes(CURRENT_USER_ROLE)) {
                try {
                    const items = await getItems();
                    const dbItem = items.find(i => i.productId === productId);
                    
                    if (dbItem && item) {
                        let addedBy = CURRENT_USER_EMAIL;
                        if (addedBy && addedBy.includes('@')) {
                            addedBy = addedBy.split('@')[0];
                        } else {
                            addedBy = addedBy || 'unknown';
                        }
                        
                        // Calculate GST amount and total price
                        const itemPrice = parseFloat(item.price || dbItem.price || 0);
                        const gstRate = parseFloat(newGstRate) || 0;
                        const gstAmount = itemPrice * (gstRate / 100);
                        const totalPrice = itemPrice + gstAmount;
                        
                        // Save to temp table only (not items table)
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

                // Item Name/Description
                row.insertCell().innerHTML = `<strong>${item.productName}</strong><br><span class="muted" style="font-size:12px">${item.description || 'No description'}</span>`;

                // Quantity
                const qtyCell = row.insertCell();
                qtyCell.innerHTML = `<input type="number" value="${item.quantity}" min="1" style="width:50px; padding:5px; border-radius:4px; border:1px solid var(--border); text-align:right;" oninput="updateItemQuantity('${item.productId}', this.value)">`;

                // Unit Price
                const priceCell = row.insertCell();
                priceCell.innerHTML = `<input type="number" value="${item.price}" min="0" step="0.01" style="width:80px; padding:5px; border-radius:4px; border:1px solid var(--border); text-align:right;" onchange="updateItemPrice('${item.productId}', this.value)">`;

                // Total (Taxable Value)
                row.insertCell().textContent = formatRupee(total);

                // GST Rate (%)
                const gstCell = row.insertCell();
                const defaultGst = parseFloat(readLS(LS_KEYS.gst) || 18);
                const isItemGstDefault = item.gstRate === defaultGst;
                const canFixGst = AUTHORIZED_TO_FIX_GST.includes(CURRENT_USER_ROLE);


                gstCell.innerHTML = `<input type="number" value="${item.gstRate}" min="0" max="50" style="width:50px; padding:5px; border-radius:4px; border:1px solid var(--border); text-align:right;" 
                                        oninput="updateItemGstRate('${item.productId}', this.value)" ${canFixGst ? '' : 'disabled class="gst-input"'}>`;
                
                // If Accountant cannot fix GST, ensure the input in the summary area is also disabled/read-only.
                const gstPercentInput = document.getElementById('gst-percent');
                if (gstPercentInput) {
                    gstPercentInput.disabled = !canFixGst;
                    if (!canFixGst) {
                        gstPercentInput.classList.add('gst-input');
                    } else {
                        gstPercentInput.classList.remove('gst-input');
                    }
                }

                // Actions
                const actionsCell = row.insertCell();
                actionsCell.innerHTML = `<button class="btn danger" style="padding: 5px 8px;" onclick="removeItemFromQuotation('${item.productId}')"><i class="fas fa-trash-alt"></i></button>`;
            });
        }

        function updateGrandTotal() {
            let subTotal = quotationItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
            
            const discountPercent = parseFloat(document.getElementById('discount-percent')?.value || 0);
            let discountAmount = (subTotal * (discountPercent / 100));
            
            let totalAfterDiscount = subTotal - discountAmount;
            
            // Calculate total GST amount based on individual item rates
            let totalGstAmount = quotationItems.reduce((sum, item) => {
                const itemTotal = item.price * item.quantity;
                const itemGstRate = item.gstRate;
                const itemGstAmount = itemTotal * (itemGstRate / 100);
                return sum + itemGstAmount;
            }, 0);

            // Apply discount proportionally to the taxable value (subtotal) before adding GST
            // A more complex proportional distribution of discount is often required in real-world GST calculation,
            // but for simplicity, we apply the discount to the subtotal and calculate GST on the original unit price * quantity,
            // then add them up. This is simplified to ensure GST remains constant regardless of discount, which is common in Indian billing systems.

            let grandTotal = totalAfterDiscount + totalGstAmount;

            // Update DOM
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
                addLog('Unauthorized Attempt', CURRENT_USER_ROLE, `Tried to create quotation`);
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
            
            // Download as PNG
            await downloadQuotationAsPngDirect(newQuotation).catch(() => {
                // Silent fail for PNG generation
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
                    <button class="btn primary" style="padding: 5px 8px; margin-right: 5px;" onclick="viewQuotationPdf('${quote.quotationId || quote.id}')"><i class="fas fa-download"></i></button>
                    <button class="btn secondary" style="padding: 5px 8px; margin-right: 5px;" onclick="viewQuotationDetails('${quote.quotationId || quote.id}')"><i class="fas fa-eye"></i></button>
                    <button class="btn danger" style="padding: 5px 8px;" onclick="deleteQuotation('${quote.quotationId || quote.id}')" title="Delete Quotation"><i class="fas fa-trash-alt"></i></button>
                `;
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
                let quotation = quotations.find(q => q.quotationId === quotationId);
                
                if (!quotation) {
                    // Try to fetch from API
                    const response = await apiFetch(`/quotations/${quotationId}`);
                    if (response) {
                        quotation = Array.isArray(response) ? response[0] : (response.data || response);
                    }
                }
                
                if (!quotation) {
                    alert('Quotation not found.');
                    return;
                }
                
                // Download as PNG instead of PDF
                await downloadQuotationAsPngDirect(quotation);
            } catch (error) {
                console.error('Error downloading quotation PNG:', error);
                alert('Failed to download quotation as PNG.');
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
                const quotations = getQuotationsSync();
                let quote = quotations.find(q => q.quotationId === quotationId);
                
                if (!quote) {
                    // Try to fetch from API
                    const response = await apiFetch(`/quotations/${quotationId}`);
                    if (response) {
                        quote = Array.isArray(response) ? response[0] : (response.data || response);
                    }
                }

                if (!quote) {
                    alert('Quotation not found.');
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
                const customer = quotation.customer || {};
                const customerName = customer?.name || customer?.phone || quotation?.quotationId || 'Unknown';
                // Sanitize filename: remove special characters, replace spaces with underscores
                const sanitizedName = customerName.toString().replace(/[^a-zA-Z0-9]/g, '_').replace(/_+/g, '_').trim();
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

        async function generateQuotationHtml(quotation) {
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
            let items = Array.isArray(quotation.items) ? quotation.items : [];
            
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
            
            // Recalculate totals if prices were updated
            if (priceUpdated) {
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
                
                // Update totals
                subTotal = newSubTotal;
                discountAmount = newDiscountAmount;
                totalAfterDiscount = newTotalAfterDiscount;
                totalGstAmount = newTotalGstAmount;
                grandTotal = newGrandTotal;
            }
            
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
                    
                    <!-- Title -->
                    <div style="text-align: center; margin: 0; padding-top: 90px;">
                        <h2 style="margin: 0; font-size: 40px; font-weight: bold; color: #ff69b4;">QUOTATION</h2>
                    </div>

                    <!-- Company Info -->
                    <div style="margin-top: 0px; padding: 20px; padding-top: 5px; color: #ffffff;">
                        <div style="display: flex; justify-content: space-between;">
                            <div>
                                <strong style="color: #ff69b4; font-size: 18px;">Advance Infotech</strong><br>
                                <span style="color: #ffffff;">No. 1102, 2nd Floor, Sri Dharmaraya <br> Swamy Temple Road, Bangalore 560002</span><br>
                                <span style="color: #ffffff;">advanceinfotech21@gmail.com</span><br>
                                <span style="color: #ffffff;">+91 6362618184 | +91 8050702019</span><br>
                            </div>
                        </div>
                    </div>

                    <!-- Customer and Quotation Info -->
                    <div style="margin-top: 0px; padding: 20px; padding-top: 0px; color: #ffffff;">
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

                    <!-- Items Table -->
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
                            }).join('') : '<tr><td colspan="4" style="text-align: center; padding: 20px; color: #ffffff; background: rgba(138, 43, 226, 0.2);">No items added</td></tr>'}
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
            const paginationDiv = document.getElementById('logsPagination');
            body.innerHTML = '';

            if (logs.length === 0) {
                noLogsMessage.style.display = 'block';
                if (paginationDiv) paginationDiv.style.display = 'none';
                return;
            }
            noLogsMessage.style.display = 'none';
            if (paginationDiv) paginationDiv.style.display = 'flex';

            // Calculate pagination
            const totalPages = Math.ceil(logs.length / logsPerPage);
            const startIndex = (logsCurrentPage - 1) * logsPerPage;
            const endIndex = startIndex + logsPerPage;
            const paginatedLogs = logs.slice(startIndex, endIndex);

            // Update pagination controls
            updateLogsPaginationControls(totalPages, logs.length);

            paginatedLogs.forEach(log => {
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
            if (!AUTHORIZED_TO_VIEW_SETTINGS.includes(CURRENT_USER_ROLE)) {
                // If not authorized, ensure the settings section remains hidden
                document.getElementById('settings').style.display = 'none';
                return;
            }
            
            const defaultGst = readLS(LS_KEYS.gst) || 18;
            const brandName = readLS(LS_KEYS.brand) || 'RoleWise';
            const companyGstId = readLS(LS_KEYS.companyGstId) || '';
            const validityDays = readLS(LS_KEYS.validityDays) || 3;
            const logoBase64 = readLS(LS_KEYS.logo) || '';
            const gstLastUpdated = readLS('rolewise_gst_updated') || 'N/A';
            
            const isAuthorized = AUTHORIZED_TO_FIX_GST.includes(CURRENT_USER_ROLE); // Only Owner/Admin/Manager can change these

            document.getElementById('settings-brand-name').value = brandName;
            document.getElementById('settings-company-gst-id').value = companyGstId;
            document.getElementById('settings-validity-days').value = validityDays;
            document.getElementById('validityDaysDisplay').textContent = validityDays;

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
                addLog('Setting Changed', CURRENT_USER_ROLE, 'Removed company logo');
                alert('Company logo removed.');
            }
        });


        /* ---------- Other Actions (UNCHANGED) ---------- */

        function deleteQuotation(quotationId) {
            if (!confirm(`Are you sure you want to delete quotation ID ${quotationId}?`)) return;

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
                if (action.toLowerCase().includes('create') || action.toLowerCase().includes('add')) {
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

        document.getElementById('addItemForm')?.addEventListener('submit', saveItem);
        document.getElementById('editProductForm')?.addEventListener('submit', saveEditProduct);
        document.getElementById('closeEditProductModal')?.addEventListener('click', closeEditProductModal);
        document.getElementById('cancelEditProductBtn')?.addEventListener('click', closeEditProductModal);
        // Initialize edit product modal
        initEditProductModal();
        document.getElementById('addItemForm')?.addEventListener('reset', handleItemEditReset);
        document.getElementById('createQuotationBtn')?.addEventListener('click', createQuotation);
        document.getElementById('itemSearchInput')?.addEventListener('input', (e) => {
            const activeTypeFilter = document.querySelector('.type-filter-btn.active')?.dataset.type || '';
            renderAvailableItemsForQuotation(e.target.value, activeTypeFilter);
        });

        // Initial type filters for quotation section
        renderQuotationTypeFilters();

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
            const headerTitle = document.getElementById('headerTitle');
            const productIdInput = document.getElementById('product-id');

            if (userRoleDisplay) userRoleDisplay.textContent = CURRENT_USER_ROLE;
            if (userEmailDisplay) userEmailDisplay.textContent = CURRENT_USER_EMAIL;
            if (userAvatar) userAvatar.textContent = CURRENT_USER_ROLE.charAt(0).toUpperCase();
            if (headerTitle) headerTitle.textContent = `${CURRENT_USER_ROLE} Dashboard`;

            applyRoleRestrictions();
            
            try {
                await Promise.all([
                    Promise.resolve(renderItemsList()).catch(err => console.error('Error rendering items list:', err)),
                    Promise.resolve(renderHistoryList()).catch(err => console.error('Error rendering history:', err)),
                    Promise.resolve(renderLogsList()).catch(err => console.error('Error rendering logs:', err)),
                    Promise.resolve(renderSettings()).catch(err => console.error('Error rendering settings:', err)),
                    Promise.resolve(updateSummary()).catch(err => console.error('Error updating summary:', err)),
                    Promise.resolve(renderCustomersList()).catch(err => console.error('Error rendering customers:', err))
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
            writeLS(LS_KEYS.role, null);
            writeLS(LS_KEYS.user, null);
            // Redirect to login
            window.location.href = '/index.html';
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
    

