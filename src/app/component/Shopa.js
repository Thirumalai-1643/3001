"use client";

import { useEffect, useState, useCallback } from "react";
import { db } from "@/app/lib/firebase";
import { collection, query, where, onSnapshot } from "firebase/firestore";

// ✅ Backend from .env.local
// NEXT_PUBLIC_BACKEND_IP=192.168.1.2:3000
const BACKEND_IP = process.env.NEXT_PUBLIC_BACKEND_IP;
if (!BACKEND_IP) {
  console.error("❌ NEXT_PUBLIC_BACKEND_IP not set in .env.local");
}
const BACKEND_URL = `http://${BACKEND_IP}`;

// 🔹 Helper for API calls
async function apiFetch(path, options = {}) {
  try {
    const res = await fetch(`${BACKEND_URL}${path}`, {
      headers: { "Content-Type": "application/json", ...options.headers },
      ...options,
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Request failed");
    return data;
  } catch (error) {
    console.error(`API Error (${path}):`, error);
    throw error;
  }
}

export default function ViewUsers() {
  const [domain, setDomain] = useState("a.shop.com");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");

  const [mongoUsers, setMongoUsers] = useState([]);
  const [firebaseUsers, setFirebaseUsers] = useState([]);
  const [loadingMongo, setLoadingMongo] = useState(true);
  const [loadingFirebase, setLoadingFirebase] = useState(true);

  // ✅ Add user
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim() || !email.trim()) {
      alert("⚠ Please enter both name and email.");
      return;
    }
    try {
      await apiFetch("/api/userPost", {
        method: "POST",
        body: JSON.stringify({ name, email, domain }),
      });
      alert("✅ User added successfully!");
      setName("");
      setEmail("");
      fetchMongoData();
    } catch {
      alert("❌ Failed to add user.");
    }
  };

  // ✅ Fetch MongoDB data
  const fetchMongoData = useCallback(async () => {
    setLoadingMongo(true);
    try {
      const result = await apiFetch(`/api/userGet?domain=${domain}`);
      setMongoUsers(Array.isArray(result.data) ? result.data : []);
    } catch {
      setMongoUsers([]);
    } finally {
      setLoadingMongo(false);
    }
  }, [domain]);

  // ✅ Load Mongo data on domain change
  useEffect(() => {
    fetchMongoData();
  }, [domain, fetchMongoData]);

  // ✅ Firebase live listener
  useEffect(() => {
    setLoadingFirebase(true);
    const q = query(collection(db, "users"), where("domain", "==", domain));
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        setFirebaseUsers(
          snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }))
        );
        setLoadingFirebase(false);
      },
      (error) => {
        console.error("Firebase fetch error:", error);
        setFirebaseUsers([]);
        setLoadingFirebase(false);
      }
    );
    return () => unsubscribe();
  }, [domain]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-100 via-pink-50 to-blue-100 p-8">
      <div className="max-w-4xl mx-auto bg-white shadow-lg rounded-xl p-6">
        <h1 className="text-3xl font-bold text-purple-700 mb-6">
          👥 User Management
        </h1>

        {/* Form */}
        <form
          onSubmit={handleSubmit}
          className="flex flex-col md:flex-row gap-4 mb-8"
        >
          <input
            type="text"
            placeholder="Name"
            className="p-3 border rounded-lg bg-purple-50 focus:outline-none focus:ring-2 focus:ring-purple-400 flex-1"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <input
            type="email"
            placeholder="Email"
            className="p-3 border rounded-lg bg-purple-50 focus:outline-none focus:ring-2 focus:ring-purple-400 flex-1"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <select
            value={domain}
            onChange={(e) => setDomain(e.target.value)}
            className="p-3 border rounded-lg bg-purple-50 focus:outline-none focus:ring-2 focus:ring-purple-400"
          >
            <option value="a.shop.com">a.shop.com</option>
            <option value="b.shop.com">b.shop.com</option>
          </select>
          <button
            type="submit"
            className="px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600"
          >
            ➕ Add User
          </button>
        </form>

        {/* Firebase Section */}
        <Section
          title="⚡ Firebase Live Users"
          color="green"
          loading={loadingFirebase}
          users={firebaseUsers}
        />

        {/* MongoDB Section */}
        <Section
          title="📦 MongoDB Stored Users"
          color="blue"
          loading={loadingMongo}
          users={mongoUsers}
        />
      </div>
    </div>
  );
}

// 🔹 Reusable User List Section
function Section({ title, color, loading, users }) {
  return (
    <section className="mb-6">
      <h2 className={`text-xl font-semibold text-${color}-600 mb-2`}>
        {title}
      </h2>
      {loading ? (
        <p className="text-gray-500">Loading...</p>
      ) : users.length === 0 ? (
        <p className="text-gray-500">No data found.</p>
      ) : (
        <ul className={`bg-${color}-50 p-4 rounded-lg`}>
          {users.map((user) => (
            <li
              key={user.id || user._id}
              className={`py-2 border-b border-${color}-200 last:border-none`}
            >
              <span className="font-medium">{user.name}</span> — {user.email} —{" "}
              <span className="text-sm text-gray-500">{user.domain}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
