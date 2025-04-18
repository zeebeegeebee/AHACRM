if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js', { scope: '/' })
        .then(registration => {
          console.log('SW registered: ', registration.scope);
          // Update the service worker periodically
          setInterval(() => registration.update(), 60 * 60 * 1000);
        })
        .catch(err => {
          console.log('ServiceWorker registration failed: ', err);
          });
    });
}

let db;

//Revised app logic to use IndexedDB for customer management
document.addEventListener('DOMContentLoaded', () => {
    // Hide splash screen after everything loads
    Promise.all([
      new Promise(resolve => {
        if ('serviceWorker' in navigator) {
          navigator.serviceWorker.ready.then(resolve);
        } else {
          resolve();
        }
      }),
      initDB() // Initialize DB first
    ]).then(() => {
        const splash = document.getElementById('ios-splash');
        if (splash) {
        splash.style.opacity = '0';
        setTimeout(() => splash.remove(), 500);
        }
        
        // Now load the UI components
        loadUI();
    }).catch(error => {
        console.error('Initialization failed:', error);
    });
});

function initDB() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open('CustomerDB', 1);
      
      request.onupgradeneeded = (event) => {
        db = event.target.result;
        if (!db.objectStoreNames.contains('customers')) {
          const store = db.createObjectStore('customers', { 
            keyPath: 'id', 
            autoIncrement: true 
          });
          store.createIndex('name', 'name', { unique: false });
          store.createIndex('email', 'email', { unique: true });
          store.createIndex('phone', 'phone', { unique: false });
        }
      };
      
      request.onsuccess = (event) => {
        db = event.target.result;
        resolve();
      };
      
      request.onerror = (event) => {
        console.error('DB error:', event.target.error);
        reject(event.target.error);
      };
    });
  }

  function loadUI() {
    const addCustomerBtn = document.getElementById('addCustomer');
    const customerForm = document.getElementById('customerForm');
    const form = document.getElementById('form');
    const cancelForm = document.getElementById('cancelForm');
    const customerList = document.getElementById('customerList');
    const searchInput = document.getElementById('searchInput');
    
    // Load all customers
    loadCustomers();
    
    // Event listeners
    addCustomerBtn.addEventListener('click', showCustomerForm);
    cancelForm.addEventListener('click', hideCustomerForm);
    form.addEventListener('submit', saveCustomer);
    searchInput.addEventListener('input', searchCustomers);
    
    function showCustomerForm() {
      customerForm.style.display = 'block';
      form.reset();
      document.getElementById('customerId').value = '';
    }
    
    function hideCustomerForm() {
      customerForm.style.display = 'none';
    }
    
    function saveCustomer(e) {
      e.preventDefault();
      
      const customer = {
        name: document.getElementById('name').value,
        email: document.getElementById('email').value,
        phone: document.getElementById('phone').value,
        notes: document.getElementById('notes').value,
        lastUpdated: new Date().toISOString()
      };
      
      const customerId = document.getElementById('customerId').value;
      
      if (customerId) {
        // Update existing customer
        customer.id = parseInt(customerId);
        updateCustomer(customer);
      } else {
        // Add new customer
        addCustomer(customer);
      }
      
      hideCustomerForm();
      loadCustomers();
    }
    
    function loadCustomers() {
      getAllCustomers((customers) => {
        customerList.innerHTML = '';
        
        if (customers.length === 0) {
          customerList.innerHTML = '<p>No customers found. Add your first customer!</p>';
          return;
        }
        
        customers.forEach(customer => {
          const customerEl = document.createElement('div');
          customerEl.className = 'customer-card';
          customerEl.innerHTML = `
            <h3>${customer.name}</h3>
            <p>${customer.email}</p>
            ${customer.phone ? `<p>${customer.phone}</p>` : ''}
            <small>Last updated: ${new Date(customer.lastUpdated).toLocaleString()}</small>
            <button class="edit-btn" data-id="${customer.id}">Edit</button>
            <button class="delete-btn" data-id="${customer.id}">Delete</button>
          `;
          
          customerEl.querySelector('.edit-btn').addEventListener('click', () => editCustomer(customer.id));
          customerEl.querySelector('.delete-btn').addEventListener('click', () => deleteCustomer(customer.id));
          
          customerList.appendChild(customerEl);
        });
      });
    }
    
    function editCustomer(id) {
      const transaction = db.transaction(['customers'], 'readonly');
      const store = transaction.objectStore('customers');
      const request = store.get(id);
      
      request.onsuccess = () => {
        const customer = request.result;
        document.getElementById('customerId').value = customer.id;
        document.getElementById('name').value = customer.name;
        document.getElementById('email').value = customer.email;
        document.getElementById('phone').value = customer.phone || '';
        document.getElementById('notes').value = customer.notes || '';
        customerForm.style.display = 'block';
      };
    }
    
    function updateCustomer(customer) {
      const transaction = db.transaction(['customers'], 'readwrite');
      const store = transaction.objectStore('customers');
      store.put(customer);
    }
    
    function deleteCustomer(id) {
      if (confirm('Are you sure you want to delete this customer?')) {
        const transaction = db.transaction(['customers'], 'readwrite');
        const store = transaction.objectStore('customers');
        store.delete(id);
        loadCustomers();
      }
    }
    
    function searchCustomers() {
      const searchTerm = searchInput.value.toLowerCase();
      
      getAllCustomers((customers) => {
        const filteredCustomers = customers.filter(customer => 
          customer.name.toLowerCase().includes(searchTerm) || 
          customer.email.toLowerCase().includes(searchTerm) ||
          (customer.phone && customer.phone.includes(searchTerm))
        );
        
        customerList.innerHTML = '';
        
        filteredCustomers.forEach(customer => {
          const customerEl = document.createElement('div');
          customerEl.className = 'customer-card';
          customerEl.innerHTML = `
            <h3>${customer.name}</h3>
            <p>${customer.email}</p>
            ${customer.phone ? `<p>${customer.phone}</p>` : ''}
            <small>Last updated: ${new Date(customer.lastUpdated).toLocaleString()}</small>
            <button class="edit-btn" data-id="${customer.id}">Edit</button>
            <button class="delete-btn" data-id="${customer.id}">Delete</button>
          `;
          
          customerEl.querySelector('.edit-btn').addEventListener('click', () => editCustomer(customer.id));
          customerEl.querySelector('.delete-btn').addEventListener('click', () => deleteCustomer(customer.id));
          
          customerList.appendChild(customerEl);
        });
      });
    }
    function getAllCustomers(callback) {
        const transaction = db.transaction(['customers'], 'readonly');
        const store = transaction.objectStore('customers');
        const request = store.getAll();
        
        request.onsuccess = () => {
          callback(request.result);
        };
        
        request.onerror = (event) => {
          console.error('Error loading customers:', event.target.error);
        };
      }
      
      function addCustomer(customer) {
        const transaction = db.transaction(['customers'], 'readwrite');
        const store = transaction.objectStore('customers');
        store.add(customer);
      }
      
      function editCustomer(id) {
        const transaction = db.transaction(['customers'], 'readonly');
        const store = transaction.objectStore('customers');
        const request = store.get(id);
        
        request.onsuccess = () => {
          const customer = request.result;
          if (customer) {
            document.getElementById('customerId').value = customer.id;
            document.getElementById('name').value = customer.name;
            document.getElementById('email').value = customer.email;
            document.getElementById('phone').value = customer.phone || '';
            document.getElementById('notes').value = customer.notes || '';
            customerForm.style.display = 'block';
          }
        };
      }
      
      function updateCustomer(customer) {
        const transaction = db.transaction(['customers'], 'readwrite');
        const store = transaction.objectStore('customers');
        store.put(customer);
      }
      
      function deleteCustomer(id) {
        if (confirm('Are you sure you want to delete this customer?')) {
          const transaction = db.transaction(['customers'], 'readwrite');
          const store = transaction.objectStore('customers');
          store.delete(id);
          loadCustomers();
        }
      }
      
      function searchCustomers() {
        const searchTerm = searchInput.value.toLowerCase();
        
        getAllCustomers((customers) => {
          const filteredCustomers = customers.filter(customer => 
            customer.name.toLowerCase().includes(searchTerm) || 
            customer.email.toLowerCase().includes(searchTerm) ||
            (customer.phone && customer.phone.includes(searchTerm))
          );
          
          customerList.innerHTML = '';
          
          filteredCustomers.forEach(customer => {
            const customerEl = document.createElement('div');
            customerEl.className = 'customer-card';
            customerEl.innerHTML = `
              <h3>${customer.name}</h3>
              <p>${customer.email}</p>
              ${customer.phone ? `<p>${customer.phone}</p>` : ''}
              <button class="edit-btn" data-id="${customer.id}">Edit</button>
              <button class="delete-btn" data-id="${customer.id}">Delete</button>
            `;
            
            customerEl.querySelector('.edit-btn').addEventListener('click', () => editCustomer(customer.id));
            customerEl.querySelector('.delete-btn').addEventListener('click', () => deleteCustomer(customer.id));
            
            customerList.appendChild(customerEl);
          });
        });
      }
      
      // Notification functions
      function subscribeToPush() {
        if ('serviceWorker' in navigator && 'PushManager' in window) {
          navigator.serviceWorker.ready.then(registration => {
            registration.pushManager.subscribe({
              userVisibleOnly: true,
              applicationServerKey: urlBase64ToUint8Array('YOUR_VAPID_PUBLIC_KEY')
            }).then(subscription => {
              fetch('/api/push-subscribe', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json'
                },
                body: JSON.stringify(subscription)
              });
            }).catch(err => console.error('Push subscription failed:', err));
          });
        }
      }
      
      function startNotificationPolling() {
        // Immediate check
        checkForNotifications();
        // Then check every 15 minutes
        setInterval(checkForNotifications, 15 * 60 * 1000);
      }
      
      function checkForNotifications() {
        fetch('/api/check-notifications')
          .then(res => res.json())
          .then(notifications => {
            notifications.forEach(notif => {
              showAppNotification(notif.title, notif.message);
            });
          })
          .catch(err => console.error('Notification check failed:', err));
      }
      
      // Initialize notifications based on capability
      if ('PushManager' in window) {
        subscribeToPush();
      } else {
        startNotificationPolling();
      }
    }

// Helper function for VAPID key conversion
function urlBase64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding)
      .replace(/-/g, '+')
      .replace(/_/g, '/');
    const rawData = window.atob(base64);
    return Uint8Array.from([...rawData].map((char) => char.charCodeAt(0)));
  }

// Safari doesn't support requestIdleCallback
window.requestIdleCallback = window.requestIdleCallback || 
  function(cb) { return setTimeout(() => { cb(); }, 1); };

// Safari doesn't support NodeList.forEach()
if (window.NodeList && !NodeList.prototype.forEach) {
  NodeList.prototype.forEach = Array.prototype.forEach;
}

// iOS keyboard viewport fix
function handleViewport() {
  if (window.visualViewport) {
    document.documentElement.style.height = `${window.visualViewport.height}px`;
    window.scrollTo(0, 0);
  }
}

window.addEventListener('resize', handleViewport);
window.addEventListener('orientationchange', handleViewport);