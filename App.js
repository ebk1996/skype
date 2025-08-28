import { useState, useEffect, useRef } from 'react';
import { getAuth, signInWithCustomToken, signInAnonymously } from 'firebase/auth';
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, addDoc, query, orderBy, onSnapshot, serverTimestamp } from 'firebase/firestore';

// Main App component
export default function App() {
  // Define Firebase configuration and app ID.
  const firebaseConfig = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : {};
  const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';

  // State variables for the application
  const [db, setDb] = useState(null);
  const [auth, setAuth] = useState(null);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [selectedUser, setSelectedUser] = useState({ id: 'gemini-bot', name: 'Gemini Bot' });
  const messagesEndRef = useRef(null);

  // Hardcoded list of users for the sidebar
  const userList = [
    { id: 'john-doe', name: 'John Doe', avatar: 'https://placehold.co/40x40/fca5a5/ffffff?text=JD' },
    { id: 'jane-smith', name: 'Jane Smith', avatar: 'https://placehold.co/40x40/f87171/ffffff?text=JS' },
    { id: 'gemini-bot', name: 'Gemini Bot', avatar: 'https://placehold.co/40x40/60a5fa/ffffff?text=GB' },
  ];

  // Initialize Firebase and set up a listener for messages
  useEffect(() => {
    async function initializeFirebase() {
      try {
        const app = initializeApp(firebaseConfig);
        const firestoreDb = getFirestore(app);
        const firebaseAuth = getAuth(app);
        setDb(firestoreDb);
        setAuth(firebaseAuth);

        const initialAuthToken = typeof __initial_auth_token !== 'undefined' ? __initial_auth_token : null;
        if (initialAuthToken) {
          await signInWithCustomToken(firebaseAuth, initialAuthToken);
        } else {
          await signInAnonymously(firebaseAuth);
        }

        // Listen for authentication state changes
        const unsubscribe = firebaseAuth.onAuthStateChanged((currentUser) => {
          if (currentUser) {
            setUser(currentUser);
          } else {
            setUser(null);
          }
          setLoading(false);
        });

        return () => unsubscribe(); // Cleanup the listener
      } catch (error) {
        console.error("Firebase initialization or authentication failed:", error);
        setLoading(false);
      }
    }
    initializeFirebase();
  }, []);

  // Listen for real-time message updates from Firestore
  useEffect(() => {
    if (db && user) {
      const q = query(
        collection(db, `/artifacts/${appId}/public/data/messages`),
        orderBy('createdAt')
      );
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const fetchedMessages = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        setMessages(fetchedMessages);
      }, (error) => {
        console.error("Failed to fetch messages:", error);
      });
      return () => unsubscribe();
    }
  }, [db, user, appId]);

  // Scroll to the latest message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Handle sending a message
  const sendMessage = async (e) => {
    e.preventDefault();
    if (!inputText.trim() || !db || !user) return;

    const messagePayload = {
      text: inputText,
      senderId: user.uid,
      senderName: user.uid,
      receiverId: selectedUser.id,
      createdAt: serverTimestamp(),
    };

    try {
      await addDoc(collection(db, `/artifacts/${appId}/public/data/messages`), messagePayload);
      setInputText('');

      // Simulate a bot response from Gemini API
      if (selectedUser.id === 'gemini-bot') {
        const geminiResponse = await getGeminiResponse(inputText);
        if (geminiResponse) {
          await addDoc(collection(db, `/artifacts/${appId}/public/data/messages`), {
            text: geminiResponse,
            senderId: 'gemini-bot',
            senderName: 'Gemini Bot',
            receiverId: user.uid,
            createdAt: serverTimestamp(),
          });
        }
      }
    } catch (error) {
      console.error("Error sending message:", error);
    }
  };

  // Function to get a response from the Gemini API
  const getGeminiResponse = async (prompt) => {
    try {
      let chatHistory = [];
      chatHistory.push({ role: "user", parts: [{ text: prompt }] });
      const payload = { contents: chatHistory };
      const apiKey = "";
      const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-05-20:generateContent?key=${apiKey}`;
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        throw new Error(`API call failed with status: ${response.status}`);
      }

      const result = await response.json();
      if (result.candidates && result.candidates.length > 0 &&
          result.candidates[0].content && result.candidates[0].content.parts &&
          result.candidates[0].content.parts.length > 0) {
        return result.candidates[0].content.parts[0].text;
      } else {
        console.error("Unexpected Gemini API response structure:", result);
        return "Sorry, I couldn't generate a response.";
      }
    } catch (error) {
      console.error("Failed to call Gemini API:", error);
      return "Sorry, there was an error connecting to the chat service.";
    }
  };
  
  // Filtering messages for the currently selected chat
  const filteredMessages = messages.filter(msg => 
    (msg.senderId === user?.uid && msg.receiverId === selectedUser.id) ||
    (msg.senderId === selectedUser.id && msg.receiverId === user?.uid)
  );

  return (
    <div className="flex flex-col h-screen antialiased text-gray-800 bg-gray-100">
      <div className="flex flex-row h-full w-full overflow-hidden">
        {/* Sidebar */}
        <div className="flex flex-col py-8 pl-6 pr-2 w-80 bg-white flex-shrink-0">
          <div className="flex flex-row items-center justify-center h-12 w-full">
            <div className="flex items-center justify-center rounded-2xl text-blue-700 bg-blue-100 h-10 w-10">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
              </svg>
            </div>
            <div className="ml-2 font-bold text-2xl">Skype Clone</div>
          </div>
          <div className="flex flex-col mt-8 overflow-y-auto">
            <div className="flex flex-row items-center justify-between text-xs">
              <span className="font-bold">Active Conversations</span>
            </div>
            <div className="flex flex-col space-y-1 mt-4 -mx-2">
              {userList.map((chatUser) => (
                <button
                  key={chatUser.id}
                  onClick={() => setSelectedUser(chatUser)}
                  className={`flex flex-row items-center hover:bg-gray-100 rounded-xl p-2 ${selectedUser.id === chatUser.id ? 'bg-gray-200' : ''}`}
                >
                  <div className="flex items-center justify-center h-8 w-8 rounded-full bg-indigo-200">
                    <img src={chatUser.avatar} alt={chatUser.name} className="h-8 w-8 rounded-full" />
                  </div>
                  <div className="ml-2 text-sm font-semibold">{chatUser.name}</div>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Chat Area */}
        <div className="flex flex-col flex-auto h-full p-6">
          <div className="flex flex-col flex-auto flex-shrink-0 rounded-2xl bg-white h-full p-4">
            <div className="flex flex-col h-full overflow-x-auto mb-4">
              <div className="flex flex-col h-full">
                <div className="grid grid-cols-12 gap-y-2">
                  {/* Chat messages */}
                  {filteredMessages.map((msg, index) => (
                    <div key={index} className={`col-span-12 ${msg.senderId === user?.uid ? 'justify-end' : 'justify-start'} flex`}>
                      <div className={`flex items-end ${msg.senderId === user?.uid ? '' : 'flex-row-reverse'}`}>
                        <div className={`flex flex-col space-y-2 text-xs max-w-xs mx-2 items-start`}>
                          <div className={`relative px-4 py-2 text-sm rounded-xl ${msg.senderId === user?.uid ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-800'}`}>
                            <div>{msg.text}</div>
                          </div>
                        </div>
                        <div className="flex items-center justify-center h-8 w-8 rounded-full bg-gray-200">
                          {/* Avatar could go here */}
                          <img src={msg.senderId === user?.uid ? 'https://placehold.co/40x40/60a5fa/ffffff?text=ME' : selectedUser.avatar} alt="User" className="h-8 w-8 rounded-full" />
                        </div>
                      </div>
                    </div>
                  ))}
                  <div ref={messagesEndRef} />
                </div>
              </div>
            </div>
            {/* Chat input */}
            <div className="flex flex-row items-center h-16 rounded-xl w-full px-4">
              <form onSubmit={sendMessage} className="flex-grow">
                <div className="relative w-full">
                  <input
                    type="text"
                    className="flex w-full border rounded-xl focus:outline-none focus:border-indigo-300 pl-4 h-10"
                    placeholder="Type your message..."
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                  />
                  <button
                    type="submit"
                    className="absolute flex items-center justify-center h-full w-12 right-0 top-0 text-gray-400 hover:text-blue-500"
                  >
                    <svg className="w-6 h-6 transform rotate-90" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                      <path d="M14 5l7 7m0 0l-7 7m7-7H3"></path>
                    </svg>
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
