if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js')
        .then(registration => {
          console.log('ServiceWorker registration successful');
        })
        .catch(err => {
          console.log('ServiceWorker registration failed: ', err);
        });
    });
}

//app logic
document.addEventListener('DOMContentLoaded', () => {
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
        notes: document.getElementById('notes').value
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
            <button class="edit-btn" data-id="${customer.id}">Edit</button>
            <button class="delete-btn" data-id="${customer.id}">Delete</button>
          `;
          
          customerEl.querySelector('.edit-btn').addEventListener('click', () => editCustomer(customer.id));
          customerEl.querySelector('.delete-btn').addEventListener('click', () => deleteCustomer(customer.id));
          
          customerList.appendChild(customerEl);
        });
      });
    }
  });

  