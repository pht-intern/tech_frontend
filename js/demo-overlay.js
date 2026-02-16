(function() {
    var STEPS = {
        owner: [
            { target: 'a[data-tab="dashboard"]', title: 'Dashboard', icon: 'fa-th-large', desc: '<strong>Navigate</strong> to the dashboard. View <strong>overview stats</strong> at a glance.' },
            { target: '#summaryItemsCount', title: 'Overview Stats', icon: 'fa-chart-bar', desc: 'Key metrics at a glance: <strong>products count</strong>, <strong>quotations</strong>, <strong>activity logs</strong>, <strong>total value</strong>, <strong>customers</strong>, <strong>monthly stats</strong>, and <strong>average quotation value</strong>.', switchTab: 'dashboard', targetClosest: '.stats-grid' },
            { target: '#recentQuotationsList', title: 'Recent Quotations', icon: 'fa-list', desc: 'Latest quotations at a glance. <strong>Click</strong> to view details.', switchTab: 'dashboard', targetClosest: '.card' },
            { target: '#recentActivityList', title: 'Recent Activity', icon: 'fa-bolt', desc: 'Latest actions: <strong>product edits</strong>, <strong>quotation changes</strong>, and more.', switchTab: 'dashboard', targetClosest: '.card' },
            { target: 'a[data-tab="itemsList"]', title: 'Products', icon: 'fa-list', desc: '<strong>Navigate</strong> to products. Manage your <strong>catalog</strong> here.' },
            { target: '#addItemForm', title: 'Create Product Form', icon: 'fa-plus-circle', desc: '<strong>Product ID</strong> (auto), URL, name, type, price, GST, description. <strong>Import CSV</strong> for bulk add. Expand <strong>Compatibility</strong> for PC parts.', switchTab: 'addItem', targetClosest: '.card' },
            { target: 'button[onclick*="importCsvInput"]', title: 'Import CSV', icon: 'fa-file-import', desc: '<strong>Bulk import</strong> products from a CSV file.', switchTab: 'addItem' },
            { target: '#productListSearchInput', title: 'Product Search', icon: 'fa-search', desc: '<strong>Search</strong> products by name or ID.', switchTab: 'itemsList' },
            { target: '#priceSortBtn', title: 'Price Sort', icon: 'fa-sort', desc: '<strong>Sort</strong> products by price (low to high or high to low).', switchTab: 'itemsList' },
            { target: '#itemsTypeFilters', title: 'Type Filters', icon: 'fa-filter', desc: '<strong>Filter</strong> products by type (Laptop, Monitor, CPU, etc.).', switchTab: 'itemsList' },
            { target: '#itemsTable', title: 'Products Table', icon: 'fa-table', desc: 'All products with <strong>ID</strong>, <strong>name</strong>, <strong>type</strong>, <strong>price</strong>, actions (edit/delete).', switchTab: 'itemsList' },
            { target: '#itemsPagination', title: 'Pagination', icon: 'fa-chevrons-left', desc: '<strong>Navigate</strong> between pages of products.', switchTab: 'itemsList' },
            { target: 'button[onclick*="exportItemsToCsv"]', title: 'Export CSV', icon: 'fa-file-export', desc: '<strong>Export</strong> product list to CSV.', switchTab: 'itemsList' },
            { target: '#productDraftsPageList', title: 'Product Drafts List', icon: 'fa-save', desc: '<strong>Resume</strong> or <strong>delete</strong> saved drafts. Drafts <strong>auto-save</strong> as you type.', switchTab: 'itemDrafts', targetClosest: '.card' },
            { target: 'a[data-tab="createQuotation"]', title: 'Quotations', icon: 'fa-file-invoice-dollar', desc: '<strong>Navigate</strong> to quotations. Create and manage <strong>quotes</strong>.' },
            { target: '#cust-name', title: 'Customer Details', icon: 'fa-user', desc: 'Customer <strong>name</strong>, <strong>phone</strong>, <strong>email</strong>, <strong>address</strong>. <strong>Phone is required</strong>.', switchTab: 'createQuotation', targetClosest: '.card' },
            { target: '#quotationItemsBody', title: 'Quotation Items', icon: 'fa-shopping-cart', desc: 'Items added to this quotation. <strong>Set quantity</strong>, <strong>unit price</strong>. Each row shows total and GST.', switchTab: 'createQuotation', targetClosest: '.card' },
            { target: '#itemSearchInput', title: 'Add Items Search', icon: 'fa-search', desc: '<strong>Search</strong> products to add. Filter by type. Toggle <strong>compatible-only</strong> for PC builds.', switchTab: 'createQuotation' },
            { target: '#availableItemsList', title: 'Available Products', icon: 'fa-list', desc: '<strong>Click</strong> a product to add it to the quotation.', switchTab: 'createQuotation' },
            { target: '#grandTotalDisplay', title: 'Summary & Total', icon: 'fa-calculator', desc: '<strong>Subtotal</strong> and <strong>grand total</strong> (incl. GST). <strong>Create Quotation</strong> button finalizes.', switchTab: 'createQuotation', targetClosest: '.card' },
            { target: '#quotationDraftsList', title: 'Quotation Drafts', icon: 'fa-save', desc: 'Saved <strong>incomplete quotations</strong>. <strong>Resume</strong> or <strong>convert</strong> to final.', switchTab: 'createQuotation' },
            { target: '#historyTable', title: 'Quotation History Table', icon: 'fa-history', desc: 'All past quotations. <strong>Reopen</strong>, <strong>export PDF</strong>, or <strong>duplicate</strong>.', switchTab: 'viewHistory' },
            { target: '#historyPagination', title: 'History Pagination', icon: 'fa-chevrons-left', desc: '<strong>Navigate</strong> between pages of quotations.', switchTab: 'viewHistory' },
            { target: 'button[onclick*="exportQuotationHistoryToCsv"]', title: 'Export History', icon: 'fa-file-export', desc: '<strong>Export</strong> quotation history to CSV.', switchTab: 'viewHistory' },
            { target: '#quotationDraftsPageList', title: 'Quotation Drafts List', icon: 'fa-file-alt', desc: '<strong>Unfinished quotations</strong>. <strong>Resume</strong> to edit or <strong>convert</strong> to final.', switchTab: 'quotationDrafts', targetClosest: '.card' },
            { target: 'a[data-tab="viewCustomers"]', title: 'Customers', icon: 'fa-users', desc: '<strong>Navigate</strong> to customers.' },
            { target: '#customersTable', title: 'Customer List', icon: 'fa-users', desc: 'All customers who received quotations. <strong>Name</strong>, <strong>email</strong>, <strong>phone</strong>, <strong>address</strong>, last quote. Use <strong>Customer details</strong> tab for expanded view.', switchTab: 'viewCustomers' },
            { target: 'a[data-tab="viewLogs"]', title: 'Logs', icon: 'fa-clipboard-list', desc: '<strong>Navigate</strong> to activity logs.' },
            { target: '#logsListBody', title: 'Activity Logs Table', icon: 'fa-history', desc: 'Chronological record of user actions across the system.', switchTab: 'viewLogs', targetClosest: '.card' },
            { target: 'a[data-tab="settings"]', title: 'Settings', icon: 'fa-cog', desc: '<strong>Navigate</strong> to settings.' },
            { target: '#logoUploadInput', title: 'Company Logo', icon: 'fa-image', desc: '<strong>Upload</strong> company logo for quotation PDFs. Recommended: <strong>square</strong>, under <strong>200KB</strong>.', switchTab: 'settings', targetClosest: '.card' },
            { target: '#settings-brand-name', title: 'Brand Name', icon: 'fa-tag', desc: 'Company name on <strong>quotation PDFs</strong>.', switchTab: 'settings' },
            { target: '#settings-validity-days', title: 'Quotation Validity', icon: 'fa-calendar-check', desc: '<strong>Days</strong> a quotation stays valid.', switchTab: 'settings' },
            { target: '#settings-company-gst-id', title: 'Company GST ID', icon: 'fa-id-card', desc: '<strong>GSTIN</strong> for quotation PDFs.', switchTab: 'settings' },
            { target: '#settings-pdf-theme', title: 'PDF Theme Settings', icon: 'fa-palette', desc: 'Choose the <strong>color theme</strong> for PDFs: Default, Green, Red, Purple, Orange, Teal, or Gray. <strong>Preview</strong> updates live.', switchTab: 'settings', targetClosest: '.card' },
            { target: '.sidebar .user', title: 'User', icon: 'fa-user', desc: 'Your <strong>profile info</strong> and <strong>role</strong> are displayed here.' },
            { target: '#logoutBtn', title: 'Logout', icon: 'fa-sign-out-alt', desc: '<strong>Sign out</strong> securely from the dashboard.' }
        ],
        admin: [
            { target: 'a[data-tab="dashboard"]', title: 'Dashboard', icon: 'fa-th-large', desc: '<strong>Navigate</strong> to the dashboard. View <strong>overview stats</strong> at a glance.' },
            { target: '#summaryItemsCount', title: 'Overview Stats', icon: 'fa-chart-bar', desc: 'Key metrics at a glance: <strong>products count</strong>, <strong>quotations</strong>, <strong>activity logs</strong>, <strong>total value</strong>, <strong>customers</strong>, <strong>monthly stats</strong>, and <strong>average quotation value</strong>.', switchTab: 'dashboard', targetClosest: '.stats-grid' },
            { target: '#recentQuotationsList', title: 'Recent Quotations', icon: 'fa-list', desc: 'Latest quotations. <strong>Click</strong> to view details.', switchTab: 'dashboard', targetClosest: '.card' },
            { target: '#recentActivityList', title: 'Recent Activity', icon: 'fa-bolt', desc: 'Latest actions: <strong>product edits</strong>, <strong>quotation changes</strong>, and more.', switchTab: 'dashboard', targetClosest: '.card' },
            { target: 'a[data-tab="itemsList"]', title: 'Products', icon: 'fa-list', desc: '<strong>Navigate</strong> to products. Manage your <strong>catalog</strong> here.' },
            { target: '#addItemForm', title: 'Create Product Form', icon: 'fa-plus-circle', desc: '<strong>Product ID</strong>, URL, name, type, price, GST. <strong>Import CSV</strong> for bulk add.', switchTab: 'addItem', targetClosest: '.card' },
            { target: 'button[onclick*="importCsvInput"]', title: 'Import CSV', icon: 'fa-file-import', desc: '<strong>Bulk import</strong> products from a CSV file.', switchTab: 'addItem' },
            { target: '#productListSearchInput', title: 'Product Search', icon: 'fa-search', desc: '<strong>Search</strong> products by name or ID.', switchTab: 'itemsList' },
            { target: '#priceSortBtn', title: 'Price Sort', icon: 'fa-sort', desc: '<strong>Sort</strong> products by price.', switchTab: 'itemsList' },
            { target: '#itemsTypeFilters', title: 'Type Filters', icon: 'fa-filter', desc: '<strong>Filter</strong> products by type.', switchTab: 'itemsList' },
            { target: '#itemsTable', title: 'Products Table', icon: 'fa-table', desc: 'All products with <strong>ID</strong>, <strong>name</strong>, <strong>type</strong>, <strong>price</strong>, actions.', switchTab: 'itemsList' },
            { target: '#itemsPagination', title: 'Pagination', icon: 'fa-chevrons-left', desc: '<strong>Navigate</strong> between pages of products.', switchTab: 'itemsList' },
            { target: 'button[onclick*="exportItemsToCsv"]', title: 'Export CSV', icon: 'fa-file-export', desc: '<strong>Export</strong> product list to CSV.', switchTab: 'itemsList' },
            { target: '#productDraftsPageList', title: 'Product Drafts List', icon: 'fa-save', desc: '<strong>Resume</strong> or <strong>delete</strong> saved drafts.', switchTab: 'itemDrafts', targetClosest: '.card' },
            { target: 'a[data-tab="createQuotation"]', title: 'Quotations', icon: 'fa-file-invoice-dollar', desc: '<strong>Navigate</strong> to quotations. Create and manage <strong>quotes</strong>.' },
            { target: '#cust-name', title: 'Customer Details', icon: 'fa-user', desc: 'Customer <strong>name</strong>, <strong>phone</strong>, <strong>email</strong>, <strong>address</strong>. <strong>Phone required</strong>.', switchTab: 'createQuotation', targetClosest: '.card' },
            { target: '#quotationItemsBody', title: 'Quotation Items', icon: 'fa-shopping-cart', desc: 'Items in this quotation. <strong>Set quantity</strong>, <strong>unit price</strong>, GST.', switchTab: 'createQuotation', targetClosest: '.card' },
            { target: '#itemSearchInput', title: 'Add Items Search', icon: 'fa-search', desc: '<strong>Search</strong> products to add. Filter by type.', switchTab: 'createQuotation' },
            { target: '#availableItemsList', title: 'Available Products', icon: 'fa-list', desc: '<strong>Click</strong> a product to add it to the quotation.', switchTab: 'createQuotation' },
            { target: '#grandTotalDisplay', title: 'Summary & Total', icon: 'fa-calculator', desc: '<strong>Subtotal</strong> and <strong>grand total</strong>. <strong>Create Quotation</strong> finalizes.', switchTab: 'createQuotation', targetClosest: '.card' },
            { target: '#quotationDraftsList', title: 'Quotation Drafts', icon: 'fa-save', desc: 'Saved <strong>incomplete quotations</strong>. <strong>Resume</strong> or <strong>convert</strong>.', switchTab: 'createQuotation' },
            { target: '#historyTable', title: 'Quotation History Table', icon: 'fa-history', desc: 'All past quotations. <strong>Reopen</strong>, <strong>export PDF</strong>, <strong>duplicate</strong>.', switchTab: 'viewHistory' },
            { target: '#historyPagination', title: 'History Pagination', icon: 'fa-chevrons-left', desc: '<strong>Navigate</strong> between pages of quotations.', switchTab: 'viewHistory' },
            { target: 'button[onclick*="exportQuotationHistoryToCsv"]', title: 'Export History', icon: 'fa-file-export', desc: '<strong>Export</strong> quotation history to CSV.', switchTab: 'viewHistory' },
            { target: '#quotationDraftsPageList', title: 'Quotation Drafts List', icon: 'fa-file-alt', desc: '<strong>Unfinished quotations</strong>. <strong>Resume</strong> or <strong>convert</strong>.', switchTab: 'quotationDrafts', targetClosest: '.card' },
            { target: 'a[data-tab="viewCustomers"]', title: 'Customers', icon: 'fa-users', desc: '<strong>Navigate</strong> to customers.' },
            { target: '#customersTable', title: 'Customer List', icon: 'fa-users', desc: 'All customers who received quotations. <strong>Export to CSV</strong>.', switchTab: 'viewCustomers' },
            { target: 'a[data-tab="viewLogs"]', title: 'Logs', icon: 'fa-clipboard-list', desc: '<strong>Navigate</strong> to activity logs.' },
            { target: '#logsListBody', title: 'Activity Logs Table', icon: 'fa-history', desc: 'Chronological record of user actions across the system.', switchTab: 'viewLogs', targetClosest: '.card' },
            { target: 'a[data-tab="settings"]', title: 'Settings', icon: 'fa-cog', desc: '<strong>Navigate</strong> to settings.' },
            { target: '#logoUploadInput', title: 'Company Logo', icon: 'fa-image', desc: '<strong>Upload</strong> logo for quotation PDFs.', switchTab: 'settings', targetClosest: '.card' },
            { target: '#settings-brand-name', title: 'Brand Name', icon: 'fa-tag', desc: 'Company name on <strong>PDFs</strong>.', switchTab: 'settings' },
            { target: '#settings-validity-days', title: 'Quotation Validity', icon: 'fa-calendar-check', desc: '<strong>Days</strong> quotation stays valid.', switchTab: 'settings' },
            { target: '#settings-company-gst-id', title: 'Company GST ID', icon: 'fa-id-card', desc: '<strong>GSTIN</strong> for PDFs.', switchTab: 'settings' },
            { target: '#settings-pdf-theme', title: 'PDF Theme Settings', icon: 'fa-palette', desc: 'Choose the <strong>color theme</strong> for PDFs: Default, Green, Red, Purple, Orange, Teal, or Gray.', switchTab: 'settings', targetClosest: '.card' },
            { target: '.sidebar .user', title: 'User', icon: 'fa-user', desc: 'Your <strong>profile info</strong> and <strong>role</strong> are displayed here.' },
            { target: '#logoutBtn', title: 'Logout', icon: 'fa-sign-out-alt', desc: '<strong>Sign out</strong> securely from the dashboard.' }
        ],
        manager: [
            { target: 'a[data-tab="dashboard"]', title: 'Dashboard', icon: 'fa-th-large', desc: '<strong>Navigate</strong> to the dashboard. View <strong>overview stats</strong>.' },
            { target: '#summaryItemsCount', title: 'Overview Stats', icon: 'fa-chart-bar', desc: 'Key metrics at a glance: <strong>products</strong>, <strong>quotations</strong>, <strong>customers</strong>, <strong>total value</strong>, <strong>monthly stats</strong>, and <strong>average quotation value</strong>.', switchTab: 'dashboard', targetClosest: '.stats-grid' },
            { target: '#recentQuotationsList', title: 'Recent Quotations', icon: 'fa-list', desc: 'Latest quotations. <strong>Click</strong> to view details.', switchTab: 'dashboard', targetClosest: '.card' },
            { target: '#recentActivityList', title: 'Recent Activity', icon: 'fa-bolt', desc: 'Latest <strong>actions and changes</strong>.', switchTab: 'dashboard', targetClosest: '.card' },
            { target: 'a[data-tab="itemsList"]', title: 'Products', icon: 'fa-list', desc: '<strong>Navigate</strong> to products.' },
            { target: '#addItemForm', title: 'Create Product Form', icon: 'fa-plus-circle', desc: 'Product details. <strong>Import CSV</strong> for bulk add.', switchTab: 'addItem', targetClosest: '.card' },
            { target: 'button[onclick*="importCsvInput"]', title: 'Import CSV', icon: 'fa-file-import', desc: '<strong>Bulk import</strong> products.', switchTab: 'addItem' },
            { target: '#productListSearchInput', title: 'Product Search', icon: 'fa-search', desc: '<strong>Search</strong> by name or ID.', switchTab: 'itemsList' },
            { target: '#itemsTable', title: 'Products Table', icon: 'fa-table', desc: 'All products. <strong>Edit</strong> or <strong>delete</strong>.', switchTab: 'itemsList' },
            { target: '#productDraftsPageList', title: 'Product Drafts List', icon: 'fa-save', desc: '<strong>Resume</strong> or <strong>delete</strong> drafts.', switchTab: 'itemDrafts', targetClosest: '.card' },
            { target: 'a[data-tab="createQuotation"]', title: 'Quotations', icon: 'fa-file-invoice-dollar', desc: '<strong>Navigate</strong> to quotations.' },
            { target: '#cust-name', title: 'Customer Details', icon: 'fa-user', desc: '<strong>Name</strong>, <strong>phone</strong>, <strong>email</strong>, <strong>address</strong>.', switchTab: 'createQuotation', targetClosest: '.card' },
            { target: '#quotationItemsBody', title: 'Quotation Items', icon: 'fa-shopping-cart', desc: 'Items in quotation. <strong>Set quantity</strong>, <strong>price</strong>.', switchTab: 'createQuotation', targetClosest: '.card' },
            { target: '#itemSearchInput', title: 'Add Items', icon: 'fa-search', desc: '<strong>Search</strong> products to add.', switchTab: 'createQuotation' },
            { target: '#grandTotalDisplay', title: 'Summary & Total', icon: 'fa-calculator', desc: '<strong>Totals</strong> and <strong>Create</strong> button.', switchTab: 'createQuotation', targetClosest: '.card' },
            { target: '#historyTable', title: 'Quotation History', icon: 'fa-history', desc: 'Past quotations. <strong>Reopen</strong>, <strong>export</strong>, <strong>duplicate</strong>.', switchTab: 'viewHistory' },
            { target: '#quotationDraftsPageList', title: 'Quotation Drafts', icon: 'fa-file-alt', desc: '<strong>Unfinished quotations</strong>. <strong>Resume</strong> or <strong>convert</strong>.', switchTab: 'quotationDrafts', targetClosest: '.card' },
            { target: 'a[data-tab="viewCustomers"]', title: 'Customers', icon: 'fa-users', desc: '<strong>Navigate</strong> to customers.' },
            { target: '#customersTable', title: 'Customer List', icon: 'fa-users', desc: 'All customers who received <strong>quotations</strong>.', switchTab: 'viewCustomers' },
            { target: 'a[data-tab="viewLogs"]', title: 'Logs', icon: 'fa-clipboard-list', desc: '<strong>Navigate</strong> to activity logs.' },
            { target: '#logsListBody', title: 'Activity Logs Table', icon: 'fa-history', desc: 'Chronological record of user actions across the system.', switchTab: 'viewLogs', targetClosest: '.card' },
            { target: 'a[data-tab="settings"]', title: 'Settings', icon: 'fa-cog', desc: '<strong>Navigate</strong> to settings.' },
            { target: '#logoUploadInput', title: 'Company Logo', icon: 'fa-image', desc: '<strong>Upload</strong> logo for quotation PDFs.', switchTab: 'settings', targetClosest: '.card' },
            { target: '#settings-brand-name', title: 'Brand Name', icon: 'fa-tag', desc: 'Company name on <strong>PDFs</strong>.', switchTab: 'settings' },
            { target: '#settings-validity-days', title: 'Quotation Validity', icon: 'fa-calendar-check', desc: '<strong>Days</strong> quotation stays valid.', switchTab: 'settings' },
            { target: '#settings-company-gst-id', title: 'Company GST ID', icon: 'fa-id-card', desc: '<strong>GSTIN</strong> for PDFs.', switchTab: 'settings' },
            { target: '#settings-pdf-theme', title: 'PDF Theme Settings', icon: 'fa-palette', desc: 'Choose the <strong>color theme</strong> for PDFs: Default, Green, Red, Purple, Orange, Teal, or Gray.', switchTab: 'settings', targetClosest: '.card' },
            { target: '.sidebar .user', title: 'User', icon: 'fa-user', desc: 'Your <strong>profile info</strong> and <strong>role</strong> are displayed here.' },
            { target: '#logoutBtn', title: 'Logout', icon: 'fa-sign-out-alt', desc: '<strong>Sign out</strong> securely from the dashboard.' }
        ],
        employee: [
            { target: 'a[data-tab="dashboard"]', title: 'Dashboard', icon: 'fa-th-large', desc: '<strong>Navigate</strong> to the dashboard.' },
            { target: '#summaryItemsCount', title: 'Overview Stats', icon: 'fa-chart-bar', desc: 'Key metrics at a glance: <strong>products count</strong> and <strong>quotations count</strong>.', switchTab: 'dashboard', targetClosest: '.stats-grid' },
            { target: '#recentQuotationsList', title: 'Recent Quotations', icon: 'fa-list', desc: 'Latest quotations. <strong>Click</strong> to view.', switchTab: 'dashboard', targetClosest: '.card' },
            { target: '#recentActivityList', title: 'Recent Activity', icon: 'fa-bolt', desc: 'Latest <strong>actions and changes</strong>.', switchTab: 'dashboard', targetClosest: '.card' },
            { target: 'a[data-tab="createQuotation"]', title: 'Quotations', icon: 'fa-file-invoice-dollar', desc: '<strong>Navigate</strong> to quotations.' },
            { target: '#cust-name', title: 'Customer Details', icon: 'fa-user', desc: '<strong>Name</strong>, <strong>phone</strong>, <strong>email</strong>, <strong>address</strong>. Phone required.', switchTab: 'createQuotation', targetClosest: '.card' },
            { target: '#quotationItemsBody', title: 'Quotation Items', icon: 'fa-shopping-cart', desc: 'Items in quotation. <strong>Set quantity</strong>, <strong>price</strong>.', switchTab: 'createQuotation', targetClosest: '.card' },
            { target: '#itemSearchInput', title: 'Add Items', icon: 'fa-search', desc: '<strong>Search</strong> products to add to quotation.', switchTab: 'createQuotation' },
            { target: '#grandTotalDisplay', title: 'Summary & Total', icon: 'fa-calculator', desc: '<strong>Totals</strong> and <strong>Create</strong> button.', switchTab: 'createQuotation', targetClosest: '.card' },
            { target: '#historyTable', title: 'Quotation History', icon: 'fa-history', desc: 'Past quotations. <strong>Reopen</strong>, <strong>export</strong>, <strong>duplicate</strong>.', switchTab: 'viewHistory' },
            { target: '#quotationDraftsPageList', title: 'Quotation Drafts', icon: 'fa-file-alt', desc: '<strong>Unfinished quotations</strong>. <strong>Resume</strong> or <strong>convert</strong>.', switchTab: 'quotationDrafts', targetClosest: '.card' },
            { target: 'a[data-tab="viewCustomers"]', title: 'Customers', icon: 'fa-users', desc: '<strong>Navigate</strong> to customers.' },
            { target: '#customersTable', title: 'Customer List', icon: 'fa-users', desc: 'All customers who received <strong>quotations</strong>.', switchTab: 'viewCustomers' },
            { target: '.sidebar .user', title: 'User', icon: 'fa-user', desc: 'Your <strong>profile info</strong> and <strong>role</strong> are displayed here.' },
            { target: '#logoutBtn', title: 'Logout', icon: 'fa-sign-out-alt', desc: '<strong>Sign out</strong> securely from the dashboard.' }
        ],
        accountant: [
            { target: 'a[data-tab="dashboard"]', title: 'Dashboard', icon: 'fa-th-large', desc: '<strong>Navigate</strong> to the dashboard.' },
            { target: '#summaryItemsCount', title: 'Overview Stats', icon: 'fa-chart-bar', desc: 'Key metrics at a glance: <strong>products count</strong>, <strong>quotations</strong>, <strong>activity logs</strong>, <strong>total value</strong>, <strong>customers</strong>, <strong>monthly stats</strong>, and <strong>average quotation value</strong>.', switchTab: 'dashboard', targetClosest: '.stats-grid' },
            { target: '#recentQuotationsList', title: 'Recent Quotations', icon: 'fa-list', desc: 'Latest quotations. <strong>Click</strong> to view.', switchTab: 'dashboard', targetClosest: '.card' },
            { target: '#recentActivityList', title: 'Recent Activity', icon: 'fa-bolt', desc: 'Latest <strong>actions and changes</strong>.', switchTab: 'dashboard', targetClosest: '.card' },
            { target: 'a[data-tab="itemsList"]', title: 'Products', icon: 'fa-list', desc: '<strong>Navigate</strong> to products.' },
            { target: '#addItemForm', title: 'Create Product Form', icon: 'fa-plus-circle', desc: 'Product details. <strong>Import CSV</strong> for bulk add.', switchTab: 'addItem', targetClosest: '.card' },
            { target: 'button[onclick*="importCsvInput"]', title: 'Import CSV', icon: 'fa-file-import', desc: '<strong>Bulk import</strong> products.', switchTab: 'addItem' },
            { target: '#productListSearchInput', title: 'Product Search', icon: 'fa-search', desc: '<strong>Search</strong> by name or ID.', switchTab: 'itemsList' },
            { target: '#itemsTable', title: 'Products Table', icon: 'fa-table', desc: 'All products. <strong>Edit</strong> or <strong>delete</strong>.', switchTab: 'itemsList' },
            { target: '#productDraftsPageList', title: 'Product Drafts List', icon: 'fa-save', desc: '<strong>Resume</strong> or <strong>delete</strong> drafts.', switchTab: 'itemDrafts', targetClosest: '.card' },
            { target: 'a[data-tab="createQuotation"]', title: 'Quotations', icon: 'fa-file-invoice-dollar', desc: '<strong>Navigate</strong> to quotations.' },
            { target: '#cust-name', title: 'Customer Details', icon: 'fa-user', desc: '<strong>Name</strong>, <strong>phone</strong>, <strong>email</strong>, <strong>address</strong>.', switchTab: 'createQuotation', targetClosest: '.card' },
            { target: '#quotationItemsBody', title: 'Quotation Items', icon: 'fa-shopping-cart', desc: 'Items in quotation. <strong>Set quantity</strong>, <strong>price</strong>.', switchTab: 'createQuotation', targetClosest: '.card' },
            { target: '#itemSearchInput', title: 'Add Items', icon: 'fa-search', desc: '<strong>Search</strong> products to add.', switchTab: 'createQuotation' },
            { target: '#grandTotalDisplay', title: 'Summary & Total', icon: 'fa-calculator', desc: '<strong>Totals</strong> and <strong>Create</strong> button.', switchTab: 'createQuotation', targetClosest: '.card' },
            { target: '#historyTable', title: 'Quotation History', icon: 'fa-history', desc: 'Past quotations. <strong>Reopen</strong>, <strong>export</strong>, <strong>duplicate</strong>.', switchTab: 'viewHistory' },
            { target: '#quotationDraftsPageList', title: 'Quotation Drafts', icon: 'fa-file-alt', desc: '<strong>Unfinished quotations</strong>. <strong>Resume</strong> or <strong>convert</strong>.', switchTab: 'quotationDrafts', targetClosest: '.card' },
            { target: 'a[data-tab="viewCustomers"]', title: 'Customers', icon: 'fa-users', desc: '<strong>Navigate</strong> to customers.' },
            { target: '#customersTable', title: 'Customer List', icon: 'fa-users', desc: 'All customers who received <strong>quotations</strong>.', switchTab: 'viewCustomers' },
            { target: 'a[data-tab="viewLogs"]', title: 'Logs', icon: 'fa-clipboard-list', desc: '<strong>Navigate</strong> to activity logs.' },
            { target: '#logsListBody', title: 'Activity Logs Table', icon: 'fa-history', desc: 'Chronological record of user actions across the system.', switchTab: 'viewLogs', targetClosest: '.card' },
            { target: 'a[data-tab="settings"]', title: 'Settings', icon: 'fa-cog', desc: '<strong>Navigate</strong> to settings.' },
            { target: '#logoUploadInput', title: 'Company Logo', icon: 'fa-image', desc: '<strong>Upload</strong> logo for quotation PDFs.', switchTab: 'settings', targetClosest: '.card' },
            { target: '#settings-brand-name', title: 'Brand Name', icon: 'fa-tag', desc: 'Company name on <strong>PDFs</strong>.', switchTab: 'settings' },
            { target: '#settings-validity-days', title: 'Quotation Validity', icon: 'fa-calendar-check', desc: '<strong>Days</strong> quotation stays valid.', switchTab: 'settings' },
            { target: '#settings-company-gst-id', title: 'Company GST ID', icon: 'fa-id-card', desc: '<strong>GSTIN</strong> for PDFs.', switchTab: 'settings' },
            { target: '#settings-pdf-theme', title: 'PDF Theme Settings', icon: 'fa-palette', desc: 'Choose the <strong>color theme</strong> for PDFs: Default, Green, Red, Purple, Orange, Teal, or Gray.', switchTab: 'settings', targetClosest: '.card' },
            { target: '.sidebar .user', title: 'User', icon: 'fa-user', desc: 'Your <strong>profile info</strong> and <strong>role</strong> are displayed here.' },
            { target: '#logoutBtn', title: 'Logout', icon: 'fa-sign-out-alt', desc: '<strong>Sign out</strong> securely from the dashboard.' }
        ]
    };

    document.addEventListener('DOMContentLoaded', function() {
        var overlay = document.getElementById('demoOverlay');
        var getDemoBtn = document.getElementById('getDemoBtn');
        var role = (document.body.getAttribute('data-demo-role') || 'owner').toLowerCase();
        var steps = STEPS[role] || STEPS.owner;

        if (!overlay || !steps.length) return;

        var currentStep = 0;
        var tooltip = null;
        var spotlight = null;
        var navEl = null;

        function createOverlayUI() {
            if (tooltip) return;
            var backdrop = document.createElement('div');
            backdrop.className = 'demo-overlay__backdrop';
            overlay.appendChild(backdrop);
            spotlight = document.createElement('div');
            spotlight.className = 'demo-spotlight';
            spotlight.setAttribute('aria-hidden', 'true');
            overlay.appendChild(spotlight);
            tooltip = document.createElement('div');
            tooltip.className = 'demo-tooltip';
            tooltip.setAttribute('role', 'tooltip');
            overlay.appendChild(tooltip);

            navEl = document.createElement('div');
            navEl.className = 'demo-nav';
            steps.forEach(function(s, i) {
                var btn = document.createElement('button');
                btn.type = 'button';
                btn.className = 'demo-nav__btn';
                btn.setAttribute('data-step', i);
                btn.textContent = s.title;
                btn.addEventListener('click', function() { goToStep(i); });
                navEl.appendChild(btn);
            });
            overlay.appendChild(navEl);
        }

        function updateSpotlight(el) {
            if (!spotlight) return;
            var backdrop = overlay.querySelector('.demo-overlay__backdrop');
            if (!el) {
                spotlight.style.display = 'none';
                if (backdrop) backdrop.style.setProperty('--hole-w', '0');
                return;
            }
            var rect = el.getBoundingClientRect();
            var pad = 6;
            var x = rect.left - pad;
            var y = rect.top - pad;
            var w = rect.width + pad * 2;
            var h = rect.height + pad * 2;
            spotlight.style.display = 'block';
            spotlight.style.left = x + 'px';
            spotlight.style.top = y + 'px';
            spotlight.style.width = w + 'px';
            spotlight.style.height = h + 'px';
            if (backdrop) {
                backdrop.style.setProperty('--hole-x', x + 'px');
                backdrop.style.setProperty('--hole-y', y + 'px');
                backdrop.style.setProperty('--hole-w', w + 'px');
                backdrop.style.setProperty('--hole-h', h + 'px');
            }
        }

        function positionTooltip(el) {
            if (!el || !tooltip) return;
            tooltip.style.left = '-9999px';
            tooltip.style.top = '0';
            var rect = el.getBoundingClientRect();
            var pad = 16;
            var arrowSide = rect.left < 260 ? 'left' : 'right';
            var ttRect = tooltip.getBoundingClientRect();

            var x = arrowSide === 'left' ? rect.right + pad : rect.left - ttRect.width - pad;
            var y = rect.top + (rect.height / 2) - (ttRect.height / 2);
            y = Math.max(80, Math.min(y, window.innerHeight - ttRect.height - 100));
            x = Math.max(20, Math.min(x, window.innerWidth - ttRect.width - 20));

            tooltip.style.left = x + 'px';
            tooltip.style.top = y + 'px';

            var oldArr = tooltip.querySelector('.demo-tooltip__arrow');
            if (oldArr) oldArr.remove();
            var arr = document.createElement('span');
            arr.className = 'demo-tooltip__arrow demo-tooltip__arrow--' + arrowSide;
            tooltip.appendChild(arr);
        }

        function goToStep(index) {
            if (index < 0 || index >= steps.length) return;
            currentStep = index;

            var step = steps[currentStep];

            if (step.switchTab) {
                var tabEl = document.querySelector('#sideNav a[data-tab="' + step.switchTab + '"]') ||
                    document.querySelector('[data-tab="' + step.switchTab + '"]');
                if (tabEl) {
                    tabEl.click();
                    setTimeout(function() { finishGoToStep(step); }, 50);
                } else {
                    finishGoToStep(step);
                }
            } else {
                finishGoToStep(step);
            }
        }

        function finishGoToStep(step) {
            var el = document.querySelector(step.target);
            if (!el) {
                goToStep(currentStep + 1);
                return;
            }
            if (step.targetClosest) {
                var parent = el.closest(step.targetClosest);
                if (parent) el = parent;
            }

            el.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
            updateSpotlight(el);
            setTimeout(function() { updateSpotlight(el); }, 450);
            tooltip.innerHTML = '';
            var strong = document.createElement('strong');
            strong.innerHTML = '<i class="fas ' + step.icon + '"></i> ' + step.title;
            var p = document.createElement('p');
            var tooltipBtns = document.createElement('div');
            tooltipBtns.className = 'demo-tooltip__btns';
            var tp = document.createElement('button');
            tp.type = 'button';
            tp.className = 'demo-tooltip__btn';
            tp.innerHTML = '<i class="fas fa-chevron-left"></i> Prev';
            tp.disabled = currentStep === 0;
            tp.addEventListener('click', function(e) { e.stopPropagation(); goToStep(currentStep - 1); });
            var tn = document.createElement('button');
            tn.type = 'button';
            tn.className = 'demo-tooltip__btn demo-tooltip__btn--primary';
            var isLastStep = currentStep === steps.length - 1;
            tn.innerHTML = isLastStep ? '<i class="fas fa-check"></i> Finish' : 'Next <i class="fas fa-chevron-right"></i>';
            tn.disabled = false;
            tn.addEventListener('click', function(e) {
                e.stopPropagation();
                if (isLastStep) hide();
                else goToStep(currentStep + 1);
            });
            tooltipBtns.appendChild(tp);
            tooltipBtns.appendChild(tn);
            tooltip.appendChild(strong);
            p.innerHTML = step.desc || '';
            tooltip.appendChild(p);
            tooltip.appendChild(tooltipBtns);
            positionTooltip(el);

            navEl.querySelectorAll('.demo-nav__btn').forEach(function(btn, i) {
                btn.classList.toggle('demo-nav__btn--active', i === currentStep);
            });
        }

        var scrollTargets = [];

        function show() {
            overlay.classList.add('demo-overlay--visible');
            createOverlayUI();
            goToStep(0);
            window.addEventListener('scroll', onScrollOrResize, true);
            window.addEventListener('resize', onScrollOrResize);
            var mainEl = document.querySelector('.main');
            if (mainEl) {
                mainEl.addEventListener('scroll', onScrollOrResize);
                scrollTargets.push(mainEl);
            }
        }

        function hide() {
            overlay.classList.remove('demo-overlay--visible');
            window.removeEventListener('scroll', onScrollOrResize, true);
            window.removeEventListener('resize', onScrollOrResize);
            scrollTargets.forEach(function(el) {
                el.removeEventListener('scroll', onScrollOrResize);
            });
            scrollTargets = [];
            if (spotlight) spotlight.style.display = 'none';
        }

        var scrollResizeTid;
        function onScrollOrResize() {
            if (scrollResizeTid) clearTimeout(scrollResizeTid);
            scrollResizeTid = setTimeout(function() {
                scrollResizeTid = 0;
                var step = steps[currentStep];
                if (!step) return;
                var el = document.querySelector(step.target);
                if (el && step.targetClosest) {
                    var parent = el.closest(step.targetClosest);
                    if (parent) el = parent;
                }
                if (el) {
                    if (spotlight) updateSpotlight(el);
                    if (tooltip) positionTooltip(el);
                }
            }, 16);
        }

        if (getDemoBtn) {
            getDemoBtn.addEventListener('click', function(e) {
                e.preventDefault();
                show();
            });
        }

        overlay.addEventListener('click', function(e) {
            if (e.target !== overlay && !e.target.classList.contains('demo-overlay__backdrop')) return;
            var step = steps[currentStep];
            var el = step ? document.querySelector(step.target) : null;
            if (el) {
                var r = el.getBoundingClientRect();
                var pad = 6;
                if (e.clientX >= r.left - pad && e.clientX <= r.right + pad &&
                    e.clientY >= r.top - pad && e.clientY <= r.bottom + pad) return;
            }
            hide();
        });
    });
})();
