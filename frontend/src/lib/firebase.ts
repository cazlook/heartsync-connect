// Mock Firebase configuration for development
// Real Firebase config will be added later with actual credentials

export const firebaseConfig = {
  apiKey: "mock-api-key",
  authDomain: "mock-project.firebaseapp.com",
  projectId: "mock-project-id",
  storageBucket: "mock-project.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abcdef"
};

// For now, we'll use our custom backend auth instead of Firebase
// When real Firebase credentials are provided, uncomment below:
// import { initializeApp } from 'firebase/app';
// import { getAuth } from 'firebase/auth';
// export const app = initializeApp(firebaseConfig);
// export const auth = getAuth(app);
