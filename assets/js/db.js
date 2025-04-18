let db;
const request = indexedDB.open('CustomerDB', 1);

request.onupgradeneeded = (event) => {
  db = event.target.result;
  const store = db.createObjectStore('customers', { keyPath: 'id', autoIncrement: true });
  store.createIndex('name', 'name', { unique: false });
  store.createIndex('email', 'email', { unique: true });
  store.createIndex('phone', 'phone', { unique: false });
};

request.onsuccess = (event) => {
  db = event.target.result;
};

function addCustomer(customer) {
  const transaction = db.transaction(['customers'], 'readwrite');
  const store = transaction.objectStore('customers');
  store.add(customer);
}

function getAllCustomers(callback) {
  const transaction = db.transaction(['customers'], 'readonly');
  const store = transaction.objectStore('customers');
  const request = store.getAll();
  
  request.onsuccess = () => {
    callback(request.result);
  };
}