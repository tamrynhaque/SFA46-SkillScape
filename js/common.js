// Shared helpers used by every page: session, page guards, data access and small UI utilities.
// Load order on each page: supabase-js CDN -> db.js -> common.js -> (api.js / smart.js) -> page script.

const LEVELS = { 1: "Foundational", 2: "Intermediate", 3: "Expert" };
const STATUS = { NOT_STARTED: "Not Started", IN_PROGRESS: "In Progress", COMPLETE: "Complete" };

// ---------- Session ----------
const Session = {
    get() {
        const email = localStorage.getItem("userEmail");
        if (!email) return null;
        return {
            id: localStorage.getItem("userId"),
            email,
            name: localStorage.getItem("userName") || email.split("@")[0],
            isAdmin: localStorage.getItem("userRole") === "admin"
        };
    },
    set(user) {
        localStorage.setItem("userId", user.id);
        localStorage.setItem("userEmail", user.email);
        localStorage.setItem("userName", user.full_name || user.email.split("@")[0]);
        localStorage.setItem("userRole", user.is_admin ? "admin" : "user");
    },
    clear() {
        ["userId", "userEmail", "userName", "userRole"].forEach(k => localStorage.removeItem(k));
    }
};

// Redirects to login if nobody is signed in (or to the dashboard if a non-admin opens an admin page).
function requireLogin({ admin = false } = {}) {
    const session = Session.get();
    if (!session || !session.id) {
        Session.clear();
        window.location.href = "login.html";
        return null;
    }
    if (admin && !session.isAdmin) {
        window.location.href = "index.html";
        return null;
    }
    wireNav();
    return session;
}

// Marks the current page's nav link as active and turns "Logout" into a real logout.
function wireNav() {
    const page = window.location.pathname.split("/").pop() || "index.html";
    document.querySelectorAll("nav .nav-link").forEach(link => {
        const href = link.getAttribute("href");
        if (href === page || (page === "role-detail.html" && href === "roles.html")) {
            link.classList.add("active");
        }
        if (href === "login.html") {
            link.addEventListener("click", () => Session.clear());
        }
    });
}

// ---------- UI helpers ----------
function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, c => ({
        "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    })[c]);
}

function toast(message, type = "success") {
    let holder = document.getElementById("toast-holder");
    if (!holder) {
        holder = document.createElement("div");
        holder.id = "toast-holder";
        document.body.appendChild(holder);
    }
    const el = document.createElement("div");
    el.className = `toast toast-${type}`;
    el.textContent = message;
    holder.appendChild(el);
    setTimeout(() => el.remove(), 3500);
}

function percent(part, total) {
    return total ? Math.round((part / total) * 100) : 0;
}

function progressBar(pct) {
    return `<div class="progress-bar-bg"><div class="progress-bar-fill" style="width:${pct}%"></div></div>`;
}

function formatDate(date) {
    return new Date(date).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

// ---------- Local cache (fallback if Supabase is unreachable) ----------
const LocalCache = {
    read(key, fallback) {
        try { return JSON.parse(localStorage.getItem(`skillscape.${key}`)) ?? fallback; }
        catch { return fallback; }
    },
    write(key, value) {
        try { localStorage.setItem(`skillscape.${key}`, JSON.stringify(value)); } catch { /* storage full/blocked */ }
    }
};

// ---------- Data access (Supabase, with localStorage mirror for progress & targets) ----------
const Store = {
    async roles() {
        const { data, error } = await supabase.from("roles").select("id, name").order("id");
        if (error) throw error;
        return data;
    },

    async role(roleId) {
        const { data, error } = await supabase.from("roles").select("id, name").eq("id", roleId).maybeSingle();
        if (error) throw error;
        return data;
    },

    // Skills for one role via the role_skills join table, sorted by level then name.
    async skillsForRole(roleId) {
        const { data, error } = await supabase
            .from("role_skills")
            .select("skills(id, name, level, resource_url)")
            .eq("role_id", roleId);
        if (error) throw error;
        return data.map(rs => rs.skills).filter(Boolean)
            .sort((a, b) => a.level - b.level || a.name.localeCompare(b.name));
    },

    async allSkills() {
        const { data, error } = await supabase.from("skills").select("id, name, level, resource_url").order("level");
        if (error) throw error;
        return data;
    },

    // { roleId: [skillId, ...] }
    async roleSkillMap() {
        const { data, error } = await supabase.from("role_skills").select("role_id, skill_id");
        if (error) throw error;
        const map = {};
        data.forEach(r => (map[r.role_id] ||= []).push(r.skill_id));
        return map;
    },

    // { skillId: status } for one user. Falls back to the local cache when offline.
    async progress(userId) {
        const { data, error } = await supabase.from("user_skills").select("skill_id, status").eq("user_id", userId);
        if (error) {
            console.warn("Using cached progress:", error.message);
            return LocalCache.read(`progress.${userId}`, {});
        }
        const map = {};
        data.forEach(p => { map[p.skill_id] = p.status; });
        LocalCache.write(`progress.${userId}`, map);
        return map;
    },

    // Saves locally first (so a refresh never loses it), then syncs to Supabase.
    async setStatus(userId, skillId, status) {
        const cached = LocalCache.read(`progress.${userId}`, {});
        cached[skillId] = status;
        LocalCache.write(`progress.${userId}`, cached);

        const { error } = await supabase.from("user_skills")
            .upsert({ user_id: userId, skill_id: skillId, status }, { onConflict: "user_id,skill_id" });
        if (error) throw error;
    },

    async targets(userId) {
        const { data, error } = await supabase.from("smart_targets")
            .select("id, skill_id, target_text, created_at")
            .eq("user_id", userId)
            .order("created_at", { ascending: false });
        if (error) {
            console.warn("Using cached targets:", error.message);
            return LocalCache.read(`targets.${userId}`, []);
        }
        LocalCache.write(`targets.${userId}`, data);
        return data;
    },

    async saveTarget(userId, skillId, targetText) {
        const { data, error } = await supabase.from("smart_targets")
            .insert({ user_id: userId, skill_id: skillId, target_text: targetText })
            .select().single();
        if (error) throw error;
        return data;
    },

    async deleteTarget(targetId) {
        const { error } = await supabase.from("smart_targets").delete().eq("id", targetId);
        if (error) throw error;
    },

    // Never selects the password column.
    async users() {
        const { data, error } = await supabase.from("users")
            .select("id, email, full_name, role_id, is_admin").order("full_name");
        if (error) throw error;
        return data;
    },

    async user(userId) {
        const { data, error } = await supabase.from("users")
            .select("id, email, full_name, role_id, is_admin").eq("id", userId).maybeSingle();
        if (error) throw error;
        return data;
    },

    async updateUser(userId, fields) {
        const { error } = await supabase.from("users").update(fields).eq("id", userId);
        if (error) throw error;
    },

    async allProgress() {
        const { data, error } = await supabase.from("user_skills").select("user_id, skill_id, status");
        if (error) throw error;
        return data;
    },

    async allTargets() {
        const { data, error } = await supabase.from("smart_targets")
            .select("id, user_id, skill_id, target_text, created_at")
            .order("created_at", { ascending: false });
        if (error) throw error;
        return data;
    }
};

// Completion summary for a list of skills given a { skillId: status } map.
function summarise(skills, progress) {
    const summary = { total: skills.length, complete: 0, inProgress: 0, byLevel: {} };
    [1, 2, 3].forEach(l => { summary.byLevel[l] = { total: 0, complete: 0 }; });
    skills.forEach(skill => {
        const status = progress[skill.id];
        const level = summary.byLevel[skill.level] ||= { total: 0, complete: 0 };
        level.total++;
        if (status === STATUS.COMPLETE) { summary.complete++; level.complete++; }
        else if (status === STATUS.IN_PROGRESS) summary.inProgress++;
    });
    summary.pct = percent(summary.complete, summary.total);
    return summary;
}
