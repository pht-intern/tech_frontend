
        /* ---------- Global State & Constants ---------- */
        const LS_KEYS = {
            role: 'rolewise_role',
            user: 'rolewise_user',
            userEmail: 'rolewise_user_email',
            sessionExpiry: 'rolewise_session_expiry'
        };
        
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
                    // Clear session
                    localStorage.removeItem(LS_KEYS.role);
                    localStorage.removeItem(LS_KEYS.user);
                    localStorage.removeItem(LS_KEYS.userEmail);
                    localStorage.removeItem(LS_KEYS.sessionExpiry);
                    return false;
                }
                
                // CRITICAL: For employee dashboard, only Sales or Employee roles are allowed
                if (userRole !== 'Sales' && userRole !== 'Employee') {
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
                
                // Double-check that userData.role is Sales or Employee
                if (userData.role !== 'Sales' && userData.role !== 'Employee') {
                    return false;
                }
                
                return true;
            } catch (error) {
                return false;
            }
        }
        
        const CURRENT_USER_ROLE = localStorage.getItem(LS_KEYS.role) || "Employee";
        // Backend allows quotation update only for Owner, Admin, Manager. Hide edit/update for others (Employee, Sales).
        const CAN_UPDATE_QUOTATION = ['Owner', 'Admin', 'Manager', 'Employee'].includes(CURRENT_USER_ROLE);

        // --- Employee Image Upload ---
        const EMP_MAX_IMAGE_MB = 10;
        const EMP_MAX_IMAGES = 1;
        const EMP_ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/jpg', 'image/gif', 'image/webp'];
        let employeeUploadedImages = [];
        function validateEmployeeImageFile(file) {
            if (!EMP_ALLOWED_TYPES.includes(file.type)) return 'Invalid format. Use PNG, JPG, GIF or WebP.';
            if (file.size > EMP_MAX_IMAGE_MB * 1024 * 1024) return `File too large. Max ${EMP_MAX_IMAGE_MB}MB.`;
            return null;
        }
        function renderEmployeeImagePreviews() {
            const c = document.getElementById('imagePreviewList');
            const p = document.getElementById('imagePreview');
            if (!c || !p) return;
            if (employeeUploadedImages.length === 0) { p.style.display = 'none'; return; }
            c.innerHTML = employeeUploadedImages.map((d, i) => `<div style="position:relative;"><img src="${d}" style="width:80px;height:80px;object-fit:cover;border-radius:6px;"><button type="button" class="emp-rm" data-i="${i}" style="position:absolute;top:-6px;right:-6px;width:22px;height:22px;border-radius:50%;border:none;background:#dc3545;color:white;cursor:pointer;">×</button></div>`).join('');
            p.style.display = 'block';
            c.querySelectorAll('.emp-rm').forEach(b => { b.onclick = () => { employeeUploadedImages.splice(parseInt(b.dataset.i), 1); renderEmployeeImagePreviews(); }; });
        }
        function getEmployeeUploadedImages() { return [...(employeeUploadedImages || [])]; }
        function clearEmployeeImageUpload() { employeeUploadedImages = []; const el = document.getElementById('quotation-image'); if (el) el.value = ''; renderEmployeeImagePreviews(); }
        // Get email from userEmail key, or parse from user object, or use default
        let userEmailFromStorage = localStorage.getItem(LS_KEYS.userEmail);
        let userObjFromStorage = localStorage.getItem(LS_KEYS.user);
        const CURRENT_USER_EMAIL = userEmailFromStorage || (userObjFromStorage ? (() => {
            try {
                const userData = JSON.parse(userObjFromStorage);
                return userData.email || "employee@rolewise.com";
            } catch (e) {
                return "employee@rolewise.com";
            }
        })() : "employee@rolewise.com");
        const API_BASE = '/api';
        let quotationItems = [];
        var EXCLUDED_ITEM_TYPES = ['cpu', 'motherboard', 'case', 'storage', 'others', '19500', 'graphic card', 'memory'];
        function isExcludedType(t) { var v = String(t).toLowerCase().trim(); return EXCLUDED_ITEM_TYPES.indexOf(v) !== -1; }
        var QUOTATION_TYPE_FILTER_PRIORITY = ['', 'intel cpu', 'amd cpu', 'intel mobo', 'amd mobo'];
        function quotationTypeFilterSortIndex(value) { var v = String(value || '').toLowerCase().trim(); var i = QUOTATION_TYPE_FILTER_PRIORITY.indexOf(v); return i >= 0 ? i : QUOTATION_TYPE_FILTER_PRIORITY.length; }
        const DEFAULT_QUOTATION_ITEM_TYPE_ORDER = ['all', 'cpu cooler', 'monitor', 'amd cpu', 'amd mobo', 'cabinet', 'cooler', 'fan', 'fan controller', 'gpu', 'gpu cable', 'gpu holder', 'hdd', 'intel cpu', 'intel mobo', 'keyboard&mouse', 'memory module radiator', 'mod cable', 'ram', 'smps', 'ssd', 'ups'];
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
        let isCreatingNewQuotation = true; // Track if we're creating a new quotation (true) or editing existing (false)
        let quotationHistory = []; 
        let currentQuotationId = null;
        let historyCurrentPage = 1;
        const historyPerPage = 10;
        let customersCurrentPage = 1;
        const customersPerPage = 10;
        let customerDetailsCurrentPage = 1;
        const customerDetailsPerPage = 10;
        let currentEditQuotationId = null;
        let editQuotationItems = [];
        let editQuoteImagesArray = [];
        // Draft system (Saved drafts in Create Quotation)
        const DRAFT_AUTO_SAVE_MS = 10000;
        const DRAFT_DEBOUNCE_MS = 2500;
        let currentSectionId = '';
        let currentQuotationDraftId = null;
        let draftQuotationIntervalId = null;
        let draftQuotationDebounceId = null;
        const CUSTOMERS = [
            { id: 1, name: "Alpha Corp", email: "alpha@corp.com", phone: "123-456-7890", address: "101 Main St, City" },
            { id: 2, name: "Beta Solutions", email: "beta@sol.com", phone: "987-654-3210", address: "202 Side Ave, Town" }
        ];
        const PRODUCTS = [
            { id: 101, name: "Basic Web Package", price: 50000.00 },
            { id: 102, name: "E-commerce Module", price: 35000.00 },
            { id: 103, name: "Cloud Hosting (Yearly)", price: 12000.00 },
            { id: 104, name: "Custom Development (per hr)", price: 500.00 }
        ];
        const AUDIT_LOGS = [];
        const SETTINGS = {
            gstRate: 0.18, // 18%
            defaultValidityDays: 30
        };

        /* ---------- Utility Functions (Log & Audit) ---------- */
        function logAction(action) {
            const timestamp = new Date().toISOString();
            const logEntry = {
                timestamp: timestamp,
                user: CURRENT_USER_ROLE,
                action: action
            };
            AUDIT_LOGS.push(logEntry);
            // Logs removed from employee dashboard
        }

        /* ---------- Quotation Calculations ---------- */
        function calculateItemTotal(item) {
            return item.price * item.quantity;
        }

        function calculateSubTotal(items) {
            return items.reduce((sum, item) => sum + calculateItemTotal(item), 0);
        }

        function calculateGST(subTotal) {
            return subTotal * SETTINGS.gstRate;
        }

        function calculateGrandTotal(subTotal, gst) {
            return subTotal + gst;
        }

        function generateProductId() {
            const today = new Date();
            const dateStr = today.toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' }).replace(/\//g, '');
            const timeStr = today.toLocaleTimeString('en-IN', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' }).replace(/:/g, '');
            return `P${dateStr}${timeStr}`;
        }

        function updateGrandTotal() {
            const items = getQuotationItems();
            let subTotal = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);

            const discountPercent = parseFloat(document.getElementById('discount-percent')?.value || 0);
            let discountAmount = (subTotal * (discountPercent / 100));
            let totalAfterDiscount = subTotal - discountAmount;

            let totalGstAmount = items.reduce((sum, item) => {
                const itemTotal = item.price * item.quantity;
                const itemGstRate = item.gstRate || (SETTINGS.gstRate * 100);
                const itemGstAmount = itemTotal * (itemGstRate / 100);
                return sum + itemGstAmount;
            }, 0);

            let grandTotal = totalAfterDiscount + totalGstAmount;

            // Update display elements if they exist
            const subTotalDisplay = document.getElementById('subTotalDisplay');
            if (subTotalDisplay) subTotalDisplay.textContent = formatRupee(subTotal);
            
            const discountAmountDisplay = document.getElementById('discountAmountDisplay');
            if (discountAmountDisplay) discountAmountDisplay.textContent = formatRupee(discountAmount);
            
            const gstAmountDisplay = document.getElementById('gstAmountDisplay');
            if (gstAmountDisplay) gstAmountDisplay.textContent = formatRupee(totalGstAmount);
            
            const grandTotalDisplay = document.getElementById('grandTotalDisplay');
            if (grandTotalDisplay) grandTotalDisplay.textContent = formatRupee(grandTotal);

            // Fallback to old element IDs if new ones don't exist
            const quotationSubTotal = document.getElementById('quotationSubTotal');
            if (quotationSubTotal) quotationSubTotal.textContent = formatCurrency(subTotal);
            
            const quotationGST = document.getElementById('quotationGST');
            if (quotationGST) quotationGST.textContent = formatCurrency(totalGstAmount);
            
            const quotationGrandTotal = document.getElementById('quotationGrandTotal');
            if (quotationGrandTotal) quotationGrandTotal.textContent = formatCurrency(grandTotal);
        }

        /* ---------- Item Management ---------- */

        // Dynamic type filters for "Add Items to Quotation" — fetched from database (GET /settings → quotationTypeFilters)
        async function renderQuotationTypeFilters(items = null) {
            console.trace('🔍 renderQuotationTypeFilters called');
            const container = document.getElementById('quotationTypeFilters');
            if (!container) return;

            if (container.hasAttribute('data-rendered') && container.children.length > 0) {
                console.log('⚠️ renderQuotationTypeFilters skipped - already rendered');
                return;
            }

            const itemsData = items || window.cachedItems || [];
            let settings = {};
            try {
                const r = await apiFetch('/settings');
                settings = (r && r.data) ? r.data : (r || {});
            } catch (e) { /* use defaults */ }
            // Use quotationTypeFilters from database; fallback to merging order + productTypes
            let filtersFromDb = Array.isArray(settings.quotationTypeFilters) ? settings.quotationTypeFilters.slice() : [];
            if (filtersFromDb.length === 0) {
                const orderFromSettings = Array.isArray(settings.quotationItemTypeOrder) && settings.quotationItemTypeOrder.length > 0
                    ? settings.quotationItemTypeOrder.slice()
                    : DEFAULT_QUOTATION_ITEM_TYPE_ORDER.slice();
                const productTypesFromSettings = Array.isArray(settings.productTypes) ? settings.productTypes.slice() : [];
                const seenMerge = new Set();
                orderFromSettings.forEach(function (t) {
                    const v = String(t).toLowerCase().trim();
                    if (v && !seenMerge.has(v) && !isExcludedType(v)) { seenMerge.add(v); filtersFromDb.push(String(t).trim()); }
                });
                productTypesFromSettings.forEach(function (t) {
                    const v = String(t).toLowerCase().trim();
                    if (v && !seenMerge.has(v) && !isExcludedType(v)) { seenMerge.add(v); filtersFromDb.push(String(t).trim()); }
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

        function toTitleCase(str) {
            return str.replace(/\w\S*/g, function(txt) {
                return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase();
            });
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
            try {
                const itemsResponse = await getItems();
                const items = Array.isArray(itemsResponse) ? itemsResponse : (itemsResponse?.data || []);
                const itemToAdd = items.find(item => (item.productId || item.id) == productId);

                if (!itemToAdd) {
                    alert('Product not found in database. Please refresh the page and try again.');
                    return;
                }

                const existingQuoteItem = quotationItems.find(qi => (qi.productId || qi.id) == (itemToAdd.productId || itemToAdd.id));

                if (existingQuoteItem) {
                    existingQuoteItem.quantity++;
                } else {
                    // Get GST rate for item
                    let gstRate = SETTINGS.gstRate * 100;
                    try {
                        const gstRulesResponse = await apiFetch('/gst_rules');
                        const gstRules = Array.isArray(gstRulesResponse) ? gstRulesResponse : (gstRulesResponse?.data || []);
                        const settingsResponse = await apiFetch('/settings');
                        const settings = settingsResponse?.data || settingsResponse || {};
                        const defaultGst = settings.defaultGst || (SETTINGS.gstRate * 100);
                        
                        const productName = itemToAdd.productName || itemToAdd.name || '';
                        const rule = Array.isArray(gstRules) ? gstRules.find(r => 
                            r.productName && r.productName.toLowerCase() === productName.toLowerCase()
                        ) : null;
                        gstRate = rule ? parseFloat(rule.percent) : parseFloat(defaultGst);
                    } catch (e) {
                        // Use default GST rate
                    }
                    
                    quotationItems.push({
                        id: Date.now(),
                        productId: itemToAdd.productId || itemToAdd.id,
                        productName: itemToAdd.productName || itemToAdd.name,
                        type: itemToAdd.type || '',
                        price: parseFloat(itemToAdd.price || 0),
                        quantity: 1,
                        gstRate: gstRate,
                        description: itemToAdd.description || ''
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
                logAction(`Added product ${itemToAdd.productName || itemToAdd.name} to quotation.`);
            } catch (error) {
                alert('Failed to add item to quotation.');
            }
        }

        function removeItemFromQuotation(itemId) {
            quotationItems = quotationItems.filter(item => (item.id || item.productId) != itemId);
            renderQuotationItems();
            updateGrandTotal();
            scheduleQuotationDraftSave();
            if (document.getElementById('compatibleFilterToggle')?.checked) {
                const searchValue = document.getElementById('itemSearchInput')?.value || '';
                const activeTypeFilter = document.querySelector('.type-filter-btn.active')?.dataset.type || '';
                renderAvailableItemsForQuotation(searchValue, activeTypeFilter);
            }
            logAction(`Removed item ID ${itemId} from quotation.`);
        }

        /* ---------- CRUD Operations ---------- */
        async function createQuotation() {
            const customerName = document.getElementById('cust-name')?.value.trim() || null;
            const phoneNumber = document.getElementById('phone-number')?.value.trim();
            const customerEmail = document.getElementById('cust-email')?.value.trim() || null;
            const customerAddress = document.getElementById('cust-address')?.value.trim() || null;
            const items = getQuotationItems();

            // Edit mode: update existing quotation via create section (same as owner)
            if (currentEditQuotationId) {
                const qid = currentEditQuotationId;
                if (!phoneNumber || phoneNumber.length < 10) {
                    alert('Please enter a valid 10-digit phone number for the customer.');
                    return;
                }
                if (items.length === 0) {
                    alert('Please add at least one item to the quotation.');
                    return;
                }
                const discountPercent = parseFloat(document.getElementById('discount-percent')?.value || 0);
                const cust = { name: customerName || '', phone: phoneNumber, email: customerEmail || null, address: customerAddress || null };
                const itemsForUpdate = items.filter(it => (it.productName || it.name) && (parseFloat(it.price) || 0) > 0).map((it, idx) => ({
                    productId: it.productId || it.id || `custom-${Date.now()}-${idx}`,
                    productName: it.productName || it.name,
                    price: parseFloat(it.price) || 0,
                    quantity: parseInt(it.quantity, 10) || 1,
                    gstRate: parseFloat(it.gstRate) || 0
                }));
                if (itemsForUpdate.length === 0) {
                    alert('Add at least one item with a valid price.');
                    return;
                }
                try {
                    const rawImages = (typeof getEmployeeUploadedImages === 'function' ? getEmployeeUploadedImages() : []) || [];
                    const imagesForSave = await ensureImagesAreUrls(Array.isArray(rawImages) ? rawImages : []);
                    const res = await apiFetch(`/quotations/${qid}/update`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ customer: cust, items: itemsForUpdate, discountPercent, images: imagesForSave })
                    });
                    if (res && res.success !== false) {
                        cancelEditInCreateSection();
                        renderHistoryList();
                        renderCustomersList();
                        renderCustomerDetailsList();
                        updateSummary();
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
                const itemTotal = item.price * item.quantity;
                const itemGstRate = item.gstRate || (SETTINGS.gstRate * 100);
                return sum + (itemTotal * (itemGstRate / 100));
            }, 0);
            let grandTotal = (subTotal - discountAmount) + totalGstAmount;

            const quotationId = generateProductId().replace('P', 'Q');
            const dateCreated = new Date().toLocaleDateString('en-IN');

            // Build payload to match backend QuotationCreateSchema exactly (snake_case/camelCase, types)
            // Backend only accepts image URL paths (from POST /api/upload-image), not base64 data URLs
            const rawImages = (typeof getEmployeeUploadedImages === 'function' ? getEmployeeUploadedImages() : []) || [];
            const imagesArray = Array.isArray(rawImages) ? rawImages.filter(function (u) {
                if (typeof u !== 'string') return false;
                if (u.indexOf('data:') === 0 || u.length > 500) return false; // skip base64 so backend does not 400
                return true;
            }) : [];
            if (rawImages.length > 0 && imagesArray.length < rawImages.length) {
                console.warn('Some images were base64 and skipped. Use Upload Image to get URLs.');
            }

            const payload = {
                quotationId: String(quotationId),
                dateCreated: String(dateCreated),
                customer: {
                    name: customerName || null,
                    phone: String(phoneNumber).trim(),
                    email: customerEmail || null,
                    address: customerAddress || null
                },
                items: items.map(function (item) {
                    var qty = parseInt(item.quantity, 10);
                    if (!Number.isInteger(qty) || qty < 1) qty = 1;
                    return {
                        productId: String(item.productId != null ? item.productId : (item.id != null ? item.id : '')),
                        productName: String(item.productName != null ? item.productName : (item.name != null ? item.name : '')),
                        price: String(parseFloat(item.price || 0).toFixed(2)),
                        quantity: qty,
                        gstRate: String(parseFloat(item.gstRate || (SETTINGS.gstRate * 100)).toFixed(2))
                    };
                }),
                images: imagesArray,
                subTotal: String(parseFloat(subTotal).toFixed(2)),
                discountPercent: String(parseFloat(discountPercent).toFixed(2)),
                discountAmount: String(parseFloat(discountAmount).toFixed(2)),
                totalGstAmount: String(parseFloat(totalGstAmount).toFixed(2)),
                grandTotal: String(parseFloat(grandTotal).toFixed(2)),
                createdBy: (CURRENT_USER_EMAIL && CURRENT_USER_EMAIL.split('@')[0]) || CURRENT_USER_ROLE || ''
            };

            console.log('Sending quotation:', JSON.stringify(payload, null, 2));

            // Disable submit button during submission
            const submitBtn = document.getElementById('createQuotationBtn');
            const originalBtnText = submitBtn?.textContent;
            if (submitBtn) {
                submitBtn.disabled = true;
                submitBtn.textContent = 'Creating...';
            }

            try {
                // Try to save to API first
                const response = await apiFetch('/quotations', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });

                if (!response) {
                    throw new Error('No response from server');
                }

                // Also save locally for fallback
                const newQuotation = {
                    id: quotationId,
                    quotationId: quotationId,
                    customerName: customerName || phoneNumber,
                    customerPhone: phoneNumber,
                    customerEmail: customerEmail,
                    customerAddress: customerAddress,
                    customer: {
                        name: customerName || null,
                        phone: phoneNumber,
                        email: customerEmail || null,
                        address: customerAddress || null
                    },
                    dateCreated: dateCreated,
                    items: JSON.parse(JSON.stringify(items)),
                    images: (typeof getEmployeeUploadedImages === 'function' ? getEmployeeUploadedImages() : []) || [],
                    subTotal,
                    discountPercent,
                    discountAmount,
                    totalGstAmount,
                    grandTotal,
                    createdBy: CURRENT_USER_EMAIL.split('@')[0] || CURRENT_USER_ROLE
                };

                quotationHistory.unshift(newQuotation);
                logAction(`Created quotation: ${quotationId} for ${customerName || 'Customer'} (${phoneNumber})`);

                // Download as PNG
                await downloadQuotationAsPdfDirect(newQuotation).catch(() => {
                    // Silent fail for PNG generation
                });

                // Reset form and clear draft (draft was converted by creating quotation)
                if (currentQuotationDraftId) {
                    try { await apiFetch('/drafts/quotations/' + currentQuotationDraftId, { method: 'DELETE' }); } catch (e) { /* ignore */ }
                    currentQuotationDraftId = null;
                }
                resetQuotationForm();
                loadQuotationDrafts();
                renderHistoryList();
                updateSummary();
                
                alert(`Quotation ${quotationId} created successfully!`);
            } catch (error) {
                // Show error message to user
                const errorMessage = error.message || 'Failed to create quotation. Please check your input and try again.';
                alert(`Error: ${errorMessage}`);
                
                // Don't save locally if there's a validation error - let user fix it
                if (errorMessage.includes('Validation error')) {
                    return;
                }
                // Fallback: save locally only
                const newQuotation = {
                    id: quotationId,
                    quotationId: quotationId,
                    customerName: customerName || phoneNumber,
                    customerPhone: phoneNumber,
                    customerEmail: customerEmail,
                    customerAddress: customerAddress,
                    customer: {
                        name: customerName || null,
                        phone: phoneNumber,
                        email: customerEmail || null,
                        address: customerAddress || null
                    },
                    dateCreated: dateCreated,
                    items: JSON.parse(JSON.stringify(items)),
                    images: (typeof getEmployeeUploadedImages === 'function' ? getEmployeeUploadedImages() : []) || [],
                    subTotal,
                    discountPercent,
                    discountAmount,
                    totalGstAmount,
                    grandTotal,
                    createdBy: CURRENT_USER_EMAIL.split('@')[0] || CURRENT_USER_ROLE
                };

                quotationHistory.unshift(newQuotation);
                logAction(`Created quotation: ${quotationId} for ${customerName || 'Customer'} (${phoneNumber})`);

                // Download as PNG
                await downloadQuotationAsPdfDirect(newQuotation).catch(() => {
                    // Silent fail for PNG generation
                });

                if (currentQuotationDraftId) {
                    try { await apiFetch('/drafts/quotations/' + currentQuotationDraftId, { method: 'DELETE' }); } catch (e) { /* ignore */ }
                    currentQuotationDraftId = null;
                }
                resetQuotationForm();
                loadQuotationDrafts();
                renderHistoryList();
                updateSummary();
                
                alert(`Quotation ${quotationId} created successfully (saved locally).`);
            } finally {
                // Re-enable submit button
                if (submitBtn) {
                    submitBtn.disabled = false;
                    submitBtn.textContent = originalBtnText || 'Create Quotation';
                }
            }
        }

        function editQuotation(quotationId, optionalQuote) {
            if (!CAN_UPDATE_QUOTATION) {
                viewQuotationDetails(quotationId);
                return;
            }
            const id = (optionalQuote && (optionalQuote.quotationId || optionalQuote.id)) || quotationId;
            if (id) editQuotationInCreateSection(id);
        }

        /** Redirect to create quotation section with quotation data loaded (same as owner). */
        async function editQuotationInCreateSection(quotationId) {
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
                    price: it.price,
                    quantity: it.quantity || 1,
                    gstRate: it.gstRate != null ? it.gstRate : 0
                }));
                employeeUploadedImages = Array.isArray(quote.images) && quote.images.length > 0 ? [quote.images[0]] : [];
                renderEmployeeImagePreviews();
                renderQuotationItems();
                updateGrandTotal();
                const createBtn = document.getElementById('createQuotationBtn');
                if (createBtn) createBtn.innerHTML = '<i class="fas fa-edit"></i> Edit Quotation';
                document.querySelectorAll('#sideNav a[data-tab="createQuotation"], .section-tabs .tab-btn[data-tab="createQuotation"]').forEach(el => {
                    el.innerHTML = el.tagName === 'A' ? '<i class="fas fa-file-invoice-dollar"></i> Edit Quotation' : 'Edit Quotation';
                });
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
            if (createBtn) createBtn.innerHTML = '<i class="fas fa-file-invoice-dollar"></i> Create Quotation';
            document.querySelectorAll('#sideNav a[data-tab="createQuotation"], .section-tabs .tab-btn[data-tab="createQuotation"]').forEach(el => {
                el.innerHTML = el.tagName === 'A' ? '<i class="fas fa-file-invoice-dollar"></i> Quotations' : 'Quotations';
            });
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
            clearEmployeeImageUpload();
            renderQuotationItems();
            updateGrandTotal();
        }

        async function updateQuotation() {
            if (!currentQuotationId) return;

            const customerId = document.getElementById('customerSelect').value;
            const validityDays = parseInt(document.getElementById('validityDays').value || SETTINGS.defaultValidityDays);
            const items = getQuotationItems();

            if (!customerId || items.length === 0) {
                alert("Please select a customer and add at least one item to the quotation.");
                return;
            }

            const fromApi = typeof window !== 'undefined' && window._editingQuotationFromApi;
            if (fromApi) {
                try {
                    const customer = CUSTOMERS.find(c => c.id == customerId);
                    const cust = customer ? { name: customer.name || '', phone: customer.phone || '', email: customer.email || null, address: customer.address || null } : { name: '', phone: '', email: null, address: null };
                    const discountPercent = parseFloat(document.getElementById('discount-percent')?.value || 0);
                    const itemsForUpdate = items.filter(it => (it.productName || it.name) && (parseFloat(it.price) || 0) > 0).map((it, idx) => ({
                        productId: it.productId || it.id || 'custom-' + Date.now() + '-' + idx,
                        productName: it.productName || it.name,
                        price: parseFloat(it.price) || 0,
                        quantity: parseInt(it.quantity, 10) || 1,
                        gstRate: parseFloat(it.gstRate) || 0
                    }));
                    if (itemsForUpdate.length === 0) {
                        alert('Add at least one item with a valid price.');
                        return;
                    }
                    const res = await apiFetch(`/quotations/${currentQuotationId}/update`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ customer: cust, items: itemsForUpdate, discountPercent, images: [] })
                    });
                    if (res && res.success !== false) {
                        try { delete window._editingQuotationFromApi; } catch (e) {}
                        logAction(`Updated quotation: ${currentQuotationId}`);
                        resetQuotationForm();
                        await renderHistoryList();
                        updateSummary();
                        showSection('history');
                        alert(`Quotation ${currentQuotationId} updated successfully.`);
                    } else {
                        alert(res?.message || 'Failed to update quotation.');
                    }
                } catch (e) {
                    console.error('Update quotation error:', e);
                    alert('Failed to update quotation.');
                }
                return;
            }

            const quotationIndex = quotationHistory.findIndex(q => (q.id || q.quotationId) === currentQuotationId);
            if (quotationIndex === -1) return;

            const subTotal = calculateSubTotal(items);
            const gst = calculateGST(subTotal);
            const grandTotal = calculateGrandTotal(subTotal, gst);
            const customer = CUSTOMERS.find(c => c.id == customerId);
            const dateCreated = quotationHistory[quotationIndex].dateCreated;

            quotationHistory[quotationIndex] = {
                ...quotationHistory[quotationIndex],
                customerId: customerId,
                customerName: customer?.name || null,
                dueDate: getDueDate(dateCreated, validityDays),
                validityDays: validityDays,
                items: JSON.parse(JSON.stringify(items)),
                subTotal: subTotal,
                gst: gst,
                grandTotal: grandTotal,
            };

            logAction(`Updated quotation: ${currentQuotationId}`);

            resetQuotationForm();
            renderHistoryList();
            updateSummary();
            showSection('history');
            alert(`Quotation ${currentQuotationId} updated successfully.`);
        }

        function deleteQuotation(quotationId) {
            if (!confirm(`Are you sure you want to delete quotation ${quotationId}?`)) return;

            quotationHistory = quotationHistory.filter(q => q.id !== quotationId);
            logAction(`Deleted quotation ${quotationId}.`);
            
            renderHistoryList();
            updateSummary();
            alert(`Quotation ${quotationId} deleted.`);
        }

        function resetQuotationForm() {
            if (typeof clearEmployeeImageUpload === 'function') clearEmployeeImageUpload();
            // Reset customer fields
            const custName = document.getElementById('cust-name');
            if (custName) custName.value = '';
            
            const phoneNumber = document.getElementById('phone-number');
            if (phoneNumber) phoneNumber.value = '';
            
            const custEmail = document.getElementById('cust-email');
            if (custEmail) custEmail.value = '';
            
            const custAddress = document.getElementById('cust-address');
            if (custAddress) custAddress.value = '';
            
            // Reset discount
            const discountPercent = document.getElementById('discount-percent');
            if (discountPercent) discountPercent.value = '0';
            
            // Clear customer details display
            const custDisplayName = document.getElementById('cust-display-name');
            if (custDisplayName) custDisplayName.textContent = '';
            
            const custDisplayPhone = document.getElementById('cust-display-phone');
            if (custDisplayPhone) custDisplayPhone.textContent = '';
            
            const custDisplayEmail = document.getElementById('cust-display-email');
            if (custDisplayEmail) custDisplayEmail.textContent = '';
            
            const custDisplayAddress = document.getElementById('cust-display-address');
            if (custDisplayAddress) custDisplayAddress.textContent = '';
            
            // Reset quotation items
            quotationItems = [];
            currentQuotationId = null;
            isCreatingNewQuotation = true; // Reset to create mode
            try { if (typeof window !== 'undefined') delete window._editingQuotationFromApi; } catch (e) {}
            renderQuotationItems();
            updateGrandTotal();
            
            // Clear item search
            const itemSearchInput = document.getElementById('itemSearchInput');
            if (itemSearchInput) itemSearchInput.value = '';
            
            // Re-render available items
            renderAvailableItemsForQuotation();
        }

        /* ---------- Rendering Functions ---------- */
        async function renderCustomersList(searchFilter = '') {
            try {
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
                const quotationsResponse = await getQuotations();
                const quotations = Array.isArray(quotationsResponse) ? quotationsResponse : (quotationsResponse?.data || []);
                
                const body = document.getElementById('customersListBody');
                if (!body) {
                    return;
                }
                body.innerHTML = '';
                const customersTable = document.getElementById('customersTable');
                const paginationDiv = document.getElementById('customersPagination');

                if (customers.length === 0) {
                    body.innerHTML = '<tr><td colspan="8" class="muted" style="text-align:center">No customer data available.</td></tr>';
                    if (customersTable) customersTable.style.display = 'none';
                    if (paginationDiv) paginationDiv.style.display = 'none';
                    return;
                }

                if (customersTable) customersTable.style.display = 'table';
                if (paginationDiv) paginationDiv.style.display = 'flex';

                // Sort by last quotation date (most recent first)
                customers.sort((a, b) => {
                    try {
                        const dateA = new Date(a.lastQuotationDate);
                        const dateB = new Date(b.lastQuotationDate);
                        return dateB - dateA;
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

                paginatedCustomers.forEach((customer, index) => {
                    const customerQuotationCount = quotations.filter(q => {
                        const phone = q.customer?.phone || q.customerPhone;
                        return phone === customer.phone;
                    }).length;

                    const row = body.insertRow();
                    row.className = 'customer-row';
                    row.insertCell().textContent = startIndex + index + 1;
                    row.insertCell().textContent = customer.name || 'N/A';
                    row.insertCell().textContent = customer.email || 'N/A';
                    row.insertCell().textContent = customer.phone || 'N/A';
                    row.insertCell().textContent = customer.address || 'N/A';
                    row.insertCell().textContent = customer.lastQuotationDate || 'N/A';
                    row.insertCell().textContent = customerQuotationCount;
                    const actionCell = row.insertCell();
                    const createBtn = document.createElement('button');
                    createBtn.className = 'btn';
                    createBtn.style.cssText = 'padding: 5px 8px;';
                    createBtn.innerHTML = '<i class="fas fa-file-invoice-dollar"></i>';
                    createBtn.title = 'Create quotation for this customer';
                    createBtn.onclick = (e) => { e.stopPropagation(); openCreateQuotationForCustomer(customer); };
                    actionCell.appendChild(createBtn);
                    row.addEventListener('click', () => toggleCustomerQuotations(customer.phone, row));
                });
            } catch (error) {
                // Fallback to local CUSTOMERS array if API fails
                const body = document.getElementById('customersListBody');
                const customersTable = document.getElementById('customersTable');
                const paginationDiv = document.getElementById('customersPagination');
                if (!body) return;
                
                body.innerHTML = '';
                
                if (CUSTOMERS.length === 0) {
                    body.innerHTML = '<tr><td colspan="8" class="muted" style="text-align:center">No customer data available.</td></tr>';
                    if (customersTable) customersTable.style.display = 'none';
                    if (paginationDiv) paginationDiv.style.display = 'none';
                    return;
                }

                if (customersTable) customersTable.style.display = 'table';
                if (paginationDiv) paginationDiv.style.display = 'flex';

                const totalPages = Math.ceil(CUSTOMERS.length / customersPerPage);
                const startIndex = (customersCurrentPage - 1) * customersPerPage;
                const endIndex = startIndex + customersPerPage;
                const paginatedCustomers = CUSTOMERS.slice(startIndex, endIndex);

                updateCustomersPaginationControls(totalPages, CUSTOMERS.length);

                const quotations = quotationHistory || [];
                paginatedCustomers.forEach((customer, index) => {
                    const customerQuotationCount = quotations.filter(q => {
                        const phone = q.customer?.phone || q.customerPhone || (q.customerId && CUSTOMERS.find(c => c.id == q.customerId)?.phone);
                        return phone === customer.phone || (q.customerId && customer.id && q.customerId == customer.id);
                    }).length;

                    const row = body.insertRow();
                    row.className = 'customer-row';
                    row.insertCell().textContent = startIndex + index + 1;
                    row.insertCell().textContent = customer.name || 'N/A';
                    row.insertCell().textContent = customer.email || 'N/A';
                    row.insertCell().textContent = customer.phone || 'N/A';
                    row.insertCell().textContent = customer.address || 'N/A';
                    row.insertCell().textContent = 'N/A';
                    row.insertCell().textContent = customerQuotationCount;
                    const actionCell = row.insertCell();
                    const createBtn = document.createElement('button');
                    createBtn.className = 'btn';
                    createBtn.style.cssText = 'padding: 5px 8px;';
                    createBtn.innerHTML = '<i class="fas fa-file-invoice-dollar"></i>';
                    createBtn.title = 'Create quotation for this customer';
                    createBtn.onclick = (e) => { e.stopPropagation(); openCreateQuotationForCustomer(customer); };
                    actionCell.appendChild(createBtn);
                    row.addEventListener('click', () => toggleCustomerQuotations(customer.phone, row));
                });
            }
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
            
            // Get current search filter
            const searchInput = document.getElementById('customerListSearchInput');
            const filter = searchInput ? searchInput.value.trim() : '';
            
            renderCustomersList(filter);
        }

        // --- Customer Quotation Details Management (same as Customer List but separate tab) ---
        async function renderCustomerDetailsList(searchFilter = '') {
            try {
                const customersResponse = await getCustomers();
                let customers = Array.isArray(customersResponse) ? customersResponse : (customersResponse?.data || []);
                const quotationsResponse = await getQuotations();
                const quotations = Array.isArray(quotationsResponse) ? quotationsResponse : (quotationsResponse?.data || []);

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
                        return dateB - dateA;
                    } catch (e) {
                        return 0;
                    }
                });

                const totalPages = Math.ceil(customers.length / customerDetailsPerPage);
                const startIndex = (customerDetailsCurrentPage - 1) * customerDetailsPerPage;
                const endIndex = startIndex + customerDetailsPerPage;
                const paginatedCustomers = customers.slice(startIndex, endIndex);

                updateCustomerDetailsPaginationControls(totalPages, customers.length);

                paginatedCustomers.forEach((customer, index) => {
                    const customerQuotationCount = quotations.filter(q => {
                        const phone = q.customer?.phone || q.customerPhone;
                        return phone === customer.phone;
                    }).length;

                    const row = body.insertRow();
                    row.className = 'customer-row';
                    row.insertCell().textContent = startIndex + index + 1;
                    row.insertCell().textContent = customer.name || 'N/A';
                    row.insertCell().textContent = customer.email || 'N/A';
                    row.insertCell().textContent = customer.phone || 'N/A';
                    row.insertCell().textContent = customer.address || 'N/A';
                    row.insertCell().textContent = customer.lastQuotationDate || 'N/A';
                    row.insertCell().textContent = customerQuotationCount;
                    const actionCell = row.insertCell();
                    const createBtn = document.createElement('button');
                    createBtn.className = 'btn';
                    createBtn.style.cssText = 'padding: 5px 8px;';
                    createBtn.innerHTML = '<i class="fas fa-file-invoice-dollar"></i>';
                    createBtn.title = 'Create quotation for this customer';
                    createBtn.onclick = (e) => { e.stopPropagation(); openCreateQuotationForCustomer(customer); };
                    actionCell.appendChild(createBtn);
                    row.addEventListener('click', () => toggleCustomerQuotations(customer.phone, row));
                });
            } catch (err) {
                const body = document.getElementById('customerDetailsListBody');
                const customersTable = document.getElementById('customerDetailsTable');
                const paginationDiv = document.getElementById('customerDetailsPagination');
                if (!body) return;
                body.innerHTML = '<tr><td colspan="8" class="muted" style="text-align:center">No customer data available.</td></tr>';
                if (customersTable) customersTable.style.display = 'none';
                if (paginationDiv) paginationDiv.style.display = 'none';
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
                        renderCustomerDetailsList(searchInput ? searchInput.value.trim() : '');
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
                    if (i === customerDetailsCurrentPage) pageBtn.classList.add('active');
                    pageBtn.textContent = i;
                    pageBtn.onclick = () => {
                        customerDetailsCurrentPage = i;
                        const searchInput = document.getElementById('customerDetailsSearchInput');
                        renderCustomerDetailsList(searchInput ? searchInput.value.trim() : '');
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
                        renderCustomerDetailsList(searchInput ? searchInput.value.trim() : '');
                    };
                    pageNumbersDiv.appendChild(lastBtn);
                }
            }
            if (prevBtn) prevBtn.disabled = customerDetailsCurrentPage <= 1;
            if (nextBtn) nextBtn.disabled = customerDetailsCurrentPage >= totalPages;
        }

        function goToCustomerDetailsPage(direction) {
            const body = document.getElementById('customerDetailsListBody');
            if (!body) return;
            customerDetailsCurrentPage += direction;
            if (customerDetailsCurrentPage < 1) customerDetailsCurrentPage = 1;
            const searchInput = document.getElementById('customerDetailsSearchInput');
            const filter = searchInput ? searchInput.value.trim() : '';
            renderCustomerDetailsList(filter);
        }

        // --- Edit Quotation Modal (same as owner.html) ---
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
                    </div>
                    <button type="button" class="edit-remove-img" data-idx="${idx}" style="position:absolute; top:-4px; right:-4px; width:20px; height:20px; border-radius:50%; border:none; background:#dc3545; color:white; cursor:pointer; font-size:12px; line-height:1;">×</button>
                </div>
            `).join('');
            previewDiv.style.display = 'block';
            container.querySelectorAll('.edit-remove-img').forEach(btn => {
                btn.onclick = () => { editQuoteImagesArray.splice(parseInt(btn.dataset.idx), 1); renderEditQuoteImagePreviews(); };
            });
        }

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
            document.addEventListener('keydown', function escHandler(e) {
                if (e.key === 'Escape' && modal.style.display === 'block') closeEditQuotationModal();
            });
            document.getElementById('editQuoteAddItemBtn')?.addEventListener('click', () => {
                editQuotationItems.push({ productId: '', productName: '', price: 0, quantity: 1, gstRate: 0 });
                renderEditQuotationItems();
            });
            document.getElementById('edit-quote-discount')?.addEventListener('input', recalcEditQuotationTotal);
            document.getElementById('edit-quote-image')?.addEventListener('change', function(e) {
                const file = (e.target.files || [])[0];
                if (file) {
                    const err = validateEmployeeImageFile(file);
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
        }

        async function toggleCustomerQuotations(customerPhone, customerRow) {
            const existingQuotationsRow = customerRow.nextElementSibling;
            const isExpanded = customerRow.classList.contains('expanded');
            const tbody = customerRow.closest('tbody');

            [].forEach.call(document.querySelectorAll('#customersListBody .customer-row.expanded, #customerDetailsListBody .customer-row.expanded'), row => {
                row.classList.remove('expanded');
                const nextRow = row.nextElementSibling;
                if (nextRow && nextRow.classList.contains('customer-quotation-row')) {
                    nextRow.remove();
                }
            });

            if (isExpanded) {
                customerRow.classList.remove('expanded');
                if (existingQuotationsRow && existingQuotationsRow.classList.contains('customer-quotation-row')) {
                    existingQuotationsRow.remove();
                }
                return;
            }

            customerRow.classList.add('expanded');

            try {
                const quotationsResponse = await getQuotations();
                const quotations = Array.isArray(quotationsResponse) ? quotationsResponse : (quotationsResponse?.data || quotationHistory || []);

                const customerQuotations = quotations.filter(q => {
                    const phone = q.customer?.phone || q.customerPhone;
                    return phone === customerPhone;
                });

                if (customerQuotations.length === 0) return;

                const customerRows = tbody ? Array.from(tbody.querySelectorAll('.customer-row')) : Array.from(document.querySelectorAll('#customersListBody .customer-row'));
                const customerIndex = customerRows.findIndex(row => (row.cells[3]?.textContent || '').trim() === customerPhone);
                const customerSerialNumber = customerIndex >= 0 ? customerIndex + 1 : 1;

                const totalAmount = (q) => parseFloat(q.grandTotal || q.totalAmount || q.total) || 0;
                const tbodyParts = [];
                customerQuotations.forEach((quotation, qIndex) => {
                    const dateStr = quotation.dateCreated || quotation.created_at || '';
                    const timestampStr = quotation.created_at ? new Date(quotation.created_at).toLocaleString() : (quotation.dateCreated ? new Date(quotation.dateCreated).toLocaleString() : '');
                    const amount = totalAmount(quotation);
                    const itemsCount = quotation.items ? quotation.items.length : 0;
                    const createdBy = (quotation.createdBy || quotation.created_by || CURRENT_USER_ROLE || 'N/A').replace(/</g, '&lt;');
                    tbodyParts.push(`
                        <tr style="border-bottom: 2px solid #e0e0e0; background-color: #f8f9fa;">
                            <td style="font-weight: bold; color: #2196f3;">${customerSerialNumber}.${qIndex + 1}</td>
                            <td>${dateStr ? new Date(dateStr).toLocaleDateString() : ''}</td>
                            <td>${timestampStr}</td>
                            <td style="font-weight: bold; color: #27ae60;">${formatRupee(amount)}</td>
                            <td>${itemsCount}</td>
                            <td>${createdBy}</td>
                            <td class="quotation-edit-cell"></td>
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
                                                        <div>${customerSerialNumber}.${qIndex + 1}.${itemIndex + 1}. ${(item.productName || item.name || '').replace(/</g, '&lt;')}</div>
                                                    </td>
                                                    <td>${item.quantity || item.qty || 1}</td>
                                                    <td>${formatRupee(item.unitPrice || item.price || 0)}</td>
                                                    <td>${formatRupee((parseFloat(item.unitPrice || item.price) || 0) * (parseInt(item.quantity || item.qty, 10) || 1))}</td>
                                                </tr>
                                            `).join('')}
                                            </tbody>
                                        </table>
                                    </div>
                                </td>
                            </tr>
                        ` : ''}
                    `);
                });

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
                                    ${tbodyParts.join('')}
                                </tbody>
                            </table>
                        </div>
                    </td>
                `;

                quotationsRow.querySelectorAll('.quotation-edit-cell').forEach((cell, idx) => {
                    const quotation = customerQuotations[idx];
                    if (!quotation) return;
                    if (!CAN_UPDATE_QUOTATION) return;
                    const editBtn = document.createElement('button');
                    editBtn.className = 'btn';
                    editBtn.style.cssText = 'padding: 4px 8px; font-size: 12px;';
                    editBtn.innerHTML = '<i class="fas fa-edit"></i>';
                    editBtn.title = 'Edit quotation';
                    editBtn.onclick = (e) => { e.stopPropagation(); editQuotation(quotation.quotationId || quotation.id, quotation); };
                    cell.appendChild(editBtn);
                });

                customerRow.parentNode.insertBefore(quotationsRow, customerRow.nextSibling);
            } catch (error) {
                console.error('Error loading customer quotations:', error);
            }
        }

        function openCreateQuotationForCustomer(customer) {
            const customerSelect = document.getElementById('customerSelect');
            if (!customerSelect) return;
            const byPhone = (CUSTOMERS || []).find(c => (c.phone || '').toString() === (customer.phone || '').toString());
            const byId = customer.id && (CUSTOMERS || []).find(c => c.id == customer.id);
            const match = byPhone || byId || (CUSTOMERS || []).find(c =>
                (c.name || '').toLowerCase() === (customer.name || '').toLowerCase() && (c.phone || '').toString() === (customer.phone || '').toString()
            );
            if (match) {
                customerSelect.value = match.id;
            }
            showSection('createQuotation');
        }

        function renderProductsList() {
            const productSelect = document.getElementById('productSelect');
            if (!productSelect) {
                // Element doesn't exist in this dashboard, skip rendering
                return;
            }
            productSelect.innerHTML = '<option value="">Select Product/Service</option>';
            PRODUCTS.forEach(product => {
                const option = document.createElement('option');
                option.value = product.id;
                option.textContent = `${product.name} (${formatCurrency(product.price)})`;
                productSelect.appendChild(option);
            });
        }

        function renderQuotationItems() {
            const body = document.getElementById('quotationItemsBody');
            if (!body) {
                return;
            }
            body.innerHTML = '';
            
            if (quotationItems.length === 0) {
                body.innerHTML = '<tr><td colspan="6" style="text-align:center; padding: 20px;">No items added yet.</td></tr>';
                return;
            }

            const sortedItems = [...quotationItems].sort((a, b) => getQuotationCategorySortIndex(a.type, DEFAULT_QUOTATION_ITEM_TYPE_ORDER) - getQuotationCategorySortIndex(b.type, DEFAULT_QUOTATION_ITEM_TYPE_ORDER));
            sortedItems.forEach(item => {
                const row = body.insertRow();
                const productName = item.productName || item.name || 'N/A';
                const description = item.description || '';
                const quantity = item.quantity || 1;
                const price = parseFloat(item.price) || 0;
                const itemTotal = price * quantity;
                const itemGstAmount = itemTotal * (item.gstRate / 100);
                const total = itemTotal + itemGstAmount; // Total including GST
                const gstRate = item.gstRate || (SETTINGS.gstRate * 100);
                const itemId = item.id || item.productId;
                
                // Item column
                const itemCell = row.insertCell();
                itemCell.innerHTML = `<strong>${productName}</strong><br><span class="muted" style="font-size:12px">${description || 'No description'}</span>`;
                
                // Quantity column
                const qtyCell = row.insertCell();
                qtyCell.innerHTML = `<input type="number" value="${quantity}" min="1" style="width:50px; padding:5px; border-radius:4px; border:1px solid var(--border);" onchange="updateItemQuantity('${itemId}', this.value)">`;
                
                // Unit Price column
                const priceCell = row.insertCell();
                priceCell.innerHTML = `<input type="number" value="${price}" min="0" step="0.01" style="width:80px; padding:5px; border-radius:4px; border:1px solid var(--border); text-align:right;" onchange="updateItemPrice('${itemId}', this.value)">`;
                
                // Total column (including GST)
                row.insertCell().textContent = formatRupee(total);
                
                // GST Rate column
                const gstCell = row.insertCell();
                gstCell.innerHTML = `<input type="number" value="${gstRate}" min="0" max="50" style="width:50px; padding:5px; border-radius:4px; border:1px solid var(--border);" onchange="updateItemGstRate('${itemId}', this.value)">`;
                
                // Actions column – delete item
                const actionsCell = row.insertCell();
                const removeBtn = document.createElement('button');
                removeBtn.className = 'btn danger';
                removeBtn.style.padding = '5px 8px';
                removeBtn.title = 'Remove item from quotation';
                removeBtn.innerHTML = '<i class="fas fa-trash-alt"></i> Delete';
                removeBtn.onclick = function () { removeItemFromQuotation(itemId); };
                actionsCell.appendChild(removeBtn);
            });
        }

        function updateItemQuantity(itemId, newQuantity) {
            const item = quotationItems.find(qi => (qi.id || qi.productId) == itemId);
            if (item) {
                item.quantity = parseInt(newQuantity) || 1;
                if (item.quantity <= 0) {
                    removeItemFromQuotation(itemId);
                    return;
                }
            }
            renderQuotationItems();
            updateGrandTotal();
            scheduleQuotationDraftSave();
        }

        async function updateItemPrice(itemId, newPrice) {
            const item = quotationItems.find(qi => (qi.id || qi.productId) == itemId);
            if (item) {
                const parsedPrice = parseFloat(newPrice) || 0;
                if (parsedPrice < 0) {
                    item.price = 0;
                } else {
                    item.price = parsedPrice;
                }
            }
            
            // Save to temp table only (do not update items table)
            const productId = item?.productId || item?.id || itemId;
            try {
                // Fetch current item data to get all required fields
                const items = await getItems();
                const dbItem = items.find(i => (i.productId || i.id) == productId);
                
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
                            productId: dbItem.productId || dbItem.id,
                            itemUrl: dbItem.itemUrl || '',
                            productName: dbItem.productName || dbItem.name,
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
            
            renderQuotationItems();
            updateGrandTotal();
            scheduleQuotationDraftSave();
        }

        async function updateItemGstRate(itemId, newGstRate) {
            const item = quotationItems.find(qi => (qi.id || qi.productId) == itemId);
            if (item) {
                item.gstRate = parseFloat(newGstRate) || (SETTINGS.gstRate * 100);
            }
            
            // Save to temp table when GST is edited (do not update items table)
            try {
                const productId = item?.productId || item?.id || itemId;
                const items = await getItems();
                const dbItem = items.find(i => (i.productId || i.id) == productId);
                
                if (dbItem && item) {
                    let addedBy = CURRENT_USER_EMAIL;
                    if (addedBy && addedBy.includes('@')) {
                        addedBy = addedBy.split('@')[0];
                    } else {
                        addedBy = addedBy || 'unknown';
                    }
                    
                    // Calculate GST amount and total price
                    const itemPrice = parseFloat(item.price || dbItem.price || 0);
                    const gstRate = parseFloat(newGstRate) || (SETTINGS.gstRate * 100);
                    const gstAmount = itemPrice * (gstRate / 100);
                    const totalPrice = itemPrice + gstAmount;
                    
                    // Save to temp table only (not items table)
                    await apiFetch('/temp', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            productId: dbItem.productId || dbItem.id,
                            itemUrl: dbItem.itemUrl || '',
                            productName: dbItem.productName || dbItem.name,
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
            
            renderQuotationItems();
            updateGrandTotal();
            scheduleQuotationDraftSave();
        }

        async function renderHistoryList(filter = '') {
            try {
                // Try to get quotations from API first, fallback to local data
                const quotationsResponse = await getQuotations();
                const quotations = Array.isArray(quotationsResponse) ? quotationsResponse : (quotationsResponse?.data || quotationHistory);
                
                const tableBody = document.getElementById('historyListBody');
                const noHistoryMessage = document.getElementById('noHistoryMessage');
                const historyTable = document.getElementById('historyTable');
                
                if (!tableBody) {
                    return;
                }
                
            tableBody.innerHTML = '';

                // Reset to page 1 if filter changed
                if (filter !== '') {
                    historyCurrentPage = 1;
                }

                // Apply search filter
                const normalizedFilter = filter.toLowerCase().trim();
                const filteredQuotations = normalizedFilter ? quotations.filter(q => {
                    const quotationId = (q.quotationId || q.id || '').toLowerCase();
                    const customerName = (q.customer?.name || q.customerName || '').toLowerCase();
                    const customerPhone = (q.customer?.phone || q.customerPhone || '').toLowerCase();
                    return quotationId.includes(normalizedFilter) || 
                           customerName.includes(normalizedFilter) || 
                           customerPhone.includes(normalizedFilter);
                }) : quotations;

                const paginationDiv = document.getElementById('historyPagination');
                
                if (filteredQuotations.length === 0) {
                    if (noHistoryMessage) noHistoryMessage.style.display = 'block';
                    if (historyTable) historyTable.style.display = 'none';
                    if (paginationDiv) paginationDiv.style.display = 'none';
                return;
            }

                if (noHistoryMessage) noHistoryMessage.style.display = 'none';
                if (historyTable) historyTable.style.display = 'table';
                if (paginationDiv) paginationDiv.style.display = 'flex';

                // Sort by last activity (most recent first, includes updates)
                const sortedQuotations = filteredQuotations.slice().sort((a, b) => {
                    const dateA = new Date(a.updated_at || a.dateCreated || a.created_at || 0);
                    const dateB = new Date(b.updated_at || b.dateCreated || b.created_at || 0);
                    return dateB - dateA;
                });

                // Calculate pagination
                const totalPages = Math.ceil(sortedQuotations.length / historyPerPage);
                const startIndex = (historyCurrentPage - 1) * historyPerPage;
                const endIndex = startIndex + historyPerPage;
                const paginatedQuotations = sortedQuotations.slice(startIndex, endIndex);

                // Update pagination controls
                updateHistoryPaginationControls(totalPages, sortedQuotations.length);

                paginatedQuotations.forEach(q => {
                    const row = tableBody.insertRow();
                    const quotationId = q.quotationId || q.id || 'N/A';
                    const customerName = q.customer?.name || q.customerName || 'N/A';
                    const customerPhone = q.customer?.phone || q.customerPhone || '';
                    row.insertCell().textContent = quotationId;
                    row.insertCell().textContent = customerName !== 'N/A' ? customerName : (customerPhone || 'N/A');
                    row.insertCell().textContent = q.dateCreated || q.created_at || 'N/A';
                    const lastUpdatedStr = q.updated_at ? new Date(q.updated_at).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' }) : '—';
                    row.insertCell().textContent = lastUpdatedStr;
                    row.insertCell().textContent = formatRupee(parseFloat(q.grandTotal) || 0);
                    row.insertCell().textContent = (q.items?.length || 0);
                    row.insertCell().textContent = q.createdBy || q.created_by || CURRENT_USER_ROLE || 'N/A';

                    const actionsCell = row.insertCell();
                    actionsCell.className = 'actions';
                    const pdfBtn = document.createElement('button');
                    pdfBtn.className = 'btn primary';
                    pdfBtn.style.cssText = 'padding: 5px 8px; margin-right: 5px;';
                    pdfBtn.innerHTML = '<i class="fas fa-download"></i>';
                    pdfBtn.onclick = () => fetchQuotationAndGeneratePdf(quotationId);
                    actionsCell.appendChild(pdfBtn);
                    const viewBtn = document.createElement('button');
                    viewBtn.className = 'btn secondary';
                    viewBtn.style.cssText = 'padding: 5px 8px; margin-right: 5px;';
                    viewBtn.innerHTML = '<i class="fas fa-eye"></i>';
                    viewBtn.onclick = () => viewQuotationDetails(quotationId);
                    actionsCell.appendChild(viewBtn);
                    if (CAN_UPDATE_QUOTATION) {
                        const editBtn = document.createElement('button');
                        editBtn.className = 'btn';
                        editBtn.style.cssText = 'padding: 5px 8px;';
                        editBtn.innerHTML = '<i class="fas fa-edit"></i>';
                        editBtn.title = 'Edit quotation';
                        editBtn.onclick = () => editQuotation(quotationId, q);
                        actionsCell.appendChild(editBtn);
                    }
                });
            } catch (error) {
                // Fallback to local data
                const tableBody = document.getElementById('historyListBody');
                const noHistoryMessage = document.getElementById('noHistoryMessage');
                const historyTable = document.getElementById('historyTable');
                const paginationDiv = document.getElementById('historyPagination');
                if (!tableBody) return;
                
                tableBody.innerHTML = '';
                
                if (quotationHistory.length === 0) {
                    if (noHistoryMessage) noHistoryMessage.style.display = 'block';
                    if (historyTable) historyTable.style.display = 'none';
                    if (paginationDiv) paginationDiv.style.display = 'none';
                    return;
                }

                if (noHistoryMessage) noHistoryMessage.style.display = 'none';
                if (historyTable) historyTable.style.display = 'table';
                if (paginationDiv) paginationDiv.style.display = 'flex';

                const sortedHistory = quotationHistory.slice().sort((a, b) => {
                    const dateA = new Date(a.updated_at || a.dateCreated || a.created_at || 0);
                    const dateB = new Date(b.updated_at || b.dateCreated || b.created_at || 0);
                    return dateB - dateA;
                });
                const totalPages = Math.ceil(sortedHistory.length / historyPerPage);
                const startIndex = (historyCurrentPage - 1) * historyPerPage;
                const endIndex = startIndex + historyPerPage;
                const paginatedHistory = sortedHistory.slice(startIndex, endIndex);

                updateHistoryPaginationControls(totalPages, sortedHistory.length);

                paginatedHistory.forEach(q => {
                    const row = tableBody.insertRow();
                    row.insertCell().textContent = q.id || q.quotationId || 'N/A';
                    row.insertCell().textContent = q.customerName || q.customer?.name || 'N/A';
                    row.insertCell().textContent = q.dateCreated || q.created_at || 'N/A';
                    const lastUpdatedStr = q.updated_at ? new Date(q.updated_at).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' }) : '—';
                    row.insertCell().textContent = lastUpdatedStr;
                    const grandTotal = parseFloat(q.grandTotal) || 0;
                    row.insertCell().textContent = formatRupee(grandTotal);
                    const itemsCount = q.items ? (Array.isArray(q.items) ? q.items.length : 0) : 0;
                    row.insertCell().textContent = itemsCount;
                    row.insertCell().textContent = q.createdBy || CURRENT_USER_ROLE || 'N/A';

                    const actionCell = row.insertCell();
                    actionCell.className = 'actions';
                    
                    const pdfBtn = document.createElement('button');
                    pdfBtn.className = 'btn primary';
                    pdfBtn.style.cssText = 'padding: 5px 8px; margin-right: 5px;';
                    pdfBtn.innerHTML = '<i class="fas fa-download"></i>';
                    pdfBtn.onclick = () => downloadQuotationAsPdfDirect(q).catch(() => {
                        // Silent fail for PNG generation
                    });
                    actionCell.appendChild(pdfBtn);

                    if (CAN_UPDATE_QUOTATION) {
                        const editBtn = document.createElement('button');
                        editBtn.className = 'btn';
                        editBtn.style.cssText = 'padding: 5px 8px;';
                        editBtn.innerHTML = '<i class="fas fa-edit"></i>';
                        editBtn.onclick = () => editQuotation(q.id || q.quotationId);
                        actionCell.appendChild(editBtn);
                    }
                });
            }
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
                    startPage = 1;
                    endPage = totalPages;
                } else {
                    if (historyCurrentPage <= 4) {
                        startPage = 1;
                        endPage = maxPagesToShow - 1;
                        showEndEllipsis = true;
                    } else if (historyCurrentPage >= totalPages - 3) {
                        startPage = totalPages - (maxPagesToShow - 2);
                        endPage = totalPages;
                        showStartEllipsis = true;
                    } else {
                        startPage = historyCurrentPage - 2;
                        endPage = historyCurrentPage + 2;
                        showStartEllipsis = true;
                        showEndEllipsis = true;
                    }
                }

                if (showStartEllipsis) {
                    const firstBtn = document.createElement('button');
                    firstBtn.className = 'pagination-page-btn';
                    firstBtn.textContent = '1';
                    firstBtn.onclick = () => {
                        historyCurrentPage = 1;
                        const searchInput = document.getElementById('historySearchInput');
                        const filter = searchInput ? searchInput.value : '';
                        renderHistoryList(filter);
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
                    if (i === historyCurrentPage) {
                        pageBtn.classList.add('active');
                    }
                    pageBtn.textContent = i;
                    
                    pageBtn.onclick = () => {
                        historyCurrentPage = i;
                        const searchInput = document.getElementById('historySearchInput');
                        const filter = searchInput ? searchInput.value : '';
                        renderHistoryList(filter);
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
                        historyCurrentPage = totalPages;
                        const searchInput = document.getElementById('historySearchInput');
                        const filter = searchInput ? searchInput.value : '';
                        renderHistoryList(filter);
                    };
                    pageNumbersDiv.appendChild(lastBtn);
                }
            }

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
            
            const searchInput = document.getElementById('historySearchInput');
            const filter = searchInput ? searchInput.value : '';
            renderHistoryList(filter);
        }

        async function fetchQuotationAndGeneratePdf(quotationId) {
            try {
                const response = await apiFetch(`/quotations/${quotationId}`);
                let quotation = null;
                
                if (response) {
                    quotation = Array.isArray(response) ? response[0] : (response.data || response);
                } else {
                    // Fallback to local data
                    quotation = quotationHistory.find(q => (q.id || q.quotationId) === quotationId);
                }
                
                if (!quotation) {
                    alert('Quotation not found.');
                    return;
                }
                
                // Download as PDF
                await downloadQuotationAsPdfDirect(quotation);
            } catch (error) {
                // Try local data
                const localQuote = quotationHistory.find(q => (q.id || q.quotationId) === quotationId);
                if (localQuote) {
                    await downloadQuotationAsPdfDirect(localQuote);
                } else {
                    alert('Failed to fetch quotation for PDF download.');
                }
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
                let quote = null;
                const response = await apiFetch(`/quotations/${quotationId}`);
                if (response) {
                    quote = Array.isArray(response) ? response[0] : (response.data || response);
                } else {
                    // Fallback to local data
                    quote = quotationHistory.find(q => (q.id || q.quotationId) === quotationId);
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

        async function cloneQuotation(quotationId) {
            try {
                const response = await apiFetch(`/quotations/${quotationId}`);
                let quote = null;
                
                if (response) {
                    quote = Array.isArray(response) ? response[0] : (response.data || response);
                } else {
                    // Fallback to local data
                    quote = quotationHistory.find(q => (q.id || q.quotationId) === quotationId);
                }

                if (!quote) {
                    alert('Quotation not found.');
                    return;
                }

                if (!confirm(`Are you sure you want to clone quotation ${quotationId}? This will replace current items in the Create Quotation section.`)) {
                    return;
                }

                // Set to create mode since cloning is creating a new quotation
                isCreatingNewQuotation = true;

                // Load customer details
                const customer = quote.customer || {};
                document.getElementById('cust-name').value = customer?.name || quote.customerName || '';
                document.getElementById('phone-number').value = customer?.phone || quote.customerPhone || '';
                document.getElementById('cust-email').value = customer?.email || quote.customerEmail || '';
                document.getElementById('cust-address').value = customer?.address || quote.customerAddress || '';
                
                const discountPercent = parseFloat(quote.discountPercent) || 0;
                const discountPercentInput = document.getElementById('discount-percent');
                if (discountPercentInput) discountPercentInput.value = discountPercent;

                // Load items
                const items = quote.items || [];
                quotationItems = items.map(item => ({
                    productId: item.productId || item.id,
                    productName: item.productName || item.name,
                    description: item.description || '',
                    price: parseFloat(item.price) || 0,
                    gstRate: parseFloat(item.gstRate) || (SETTINGS.gstRate * 100),
                    quantity: parseInt(item.quantity) || 1,
                }));

                renderQuotationItems();
                updateGrandTotal();

                // Switch to create quotation section
                showSection('createQuotation');
                document.querySelector('#sideNav a[data-tab="createQuotation"]')?.click();

                alert(`Quotation ${quotationId} cloned successfully.`);
            } catch (error) {
                alert('Failed to clone quotation.');
            }
        }

        async function renderLogsList() {
            const tableBody = document.getElementById('logsListBody');
            if (!tableBody) {
                return;
            }
            tableBody.innerHTML = '';

            try {
                // Try to get logs from API first, fallback to local AUDIT_LOGS
                const logsResponse = await getLogs();
                const logs = Array.isArray(logsResponse) ? logsResponse : (logsResponse?.data || AUDIT_LOGS);
                
                if (!Array.isArray(logs) || logs.length === 0) {
                    tableBody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding: 20px;">No user activity logs recorded yet.</td></tr>';
                    return;
                }

                // Sort by timestamp (most recent first)
                const sortedLogs = logs.slice().sort((a, b) => {
                    const timeA = new Date(a.timestamp || a.created_at || 0).getTime();
                    const timeB = new Date(b.timestamp || b.created_at || 0).getTime();
                    return timeB - timeA;
                });

                sortedLogs.forEach(log => {
                    const row = tableBody.insertRow();
                    
                    // Timestamp
                    const timestamp = new Date(log.timestamp || log.created_at || Date.now());
                    row.insertCell().textContent = timestamp.toLocaleString('en-IN');
                    
                    // User
                    row.insertCell().textContent = log.user || 'N/A';
                    
                    // Role
                    row.insertCell().textContent = log.role || CURRENT_USER_ROLE;
                    
                    // Action
                    row.insertCell().textContent = log.action || 'N/A';
                    
                    // Details
                    row.insertCell().textContent = log.details || 'N/A';
                });
            } catch (error) {
                // Fallback to local logs
            if (AUDIT_LOGS.length === 0) {
                    tableBody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding: 20px;">No user activity logs recorded yet.</td></tr>';
                return;
            }

                AUDIT_LOGS.forEach(log => {
                    const row = tableBody.insertRow();
                    
                    const timestamp = new Date(log.timestamp || Date.now());
                    row.insertCell().textContent = timestamp.toLocaleString('en-IN');
                    row.insertCell().textContent = log.user || CURRENT_USER_ROLE;
                    row.insertCell().textContent = CURRENT_USER_ROLE;
                    row.insertCell().textContent = log.action || 'N/A';
                    row.insertCell().textContent = log.details || 'N/A';
                });
            }
        }

        async function renderSettings() {
            try {
                // Try to get settings from API
                const settingsResponse = await apiFetch('/settings');
                const settings = settingsResponse?.data || settingsResponse || SETTINGS;
                
                // Update GST percentage display if element exists
                const gstRateDisplay = document.getElementById('gstRateDisplay');
                if (gstRateDisplay) {
                    const gstRate = settings.defaultGst || (SETTINGS.gstRate * 100);
                    gstRateDisplay.textContent = `${gstRate}%`;
                }
                
                // Update validity days display if element exists
                const defaultValidityDisplay = document.getElementById('defaultValidityDisplay');
                if (defaultValidityDisplay) {
                    const validityDays = settings.validityDays || SETTINGS.defaultValidityDays;
                    defaultValidityDisplay.textContent = `${validityDays} days`;
                }
                
                // Update settings form fields if they exist
                const settingsGstPercent = document.getElementById('settings-gst-percent');
                if (settingsGstPercent) {
                    settingsGstPercent.value = settings.defaultGst || (SETTINGS.gstRate * 100);
                }
                
                const settingsValidityDays = document.getElementById('settings-validity-days');
                if (settingsValidityDays) {
                    settingsValidityDays.value = settings.validityDays || SETTINGS.defaultValidityDays;
                }
                
                const validityDaysDisplay = document.getElementById('validityDaysDisplay');
                if (validityDaysDisplay) {
                    validityDaysDisplay.textContent = settings.validityDays || SETTINGS.defaultValidityDays;
                }
                
                const settingsBrandName = document.getElementById('settings-brand-name');
                if (settingsBrandName) {
                    settingsBrandName.value = settings.brand || '';
                }
                
                const settingsCompanyGstId = document.getElementById('settings-company-gst-id');
                if (settingsCompanyGstId) {
                    settingsCompanyGstId.value = settings.companyGstId || '';
                }
                
                // Logo handling
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
            } catch (error) {
                // Use default settings if API fails
                const gstRateDisplay = document.getElementById('gstRateDisplay');
                if (gstRateDisplay) {
                    gstRateDisplay.textContent = `${(SETTINGS.gstRate * 100).toFixed(0)}%`;
                }
                
                const defaultValidityDisplay = document.getElementById('defaultValidityDisplay');
                if (defaultValidityDisplay) {
                    defaultValidityDisplay.textContent = `${SETTINGS.defaultValidityDays} days`;
        }
            }
        }

        // --- API Helper Functions ---
        async function apiFetch(endpoint, options = {}) {
            try {
                // Auth: session cookie (credentials) + X-User-Email fallback when cookie not sent (e.g. cross-origin / cPanel)
                const authHeaders = {};
                const email = localStorage.getItem(LS_KEYS.userEmail);
                if (email) authHeaders['X-User-Email'] = email;
                const token = localStorage.getItem('token');
                if (token) authHeaders['Authorization'] = 'Bearer ' + token;
                const fetchOptions = {
                    ...options,
                    credentials: 'include',
                    headers: { ...authHeaders, ...(options.headers || {}) }
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

        async function uploadImageDataUrl(dataUrl) {
            const res = await apiFetch('/upload-image', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ dataUrl: dataUrl })
            });
            const data = res && (res.data || res);
            const url = (data && data.url) || (data && data.path);
            if (!url) throw new Error('Upload failed: no URL returned');
            return url;
        }

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

        // --- Quotation draft system (Saved drafts) ---
        async function loadQuotationDrafts(alsoRefreshPageList) {
            try {
                const res = await apiFetch('/drafts/quotations');
                if (res == null) {
                    renderQuotationDraftsList([], 'quotationDraftsList');
                    if (currentSectionId === 'quotationDrafts') renderQuotationDraftsList([], 'quotationDraftsPageList');
                    return;
                }
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
            el.innerHTML = drafts.map(function (d) {
                const label = (d.customer && d.customer.phone) ? String(d.customer.phone) : (d.draftQuotationId || 'Draft #' + d.id);
                const dateStr = d.updated_at ? new Date(d.updated_at).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' }) : '';
                return '<div class="draft-row" data-draft-id="' + d.id + '" style="padding:10px; border:1px solid #e5e7eb; border-radius:8px; margin-bottom:8px; background:#fafafa;">' +
                    '<div style="font-weight:500; font-size:13px;">' + label + '</div>' +
                    '<div class="muted" style="font-size:11px; margin-top:4px;">' + dateStr + ' · ' + (d.items || []).length + ' items</div>' +
                    '<div style="margin-top:8px; display:flex; gap:6px; flex-wrap:wrap;">' +
                    '<button type="button" class="btn" style="padding:4px 10px; font-size:12px;" data-action="resume-quotation-draft" data-id="' + d.id + '">Resume</button>' +
                    '<button type="button" class="btn primary" style="padding:4px 10px; font-size:12px;" data-action="convert-quotation-draft" data-id="' + d.id + '">Convert to quotation</button>' +
                    '<button type="button" class="btn" style="padding:4px 10px; font-size:12px; color:#dc3545;" data-action="delete-quotation-draft" data-id="' + d.id + '">Delete</button>' +
                    '</div></div>';
            }).join('');
        }

        function buildQuotationDraftPayload() {
            const customerName = document.getElementById('cust-name')?.value.trim() || '';
            const phoneNumber = document.getElementById('phone-number')?.value.trim() || '';
            const customerEmail = document.getElementById('cust-email')?.value.trim() || '';
            const customerAddress = document.getElementById('cust-address')?.value.trim() || '';
            const items = getQuotationItems();
            const hasAnyContent = phoneNumber || customerName || customerEmail || customerAddress || (items && items.length > 0);
            if (!hasAnyContent) return null;
            var subTotal = 0;
            if (items && items.length) {
                subTotal = items.reduce(function (sum, item) { return sum + (parseFloat(item.price || 0) * (item.quantity || 1)); }, 0);
            }
            const discountPercent = parseFloat(document.getElementById('discount-percent')?.value || 0) || 0;
            const discountAmount = subTotal * (discountPercent / 100);
            var totalGstAmount = 0;
            if (items && items.length) {
                totalGstAmount = items.reduce(function (sum, item) { return sum + (item.price * item.quantity * (parseFloat(item.gstRate || 0) / 100)); }, 0);
            }
            const grandTotal = (subTotal - discountAmount) + totalGstAmount;
            const itemsForApi = (items || []).map(function (item) {
                return {
                    productId: String(item.productId || item.id || ''),
                    productName: String(item.productName || item.name || ''),
                    price: String(parseFloat(item.price || 0).toFixed(2)),
                    quantity: parseInt(item.quantity || 1, 10),
                    gstRate: String(parseFloat(item.gstRate || 0).toFixed(2))
                };
            });
            return {
                draftId: currentQuotationDraftId || undefined,
                dateCreated: new Date().toLocaleDateString('en-IN'),
                customer: { name: customerName || '—', phone: phoneNumber || '0', email: customerEmail || null, address: customerAddress || null },
                items: itemsForApi,
                images: (typeof getEmployeeUploadedImages === 'function' ? getEmployeeUploadedImages() : []) || [],
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

        function saveDraftWithKeepalive() {
            if (currentSectionId === 'createQuotation') {
                const payload = buildQuotationDraftPayload();
                if (payload) {
                    var url = API_BASE + '/drafts/quotations';
                    fetch(url, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(payload),
                        credentials: 'include',
                        keepalive: true
                    }).catch(function () {});
                }
            }
        }

        function scheduleQuotationDraftSave() {
            if (draftQuotationDebounceId) clearTimeout(draftQuotationDebounceId);
            draftQuotationDebounceId = setTimeout(function () {
                draftQuotationDebounceId = null;
                if (currentSectionId === 'createQuotation') saveQuotationDraftToServer();
            }, DRAFT_DEBOUNCE_MS);
        }

        async function resumeQuotationDraft(draftId) {
            try {
                const res = await apiFetch('/drafts/quotations/' + draftId);
                const d = res.data || res;
                if (!d) return;
                currentQuotationDraftId = d.id;
                var custNameEl = document.getElementById('cust-name');
                if (custNameEl) custNameEl.value = (d.customer && d.customer.name) ? d.customer.name : '';
                var phoneEl = document.getElementById('phone-number');
                if (phoneEl) phoneEl.value = (d.customer && d.customer.phone) ? d.customer.phone : '';
                var emailEl = document.getElementById('cust-email');
                if (emailEl) emailEl.value = (d.customer && d.customer.email) ? d.customer.email : '';
                var addrEl = document.getElementById('cust-address');
                if (addrEl) addrEl.value = (d.customer && d.customer.address) ? d.customer.address : '';
                var discountPercentInput = document.getElementById('discount-percent');
                if (discountPercentInput) discountPercentInput.value = d.discountPercent != null ? d.discountPercent : 0;
                quotationItems = (d.items || []).map(function (it) {
                    return { productId: it.productId, productName: it.productName, type: it.type || '', price: it.price, quantity: it.quantity || 1, gstRate: it.gstRate != null ? it.gstRate : 0 };
                });
                employeeUploadedImages = Array.isArray(d.images) && d.images.length > 0 ? [d.images[0]] : [];
                renderEmployeeImagePreviews();
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
                await apiFetch('/drafts/quotations/' + draftId + '/convert', { method: 'POST' });
                if (currentQuotationDraftId === draftId) currentQuotationDraftId = null;
                loadQuotationDrafts(true);
                alert('Quotation created from draft successfully.');
                renderHistoryList();
                updateSummary();
            } catch (e) {
                alert(e.message || 'Failed to convert draft.');
            }
        }

        async function deleteQuotationDraft(draftId) {
            if (!confirm('Delete this draft?')) return;
            try {
                await apiFetch('/drafts/quotations/' + draftId, { method: 'DELETE' });
                if (currentQuotationDraftId === draftId) currentQuotationDraftId = null;
                loadQuotationDrafts(true);
            } catch (e) {
                console.warn('Delete draft failed:', e);
            }
        }

        async function getItems() {
            console.trace('🔍 getItems called - tracking API call origin');
            
            // Use cached data if available to prevent API spam
            if (window.cachedItems) {
                console.log('✅ Using cached items - no API call');
                return window.cachedItems;
            }
            
            try {
                const response = await apiFetch('/items');
                if (!response) {
                    console.warn('No items response from API');
                    return []; // Return empty array instead of hardcoded products
                }
                const items = Array.isArray(response) ? response : (response.data || []);
                // Cache the result
                window.cachedItems = items;
                return items;
            } catch (error) {
                console.error('Error fetching items:', error);
                return []; // Return empty array instead of hardcoded products
            }
        }

        async function getGstRules() {
            console.trace('🔍 getGstRules called - tracking API call origin');
            
            // Use cached data if available to prevent API spam
            if (window.cachedGstRules) {
                console.log('✅ Using cached GST rules - no API call');
                return window.cachedGstRules;
            }
            
            try {
                const response = await apiFetch('/gst_rules');
                const gstRules = Array.isArray(response) ? response : (response.data || []);
                // Cache the result
                window.cachedGstRules = gstRules;
                return gstRules;
            } catch (error) {
                console.error('Error fetching GST rules:', error);
                return []; // Fallback to empty array
            }
        }

        async function getQuotations() {
            try {
                const response = await apiFetch('/quotations');
                if (!response) return quotationHistory; // Fallback to local data
                const quotations = Array.isArray(response) ? response : (response.data || []);
                // Merge with local quotationHistory if API data is available
                return quotations.length > 0 ? quotations : quotationHistory;
            } catch (error) {
                return quotationHistory; // Fallback to local data
            }
        }

        async function getCustomers() {
            try {
                const response = await apiFetch('/customers');
                return Array.isArray(response) ? response : (response?.data || []);
            } catch (error) {
                return []; // Fallback to empty for customer list
            }
        }

        async function getLogs() {
            try {
                const response = await apiFetch('/logs');
                if (!response) return AUDIT_LOGS; // Fallback to local data
                return Array.isArray(response) ? response : (response.data || AUDIT_LOGS);
            } catch (error) {
                return AUDIT_LOGS; // Fallback to local data
            }
        }

        function formatRupee(amount) {
            return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(amount);
        }

        async function updateSummary() {
            try {
                const itemsResponse = await getItems();
                const quotationsResponse = await getQuotations();
                const logsResponse = await getLogs();

                // Handle API response format
                const items = Array.isArray(itemsResponse) ? itemsResponse : (itemsResponse?.data || []);
                const quotations = Array.isArray(quotationsResponse) ? quotationsResponse : (quotationsResponse?.data || quotationHistory);
                const logs = Array.isArray(logsResponse) ? logsResponse : (logsResponse?.data || AUDIT_LOGS);

                // Update basic counts
                const itemsCountEl = document.getElementById('summaryItemsCount');
                if (itemsCountEl) itemsCountEl.textContent = items.length || 0;

                const quotationsCountEl = document.getElementById('summaryQuotationsCount');
                if (quotationsCountEl) quotationsCountEl.textContent = quotations.length || 0;

                // Logs count removed - Logs section removed from employee dashboard
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
                
                const openAction = CAN_UPDATE_QUOTATION ? `editQuotation('${quotationId}')` : `viewQuotationDetails('${quotationId}')`;
                return `
                    <div style="padding: 10px; border-bottom: 1px solid #f2f6fb; cursor: pointer;" 
                         onclick="${openAction}"
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
                const actionText = log.action || '';
                if (actionText.toLowerCase().includes('price')) actionIcon = 'fa-rupee-sign';
                else if (actionText.toLowerCase().includes('product') || actionText.toLowerCase().includes('item')) actionIcon = 'fa-box';
                else if (actionText.toLowerCase().includes('quotation') || actionText.toLowerCase().includes('quote')) actionIcon = 'fa-file-invoice-dollar';
                else if (actionText.toLowerCase().includes('customer')) actionIcon = 'fa-users';
                else if (actionText.toLowerCase().includes('delete')) actionIcon = 'fa-trash-alt';
                else if (actionText.toLowerCase().includes('create') || actionText.toLowerCase().includes('add')) actionIcon = 'fa-plus-circle';
                else if (actionText.toLowerCase().includes('update') || actionText.toLowerCase().includes('edit')) actionIcon = 'fa-edit';
                else if (actionText.toLowerCase().includes('login') || actionText.toLowerCase().includes('switch')) actionIcon = 'fa-sign-in-alt';
                
                // Truncate details if too long
                const details = log.details || log.action || '';
                const truncatedDetails = details.length > 50 ? details.substring(0, 50) + '...' : details;
                
                return `
                    <div style="padding: 10px; border-bottom: 1px solid #f2f6fb;">
                        <div style="display: flex; align-items: flex-start; gap: 10px;">
                            <i class="fas ${actionIcon}" style="color: #3498DB; font-size: 16px; margin-top: 2px;"></i>
                            <div style="flex: 1;">
                                <div style="font-weight: bold; color: #34495E; font-size: 14px;">${actionText || 'N/A'}</div>
                                ${truncatedDetails && truncatedDetails !== actionText ? `<div style="font-size: 12px; color: #95a5a6; margin-top: 2px;">${truncatedDetails}</div>` : ''}
                                <div style="font-size: 11px; color: #7f8c8d; margin-top: 4px;">
                                    <i class="fas fa-user" style="margin-right: 4px;"></i>${log.user || log.role || 'N/A'}
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

        /* ---------- Helper Functions ---------- */
        /**
         * Formats a number as Indian Rupee (INR) currency.
         * @param {number} amount
         * @returns {string} Formatted currency string.
         */
        function formatCurrency(amount) {
            return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(amount);
        }

        /**
         * Calculates the due date by adding validity days to the creation date.
         * @param {string} dateCreated
         * @param {number} validityDays
         * @returns {string} Formatted due date string (DD/MM/YYYY).
         */
        function getDueDate(dateCreated, validityDays) {
            const date = new Date(dateCreated);
            date.setDate(date.getDate() + validityDays);
            return date.toLocaleDateString('en-IN');
        } 
        
        // **********************************************
        // <<< FIX: This function was missing and is CRITICAL for the Create/Update button to work. >>>
        /**
         * Returns the global array of quotation items.
         * @returns {Array} The quotationItems array.
         */
        function getQuotationItems() {
            return quotationItems;
        }
        // **********************************************

        // --- UI & Navigation ---
        /**
         * Switches the active section of the dashboard.
         * @param {string} id - The ID of the section to show (e.g., 'dashboard', 'quotation', 'history').
         */
        function showSection(id) {
            currentSectionId = id || '';
            // Clear draft auto-save when leaving create quotation
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
            // Update section display
            document.querySelectorAll('.content-section').forEach(section => {
                section.style.display = 'none';
            });
            const targetSection = document.getElementById(id);
            if (targetSection) {
                targetSection.style.display = 'flex';
            }

            // Update navigation active states
            document.querySelectorAll('#sideNav a').forEach(link => {
                link.classList.remove('active');
            });
            document.querySelectorAll('.tab-btn').forEach(btn => {
                btn.classList.remove('active');
            });

            let sideNavTab = id;
            if (id === 'viewHistory' || id === 'quotationDrafts') sideNavTab = 'createQuotation';
            else if (id === 'addItem' || id === 'itemDrafts') sideNavTab = 'itemsList';
            document.querySelector(`#sideNav a[data-tab="${sideNavTab}"]`)?.classList.add('active');
            document.querySelector(`.section-tabs button[data-tab="${id}"]`)?.classList.add('active');

            // Load section-specific data
            if (id === 'viewHistory') {
                renderHistoryList();
            } else if (id === 'viewCustomers') {
                renderCustomersList();
                renderCustomerDetailsList();
            } else if (id === 'createQuotation') {
                renderQuotationTypeFilters();
                renderAvailableItemsForQuotation();
                renderQuotationItems();
                updateGrandTotal();
                loadQuotationDrafts();
                const createBtn = document.getElementById('createQuotationBtn');
                const cancelEditBtn = document.getElementById('cancelEditInCreateSectionBtn');
                const sectionTitle = document.getElementById('createQuotationSectionTitle');
                if (currentEditQuotationId) {
                    if (createBtn) createBtn.innerHTML = '<i class="fas fa-edit"></i> Edit Quotation';
                    document.querySelectorAll('#sideNav a[data-tab="createQuotation"], .section-tabs .tab-btn[data-tab="createQuotation"]').forEach(el => {
                        el.innerHTML = el.tagName === 'A' ? '<i class="fas fa-file-invoice-dollar"></i> Edit Quotation' : 'Edit Quotation';
                    });
                    if (sectionTitle) sectionTitle.textContent = 'Edit Quotation';
                    if (cancelEditBtn) cancelEditBtn.style.display = '';
                } else {
                    if (createBtn) createBtn.innerHTML = '<i class="fas fa-file-invoice-dollar"></i> Create Quotation';
                    document.querySelectorAll('#sideNav a[data-tab="createQuotation"], .section-tabs .tab-btn[data-tab="createQuotation"]').forEach(el => {
                        el.innerHTML = el.tagName === 'A' ? '<i class="fas fa-file-invoice-dollar"></i> Quotations' : 'Quotations';
                    });
                    if (sectionTitle) sectionTitle.textContent = 'Create Quotation';
                    if (cancelEditBtn) cancelEditBtn.style.display = 'none';
                    draftQuotationIntervalId = setInterval(function () { saveQuotationDraftToServer(); loadQuotationDrafts(); }, DRAFT_AUTO_SAVE_MS);
                }
            } else if (id === 'quotationDrafts') {
                loadQuotationDrafts(true);
            }
        }

        // Add search functionality for history and item search
        let domListenersInitialized = false;
        let typeFilterHandlersSet = false;
        document.addEventListener('DOMContentLoaded', function() {
            if (domListenersInitialized) return;
            domListenersInitialized = true;

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
            updateSidebarTime();
            setInterval(updateSidebarTime, 1000);
            
            const historySearchInput = document.getElementById('historySearchInput');
            if (historySearchInput) {
                // Remove existing listeners
                const newHistoryInput = historySearchInput.cloneNode(true);
                historySearchInput.parentNode.replaceChild(newHistoryInput, historySearchInput);
                
                newHistoryInput.addEventListener('input', function(e) {
                    renderHistoryList(e.target.value);
                });
            }
            
            const itemSearchInput = document.getElementById('itemSearchInput');
            if (itemSearchInput) {
                // Remove existing listeners
                const newItemInput = itemSearchInput.cloneNode(true);
                itemSearchInput.parentNode.replaceChild(newItemInput, itemSearchInput);
                
                newItemInput.addEventListener('input', function(e) {
                    const activeTypeFilter = document.querySelector('.type-filter-btn.active')?.dataset.type || '';
                    renderAvailableItemsForQuotation(e.target.value, activeTypeFilter);
                });

                // Connect customer search input
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
                        customerDetailsCurrentPage = 1;
                        renderCustomerDetailsList(filter);
                    });
                }
                // When switching Customer List / Customer Quotation Details tabs, refresh the search bar of the section we're leaving
                document.querySelector('.main')?.addEventListener('click', function(e) {
                    const tab = e.target.closest('.customer-sub-tab');
                    if (!tab) return;
                    const sub = tab.getAttribute('data-customer-subtab');
                    if (sub === 'customerDetails') {
                        const inp = document.getElementById('customerListSearchInput');
                        if (inp) inp.value = '';
                        customersCurrentPage = 1;
                    } else if (sub === 'customerList') {
                        const inp = document.getElementById('customerDetailsSearchInput');
                        if (inp) inp.value = '';
                        customerDetailsCurrentPage = 1;
                    }
                });
            }

            initEditQuotationModal();
            document.getElementById('cancelEditInCreateSectionBtn')?.addEventListener('click', cancelEditInCreateSection);

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

            document.getElementById('quotation-image')?.addEventListener('change', function(e) {
                const file = e.target.files?.[0];
                if (!file) return;
                const err = validateEmployeeImageFile(file);
                if (err) { alert(err); e.target.value = ''; return; }
                const r = new FileReader();
                r.onload = (ev) => { employeeUploadedImages = [ev.target.result]; renderEmployeeImagePreviews(); };
                r.readAsDataURL(file);
                e.target.value = '';
            });
            document.getElementById('removeAllImagesBtn')?.addEventListener('click', clearEmployeeImageUpload);

            // Type filter button handlers - use event delegation (only once)
            if (!typeFilterHandlersSet) {
                typeFilterHandlersSet = true;
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
            }
            
            // Initial load of available items and type filters - wait for cached data
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
        });

        // Event delegation for draft buttons (Saved drafts)
        document.addEventListener('click', async function (e) {
            var btn = e.target.closest && e.target.closest('[data-action][data-id]');
            if (!btn) return;
            var action = btn.getAttribute('data-action');
            var id = parseInt(btn.getAttribute('data-id'), 10);
            if (action === 'resume-quotation-draft') { resumeQuotationDraft(id); return; }
            if (action === 'convert-quotation-draft') { convertQuotationDraft(id); return; }
            if (action === 'delete-quotation-draft') { deleteQuotationDraft(id); return; }
        });

        document.addEventListener('visibilitychange', function () {
            if (document.visibilityState === 'hidden') saveDraftWithKeepalive();
        });
        window.addEventListener('beforeunload', function () {
            saveDraftWithKeepalive();
        });

        (function setupDraftDebounceListeners() {
            var qIds = ['cust-name', 'phone-number', 'cust-email', 'cust-address'];
            qIds.forEach(function (id) {
                var el = document.getElementById(id);
                if (el) {
                    el.addEventListener('input', scheduleQuotationDraftSave);
                    el.addEventListener('change', scheduleQuotationDraftSave);
                }
            });
            var discountEl = document.getElementById('discount-percent');
            if (discountEl) {
                discountEl.addEventListener('input', scheduleQuotationDraftSave);
                discountEl.addEventListener('change', scheduleQuotationDraftSave);
            }
        })();

        // Original showSection function (keeping for backward compatibility)
        function showSectionOld(id) {
            document.querySelectorAll('.content-section').forEach(section => {
                section.style.display = 'none';
            });
            document.getElementById(id).style.display = 'block';

            document.querySelectorAll('.sidebar a').forEach(link => {
                link.classList.remove('active');
            });
            document.querySelector(`.sidebar a[href="#${id}"]`).classList.add('active');
        }

        function applyRoleRestrictions() {
            // Employee role can create, view history, and view logs.
            // No specific restrictions are applied in this simple model, but this function is a placeholder.
        }

        // --- PDF Generation ---
        async function getSettings() {
            try {
                const response = await apiFetch('/settings');
                // API returns { success, data: { brand, companyGstId, ... } } – same source as owner/admin so settings apply everywhere
                const data = response?.data ?? response ?? {};
                if (typeof data === 'object' && data !== null) {
                    return data;
                }
            } catch (error) {
                // Fallback below
            }
            return {
                logo: '',
                brand: 'TECHTITANS',
                companyGstId: 'N/A',
                validityDays: 3,
                defaultValidityDays: 3,
                pdfTheme: 'default',
                companyAddress: '1102, second Floor, Before Atithi Satkar Hotel OTC Road, Bangalore 560002',
                companyEmail: 'advanceinfotech21@gmail.com',
                companyPhone: '+91 63626 18184'
            };
        }

        const PDF_THEMES = {
            default: { name: 'Default (Blue)', primary: '#3A648C', secondary: '#111827', border: '#e5e7eb', accent: '#35b3e7', pastelBg: '#f0f7ff' },
            green: { name: 'Green', primary: '#059669', secondary: '#064e3b', border: '#d1fae5', accent: '#10b981', pastelBg: '#f0fdf4' },
            red: { name: 'Red', primary: '#dc2626', secondary: '#7f1d1d', border: '#fee2e2', accent: '#ef4444', pastelBg: '#fef2f2' },
            purple: { name: 'Purple', primary: '#7c3aed', secondary: '#4c1d95', border: '#ede9fe', accent: '#8b5cf6', pastelBg: '#faf5ff' },
            orange: { name: 'Orange', primary: '#ea580c', secondary: '#7c2d12', border: '#fed7aa', accent: '#f97316', pastelBg: '#fff7ed' },
            teal: { name: 'Teal', primary: '#0d9488', secondary: '#134e4a', border: '#ccfbf1', accent: '#14b8a6', pastelBg: '#f0fdfa' },
            gray: { name: 'Gray', primary: '#374151', secondary: '#111827', border: '#f3f4f6', accent: '#6b7280', pastelBg: '#f8fafc' }
        };

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
        function getPdfThemeOverride() { try { return localStorage.getItem(PDF_THEME_OVERRIDE_KEY) || null; } catch (e) { return null; } }
        function getEffectivePdfThemes() {
            const map = { ...PDF_THEMES };
            return map;
        }
        function getEffectivePdfThemeKey(settings) {
            const override = getPdfThemeOverride();
            if (override) return override;
            return (settings && settings.pdfTheme) ? settings.pdfTheme : 'default';
        }
        function showPdfLoadingOverlay() {
            if (document.getElementById('pdfLoadingOverlay')) return;
            const el = document.createElement('div');
            el.id = 'pdfLoadingOverlay';
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

        async function generateQuotationHtml(quotation, options = {}) {
            // MUST be first: declare discountPercent before any use (avoids TDZ ReferenceError)
            const discountPercent = Number(quotation.discountPercent) || 0;

            // Normalize quotation data (handle both API format and local format)
            const quotationId = quotation.quotationId || quotation.id;
            const dateCreated = quotation.dateCreated || quotation.date_created;
            const customer = quotation.customer || {
                name: quotation.customerName,
                phone: quotation.customerPhone || quotation.phone,
                email: quotation.customerEmail || quotation.email,
                address: quotation.customerAddress || quotation.address
            };
            let items = quotation.items || quotation.products || quotation.lineItems || [];
            
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

            // Apply Quotation Products display order from Settings to PDF (same order as Create/Edit UI; persists after product edits)
            if (!Array.isArray(items)) items = [];
            try {
                const settingsForOrder = await getSettings();
                const rawOrder = (settingsForOrder && (settingsForOrder.quotationItemTypeOrder || settingsForOrder.quotationTypeFilters)) || [];
                const displayOrder = Array.isArray(rawOrder) && rawOrder.length > 0
                    ? rawOrder.map(function (x) { return (x || '').toString().toLowerCase().trim(); }).filter(Boolean)
                    : DEFAULT_QUOTATION_ITEM_TYPE_ORDER.slice();
                if (displayOrder.length > 0) {
                    items = items.slice().sort(function (a, b) {
                        return getQuotationCategorySortIndex(a.type, displayOrder) - getQuotationCategorySortIndex(b.type, displayOrder);
                    });
                }
            } catch (e) {
                items = items.slice().sort(function (a, b) {
                    return getQuotationCategorySortIndex(a.type, DEFAULT_QUOTATION_ITEM_TYPE_ORDER) - getQuotationCategorySortIndex(b.type, DEFAULT_QUOTATION_ITEM_TYPE_ORDER);
                });
            }
            
            // ALWAYS recalculate totals (same as owner.js)
            let subTotal = parseFloat(quotation.subTotal) || 0;
            let discountAmount = parseFloat(quotation.discountAmount) || (subTotal * discountPercent / 100);
            let totalAfterDiscount = subTotal - discountAmount;
            let totalGstAmount = parseFloat(quotation.totalGstAmount) || parseFloat(quotation.gst) || 0;
            let grandTotal = parseFloat(quotation.grandTotal) || (totalAfterDiscount + totalGstAmount);
            
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

            const settings = await getSettings();
            const logoBase64 = '';
            const brandName = settings.brand || 'TECHTITANS';
            const companyGstId = settings.companyGstId || 'N/A';
            const validityDays = quotation.validityDays || settings.validityDays || settings.defaultValidityDays || 3;
            const pdfThemeName = getEffectivePdfThemeKey(settings);
            const themeMap = getEffectivePdfThemes();
            const theme = themeMap[pdfThemeName] || themeMap.default;
            const pdfFontPrimary = getPdfFontFamilyCss(getEffectivePdfFontPrimary());
            const pdfFontSecondary = getPdfFontFamilyCss(getEffectivePdfFontSecondary());
            const pdfFontTertiary = getPdfFontFamilyCss(getEffectivePdfFontTertiary());
            const companyAddress = settings.companyAddress || '1102, second Floor, Before Atithi Satkar<br>Hotel OTC Road, Bangalore 560002';
            const companyEmail = settings.companyEmail || 'advanceinfotech21@gmail.com';
            const companyPhone = settings.companyPhone || '+91 63626 18184 | +91 80507 02019';

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
                    ${showHeaderSection ? `<div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 40px; margin-top: 120px;"><div><div style="font-size: 14px; font-weight: 600; color: ${theme.primary}; margin-top: 8px; margin-bottom: 4px;">Advance InfoTech</div><div style="font-size: 12px; color: #6b7280;">${companyAddress}</div><div style="font-size: 12px; color: #6b7280;">${companyEmail}</div><div style="font-size: 12px; color: #6b7280;">${companyPhone}</div></div><div style="flex: 1; text-align: center;"><h1 style="margin: 0; font-size: 26px; font-weight: 600; color: ${theme.primary}; letter-spacing: -0.02em; font-family: ${pdfFontPrimary};">Quotation</h1></div><div style="width: 200px;"></div></div>
                    <div style="display: flex; justify-content: space-between; margin-bottom: 32px; padding-bottom: 24px; border-bottom: 1px solid ${theme.border};"><div>${(function() { const line1 = [customer?.name, customer?.phone, customer?.email].filter(Boolean); const addr = customer?.address; if (!line1.length && !addr) return ''; return `<div style="font-size: 14px; font-weight: 600; color: ${theme.primary}; margin-bottom: 4px;">Quotation to</div><div style="font-size: 12px; color: #374151; "><span style="font-weight: 600;">${line1.map((part, i) => (i ? ' <span style="font-weight: 700; margin: 0 0.35em;">|</span> ' : '') + part).join('')}</span>${addr ? '<br><span style="font-weight: 600;">' + addr + '</span>' : ''}</div>`; })()}</div><div style="text-align: right;"><div style="font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; color: #6b7280;">Date</div><div style="font-size: 14px;">${dateCreated}</div></div></div>` : ''}
                    <table class="q-table"><thead><tr><th>S.No</th><th>Type</th><th>Description</th><th class="text-right">Unit Price</th><th class="text-right">Qty</th><th class="text-right">Amount</th></tr></thead><tbody>${itemsForTable.length > 0 ? itemsForTable.map((item, idx) => { const itemPrice = parseFloat(item.price || 0); const itemQuantity = parseInt(item.quantity || 1); const itemTotal = itemPrice * itemQuantity; return `<tr><td>${snoOffset + idx + 1}</td><td>${item.type || 'N/A'}</td><td>${item.productName || 'N/A'}</td><td class="text-right">${formatRupee(itemPrice)}</td><td class="text-right">${itemQuantity}</td><td class="text-right">${formatRupee(itemTotal)}</td></tr>`; }).join('') : '<tr><td colspan="6" style="text-align: center; padding: 24px; color: #9ca3af;">No items</td></tr>'}</tbody></table>
                    ${showTotals ? `<div style="margin-top: 24px; text-align: right; padding-bottom: 24px; border-bottom: 1px solid ${theme.border};"><div style="display: inline-block; width: 260px; text-align: right;"><div style="display: flex; justify-content: space-between; padding: 8px 0; font-size: 14px;"><span style="color: #6b7280;">Subtotal (excl). GST)</span><span>${formatRupee(totalAfterDiscount)}</span></div><div style="display: flex; justify-content: space-between; padding: 12px 0; margin-top: 8px; border-top: 2px solid ${theme.primary}; font-size: 16px; font-weight: 600;"><span>Total</span><span>${formatRupee(grandTotal)}</span></div></div></div>` : ''}
                    ${showFooterSection ? `<div style="position: absolute; bottom: 48px; left: 56px; right: 56px; font-size: 14px; text-align: center; line-height: 1.7; color: #5c5c5c;">${pageNumFooter ? `<div style="margin-bottom: 8px; font-weight: 600;">${pageNumFooter}</div>` : ''}<div>Free <span style="color: ${theme.primary}">Pan-India shipping</span> available, 100% genuine parts with proper GST invoice, and direct brand/manufacturer warranty on all components.</div><div>Includes <span style="color: ${theme.primary}">3-year</span> technical call support <span style="color: ${theme.accent}">(Monday to Saturday, 12 PM–7 PM)</span> and Windows 11 Pro installation with lifetime license support.</div><div>Prices valid for <span style="color: ${theme.primary}">limited time</span> due to frequent market changes in GPU/RAM/SSD.</div></div>` : ''}
                </div>
            `;
        }

        // --- PDF Download Logic (modal) ---
        async function downloadQuotationAsPdf(quotation) {
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

        async function generateQuotationPDF(quotationId, quotationData = null) {
            let quotation = quotationData;
            if (!quotation) {
                try {
                    const response = await apiFetch(`/quotations/${quotationId}`);
                    if (response) quotation = Array.isArray(response) ? response[0] : (response.data || response);
                } catch (e) {}
                if (!quotation) quotation = quotationHistory.find(q => (q.id || q.quotationId) === quotationId);
            }
            if (!quotation) {
                alert("Quotation not found.");
                return;
            }
            await downloadQuotationAsPdfDirect(quotation);
            const quotationIdValue = quotation.quotationId || quotation.id;
            if (quotationIdValue) logAction(`Generated PDF for ${quotationIdValue}.`);
        }


        /* ---------- Initializers ---------- */
        let employeePageInitialized = false;
        let eventListenersInitialized = false;

        function initializeDashboard() {
            if (employeePageInitialized) return;
            employeePageInitialized = true;

            // Set initial user info
            const userRoleDisplay = document.getElementById('userRoleDisplay');
            const userEmailDisplay = document.getElementById('userEmailDisplay');
            const userAvatar = document.getElementById('userAvatar');

            if (userRoleDisplay) userRoleDisplay.textContent = CURRENT_USER_ROLE;
            if (userEmailDisplay) userEmailDisplay.textContent = CURRENT_USER_EMAIL;
            if (userAvatar) userAvatar.textContent = CURRENT_USER_ROLE.charAt(0).toUpperCase();

            // Add event listeners for navigation tabs (only once)
            if (!eventListenersInitialized) {
                eventListenersInitialized = true;
                document.querySelectorAll('[data-tab]').forEach(el => {
                    // Remove existing listeners to prevent duplicates
                    const newEl = el.cloneNode(true);
                    el.parentNode.replaceChild(newEl, el);
                    
                    newEl.addEventListener('click', function (e) {
                        e.preventDefault();
                        const sectionId = this.getAttribute('data-tab');
                        showSection(sectionId);
                    });
                });
            }

            applyRoleRestrictions();
            
            // Load initial data - fetch ONCE and pass down
            Promise.all([
                getItems().catch(err => { console.error('Error fetching items:', err); return []; }),
                getQuotations().catch(err => { console.error('Error fetching quotations:', err); return []; }),
                getGstRules().catch(err => { console.error('Error fetching GST rules:', err); return []; }),
                getSettings().catch(err => { console.error('Error fetching settings:', err); return getSettingsFallback(); })
            ]).then(([itemsData, quotationsData, gstRulesData, settingsData]) => {
                // Store data globally to prevent re-fetching
                window.cachedItems = itemsData;
                window.cachedQuotations = quotationsData;
                window.cachedGstRules = gstRulesData;
                window.cachedSettings = settingsData;

                // Apply company logo in sidebar (from settings)
                const logoEl = document.querySelector('.sidebar .brand img');
                if (logoEl && settingsData && settingsData.logo) logoEl.src = settingsData.logo;

                // Now render everything with cached data
                Promise.all([
                    renderHistoryList().catch(err => console.error('Error rendering history:', err)),
                    updateSummary().catch(err => console.error('Error updating summary:', err)),
                    renderCustomersList().catch(err => console.error('Error rendering customers:', err)),
                    Promise.resolve(renderProductsList()).catch(err => console.error('Error rendering products:', err))
                ]).then(() => {
                    showSection('dashboard');
                }).catch((error) => {
                    console.error('Error initializing dashboard:', error);
                    showSection('dashboard');
                });
            }).catch((error) => {
                console.error('Error fetching initial data:', error);
                showSection('dashboard');
            });
            
            updateGrandTotal(); 
            resetQuotationForm();

            // Set the role switcher to the current role
            const roleSwitcher = document.getElementById('role-switcher');
            if(roleSwitcher) {
                roleSwitcher.value = CURRENT_USER_ROLE;
            }
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
                    'rolewise_role',
                    'rolewise_user',
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
                    'rolewise_role',
                    'rolewise_user',
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
            localStorage.removeItem('rolewise_user_name');
            localStorage.removeItem('rolewise_user_id');
            localStorage.removeItem('rolewise_session_timeout');
            localStorage.removeItem('rolewise_session_start');
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
