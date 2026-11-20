import React, { useEffect, useRef, useState } from "react";
import bcrypt from "bcryptjs";
import { Link, Navigate, NavLink, useLocation, useNavigate } from "react-router-dom";

const initialContacts = [
  { id: "contact-olivia", name: "Olivia Rhye", email: "olivia@untitledui.com", company: "Layers", status: "Customer", initials: "OR", color: "lavender", date: "Today" },
  { id: "contact-phoenix", name: "Phoenix Baker", email: "phoenix@baker.io", company: "Baker Studio", status: "Lead", initials: "PB", color: "peach", date: "Today" },
  { id: "contact-lana", name: "Lana Steiner", email: "lana@stellarlabs.com", company: "Stellar Labs", status: "Customer", initials: "LS", color: "mint", date: "Yesterday" },
  { id: "contact-demi", name: "Demi Wilkinson", email: "demi@work.co", company: "Work & Co", status: "Lead", initials: "DW", color: "blue", date: "Yesterday" },
  { id: "contact-candice", name: "Candice Wu", email: "candice@circles.co", company: "Circles", status: "Prospect", initials: "CW", color: "rose", date: "Oct 24, 2024" },
];

const roleRules = {
  Admin: ["Access all workspace pages", "Create, edit, deactivate, and delete users", "Only role with access to user administration"],
  Manager: ["Access Overview, Contacts, Deals, Tasks, and Reports", "No access to user administration"],
  Member: ["Access Overview, Contacts, and Tasks", "No access to Deals, Reports, or user administration"],
};

const rolePages = {
  Admin: ["Overview", "Contacts", "Deals", "Tasks", "Reports", "Users & access"],
  Manager: ["Overview", "Contacts", "Deals", "Tasks", "Reports"],
  Member: ["Overview", "Contacts", "Tasks"],
};

const initialDeals = [
  { id: "deal-website", name: "Website redesign", company: "Layers", stage: "Proposal", amount: 12000, initials: "L", color: "lavender" },
  { id: "deal-subscription", name: "Annual subscription", company: "Baker Studio", stage: "Negotiation", amount: 8400, initials: "B", color: "peach" },
  { id: "deal-brand", name: "Brand strategy", company: "Stellar Labs", stage: "Qualified", amount: 6200, initials: "S", color: "mint" },
];

const initialTasks = [
  { id: "task-proposal", title: "Send proposal to Olivia", detail: "Layers · Deal follow-up", time: "10:30 AM", done: false },
  { id: "task-discovery", title: "Prepare discovery questions", detail: "Baker Studio · Intro call", time: "1:00 PM", done: false },
  { id: "task-lana", title: "Check in with Lana", detail: "Stellar Labs · Follow-up", time: "3:30 PM", done: true },
];

const pagePaths = {
  Overview: "/app",
  Contacts: "/app/contacts",
  Deals: "/app/deals",
  Tasks: "/app/tasks",
  Reports: "/app/reports",
  "Users & access": "/app/users",
};

const localUsersKey = "orbit-crm-offline-users";
const localSessionKey = "orbit-crm-offline-session";
const initialDemoUsers = [
  { id: "demo-admin", name: "Jamie Davis", email: "jamie@studionorth.co", role: "Admin", status: "Active", password: "admin123" },
  { id: "demo-manager", name: "Taylor Morgan", email: "taylor@studionorth.co", role: "Manager", status: "Active", password: "manager123" },
  { id: "demo-member", name: "Alex Chen", email: "alex@studionorth.co", role: "Member", status: "Active", password: "member123" },
];

let localApiMode = false;

function enableLocalApiMode() {
  if (localApiMode) return;
  localApiMode = true;
  window.dispatchEvent(new Event("crm-local-api-mode"));
}

function localError(message, status) {
  const error = new Error(message);
  error.status = status;
  return error;
}

async function getLocalUsers() {
  const saved = localStorage.getItem(localUsersKey);
  if (saved) {
    try {
      return JSON.parse(saved);
    } catch {
      throw new Error("Local account data is unreadable. Clear this app's local storage and try again.");
    }
  }

  const users = await Promise.all(initialDemoUsers.map(async ({ password, ...user }) => ({
    ...user,
    passwordHash: await bcrypt.hash(password, 10),
    image: "",
  })));
  localStorage.setItem(localUsersKey, JSON.stringify(users));
  return users;
}

function saveLocalUsers(users) {
  localStorage.setItem(localUsersKey, JSON.stringify(users));
}

function publicLocalUser(user) {
  const { passwordHash, ...safeUser } = user;
  return safeUser;
}

function validateLocalImage(image) {
  return image === "" || (
    typeof image === "string" &&
    image.length <= 750000 &&
    /^data:image\/(?:jpeg|png|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(image)
  );
}

async function localApiRequest(path, options = {}) {
  const method = options.method || "GET";
  const body = options.body || {};
  const users = await getLocalUsers();

  if (path === "/auth/signup" && method === "POST") {
    const name = typeof body.name === "string" ? body.name.trim() : "";
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    if (name.length < 2 || name.length > 80 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || typeof body.password !== "string" || body.password.length < 8 || body.password.length > 128 || !validateLocalImage(body.image || "")) {
      throw localError("Enter a name, valid email, password with at least 8 characters, and a valid profile image.", 400);
    }
    if (users.some((user) => user.email === email)) {
      throw localError("An account with this email already exists.", 409);
    }
    const user = {
      id: `local-${Date.now()}`,
      name,
      email,
      passwordHash: await bcrypt.hash(body.password, 10),
      image: body.image || "",
      role: "Member",
      status: "Active",
    };
    saveLocalUsers([user, ...users]);
    localStorage.setItem(localSessionKey, user.id);
    return { user: publicLocalUser(user) };
  }

  if (path === "/auth/login" && method === "POST") {
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    const user = users.find((item) => item.email === email);
    if (!user || user.status !== "Active" || !(await bcrypt.compare(body.password || "", user.passwordHash))) {
      throw localError("Email or password is incorrect, or this account is inactive.", 401);
    }
    localStorage.setItem(localSessionKey, user.id);
    return { user: publicLocalUser(user) };
  }

  if (path === "/auth/me" && method === "GET") {
    const sessionId = localStorage.getItem(localSessionKey);
    const user = users.find((item) => item.id === sessionId && item.status === "Active");
    if (!user) throw localError("Sign in to continue.", 401);
    return { user: publicLocalUser(user) };
  }

  if (path === "/auth/logout" && method === "POST") {
    localStorage.removeItem(localSessionKey);
    return { ok: true };
  }

  if (path === "/auth/profile" && method === "PATCH") {
    const sessionId = localStorage.getItem(localSessionKey);
    const index = users.findIndex((item) => item.id === sessionId && item.status === "Active");
    if (index < 0) throw localError("Sign in to continue.", 401);
    const updated = { ...users[index] };
    if (body.name !== undefined) {
      if (typeof body.name !== "string" || body.name.trim().length < 2 || body.name.trim().length > 80) throw localError("Name must be between 2 and 80 characters.", 400);
      updated.name = body.name.trim();
    }
    if (body.email !== undefined) {
      const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) throw localError("Enter a valid email address.", 400);
      if (users.some((item) => item.email === email && item.id !== updated.id)) throw localError("A user with this email already exists.", 409);
      updated.email = email;
    }
    if (body.image !== undefined) {
      if (!validateLocalImage(body.image)) throw localError("Choose a supported profile image.", 400);
      updated.image = body.image;
    }
    users[index] = updated;
    saveLocalUsers(users);
    return { user: publicLocalUser(updated) };
  }

  const sessionId = localStorage.getItem(localSessionKey);
  const currentUser = users.find((item) => item.id === sessionId && item.status === "Active");
  if (!currentUser) throw localError("Sign in to continue.", 401);
  if (currentUser.role !== "Admin") throw localError("You do not have permission to perform this action.", 403);

  if (path === "/users" && method === "GET") {
    return { users: users.map(publicLocalUser).sort((a, b) => a.name.localeCompare(b.name)) };
  }
  if (path === "/users" && method === "POST") {
    const name = typeof body.name === "string" ? body.name.trim() : "";
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    const role = body.role || "Member";
    if (name.length < 2 || name.length > 80 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || typeof body.password !== "string" || body.password.length < 8 || body.password.length > 128 || !["Admin", "Manager", "Member"].includes(role) || !validateLocalImage(body.image || "")) {
      throw localError("Enter valid account details and a password with at least 8 characters.", 400);
    }
    if (users.some((user) => user.email === email)) throw localError("An account with this email already exists.", 409);
    const user = {
      id: `local-${Date.now()}`,
      name,
      email,
      role,
      status: "Active",
      image: body.image || "",
      passwordHash: await bcrypt.hash(body.password, 10),
    };
    saveLocalUsers([user, ...users]);
    return { user: publicLocalUser(user) };
  }

  const userMatch = path.match(/^\/users\/([^/]+)$/);
  if (userMatch && method === "GET") {
    const user = users.find((item) => item.id === decodeURIComponent(userMatch[1]));
    if (!user) throw localError("User not found.", 404);
    return { user: publicLocalUser(user) };
  }
  if (userMatch && method === "PATCH") {
    const index = users.findIndex((user) => user.id === decodeURIComponent(userMatch[1]));
    if (index < 0) throw localError("User not found.", 404);
    const updated = { ...users[index] };
    if (body.name !== undefined) {
      if (typeof body.name !== "string" || body.name.trim().length < 2 || body.name.trim().length > 80) throw localError("Name must be between 2 and 80 characters.", 400);
      updated.name = body.name.trim();
    }
    if (body.email !== undefined) {
      const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) throw localError("Enter a valid email address.", 400);
      if (users.some((user) => user.email === email && user.id !== updated.id)) throw localError("An account with this email already exists.", 409);
      updated.email = email;
    }
    if (body.role !== undefined) {
      if (!["Admin", "Manager", "Member"].includes(body.role)) throw localError("Role must be Admin, Manager, or Member.", 400);
      updated.role = body.role;
    }
    if (body.status !== undefined) {
      if (!["Active", "Inactive"].includes(body.status)) throw localError("Status must be Active or Inactive.", 400);
      updated.status = body.status;
    }
    if (body.image !== undefined) {
      if (!validateLocalImage(body.image)) throw localError("Choose a supported profile image.", 400);
      updated.image = body.image;
    }
    if (body.password) {
      if (body.password.length < 8 || body.password.length > 128) throw localError("Password must be between 8 and 128 characters.", 400);
      updated.passwordHash = await bcrypt.hash(body.password, 10);
    }
    if (updated.id === currentUser.id && (updated.role !== "Admin" || updated.status !== "Active")) {
      throw localError("You cannot remove your own Admin access or deactivate your account.", 400);
    }
    const removesAdminAccess = updated.id !== currentUser.id
      && users[index].role === "Admin"
      && users[index].status === "Active"
      && (updated.role !== "Admin" || updated.status !== "Active");
    if (removesAdminAccess) {
      const activeAdminCount = users.filter((item) => item.role === "Admin" && item.status === "Active").length;
      if (activeAdminCount <= 1) throw localError("At least one active Admin account must remain.", 400);
    }
    users[index] = updated;
    saveLocalUsers(users);
    return { user: publicLocalUser(updated) };
  }
  if (userMatch && method === "DELETE") {
    const userId = decodeURIComponent(userMatch[1]);
    if (userId === currentUser.id) throw localError("You cannot delete your own account.", 400);
    const existing = users.find((user) => user.id === userId);
    if (!existing) throw localError("User not found.", 404);
    if (existing.role === "Admin" && existing.status === "Active") {
      const activeAdminCount = users.filter((item) => item.role === "Admin" && item.status === "Active").length;
      if (activeAdminCount <= 1) throw localError("At least one active Admin account must remain.", 400);
    }
    const remaining = users.filter((user) => user.id !== userId);
    if (remaining.length === users.length) throw localError("User not found.", 404);
    saveLocalUsers(remaining);
    return { ok: true };
  }

  throw localError("API endpoint not found.", 404);
}

async function apiRequest(path, options = {}) {
  if (process.env.API_ENABLED !== "true") {
    enableLocalApiMode();
    return localApiRequest(path, options);
  }

  const headers = { ...options.headers };
  if (options.body !== undefined) headers["Content-Type"] = "application/json";
  const response = await fetch(`/api${path}`, {
    ...options,
    credentials: "include",
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const error = new Error(payload && payload.message ? payload.message : `Request failed with status ${response.status}.`);
    error.status = response.status;
    throw error;
  }
  if (!payload) throw new Error("The server returned an invalid response.");
  return payload;
}

const navGroups = [
  { label: "WORKSPACE", items: [["Overview", "grid"], ["Contacts", "users"], ["Deals", "briefcase"], ["Tasks", "check"]] },
  { label: "INSIGHTS", items: [["Reports", "chart"]] },
  { label: "ADMINISTRATION", items: [["Users & access", "users"]] },
];

function Icon({ name, size = 18 }) {
  const common = { width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": true };
  const paths = {
    grid: <><rect x="3.5" y="3.5" width="7" height="7" rx="1.5" /><rect x="13.5" y="3.5" width="7" height="7" rx="1.5" /><rect x="3.5" y="13.5" width="7" height="7" rx="1.5" /><rect x="13.5" y="13.5" width="7" height="7" rx="1.5" /></>,
    users: <><path d="M16 20v-1.5a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4V20" /><circle cx="9.5" cy="7" r="3.5" /><path d="M17 11a3.5 3.5 0 0 0 0-7M21 20v-1.5a4 4 0 0 0-3-3.87" /></>,
    briefcase: <><rect x="3" y="7" width="18" height="14" rx="2" /><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M3 12h18M10 12v2h4v-2" /></>,
    check: <><rect x="4" y="4" width="16" height="16" rx="3" /><path d="m8 12 2.5 2.5L16 9" /></>,
    chart: <><path d="M4 19V5M4 19h17" /><path d="m7 15 4-4 3 2 6-7" /><path d="M16 6h4v4" /></>,
    search: <><circle cx="10.8" cy="10.8" r="6.8" /><path d="m16 16 4.5 4.5" /></>,
    bell: <><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4" /></>,
    plus: <><path d="M12 5v14M5 12h14" /></>,
    arrow: <><path d="M5 12h14M13 6l6 6-6 6" /></>,
    upload: <><path d="M12 16V4m0 0L7 9m5-5 5 5" /><path d="M5 14v5a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-5" /></>,
    more: <><circle cx="5" cy="12" r="1" /><circle cx="12" cy="12" r="1" /><circle cx="19" cy="12" r="1" /></>,
    chevron: <path d="m7 10 5 5 5-5" />,
    clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
    calendar: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M16 3v4M8 3v4M3 10h18" /></>,
    menu: <><path d="M4 6h16M4 12h16M4 18h16" /></>,
    close: <><path d="m6 6 12 12M18 6 6 18" /></>,
  };
  return <svg {...common}>{paths[name]}</svg>;
}

function Avatar({ initials, color, small = false, image }) {
  return <span className={`avatar ${color} ${small ? "avatar-small" : ""}`}>{image ? <img src={image} alt="" /> : initials}</span>;
}

function readProfileImage(file) {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith("image/")) {
      reject(new Error("Choose an image file."));
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      reject(new Error("Choose an image smaller than 5 MB."));
      return;
    }

    const reader = new FileReader();
    reader.onerror = () => reject(new Error("The image could not be read. Please try another file."));
    reader.onload = () => {
      const image = new Image();
      image.onerror = () => reject(new Error("The image could not be opened. Please try another file."));
      image.onload = () => {
        const scale = Math.min(1, 512 / Math.max(image.width, image.height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(image.width * scale));
        canvas.height = Math.max(1, Math.round(image.height * scale));
        const context = canvas.getContext("2d");
        if (!context) {
          reject(new Error("Image processing is unavailable in this browser."));
          return;
        }
        context.fillStyle = "#fff";
        context.fillRect(0, 0, canvas.width, canvas.height);
        context.drawImage(image, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", 0.82));
      };
      image.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

function ProfileImagePicker({ name, image, onChange }) {
  const [error, setError] = useState("");
  const fileInputRef = useRef(null);

  async function handleChange(event) {
    const file = event.target.files[0];
    if (!file) return;
    try {
      onChange(await readProfileImage(file));
      setError("");
    } catch (imageError) {
      setError(imageError.message);
    }
    event.target.value = "";
  }

  return <div className="profile-image-picker">
    <Avatar initials={getInitials(name || "?")} color="dark" image={image} />
    <div className="profile-image-controls">
      <button type="button" className="image-upload-button" aria-label="Upload profile image" title="Upload image" onClick={() => fileInputRef.current?.click()}><Icon name="upload" size={16} /></button>
      <input ref={fileInputRef} type="file" accept="image/*" onChange={handleChange} />
      {image && <button type="button" className="image-remove-button" onClick={() => { onChange(""); setError(""); }}>Remove</button>}
      <small>Image up to 5 MB</small>
      {error && <span className="form-error" role="alert">{error}</span>}
    </div>
  </div>;
}

function Sidebar({ active, onLogout, open, onClose, taskCount, user }) {
  return (
    <>
      {open && <button className="mobile-scrim" aria-label="Close navigation" onClick={onClose} />}
      <aside className={`sidebar ${open ? "sidebar-open" : ""}`}>
        <div className="brand-row">
          <div className="brand-mark">o</div>
          <Link to="/app" className="brand-name">orbit<span>.</span></Link>
          <button className="icon-button mobile-close" onClick={onClose} aria-label="Close menu"><Icon name="close" /></button>
        </div>
        <div className="workspace-switch">
          <span className="workspace-icon">S</span>
          <span className="workspace-copy"><strong>Studio North</strong><small>Free plan</small></span>
          <Icon name="chevron" size={16} />
        </div>
        <nav className="side-nav" aria-label="Main navigation">
          {navGroups.map((group) => {
            const availableItems = group.items.filter(([label]) => rolePages[user.role].includes(label));
            if (availableItems.length === 0) return null;
            return <div className="nav-group" key={group.label}>
              <p className="nav-label">{group.label}</p>
              {availableItems.map(([label, icon]) => (
                <NavLink key={label} to={pagePaths[label]} end={label === "Overview"} onClick={onClose} className={({ isActive }) => `nav-item ${isActive ? "active" : ""}`}>
                  <Icon name={icon} /><span>{label}</span>
                  {label === "Tasks" && taskCount > 0 && <span className="nav-count">{taskCount}</span>}
                </NavLink>
              ))}
            </div>;
          })}
        </nav>
        <div className="sidebar-bottom">
          <div className="upgrade-card">
            <div className="upgrade-spark">✦</div>
            <strong>Make room to grow</strong>
            <p>Upgrade your plan for unlimited contacts and more.</p>
            <Link to="/#get-started">Explore plans <Icon name="arrow" size={14} /></Link>
          </div>
          <button className="profile-button" onClick={onLogout} title="Sign out">
            <Avatar initials={getInitials(user.name)} color="dark" image={user.image} />
            <span className="profile-copy"><strong>{user.name}</strong><small>{user.email}</small></span>
            <span className="logout-label">Sign out</span>
          </button>
        </div>
      </aside>
    </>
  );
}

function Header({ title, onMenu, onSearch, onNotifications, onLogout, onUpdateProfile, search, theme, onThemeChange, user }) {
  const [profileOpen, setProfileOpen] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [editingProfile, setEditingProfile] = useState(false);
  const profileMenuRef = useRef(null);

  useEffect(() => {
    function handleOutsideClick(event) {
      if (profileMenuRef.current && !profileMenuRef.current.contains(event.target)) {
        setProfileOpen(false);
      }
    }
    function handleEscape(event) {
      if (event.key === "Escape") {
        setProfileOpen(false);
        setShowProfile(false);
        setEditingProfile(false);
      }
    }
    document.addEventListener("mousedown", handleOutsideClick);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
      document.removeEventListener("keydown", handleEscape);
    };
  }, []);

  useEffect(() => {
    setProfileOpen(false);
  }, [title]);

  return (
    <header className="topbar">
      <button className="icon-button menu-button" aria-label="Open navigation" onClick={onMenu}><Icon name="menu" /></button>
      <div className="breadcrumbs"><span>Workspace</span><span className="crumb-slash">/</span><strong>{title}</strong></div>
      <div className="topbar-actions">
        <label className="search-box">
          <Icon name="search" size={17} />
          <input placeholder="Search anything..." aria-label="Search" value={search} onChange={(event) => onSearch(event.target.value)} />
          <kbd>⌘ K</kbd>
        </label>
        <button className="icon-button notification-button" aria-label="Notifications" onClick={onNotifications}><Icon name="bell" /></button>
        <div className="profile-menu-wrap" ref={profileMenuRef}>
          <button className="topbar-profile-button" aria-label="Open account menu" aria-haspopup="menu" aria-expanded={profileOpen} onClick={() => setProfileOpen((open) => !open)}>
            <Avatar initials={getInitials(user.name)} color="dark" small image={user.image} />
          </button>
          {profileOpen && <div className="account-menu" role="menu" aria-label="Account menu">
            <div className="account-menu-person">
              <Avatar initials={getInitials(user.name)} color="dark" image={user.image} />
              <span><strong>{user.name}</strong><small>{user.email}</small><span className={`role-badge ${user.role.toLowerCase()}`}>{user.role}</span></span>
            </div>
            <div className="account-menu-divider" />
            <div className="account-appearance" role="group" aria-label="Appearance options">
              <span>Appearance</span>
              <div>
                <button type="button" role="menuitemradio" aria-checked={theme === "bright"} className={theme === "bright" ? "selected" : ""} onClick={() => onThemeChange("bright")}>Bright</button>
                <button type="button" role="menuitemradio" aria-checked={theme === "dark"} className={theme === "dark" ? "selected" : ""} onClick={() => onThemeChange("dark")}>Dark</button>
              </div>
            </div>
            <div className="account-menu-divider" />
            <button role="menuitem" onClick={() => { setProfileOpen(false); setEditingProfile(false); setShowProfile(true); }}>My profile</button>
            {user.role === "Admin" && <Link role="menuitem" to={pagePaths["Users & access"]}>Manage users</Link>}
            <div className="account-menu-divider" />
            <button role="menuitem" className="account-logout" onClick={() => { setProfileOpen(false); onLogout(); }}>Sign out</button>
          </div>}
        </div>
      </div>
      {showProfile && <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) { setShowProfile(false); setEditingProfile(false); } }}>
        <section className="user-modal profile-details-modal" role="dialog" aria-modal="true" aria-labelledby="profile-dialog-title">
          <div className="panel-heading"><div><h2 id="profile-dialog-title">{editingProfile ? "Edit profile" : "My profile"}</h2><p>{editingProfile ? "Update your account details and photo." : "Your workspace account details."}</p></div><button className="icon-button" aria-label="Close profile" onClick={() => { setShowProfile(false); setEditingProfile(false); }}><Icon name="close" /></button></div>
          {editingProfile
            ? <ProfileEditor user={user} onSave={onUpdateProfile} onCancel={() => setEditingProfile(false)} onSaved={() => { setShowProfile(false); setEditingProfile(false); }} />
            : <><div className="profile-details"><Avatar initials={getInitials(user.name)} color="dark" image={user.image} /><div><span>Name</span><strong>{user.name}</strong></div><div><span>Email</span><strong>{user.email}</strong></div><div><span>Role</span><strong>{user.role}</strong></div><div><span>Account status</span><strong>{user.status}</strong></div></div>
              <div className="modal-actions"><button className="button button-secondary" onClick={() => setEditingProfile(true)}>Edit profile</button><button className="button button-primary" onClick={() => setShowProfile(false)}>Done</button></div></>}
        </section>
      </div>}
    </header>
  );
}

function ProfileEditor({ user, onSave, onCancel, onSaved }) {
  const [form, setForm] = useState({ name: user.name, email: user.email, image: user.image || "" });
  const [error, setError] = useState("");

  async function submit(event) {
    event.preventDefault();
    setError("");
    try {
      await onSave({ ...form, name: form.name.trim(), email: form.email.trim().toLowerCase() });
      onSaved();
    } catch (saveError) {
      setError(saveError.message);
    }
  }

  return <form className="user-form" onSubmit={submit}>
    <ProfileImagePicker name={form.name} image={form.image} onChange={(image) => setForm((current) => ({ ...current, image }))} />
    <label>Full name<input autoFocus value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required /></label>
    <label>Email address<input type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} required /></label>
    {error && <p className="form-error" role="alert">{error}</p>}
    <div className="modal-actions"><button type="button" className="button button-secondary" onClick={onCancel}>Cancel</button><button type="submit" className="button button-primary">Save changes</button></div>
  </form>;
}

function Dashboard({ contacts, deals, tasks, user, onNavigate, onToggleTask }) {
  const openDeals = deals.filter((deal) => !["Won", "Lost"].includes(deal.stage));
  const wonRevenue = deals.filter((deal) => deal.stage === "Won").reduce((total, deal) => total + Number(deal.amount), 0);
  const potentialRevenue = openDeals.reduce((total, deal) => total + Number(deal.amount), 0);
  const openTasks = tasks.filter((task) => !task.done);
  return (
    <>
      <div className="page-heading">
        <div><p className="eyebrow">YOUR CRM AT A GLANCE</p><h1>Good morning, {user.name.split(" ")[0]} <span className="wave">✦</span></h1><p className="page-subtitle">Here’s what’s happening with your business today.</p></div>
        <button className="button button-primary" onClick={() => onNavigate("Contacts")}><Icon name="plus" size={17} /> Add contact</button>
      </div>
      <section className="stats-grid" aria-label="Business overview">
        <StatCard label="Total contacts" value={contacts.length} change="Live" hint="in your workspace" icon="users" color="purple" />
        <StatCard label="Open deals" value={openDeals.length} change="Live" hint="in your pipeline" icon="briefcase" color="orange" />
        <StatCard label="Revenue won" value={formatMoney(wonRevenue)} change="Live" hint="closed-won deals" icon="chart" color="green" />
        <StatCard label="Tasks due" value={openTasks.length} change="Open" hint="awaiting follow-up" icon="check" color="blue" negative />
      </section>
      <div className="dashboard-grid">
        <section className="panel pipeline-panel">
          <div className="panel-heading"><div><h2>Sales pipeline</h2><p>Your deals at a glance</p></div><button className="text-button" onClick={() => onNavigate("Deals")}>View deals <Icon name="arrow" size={15} /></button></div>
          <div className="pipeline-total"><strong>{formatMoney(potentialRevenue)}</strong><span>Potential revenue</span><span className="pipeline-trend">{openDeals.length} open</span></div>
          <div className="bar-chart" aria-label="Sales pipeline trend">
            {[38, 51, 44, 64, 57, 78, 70, 90, 68, 84, 73, 100].map((height, index) => <div key={index} className={`bar ${index === 11 ? "bar-highlight" : ""}`} style={{ height: `${height}%` }} />)}
          </div>
          <div className="chart-labels"><span>May</span><span>Jun</span><span>Jul</span><span>Aug</span><span>Sep</span><span>Oct</span></div>
        </section>
        <section className="panel tasks-panel">
          <div className="panel-heading"><div><h2>Upcoming tasks</h2><p>Stay on top of your follow-ups</p></div><button className="icon-button subtle-button" aria-label="More task options"><Icon name="more" /></button></div>
          <div className="task-list">
            {tasks.slice(0, 3).map((task) => <div className={`task-row ${task.done ? "task-done" : ""}`} key={task.id}>
              <button className={`task-check ${task.done ? "checked" : ""}`} aria-label={task.done ? "Mark task incomplete" : "Mark task complete"} onClick={() => onToggleTask(task.id)}>{task.done && "✓"}</button>
              <div className="task-copy"><strong>{task.title}</strong><span>{task.detail}</span></div>
              <span className="task-time">{task.time}</span>
            </div>)}
          </div>
          <button className="bottom-link" onClick={() => onNavigate("Tasks")}>View all tasks <Icon name="arrow" size={15} /></button>
        </section>
        <section className="panel deals-panel">
          <div className="panel-heading"><div><h2>Recent deals</h2><p>Keep an eye on your opportunities</p></div><button className="text-button" onClick={() => onNavigate("Deals")}>See all <Icon name="arrow" size={15} /></button></div>
          <div className="deal-table">
            {deals.slice(0, 3).map((deal) => <div className="deal-row" key={deal.id}>
              <div className="deal-name"><Avatar initials={deal.initials} color={deal.color} small /><span><strong>{deal.name}</strong><small>{deal.company}</small></span></div>
              <span className={`stage stage-${deal.stage.toLowerCase()}`}>{deal.stage}</span>
              <strong className="deal-amount">{formatMoney(deal.amount)}</strong>
            </div>)}
          </div>
        </section>
        <section className="panel activity-panel">
          <div className="panel-heading"><div><h2>Recent activity</h2><p>The latest from your contacts</p></div><button className="icon-button subtle-button" aria-label="More activity options"><Icon name="more" /></button></div>
          <div className="activity-list">
            <Activity initials="OR" color="lavender" name="Olivia Rhye" action="opened your proposal" time="10 min ago" />
            <Activity initials="PB" color="peach" name="Phoenix Baker" action="was added as a new lead" time="1 hour ago" />
            <Activity initials="LS" color="mint" name="Lana Steiner" action="replied to your email" time="3 hours ago" />
          </div>
        </section>
      </div>
      <section className="panel contacts-panel">
        <div className="panel-heading"><div><h2>Recently added contacts</h2><p>Your newest relationships, all in one place</p></div><button className="text-button" onClick={() => onNavigate("Contacts")}>All contacts <Icon name="arrow" size={15} /></button></div>
        <ContactTable contacts={contacts.slice(0, 4)} />
      </section>
    </>
  );
}

function StatCard({ label, value, change, hint, icon, color, negative = false }) {
  return <article className="stat-card"><div className="stat-top"><span>{label}</span><span className={`stat-icon ${color}`}><Icon name={icon} size={17} /></span></div><div className="stat-value">{value}</div><div className="stat-foot"><span className={negative ? "change-neutral" : "change-positive"}>{negative ? "•" : "↗"} {change}</span><span>{hint}</span></div></article>;
}

function Activity({ initials, color, name, action, time }) {
  return <div className="activity-row"><Avatar initials={initials} color={color} small /><p><strong>{name}</strong> {action}<small>{time}</small></p></div>;
}

function ContactTable({ contacts, onEdit, onDelete }) {
  return <div className="contact-table-wrap"><table className="contact-table"><thead><tr><th>NAME</th><th>COMPANY</th><th>STATUS</th><th>ADDED</th><th /></tr></thead><tbody>
    {contacts.map((contact) => <tr key={contact.id || contact.email}><td><div className="contact-person"><Avatar initials={contact.initials} color={contact.color} small /><span><strong>{contact.name}</strong><small>{contact.email}</small></span></div></td><td>{contact.company}</td><td><span className={`contact-status ${contact.status.toLowerCase()}`}><i />{contact.status}</span></td><td>{contact.date}</td><td>{onEdit && <div className="record-actions"><button onClick={() => onEdit(contact)}>Edit</button><button className="delete-action" onClick={() => onDelete(contact)}>Delete</button></div>}</td></tr>)}
  </tbody></table></div>;
}

function formatMoney(amount) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(Number(amount) || 0);
}

function getInitials(name) {
  return name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
}

function LoginPage({ onLogin, onSignup, usingLocalMode }) {
  const [isSignup, setIsSignup] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [image, setImage] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      if (isSignup) {
        await onSignup({ name: name.trim(), email: email.trim().toLowerCase(), password, image });
      } else {
        await onLogin({ email: email.trim().toLowerCase(), password });
      }
    } catch (submitError) {
      setError(submitError.message);
    } finally {
      setSubmitting(false);
    }
  }

  return <main className="auth-page">
    <section className="auth-card">
      <div className="auth-brand"><div className="brand-mark">o</div><span className="brand-name">orbit<span>.</span></span></div>
      <p className="eyebrow">{isSignup ? "GET STARTED" : "WELCOME BACK"}</p>
      <h1>{isSignup ? "Create your account" : "Sign in to your workspace"}</h1>
      <p className="auth-subtitle">{isSignup ? "Create a Member account to start organizing your customer relationships." : usingLocalMode ? "Standalone demo mode: your account is saved in this browser." : "Sign in with your workspace account."}</p>
      <form className="auth-form" onSubmit={submit}>
        {isSignup && <>
          <ProfileImagePicker name={name} image={image} onChange={setImage} />
          <label>Full name<input autoFocus autoComplete="name" value={name} onChange={(event) => setName(event.target.value)} required /></label>
        </>}
        <label>Email address<input type="email" autoComplete={isSignup ? "email" : "username"} value={email} onChange={(event) => setEmail(event.target.value)} required /></label>
        <label>Password<input type="password" autoComplete={isSignup ? "new-password" : "current-password"} minLength={isSignup ? 8 : undefined} value={password} onChange={(event) => setPassword(event.target.value)} required /></label>
        {error && <p className="form-error" role="alert">{error}</p>}
        <button className="button button-primary auth-submit" type="submit" disabled={submitting}>{submitting ? "Please wait..." : isSignup ? "Create account" : "Sign in"}</button>
      </form>
      <p className="auth-switch">{isSignup ? "Already have an account?" : "New to Orbit?"} <button type="button" onClick={() => { setIsSignup((current) => !current); setName(""); setEmail(""); setPassword(""); setImage(""); setError(""); }}>{isSignup ? "Sign in" : "Create an account"}</button></p>
      <div className="demo-credentials"><strong>Local demo accounts</strong><span>Admin · jamie@studionorth.co · admin123</span><span>Manager · taylor@studionorth.co · manager123</span><span>Member · alex@studionorth.co · member123</span></div>

    </section>
  </main>;
}

function LoadingPage() {
  return <main className="loading-page" role="status" aria-live="polite">
    <div className="loading-brand"><div className="brand-mark">o</div><span className="brand-name">orbit<span>.</span></span></div>
    <div className="loading-spinner" aria-hidden="true" />
    <p>Loading your workspace</p>
  </main>;
}

function UsersPage({ currentUser, search, usingLocalMode }) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState("");
  const [editing, setEditing] = useState(null);
  const [formOpen, setFormOpen] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({ name: "", email: "", role: "Member", password: "", image: "" });
  const filteredUsers = users.filter((user) => `${user.name} ${user.email} ${user.role} ${user.status}`.toLowerCase().includes(search.toLowerCase()));

  useEffect(() => {
    let active = true;
    apiRequest("/users")
      .then(({ users: fetchedUsers }) => { if (active) setUsers(fetchedUsers); })
      .catch((loadError) => { if (active) setListError(loadError.message); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  async function openForm(user = null) {
    setError("");
    if (!user) {
      setEditing(null);
      setFormOpen(true);
      setForm({ name: "", email: "", role: "Member", password: "", image: "" });
      return;
    }
    try {
      const { user: current } = await apiRequest(`/users/${user.id}`);
      setEditing(current);
      setFormOpen(true);
      setForm({ name: current.name, email: current.email, role: current.role, password: "", image: current.image || "" });
    } catch (readError) {
      setListError(readError.message);
    }
  }

  async function saveUser(event) {
    event.preventDefault();
    const normalizedEmail = form.email.trim().toLowerCase();
    const duplicate = users.some((user) => user.email.toLowerCase() === normalizedEmail && user.id !== (editing && editing.id));
    if (duplicate) {
      setError("A user with this email already exists.");
      return;
    }
    if (!editing && form.password.length < 8) {
      setError("Set a password with at least 8 characters.");
      return;
    }
    if (editing && editing.id === currentUser.id && form.role !== "Admin") {
      setError("You cannot remove your own Admin access.");
      return;
    }
    const userData = {
      name: form.name.trim(),
      email: normalizedEmail,
      role: form.role,
      image: form.image,
    };
    if (form.password) userData.password = form.password;
    try {
      const { user } = await apiRequest(editing ? `/users/${editing.id}` : "/users", {
        method: editing ? "PATCH" : "POST",
        body: userData,
      });
      setUsers((current) => editing ? current.map((item) => item.id === user.id ? user : item) : [user, ...current]);
      setFormOpen(false);
      setEditing(null);
      setError("");
    } catch (saveError) {
      setError(saveError.message);
    }
  }

  async function toggleStatus(user) {
    if (user.id === currentUser.id) return;
    try {
      const { user: updatedUser } = await apiRequest(`/users/${user.id}`, {
        method: "PATCH",
        body: { status: user.status === "Active" ? "Inactive" : "Active" },
      });
      setUsers((current) => current.map((item) => item.id === user.id ? updatedUser : item));
    } catch (statusError) {
      setListError(statusError.message);
    }
  }

  async function deleteUser(user) {
    if (user.id === currentUser.id) return;
    if (window.confirm(`Delete ${user.name}'s account? This cannot be undone.`)) {
      try {
        await apiRequest(`/users/${user.id}`, { method: "DELETE" });
        setUsers((current) => current.filter((item) => item.id !== user.id));
      } catch (deleteError) {
        setListError(deleteError.message);
      }
    }
  }

  return <>
    <div className="page-heading"><div><p className="eyebrow">ADMINISTRATION</p><h1>Users &amp; access</h1><p className="page-subtitle">Manage workspace accounts and what each role can access.</p></div><button className="button button-primary" onClick={() => openForm()}><Icon name="plus" size={17} /> Add user</button></div>
    <section className="panel users-panel">
      <div className="panel-heading"><div><h2>Workspace users</h2><p>{users.length} accounts · {usingLocalMode ? "saved in this browser" : "managed by the server"}</p></div></div>
      {listError && <p className="form-error" role="alert">{listError}</p>}
      {loading ? <p className="empty-state">Loading users...</p> : <div className="contact-table-wrap"><table className="contact-table users-table"><thead><tr><th>USER</th><th>ROLE</th><th>STATUS</th><th>LAST SIGN-IN</th><th>ACTIONS</th></tr></thead><tbody>
        {filteredUsers.map((user) => <tr key={user.id}>
          <td><div className="contact-person"><Avatar initials={getInitials(user.name)} color={user.id === currentUser.id ? "dark" : "lavender"} small image={user.image} /><span><strong>{user.name}{user.id === currentUser.id ? " (you)" : ""}</strong><small>{user.email}</small></span></div></td>
          <td><span className={`role-badge ${user.role.toLowerCase()}`}>{user.role}</span></td>
          <td><span className={`contact-status ${user.status.toLowerCase()}`}><i />{user.status}</span></td>
          <td>{user.id === currentUser.id ? "Now" : "—"}</td>
          <td><div className="user-actions"><button onClick={() => openForm(user)}>Edit</button><button disabled={user.id === currentUser.id} onClick={() => toggleStatus(user)}>{user.status === "Active" ? "Deactivate" : "Activate"}</button><button className="delete-action" disabled={user.id === currentUser.id} onClick={() => deleteUser(user)}>Delete</button></div></td>
        </tr>)}
      </tbody></table></div>}
      {!loading && !listError && filteredUsers.length === 0 && <p className="empty-state">No users match your search.</p>}
    </section>
    <section className="panel role-rules-panel"><div className="panel-heading"><div><h2>Role rules</h2><p>{usingLocalMode ? "Role access is part of this browser demo." : "Access is enforced by the API."}</p></div></div><div className="role-rules-grid">
      {Object.entries(roleRules).map(([role, rules]) => <article className="role-rule" key={role}><span className={`role-badge ${role.toLowerCase()}`}>{role}</span><ul>{rules.map((rule) => <li key={rule}>{rule}</li>)}</ul></article>)}
    </div><p className="security-note"><strong>Security note:</strong> {usingLocalMode ? "Local-mode accounts and role rules can be changed through browser storage. Do not use real credentials." : "User authentication, sessions, and role access are enforced by the server."} CRM contacts, deals, and tasks are still stored in this browser.</p></section>
    {formOpen && <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setFormOpen(false); }}>
      <section className="user-modal" role="dialog" aria-modal="true" aria-labelledby="user-modal-title">
        <div className="panel-heading"><div><h2 id="user-modal-title">{editing ? "Edit user" : "Add user"}</h2><p>{editing ? "Update account details and access." : "Create a workspace account."}</p></div><button className="icon-button" aria-label="Close dialog" onClick={() => setFormOpen(false)}><Icon name="close" /></button></div>
        <form className="user-form" onSubmit={saveUser}>
          <ProfileImagePicker name={form.name} image={form.image} onChange={(image) => setForm((current) => ({ ...current, image }))} />
          <label>Full name<input autoFocus value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required /></label>
          <label>Email address<input type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} required /></label>
          <label>Role<select value={form.role} onChange={(event) => setForm({ ...form, role: event.target.value })}><option>Admin</option><option>Manager</option><option>Member</option></select></label>
          <label>{editing ? "Reset password (optional)" : "Password"}<input type="password" minLength={8} value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} required={!editing} autoComplete="new-password" /></label>
          {error && <p className="form-error" role="alert">{error}</p>}
          <p className="modal-disclaimer">{usingLocalMode ? "Standalone mode hashes passwords in this browser but does not provide production security." : "Passwords are hashed before they are stored on the server."}</p>
          <div className="modal-actions"><button type="button" className="button button-secondary" onClick={() => setFormOpen(false)}>Cancel</button><button type="submit" className="button button-primary">{editing ? "Save changes" : "Create user"}</button></div>
        </form>
      </section>
    </div>}
  </>;
}

function ContactsPage({ contacts, setContacts, search }) {
  const [filter, setFilter] = useState("All contacts");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const filtered = contacts.filter((contact) => {
    const matchesText = `${contact.name} ${contact.email} ${contact.company}`.toLowerCase().includes(search.toLowerCase());
    return matchesText && (filter === "All contacts" || contact.status === filter.slice(0, -1) || contact.status === filter);
  });
  function openForm(contact = null) {
    setEditing(contact);
    setFormOpen(true);
  }
  function saveContact(values) {
    const email = values.email.trim().toLowerCase();
    if (contacts.some((contact) => contact.email.toLowerCase() === email && contact.id !== (editing && editing.id))) {
      return "A contact with this email already exists.";
    }
    const name = values.name.trim();
    const contact = {
      ...(editing || {}),
      id: editing ? editing.id : `contact-${Date.now()}`,
      name,
      email,
      company: values.company.trim(),
      status: values.status,
      initials: getInitials(name),
      color: editing ? editing.color : "blue",
      date: editing ? editing.date : "Today",
    };
    setContacts((current) => editing ? current.map((item) => item.id === editing.id ? contact : item) : [contact, ...current]);
    return "";
  }
  function deleteContact(contact) {
    if (window.confirm(`Delete ${contact.name}? This cannot be undone.`)) {
      setContacts((current) => current.filter((item) => item.id !== contact.id));
    }
  }
  return <>
    <div className="page-heading"><div><p className="eyebrow">YOUR RELATIONSHIPS</p><h1>Contacts</h1><p className="page-subtitle">Manage the people who make your business happen.</p></div><button className="button button-primary" onClick={() => openForm()}><Icon name="plus" size={17} /> Add contact</button></div>
    <section className="panel contacts-page-panel">
      <div className="contact-toolbar"><div className="filter-tabs">{["All contacts", "Customers", "Leads", "Prospects"].map((item) => <button key={item} className={filter === item ? "selected" : ""} onClick={() => setFilter(item)}>{item}<span>{item === "All contacts" ? contacts.length : contacts.filter((contact) => contact.status === item.slice(0, -1)).length}</span></button>)}</div></div>
      <ContactTable contacts={filtered} onEdit={openForm} onDelete={deleteContact} />
      {filtered.length === 0 && <p className="empty-state">No contacts match your search.</p>}
    </section>
    {formOpen && <RecordModal key={editing ? editing.id : "new-contact"} title={editing ? "Edit contact" : "Add contact"} initialValues={editing ? { name: editing.name, email: editing.email, company: editing.company, status: editing.status } : { name: "", email: "", company: "", status: "Lead" }} fields={[{ name: "name", label: "Full name", required: true }, { name: "email", label: "Email address", type: "email", required: true }, { name: "company", label: "Company", required: true }, { name: "status", label: "Status", type: "select", options: ["Lead", "Customer", "Prospect"] }]} onSave={saveContact} onClose={() => { setFormOpen(false); setEditing(null); }} />}
  </>;
}

function RecordModal({ title, fields, initialValues, onSave, onClose }) {
  const [values, setValues] = useState(initialValues);
  const [error, setError] = useState("");

  function submit(event) {
    event.preventDefault();
    const message = onSave(values);
    if (message) {
      setError(message);
      return;
    }
    onClose();
  }

  return <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <section className="user-modal" role="dialog" aria-modal="true" aria-labelledby="record-modal-title">
      <div className="panel-heading"><div><h2 id="record-modal-title">{title}</h2><p>Enter the details below.</p></div><button className="icon-button" aria-label="Close dialog" onClick={onClose}><Icon name="close" /></button></div>
      <form className="user-form" onSubmit={submit}>
        {fields.map((field) => <label key={field.name}>{field.label}
          {field.type === "select" ? <select required={field.required} value={values[field.name]} onChange={(event) => setValues({ ...values, [field.name]: event.target.value })}>{field.options.map((option) => <option key={option}>{option}</option>)}</select>
            : <input autoFocus={field.name === fields[0].name} type={field.type || "text"} min={field.min} step={field.step} value={values[field.name]} onChange={(event) => setValues({ ...values, [field.name]: event.target.value })} required={field.required} />}
        </label>)}
        {error && <p className="form-error" role="alert">{error}</p>}
        <div className="modal-actions"><button type="button" className="button button-secondary" onClick={onClose}>Cancel</button><button type="submit" className="button button-primary">Save</button></div>
      </form>
    </section>
  </div>;
}

function DealsPage({ deals, setDeals, search }) {
  const [editing, setEditing] = useState(null);
  const [formOpen, setFormOpen] = useState(false);
  const visibleDeals = deals.filter((deal) => `${deal.name} ${deal.company} ${deal.stage}`.toLowerCase().includes(search.toLowerCase()));
  function saveDeal(values) {
    const deal = { ...(editing || {}), id: editing ? editing.id : `deal-${Date.now()}`, name: values.name.trim(), company: values.company.trim(), stage: values.stage, amount: Number(values.amount), initials: getInitials(values.company)[0] || "D", color: editing ? editing.color : "blue" };
    setDeals((current) => editing ? current.map((item) => item.id === editing.id ? deal : item) : [deal, ...current]);
    return "";
  }
  function removeDeal(deal) {
    if (window.confirm(`Delete the "${deal.name}" deal?`)) setDeals((current) => current.filter((item) => item.id !== deal.id));
  }
  return <>
    <div className="page-heading"><div><p className="eyebrow">SALES PIPELINE</p><h1>Deals</h1><p className="page-subtitle">Track opportunities and keep your pipeline moving.</p></div><button className="button button-primary" onClick={() => { setEditing(null); setFormOpen(true); }}><Icon name="plus" size={17} /> Add deal</button></div>
    <section className="panel record-list">{visibleDeals.length ? visibleDeals.map((deal) => <div className="record-list-row" key={deal.id}>
      <Avatar initials={deal.initials} color={deal.color} />
      <div className="record-list-copy"><strong>{deal.name}</strong><span>{deal.company}</span></div>
      <span className={`stage stage-${deal.stage.toLowerCase()}`}>{deal.stage}</span>
      <strong className="record-amount">{formatMoney(deal.amount)}</strong>
      <div className="record-actions"><button onClick={() => { setEditing(deal); setFormOpen(true); }}>Edit</button><button className="delete-action" onClick={() => removeDeal(deal)}>Delete</button></div>
    </div>) : <p className="empty-state">No deals match your search.</p>}</section>
    {formOpen && <RecordModal key={editing ? editing.id : "new-deal"} title={editing ? "Edit deal" : "Add deal"} initialValues={editing ? { name: editing.name, company: editing.company, stage: editing.stage, amount: editing.amount } : { name: "", company: "", stage: "Qualified", amount: "" }} fields={[{ name: "name", label: "Deal name", required: true }, { name: "company", label: "Company", required: true }, { name: "amount", label: "Amount (USD)", type: "number", min: "0", step: "1", required: true }, { name: "stage", label: "Stage", type: "select", options: ["Qualified", "Proposal", "Negotiation", "Won", "Lost"] }]} onSave={saveDeal} onClose={() => { setFormOpen(false); setEditing(null); }} />}
  </>;
}

function TasksPage({ tasks, setTasks, search }) {
  const [formOpen, setFormOpen] = useState(false);
  const visibleTasks = tasks.filter((task) => `${task.title} ${task.detail}`.toLowerCase().includes(search.toLowerCase()));
  function toggleTask(id) {
    setTasks((current) => current.map((task) => task.id === id ? { ...task, done: !task.done } : task));
  }
  function saveTask(values) {
    setTasks((current) => [{ id: `task-${Date.now()}`, title: values.title.trim(), detail: values.detail.trim(), time: values.time || "No time set", done: false }, ...current]);
    return "";
  }
  function removeTask(task) {
    if (window.confirm(`Delete "${task.title}"?`)) setTasks((current) => current.filter((item) => item.id !== task.id));
  }
  return <>
    <div className="page-heading"><div><p className="eyebrow">YOUR WORKSPACE</p><h1>Tasks</h1><p className="page-subtitle">A clear view of what needs your attention.</p></div><button className="button button-primary" onClick={() => setFormOpen(true)}><Icon name="plus" size={17} /> Add task</button></div>
    <section className="panel task-page-list">{visibleTasks.length ? visibleTasks.map((task) => <div className={`task-page-row ${task.done ? "task-done" : ""}`} key={task.id}>
      <button className={`task-check ${task.done ? "checked" : ""}`} aria-label={task.done ? "Mark task incomplete" : "Mark task complete"} onClick={() => toggleTask(task.id)}>{task.done && "✓"}</button>
      <div className="task-copy"><strong>{task.title}</strong><span>{task.detail}</span></div>
      <span className="task-time">{task.time}</span>
      <button className="record-delete" onClick={() => removeTask(task)}>Delete</button>
    </div>) : <p className="empty-state">No tasks match your search.</p>}</section>
    {formOpen && <RecordModal title="Add task" initialValues={{ title: "", detail: "", time: "" }} fields={[{ name: "title", label: "Task", required: true }, { name: "detail", label: "Related contact or details" }, { name: "time", label: "Time", type: "time" }]} onSave={saveTask} onClose={() => setFormOpen(false)} />}
  </>;
}

function ReportsPage({ deals, contacts, tasks }) {
  const wonDeals = deals.filter((deal) => deal.stage === "Won");
  const openDeals = deals.filter((deal) => !["Won", "Lost"].includes(deal.stage));
  const wonRevenue = wonDeals.reduce((total, deal) => total + Number(deal.amount), 0);
  const completedTasks = tasks.filter((task) => task.done).length;
  return <>
    <div className="page-heading"><div><p className="eyebrow">BUSINESS INSIGHTS</p><h1>Reports</h1><p className="page-subtitle">A live snapshot of your contacts, pipeline, and follow-ups.</p></div></div>
    <section className="stats-grid report-stats">
      <StatCard label="Total contacts" value={contacts.length} change="Live" hint="in your workspace" icon="users" color="purple" />
      <StatCard label="Open deals" value={openDeals.length} change="Live" hint="excluding won and lost" icon="briefcase" color="orange" />
      <StatCard label="Revenue won" value={formatMoney(wonRevenue)} change="Live" hint="closed-won deals" icon="chart" color="green" />
      <StatCard label="Tasks completed" value={completedTasks} change="Live" hint={`${tasks.length} total tasks`} icon="check" color="blue" />
    </section>
    <section className="panel report-summary"><div className="panel-heading"><div><h2>Pipeline by stage</h2><p>Current opportunity count and value</p></div></div>{["Qualified", "Proposal", "Negotiation", "Won", "Lost"].map((stage) => {
      const stageDeals = deals.filter((deal) => deal.stage === stage);
      const value = stageDeals.reduce((total, deal) => total + Number(deal.amount), 0);
      return <div className="report-stage-row" key={stage}><span>{stage}</span><div className="report-track"><i style={{ width: `${deals.length ? Math.max(4, stageDeals.length / deals.length * 100) : 0}%` }} /></div><strong>{stageDeals.length} · {formatMoney(value)}</strong></div>;
    })}</section>
  </>;
}

function LandingPage() {
  return <div className="landing-page">
    <header className="landing-header">
      <Link to="/" className="landing-brand"><span className="brand-mark">o</span><span className="brand-name">orbit<span>.</span></span></Link>
      <nav className="landing-nav"><a href="#features">Features</a><a href="#workflow">How it works</a><a href="#get-started">Get started</a></nav>
      <div className="landing-actions"><Link className="landing-signin" to="/login">Sign in</Link><Link className="button button-primary" to="/login">Get started <Icon name="arrow" size={16} /></Link></div>
    </header>
    <main>
      <section className="landing-hero">
        <div className="hero-copy"><span className="hero-kicker"><i /> YOUR BUSINESS, IN GOOD COMPANY</span><h1>Relationships that move your business <em>forward.</em></h1><p>Orbit brings your contacts, deals, and next steps together, so you can spend less time keeping track and more time building trust.</p><div className="hero-actions"><Link className="button button-primary" to="/login">Explore the workspace <Icon name="arrow" size={17} /></Link><a className="hero-secondary" href="#features">See what you can do <span>↓</span></a></div><div className="hero-proof"><div className="proof-avatars"><Avatar initials="OR" color="lavender" small /><Avatar initials="PB" color="peach" small /><Avatar initials="LS" color="mint" small /></div><span><strong>One clear view.</strong> Every customer relationship.</span></div></div>
        <div className="hero-visual" aria-label="Orbit CRM dashboard preview">
          <div className="visual-glow" />
          <div className="preview-window"><div className="preview-top"><span className="preview-logo">o</span><span>Studio North</span><span className="preview-dots">•••</span></div><div className="preview-body"><div className="preview-welcome"><div><small>YOUR WORKSPACE</small><strong>Good morning, Jamie</strong></div><span className="preview-add">＋ New</span></div><div className="preview-metrics"><div><small>Contacts</small><strong>248</strong><span>↗ 12.8%</span></div><div><small>Open deals</small><strong>18</strong><span>↗ 4.2%</span></div><div><small>Revenue won</small><strong>$24.5k</strong><span>↗ 18.6%</span></div></div><div className="preview-chart"><div className="preview-chart-head"><span>Sales pipeline</span><strong>$86,400 <small>potential</small></strong></div><div className="preview-bars">{[36, 52, 45, 70, 59, 82, 68, 96].map((height, index) => <i key={index} style={{ height: `${height}%` }} />)}</div><div className="preview-chart-labels"><span>May</span><span>Jun</span><span>Jul</span><span>Aug</span><span>Sep</span></div></div><div className="preview-bottom"><div><span className="preview-check">✓</span><span><strong>Send proposal to Olivia</strong><small>Layers · Today</small></span></div><span className="preview-time">10:30</span></div></div></div>
          <div className="floating-note"><span>↗</span><div><strong>More momentum</strong><small>Keep every deal moving</small></div></div>
        </div>
      </section>
      <section className="landing-trust"><span>BUILT FOR PEOPLE-FIRST TEAMS</span><div><strong>Studio North</strong><strong>layers</strong><strong>stellar<span>labs</span></strong><strong>goodwork</strong><strong>circles</strong></div></section>
      <section className="landing-features" id="features"><div className="section-intro"><span className="hero-kicker"><i /> EVERYTHING IN ONE PLACE</span><h2>Make every interaction <em>count.</em></h2><p>The tools to stay thoughtful, organized, and one step ahead.</p></div><div className="feature-grid"><article><span className="feature-icon purple"><Icon name="users" size={20} /></span><h3>People, not spreadsheets</h3><p>Keep customer details, company context, and conversation history easy to find.</p></article><article><span className="feature-icon orange"><Icon name="briefcase" size={20} /></span><h3>A pipeline you can trust</h3><p>See what’s moving, what needs attention, and where your next win may come from.</p></article><article><span className="feature-icon green"><Icon name="check" size={20} /></span><h3>Follow through, naturally</h3><p>Turn good intentions into clear next steps with tasks and timely follow-ups.</p></article></div></section>
      <section className="landing-workflow" id="workflow"><div><span className="hero-kicker"><i /> SIMPLE BY DESIGN</span><h2>Less admin.<br /><em>More connection.</em></h2><p>Orbit gives your team a shared rhythm—from the first hello to the next big opportunity—without getting in the way of the work.</p><Link className="text-button" to="/login">Take a look inside <Icon name="arrow" size={16} /></Link></div><div className="workflow-steps"><div><b>01</b><span><strong>Bring people together</strong><small>Build a thoughtful home for every relationship.</small></span></div><div><b>02</b><span><strong>Know what’s next</strong><small>Keep deals and follow-ups visible to your team.</small></span></div><div><b>03</b><span><strong>Make progress visible</strong><small>See the momentum behind your customer work.</small></span></div></div></section>
      <section className="landing-cta" id="get-started"><span className="hero-kicker"><i /> A FRESH START FOR YOUR CRM</span><h2>Good relationships<br />deserve a great system.</h2><p>Start exploring a calmer way to manage your customer relationships.</p><Link className="button button-primary" to="/login">Get started with Orbit <Icon name="arrow" size={17} /></Link></section>
    </main>
    <footer className="landing-footer"><Link to="/" className="landing-brand"><span className="brand-mark">o</span><span className="brand-name">orbit<span>.</span></span></Link><span>Made for meaningful relationships.</span><span>© 2024 Orbit CRM</span></footer>
  </div>;
}

function NotFoundPage() {
  return <main className="not-found-page"><span className="brand-mark">o</span><p className="eyebrow">404 · PAGE NOT FOUND</p><h1>This page isn’t in your workspace.</h1><p>Check the link or head back to Orbit.</p><Link className="button button-primary" to="/">Back to home <Icon name="arrow" size={16} /></Link></main>;
}

export default function App() {
  const navigate = useNavigate();
  const location = useLocation();
  const [isLoading, setIsLoading] = useState(true);
  const [contacts, setContacts] = useState(() => {
    const saved = localStorage.getItem("orbit-crm-contacts");
    return saved ? JSON.parse(saved) : initialContacts;
  });
  const [deals, setDeals] = useState(() => {
    const saved = localStorage.getItem("orbit-crm-deals");
    return saved ? JSON.parse(saved) : initialDeals;
  });
  const [tasks, setTasks] = useState(() => {
    const saved = localStorage.getItem("orbit-crm-tasks");
    return saved ? JSON.parse(saved) : initialTasks;
  });
  const [theme, setTheme] = useState(() => localStorage.getItem("orbit-crm-theme") === "dark" ? "dark" : "bright");
  const [currentUser, setCurrentUser] = useState(null);
  const [usingLocalMode, setUsingLocalMode] = useState(process.env.API_ENABLED !== "true");
  const [authLoading, setAuthLoading] = useState(() => location.pathname.startsWith("/app"));
  const [authError, setAuthError] = useState("");
  const [authRetry, setAuthRetry] = useState(0);
  const [search, setSearch] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const [toast, setToast] = useState("");
  const page = Object.keys(pagePaths).find((label) => pagePaths[label] === location.pathname);
  const isAppRoute = location.pathname.startsWith("/app");
  const activePage = location.pathname === "/app" ? "Overview" : page;

  useEffect(() => {
    const timer = window.setTimeout(() => setIsLoading(false), 450);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    localStorage.setItem("orbit-crm-contacts", JSON.stringify(contacts));
  }, [contacts]);

  useEffect(() => {
    localStorage.setItem("orbit-crm-deals", JSON.stringify(deals));
  }, [deals]);

  useEffect(() => {
    localStorage.setItem("orbit-crm-tasks", JSON.stringify(tasks));
  }, [tasks]);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem("orbit-crm-theme", theme);
  }, [theme]);

  useEffect(() => {
    localStorage.removeItem("orbit-crm-users");
    localStorage.removeItem("orbit-crm-session");
    document.cookie = "orbit-crm-session=; Path=/; Max-Age=0; SameSite=Lax";
  }, []);

  useEffect(() => {
    function handleLocalMode() {
      setUsingLocalMode(true);
    }
    window.addEventListener("crm-local-api-mode", handleLocalMode);
    return () => window.removeEventListener("crm-local-api-mode", handleLocalMode);
  }, []);

  useEffect(() => {
    if (!isAppRoute) {
      setAuthLoading(false);
      setAuthError("");
      return undefined;
    }

    let active = true;
    setAuthLoading(true);
    setAuthError("");
    apiRequest("/auth/me")
      .then(({ user }) => { if (active) setCurrentUser(user); })
      .catch((error) => {
        if (!active) return;
        if (error.status === 401) {
          setCurrentUser(null);
        } else {
          setAuthError(error.message);
        }
      })
      .finally(() => { if (active) setAuthLoading(false); });
    return () => { active = false; };
  }, [isAppRoute, authRetry]);

  useEffect(() => {
    setSearch("");
    setMenuOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!toast) return undefined;
    const timer = window.setTimeout(() => setToast(""), 3000);
    return () => window.clearTimeout(timer);
  }, [toast]);

  function navigateTo(page) {
    if (currentUser && rolePages[currentUser.role].includes(page) && pagePaths[page]) {
      navigate(pagePaths[page]);
      setSearch("");
    }
  }

  async function logout() {
    try {
      await apiRequest("/auth/logout", { method: "POST" });
      setCurrentUser(null);
      navigate("/login");
    } catch (error) {
      setToast(error.message);
    }
  }

  if (location.pathname === "/") return <LandingPage />;
  if (location.pathname === "/login") return <LoginPage
    usingLocalMode={usingLocalMode}
    onLogin={async (credentials) => {
      const { user } = await apiRequest("/auth/login", { method: "POST", body: credentials });
      setCurrentUser(user);
      navigate("/app", { replace: true });
    }}
    onSignup={async (details) => {
      const { user } = await apiRequest("/auth/signup", { method: "POST", body: details });
      setCurrentUser(user);
      navigate("/app", { replace: true });
    }}
  />;
  if (!isAppRoute) return <NotFoundPage />;
  if (isLoading || authLoading) return <LoadingPage />;
  if (authError) return <main className="auth-page"><section className="auth-card"><h1>Unable to connect</h1><p className="auth-subtitle" role="alert">{authError}</p><button className="button button-primary auth-submit" onClick={() => setAuthRetry((current) => current + 1)}>Retry</button></section></main>;
  if (!currentUser) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  if (!activePage || !rolePages[currentUser.role].includes(activePage)) return <Navigate to="/app" replace />;

  let content = null;
  if (activePage === "Overview") content = <Dashboard contacts={contacts} deals={deals} tasks={tasks} user={currentUser} onNavigate={navigateTo} onToggleTask={(id) => setTasks((items) => items.map((task) => task.id === id ? { ...task, done: !task.done } : task))} />;
  if (activePage === "Contacts") content = <ContactsPage contacts={contacts} setContacts={setContacts} search={search} />;
  if (activePage === "Deals") content = <DealsPage deals={deals} setDeals={setDeals} search={search} />;
  if (activePage === "Tasks") content = <TasksPage tasks={tasks} setTasks={setTasks} search={search} />;
  if (activePage === "Reports") content = <ReportsPage deals={deals} contacts={contacts} tasks={tasks} />;
  if (activePage === "Users & access" && currentUser.role === "Admin") content = <UsersPage currentUser={currentUser} search={search} usingLocalMode={usingLocalMode} />;
  const title = activePage === "Users & access" ? "Users & access" : activePage;
  return <div className="app-shell">
    <Sidebar active={activePage} open={menuOpen} onClose={() => setMenuOpen(false)} taskCount={tasks.filter((task) => !task.done).length} user={currentUser} onLogout={logout} />
    <main className="main-area"><Header title={title} onMenu={() => setMenuOpen(true)} onSearch={setSearch} search={search} onNotifications={() => setToast("You’re all caught up.")} onLogout={logout} theme={theme} onThemeChange={setTheme} onUpdateProfile={async (values) => {
      const { user } = await apiRequest("/auth/profile", { method: "PATCH", body: values });
      setCurrentUser(user);
    }} user={currentUser} /><div className="page-content">{usingLocalMode && <p className="security-note local-mode-note" role="status"><strong>Standalone demo:</strong> Account data and role checks are stored in this browser only. Do not use real credentials.</p>}{content}<footer className="footer-note">© 2024 Orbit CRM <span>Made for meaningful relationships.</span></footer></div></main>
    {toast && <div className="toast-message" role="status">{toast}</div>}
  </div>;
}
