// Admin: list of all registered users with role progress and target counts.

document.addEventListener("DOMContentLoaded", async () => {
    const session = requireLogin({ admin: true });
    if (!session) return;
    const body = document.getElementById("users-body");

    let users, roles, roleSkills, skills, allProgress, allTargets;
    try {
        [users, roles, roleSkills, skills, allProgress, allTargets] = await Promise.all([
            Store.users(), Store.roles(), Store.roleSkillMap(), Store.allSkills(), Store.allProgress(), Store.allTargets()
        ]);
    } catch (err) {
        body.innerHTML = `<tr><td colspan="6" class="error">Could not load users: ${escapeHtml(err.message)}</td></tr>`;
        return;
    }

    const roleById = Object.fromEntries(roles.map(r => [r.id, r]));
    const skillById = Object.fromEntries(skills.map(s => [s.id, s]));
    const progressByUser = {};
    allProgress.forEach(p => { (progressByUser[p.user_id] ||= {})[p.skill_id] = p.status; });

    const rows = users.map(u => {
        const roleSkillList = (roleSkills[u.role_id] || []).map(id => skillById[id]).filter(Boolean);
        const s = summarise(roleSkillList, progressByUser[u.id] || {});
        return {
            u, s,
            roleName: roleById[u.role_id]?.name || "No role selected",
            targets: allTargets.filter(t => t.user_id === u.id).length
        };
    });

    function render(filter = "") {
        const q = filter.toLowerCase();
        const visible = rows.filter(r => [r.u.full_name, r.u.email, r.roleName].some(v => (v || "").toLowerCase().includes(q)));
        body.innerHTML = visible.map(r => `
            <tr>
                <td>${escapeHtml(r.u.full_name || "-")} ${r.u.is_admin ? `<span class="role-badge badge-mine">Admin</span>` : ""}</td>
                <td>${escapeHtml(r.u.email)}</td>
                <td>${escapeHtml(r.roleName)}</td>
                <td style="min-width: 140px;">${r.u.role_id ? `${progressBar(r.s.pct)}<small class="muted">${r.s.complete}/${r.s.total} · ${r.s.pct}%</small>` : "-"}</td>
                <td>${r.targets}</td>
                <td><a class="btn-secondary btn-sm" href="admin.html?user=${encodeURIComponent(r.u.id)}#specific-user-view">View profile</a></td>
            </tr>`).join("") || `<tr><td colspan="6" class="muted">No users match "${escapeHtml(filter)}".</td></tr>`;
    }

    document.getElementById("user-search").addEventListener("input", e => render(e.target.value));
    render();
});
