"use client";

import { useEffect, useState, useCallback } from "react";
import { db } from "@/app/lib/firebase";
import { collection, query, where, onSnapshot, addDoc } from "firebase/firestore";

/* -------------------- Dynamic Backend URL -------------------- */
const getBackendURL = () => {
  if (process.env.NEXT_PUBLIC_BACKEND_IP) {
    // use env IP if exists
    return process.env.NEXT_PUBLIC_BACKEND_IP.startsWith("http")
      ? process.env.NEXT_PUBLIC_BACKEND_IP
      : `http://${process.env.NEXT_PUBLIC_BACKEND_IP}`;
  }
  // fallback to current frontend host + port 3000
  if (typeof window !== "undefined") {
    return `http://${window.location.hostname}:3000`;
  }
  return "";
};

const BACKEND_URL = getBackendURL();

/* -------------------- API helper -------------------- */
async function apiFetch(path, options = {}) {
  try {
    const res = await fetch(`${BACKEND_URL}${path}`, {
      headers: { "Content-Type": "application/json", ...options.headers },
      ...options,
    });
    const text = await res.text();
    let data;
    try { data = JSON.parse(text); } catch { data = { error: text }; }

    if (!res.ok) throw new Error(data.error || "Request failed");
    return data;
  } catch (err) {
    console.error(`API Error (${path}):`, err);
    throw err;
  }
}

/* -------------------- Main Component -------------------- */
export default function ViewUsers() {
  const [domain, setDomain] = useState("a.shop.com");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");

  const [mongoUsers, setMongoUsers] = useState([]);
  const [firebaseUsers, setFirebaseUsers] = useState([]);
  const [loadingMongo, setLoadingMongo] = useState(true);
  const [loadingFirebase, setLoadingFirebase] = useState(true);

  /* -------------------- Add User -------------------- */
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim() || !email.trim()) return alert("⚠ Enter both name and email.");

    try {
      await apiFetch("/api/userPost", {
        method: "POST",
        body: JSON.stringify({ name, email, domain }),
      });

      await addDoc(collection(db, "users"), { name, email, domain });

      alert("✅ User added successfully!");
      setName("");
      setEmail("");
      fetchMongoData();
    } catch {
      alert("❌ Failed to add user.");
    }
  };

  /* -------------------- Fetch MongoDB Users -------------------- */
  const fetchMongoData = useCallback(async () => {
    setLoadingMongo(true);
    try {
      const result = await apiFetch(`/api/userGet?domain=${encodeURIComponent(domain)}`);
      setMongoUsers(Array.isArray(result.data) ? result.data : []);
    } catch {
      setMongoUsers([]);
    } finally {
      setLoadingMongo(false);
    }
  }, [domain]);

  useEffect(() => { fetchMongoData(); }, [domain, fetchMongoData]);

  /* -------------------- Firebase Live Listener -------------------- */
  useEffect(() => {
    setLoadingFirebase(true);
    const q = query(collection(db, "users"), where("domain", "==", domain));
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        setFirebaseUsers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        setLoadingFirebase(false);
      },
      (error) => {
        console.error("Firebase error:", error);
        setFirebaseUsers([]);
        setLoadingFirebase(false);
      }
    );
    return () => unsubscribe();
  }, [domain]);

  /* -------------------- JSX -------------------- */
  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-100 via-pink-50 to-blue-100 p-8">
      <div className="max-w-4xl mx-auto bg-white shadow-lg rounded-xl p-6">
        <h1 className="text-3xl font-bold text-purple-700 mb-6">👥 User Management</h1>

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex flex-col md:flex-row gap-4 mb-8">
          <input
            type="text"
            placeholder="Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="p-3 border rounded-lg flex-1"
          />
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="p-3 border rounded-lg flex-1"
          />
          <select
            value={domain}
            onChange={(e) => setDomain(e.target.value)}
            className="p-3 border rounded-lg"
          >
            <option value="a.shop.com">a.shop.com</option>
            <option value="b.shop.com">b.shop.com</option>
          </select>
          <button
            type="submit"
            className="px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600"
          >
            Add User
          </button>
        </form>

        {/* Firebase Section */}
        <Section title="⚡ Firebase Live Users" color="green" loading={loadingFirebase} users={firebaseUsers} />

        {/* MongoDB Section */}
        <Section title="📦 MongoDB Stored Users" color="blue" loading={loadingMongo} users={mongoUsers} />
      </div>
    </div>
  );
}

/* -------------------- Section Component -------------------- */
function Section({ title, color, loading, users }) {
  const titleColor = color === "green" ? "text-green-600" : "text-blue-600";
  const bgColor = color === "green" ? "bg-green-50" : "bg-blue-50";
  const borderColor = color === "green" ? "border-green-200" : "border-blue-200";

  return (
    <section className="mb-6">
      <h2 className={`text-xl font-semibold ${titleColor} mb-2`}>{title}</h2>
      {loading ? (
        <p className="text-gray-500">Loading...</p>
      ) : users.length === 0 ? (
        <p className="text-gray-500">No data found.</p>
      ) : (
        <ul className={`${bgColor} p-4 rounded-lg`}>
          {users.map(user => (
            <li key={user.id || user._id} className={`py-2 border-b ${borderColor} last:border-none`}>
              <span className="font-medium">{user.name}</span> — {user.email} — <span className="text-sm text-gray-500">{user.domain}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
