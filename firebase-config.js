// Firebase Configuration
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js';
import { getDatabase } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js';

// Firebase configuration
const firebaseConfig = {
    databaseURL: "TU_DATABASE"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const database = getDatabase(app);

// Export database instance globally for use in app.js
// app.js directly imports Firebase functions, but relies on this global 'database' object
// for database references (e.g., ref(window.database, 'students'))
window.database = database;

console.log('Firebase initialized successfully');
