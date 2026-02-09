
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
        let isCreatingNewQuotation = true; // Track if we're creating a new quotation (true) or editing existing (false)
        let quotationHistory = []; 
        let currentQuotationId = null;
        let historyCurrentPage = 1;
        const historyPerPage = 10;
        let customersCurrentPage = 1;
        const customersPerPage = 10; 
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

        // Dynamic type filters for "Add Items to Quotation"
        function renderQuotationTypeFilters(items = null) {
            console.trace('🔍 renderQuotationTypeFilters called');
            const container = document.getElementById('quotationTypeFilters');
            if (!container) return;

            // Prevent unnecessary re-renders
            if (container.hasAttribute('data-rendered') && container.children.length > 0) {
                console.log('⚠️ renderQuotationTypeFilters skipped - already rendered');
                return;
            }

            // Use passed items or get from cache
            const itemsData = items || window.cachedItems || [];
            let types = [];
            
            types = [...new Set(itemsData.map(item => item.type).filter(Boolean))]
                .sort((a, b) => a.localeCompare(b, 'en-IN', { sensitivity: 'base' }));

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
            
            // Mark as rendered
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
                // Use passed items or get from cache/fetch
                const itemsData = items || window.cachedItems || await getItems();
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
                        price: parseFloat(itemToAdd.price || 0),
                        quantity: 1,
                        gstRate: gstRate,
                        description: itemToAdd.description || ''
                    });
                }

                renderQuotationItems();
                updateGrandTotal();
                logAction(`Added product ${itemToAdd.productName || itemToAdd.name} to quotation.`);
            } catch (error) {
                alert('Failed to add item to quotation.');
            }
        }

        function removeItemFromQuotation(itemId) {
            quotationItems = quotationItems.filter(item => item.id !== itemId);
            renderQuotationItems();
            updateGrandTotal();
            logAction(`Removed item ID ${itemId} from quotation.`);
        }

        /* ---------- CRUD Operations ---------- */
        async function createQuotation() {
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
                const itemTotal = item.price * item.quantity;
                const itemGstRate = item.gstRate || (SETTINGS.gstRate * 100);
                return sum + (itemTotal * (itemGstRate / 100));
            }, 0);
            let grandTotal = (subTotal - discountAmount) + totalGstAmount;

            const quotationId = generateProductId().replace('P', 'Q');
            const dateCreated = new Date().toLocaleDateString('en-IN');

            const payload = {
                quotationId: quotationId,
                dateCreated: dateCreated,
                customer: {
                    name: customerName || null,
                    phone: phoneNumber,
                    email: customerEmail || null,
                    address: customerAddress || null
                },
                items: items.map(item => ({
                    productId: String(item.productId || item.id),
                    productName: String(item.productName || item.name),
                    price: String(parseFloat(item.price || 0).toFixed(2)),
                    quantity: parseInt(item.quantity || 1),
                    gstRate: String(parseFloat(item.gstRate || (SETTINGS.gstRate * 100)).toFixed(2))
                })),
                subTotal: String(parseFloat(subTotal).toFixed(2)),
                discountPercent: String(parseFloat(discountPercent).toFixed(2)),
                discountAmount: String(parseFloat(discountAmount).toFixed(2)),
                totalGstAmount: String(parseFloat(totalGstAmount).toFixed(2)),
                grandTotal: String(parseFloat(grandTotal).toFixed(2)),
                createdBy: CURRENT_USER_EMAIL.split('@')[0] || CURRENT_USER_ROLE
            };

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
                    subTotal,
                    discountPercent,
                    discountAmount,
                    totalGstAmount,
                    grandTotal,
                    createdBy: CURRENT_USER_EMAIL.split('@')[0] || CURRENT_USER_ROLE
                };

                quotationHistory.unshift(newQuotation);
                logAction(`Created new quotation ${quotationId} for ${customerName || phoneNumber}.`);

                // Download as PNG
                await downloadQuotationAsPngDirect(newQuotation).catch(() => {
                    // Silent fail for PNG generation
                });

                // Reset form
                resetQuotationForm();
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
                    subTotal,
                    discountPercent,
                    discountAmount,
                    totalGstAmount,
                    grandTotal,
                    createdBy: CURRENT_USER_EMAIL.split('@')[0] || CURRENT_USER_ROLE
                };

                quotationHistory.unshift(newQuotation);
                logAction(`Created new quotation ${quotationId} for ${customerName || phoneNumber}.`);

                // Download as PNG
                await downloadQuotationAsPngDirect(newQuotation).catch(() => {
                    // Silent fail for PNG generation
                });

                resetQuotationForm();
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

        function editQuotation(quotationId) {
            const quotation = quotationHistory.find(q => q.id === quotationId);
            if (!quotation) return;

            currentQuotationId = quotationId;
            isCreatingNewQuotation = false; // Set to edit mode when editing existing quotation

            // Load data into the form
            document.getElementById('customerSelect').value = quotation.customerId;
            document.getElementById('validityDays').value = quotation.validityDays;
            
            // Load items
            quotationItems = JSON.parse(JSON.stringify(quotation.items));
            renderQuotationItems();
            updateGrandTotal();

            // Change button text and action
            document.getElementById('createQuotationBtn').style.display = 'none';
            document.getElementById('updateQuotationBtn').style.display = 'block';
            document.getElementById('resetFormBtn').textContent = 'Cancel Edit';

            showSection('quotation');
            logAction(`Opened quotation ${quotationId} for editing.`);
        }

        function updateQuotation() {
            if (!currentQuotationId) return;

            const quotationIndex = quotationHistory.findIndex(q => q.id === currentQuotationId);
            if (quotationIndex === -1) return;

            const customerId = document.getElementById('customerSelect').value;
            const validityDays = parseInt(document.getElementById('validityDays').value || SETTINGS.defaultValidityDays);
            const items = getQuotationItems(); // <<< THIS WAS THE MISSING FUNCTION CALL

            if (!customerId || items.length === 0) {
                alert("Please select a customer and add at least one item to the quotation.");
                return;
            }

            const subTotal = calculateSubTotal(items);
            const gst = calculateGST(subTotal);
            const grandTotal = calculateGrandTotal(subTotal, gst);
            const customer = CUSTOMERS.find(c => c.id == customerId);
            const dateCreated = quotationHistory[quotationIndex].dateCreated; // Keep original creation date

            quotationHistory[quotationIndex] = {
                ...quotationHistory[quotationIndex], // Keep original ID and status
                customerId: customerId,
                customerName: customer?.name || null,
                dueDate: getDueDate(dateCreated, validityDays),
                validityDays: validityDays,
                items: JSON.parse(JSON.stringify(items)),
                subTotal: subTotal,
                gst: gst,
                grandTotal: grandTotal,
            };

            logAction(`Updated quotation ${currentQuotationId}.`);

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
            renderQuotationItems();
            updateGrandTotal();
            
            // Clear item search
            const itemSearchInput = document.getElementById('itemSearchInput');
            if (itemSearchInput) itemSearchInput.value = '';
            
            // Re-render available items
            renderAvailableItemsForQuotation();
        }

        /* ---------- Rendering Functions ---------- */
        async function renderCustomersList() {
            try {
                // Try to get quotations from API first, fallback to local data
                const quotationsResponse = await getQuotations();
                const quotations = Array.isArray(quotationsResponse) ? quotationsResponse : (quotationsResponse?.data || quotationHistory);
                
                const body = document.getElementById('customersListBody');
                if (!body) {
                    return;
                }
                body.innerHTML = '';

                // Build customers map from quotations
                const customersMap = new Map();
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
                    // Use phone as key to get unique customers
                    customersMap.set(phone, newCustomerData);
                });

                const customers = Array.from(customersMap.values());
                const customersTable = document.getElementById('customersTable');
                const paginationDiv = document.getElementById('customersPagination');

                if (customers.length === 0) {
                    body.innerHTML = '<tr><td colspan="5" class="muted" style="text-align:center">No customer data available.</td></tr>';
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

                paginatedCustomers.forEach(customer => {
                    const row = body.insertRow();
                    row.insertCell().textContent = customer.name || 'N/A';
                    row.insertCell().textContent = customer.email || 'N/A';
                    row.insertCell().textContent = customer.phone || 'N/A';
                    row.insertCell().textContent = customer.address || 'N/A';
                    row.insertCell().textContent = customer.lastQuotationDate;
                });
            } catch (error) {
                // Fallback to local CUSTOMERS array if API fails
                const body = document.getElementById('customersListBody');
                const customersTable = document.getElementById('customersTable');
                const paginationDiv = document.getElementById('customersPagination');
                if (!body) return;
                
                body.innerHTML = '';
                
                if (CUSTOMERS.length === 0) {
                    body.innerHTML = '<tr><td colspan="5" class="muted" style="text-align:center">No customer data available.</td></tr>';
                    if (customersTable) customersTable.style.display = 'none';
                    if (paginationDiv) paginationDiv.style.display = 'none';
                    return;
                }

                if (customersTable) customersTable.style.display = 'table';
                if (paginationDiv) paginationDiv.style.display = 'flex';

                // Calculate pagination
                const totalPages = Math.ceil(CUSTOMERS.length / customersPerPage);
                const startIndex = (customersCurrentPage - 1) * customersPerPage;
                const endIndex = startIndex + customersPerPage;
                const paginatedCustomers = CUSTOMERS.slice(startIndex, endIndex);

                // Update pagination controls
                updateCustomersPaginationControls(totalPages, CUSTOMERS.length);

                paginatedCustomers.forEach(customer => {
                    const row = body.insertRow();
                    row.insertCell().textContent = customer.name || 'N/A';
                    row.insertCell().textContent = customer.email || 'N/A';
                    row.insertCell().textContent = customer.phone || 'N/A';
                    row.insertCell().textContent = customer.address || 'N/A';
                    row.insertCell().textContent = 'N/A'; // No quotation date for local customers
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
            
            renderCustomersList();
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

            quotationItems.forEach(item => {
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
                
                // Actions column
                const actionsCell = row.insertCell();
                const removeBtn = document.createElement('button');
                removeBtn.className = 'btn danger';
                removeBtn.style.cssText = 'padding: 5px 8px;';
                removeBtn.innerHTML = '<i class="fas fa-trash-alt"></i>';
                removeBtn.onclick = () => removeItemFromQuotation(itemId);
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

                // Sort by date (most recent first)
                const sortedQuotations = filteredQuotations.slice().sort((a, b) => {
                    const dateA = new Date(a.dateCreated || a.created_at || 0);
                    const dateB = new Date(b.dateCreated || b.created_at || 0);
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
                    row.insertCell().textContent = formatRupee(parseFloat(q.grandTotal) || 0);
                    row.insertCell().textContent = (q.items?.length || 0);
                    row.insertCell().textContent = q.createdBy || q.created_by || CURRENT_USER_ROLE || 'N/A';

                    const actionsCell = row.insertCell();
                    actionsCell.innerHTML = `
                        <button class="btn primary" style="padding: 5px 8px; margin-right: 5px;" onclick="fetchQuotationAndGeneratePdf('${quotationId}')"><i class="fas fa-download"></i></button>
                        <button class="btn secondary" style="padding: 5px 8px; margin-right: 5px;" onclick="viewQuotationDetails('${quotationId}')"><i class="fas fa-eye"></i></button>
                    `;
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

                // Calculate pagination
                const totalPages = Math.ceil(quotationHistory.length / historyPerPage);
                const startIndex = (historyCurrentPage - 1) * historyPerPage;
                const endIndex = startIndex + historyPerPage;
                const paginatedHistory = quotationHistory.slice(startIndex, endIndex);

                // Update pagination controls
                updateHistoryPaginationControls(totalPages, quotationHistory.length);

                paginatedHistory.forEach(q => {
                    const row = tableBody.insertRow();
                    row.insertCell().textContent = q.id || q.quotationId || 'N/A';
                    row.insertCell().textContent = q.customerName || q.customer?.name || 'N/A';
                    row.insertCell().textContent = q.dateCreated || q.created_at || 'N/A';
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
                    pdfBtn.onclick = () => downloadQuotationAsPngDirect(q).catch(() => {
                        // Silent fail for PNG generation
                    });
                    actionCell.appendChild(pdfBtn);

                    const editBtn = document.createElement('button');
                    editBtn.className = 'btn';
                    editBtn.style.cssText = 'padding: 5px 8px;';
                    editBtn.innerHTML = '<i class="fas fa-edit"></i>';
                    editBtn.onclick = () => editQuotation(q.id || q.quotationId);
                    actionCell.appendChild(editBtn);
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
                
                // Download as PNG instead of PDF
                await downloadQuotationAsPngDirect(quotation);
            } catch (error) {
                // Try local data
                const localQuote = quotationHistory.find(q => (q.id || q.quotationId) === quotationId);
                if (localQuote) {
                    await downloadQuotationAsPngDirect(localQuote);
                } else {
                    alert('Failed to fetch quotation for PNG download.');
                }
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
                    const logoBase64 = settings.logo;
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
                
                return `
                    <div style="padding: 10px; border-bottom: 1px solid #f2f6fb; cursor: pointer;" 
                         onclick="editQuotation('${quotationId}')"
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
                if (actionText.toLowerCase().includes('product') || actionText.toLowerCase().includes('item')) actionIcon = 'fa-box';
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

            document.querySelector(`#sideNav a[data-tab="${id}"]`)?.classList.add('active');
            document.querySelector(`.section-tabs button[data-tab="${id}"]`)?.classList.add('active');

            // Load section-specific data
            if (id === 'viewHistory') {
                renderHistoryList();
            } else if (id === 'viewCustomers') {
                renderCustomersList();
            } else if (id === 'createQuotation') {
                renderQuotationTypeFilters();
                renderAvailableItemsForQuotation();
                renderQuotationItems();
                updateGrandTotal();
            }
        }

        // Add search functionality for history and item search
        let domListenersInitialized = false;
        let typeFilterHandlersSet = false;
        document.addEventListener('DOMContentLoaded', function() {
            if (domListenersInitialized) return;
            domListenersInitialized = true;
            
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
            }

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
            console.trace('🔍 getSettings called - tracking API call origin');
            try {
                const response = await apiFetch('/settings');
                if (response && response.data) {
                    return response.data;
                }
            } catch (error) {
                // Fallback to defaults
            }
            // Fallback to defaults
            return {
                logo: '',
                brand: 'RoleWise Tech',
                companyGstId: 'N/A',
                validityDays: 3,
                companyAddress: '123 Business Lane, City, State 400001',
                companyEmail: 'contact@rolewise.app'
            };
        }

        async function generateQuotationHtml(quotation) {
            // Normalize quotation data (handle both API format and local format)
            const quotationId = quotation.quotationId || quotation.id;
            const dateCreated = quotation.dateCreated || quotation.date_created;
            const customer = quotation.customer || {
                name: quotation.customerName,
                phone: quotation.customerPhone || quotation.phone,
                email: quotation.customerEmail || quotation.email,
                address: quotation.customerAddress || quotation.address
            };
            let items = quotation.items || [];
            
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
                totalGstAmount = newTotalGstAmount;
                grandTotal = newGrandTotal;
            }
            
            let subTotal = parseFloat(quotation.subTotal) || 0;
            const discountPercent = parseFloat(quotation.discountPercent) || 0;
            let discountAmount = parseFloat(quotation.discountAmount) || (subTotal * discountPercent / 100);
            let totalAfterDiscount = subTotal - discountAmount;
            let totalGstAmount = parseFloat(quotation.totalGstAmount) || parseFloat(quotation.gst) || 0;
            let grandTotal = parseFloat(quotation.grandTotal) || (totalAfterDiscount + totalGstAmount);

            const settings = await getSettings();
            const logoBase64 = settings.logo || '';
            const brandName = settings.brand || 'TECHTITANS';
            const companyGstId = settings.companyGstId || 'N/A';
            const validityDays = quotation.validityDays || settings.validityDays || 3;
            
            // Company details - using defaults if not in settings
            const companyAddress = settings.companyAddress || '1102, second Floor, Before Atithi Satkar Hotel OTC Road, Bangalore 560002';
            const companyEmail = settings.companyEmail || 'advanceinfotech21@gmail.com';

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
                            <div style="text-align: right; margin-top: 10px; margin-bottom: 5px;">
                                <span style="color: #ffffff; font-size: 11px; opacity: 0.8;">(inclusive of GST)</span>
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

        async function generateQuotationPDF(quotationId, quotationData = null) {
            let quotation = quotationData;
            
            // If quotation data not provided, try to fetch it
            if (!quotation) {
                // Try API first
                try {
                    const response = await apiFetch(`/quotations/${quotationId}`);
                    if (response) {
                        quotation = Array.isArray(response) ? response[0] : (response.data || response);
                    }
                } catch (error) {
                    // Fallback to local data
                }
                
                // Fallback to local history
                if (!quotation) {
                    quotation = quotationHistory.find(q => (q.id || q.quotationId) === quotationId);
                }
            }

            if (!quotation) {
                alert("Quotation not found.");
                return;
            }

            const pdfTemplate = document.getElementById('quotationPdfTemplate') || document.getElementById('pdfTemplate');
            if (!pdfTemplate) {
                // Create template if it doesn't exist
                const template = document.createElement('div');
                template.id = 'quotationPdfTemplate';
                template.style.display = 'none';
                template.style.position = 'absolute';
                template.style.left = '-9999px';
                document.body.appendChild(template);
                pdfTemplate = template;
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
                const customerName = customer?.name || customer?.phone || quotation?.quotationId || quotation?.id || 'Unknown';
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
                
                const quotationIdValue = quotation.quotationId || quotation.id;
                logAction(`Generated PDF for ${quotationIdValue}.`);
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
            const headerTitle = document.getElementById('headerTitle');

            if (userRoleDisplay) userRoleDisplay.textContent = CURRENT_USER_ROLE;
            if (userEmailDisplay) userEmailDisplay.textContent = CURRENT_USER_EMAIL;
            if (userAvatar) userAvatar.textContent = CURRENT_USER_ROLE.charAt(0).toUpperCase();
            if (headerTitle) headerTitle.textContent = `${CURRENT_USER_ROLE} Dashboard`;

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
                    'rolewise_role',
                    'rolewise_user',
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
            // Clear all session data
            localStorage.removeItem(LS_KEYS.role);
            localStorage.removeItem(LS_KEYS.user);
            localStorage.removeItem(LS_KEYS.userEmail);
            localStorage.removeItem(LS_KEYS.sessionExpiry);
            localStorage.removeItem('rolewise_user_name');
            localStorage.removeItem('rolewise_user_id');
            localStorage.removeItem('rolewise_session_timeout');
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
