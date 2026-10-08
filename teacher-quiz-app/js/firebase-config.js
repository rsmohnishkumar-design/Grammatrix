// Quizzify — a dedicated Firebase project, separate from Grammatrix.
const firebaseConfig = {
  apiKey: "AIzaSyBedj7OF9N1mwQmQytLoOUi8_yjFGPzplo",
  authDomain: "quizzify-91005.firebaseapp.com",
  projectId: "quizzify-91005",
  storageBucket: "quizzify-91005.firebasestorage.app",
  messagingSenderId: "675521594929",
  appId: "1:675521594929:web:31b101969a8c10d6da7710",
};

firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
const storage = firebase.storage();
