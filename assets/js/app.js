if ('serviceWorker' in navigator) {
    window.addEventListener('load', function() {
        // Register with updated scope and features
        navigator.serviceWorker.register('/sw.js', { 
          scope: '/',
          updateViaCache: 'none'  // Important for fresh updates
        })
        .then(function(registration) {
          console.log('ServiceWorker registration successful with scope:', registration.scope);
          
          // Check for updates every hour
          setInterval(() => {
            registration.update().then(() => {
              console.log('ServiceWorker update check completed');
            }).catch(err => {
              console.log('ServiceWorker update failed:', err);
            });
          }, 60 * 60 * 1000);
          
          // Push Notification Setup
          if ('PushManager' in window) {
            setupPushNotifications(registration);
          }
          
          // Track installation state
          registration.addEventListener('updatefound', () => {
            const newWorker = registration.installing;
            console.log('New service worker found:', newWorker.state);
            
            newWorker.addEventListener('statechange', () => {
              console.log('Service worker state changed:', newWorker.state);
              if (newWorker.state === 'installed') {
                // Optional: Show "Update available" toast to user
                if (navigator.serviceWorker.controller) {
                  showAppNotification('Update Available', 'Refresh to get the latest version');
                }
              }
            });
          });
        })
        .catch(function(err) {
          console.log('ServiceWorker registration failed:', err);
        });
        
        // Listen for controller changes (when new SW takes control)
        navigator.serviceWorker.addEventListener('controllerchange', () => {
          console.log('Controller changed - reloading for fresh content');
          window.location.reload();
        });
    });
}

// Push Notification Setup Function
function setupPushNotifications(registration) {
    // Check current permission state
    Notification.requestPermission().then(permission => {
      if (permission === 'granted') {
        console.log('Push notifications permission granted');
        
        // Subscribe to push service
        registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array('YOUR_VAPID_PUBLIC_KEY')
        })
        .then(subscription => {
          console.log('Push subscription successful');
          // Send subscription to server
          sendSubscriptionToServer(subscription);
          
          // Set up periodic sync (if supported)
          if ('periodicSync' in registration) {
            registerPeriodicSync(registration);
          }
        })
        .catch(err => {
          console.error('Push subscription failed:', err);
          // Fallback to polling
          startNotificationPolling();
        });
      } else {
        console.log('Push notifications permission denied');
        // Fallback to polling
        startNotificationPolling();
      }
    });
  }
  
  // Helper function to convert VAPID key
  function urlBase64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding)
      .replace(/-/g, '+')
      .replace(/_/g, '/');
    const rawData = window.atob(base64);
    return Uint8Array.from([...rawData].map((char) => char.charCodeAt(0)));
  }
  
  // Send subscription to your backend
  function sendSubscriptionToServer(subscription) {
    fetch('/api/push-subscribe', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(subscription)
    })
    .then(response => {
      if (!response.ok) throw new Error('Subscription failed');
      console.log('Subscription sent to server');
    })
    .catch(err => {
      console.error('Failed to send subscription:', err);
    });
  }
  
  // Periodic Sync Registration (for background updates)
  function registerPeriodicSync(registration) {
    registration.periodicSync.register('customer-updates', {
      minInterval: 24 * 60 * 60 * 1000 // Daily updates
    })
    .then(() => console.log('Periodic sync registered'))
    .catch(err => console.error('Periodic sync failed:', err));
  }
  
  // Fallback Polling Mechanism
  function startNotificationPolling() {
    // Immediate check
    checkForNotifications();
    // Then check every 4 hours
    setInterval(checkForNotifications, 4 * 60 * 60 * 1000);
  }
  
  function checkForNotifications() {
    fetch('/api/check-notifications')
      .then(response => response.json())
      .then(notifications => {
        notifications.forEach(notif => {
          showAppNotification(notif.title, notif.message);
        });
      })
      .catch(err => console.error('Notification check failed:', err));
  }
  
  // In-app notification display
  function showAppNotification(title, message) {
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification(title, { 
        body: message,
        icon: '/assets/icons/icon-192x192.png'
      });
    } else {
      // Fallback to in-app notification UI
      const notification = document.createElement('div');
      notification.className = 'app-notification';
      notification.innerHTML = `
        <strong>${title}</strong>
        <p>${message}</p>
      `;
      document.body.appendChild(notification);
      setTimeout(() => notification.remove(), 5000);
    }
  }

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