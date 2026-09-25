// Academy Lead dashboard: "What is the collective skill gap of my team?"

document.addEventListener("DOMContentLoaded", async () => {
    const session = requireLogin({ admin: true });
    if (!session) return;

    let users, roles, roleSkills, skills, allProgress, allTargets;
    try {
        [users, roles, roleSkills, skills, allProgress, allTargets] = await Promise.all([
            Store.users(), Store.roles(), Store.roleSkillMap(), Store.allSkills(), Store.allProgress(), Store.allTargets()
        ]);
    } catch (err) {
        document.querySelector("main").innerHTML = `<p class="error">Could not load admin data: ${escapeHtml(err.message)}</p>`;
        return;
    }

    const consultants = users.filter(u => !u.is_admin);
    const roleById = Object.fromEntries(roles.map(r => [r.id, r]));
    const skillById = Object.fromEntries(skills.map(s => [s.id, s]));
    const userById = Object.fromEntries(users.map(u => [u.id, u]));
    const displayName = u => u.full_name || u.email;

    // progressByUser[userId][skillId] = status
    const progressByUser = {};
    allProgress.forEach(p => { (progressByUser[p.user_id] ||= {})[p.skill_id] = p.status; });

    const skillsForRole = roleId => (roleSkills[roleId] || []).map(id => skillById[id]).filter(Boolean)
        .sort((a, b) => a.level - b.level || a.name.localeCompare(b.name));
    const userSummary = u => summarise(skillsForRole(u.role_id), progressByUser[u.id] || {});

    // --- Stat tiles ---
    const avg = consultants.length
        ? Math.round(consultants.reduce((sum, u) => sum + userSummary(u).pct, 0) / consultants.length) : 0;
    const completions = allProgress.filter(p => p.status === STATUS.COMPLETE).length;
    document.getElementById("stats").innerHTML = [
        ["Consultants", consultants.length],
        ["Avg role completion", `${avg}%`],
        ["Skills completed", completions],
        ["SMART targets set", allTargets.length]
    ].map(([label, value]) => `<div class="stat-tile"><span class="stat-value">${value}</span><span class="stat-label">${label}</span></div>`).join("");

    // --- Heatmap ---
    const roleFilter = document.getElementById("heatmap-role");
    roleFilter.innerHTML += roles.filter(r => (roleSkills[r.id] || []).length)
        .map(r => `<option value="${r.id}">${escapeHtml(r.name)}</option>`).join("");

    function heatColour(pct) {
        // red (0%) -> amber (50%) -> green (100%)
        const hue = Math.round((pct / 100) * 130);
        return `hsla(${hue}, 70%, 45%, 0.55)`;
    }

    function heatmapRows(roleId) {
        const pool = consultants.filter(u => u.role_id && (!roleId || u.role_id === roleId));
        const relevantSkills = roleId ? skillsForRole(roleId) : skills;
        return relevantSkills.map(skill => {
            const needing = pool.filter(u => (roleSkills[u.role_id] || []).includes(skill.id));
            let complete = 0, inProgress = 0;
            needing.forEach(u => {
                const st = (progressByUser[u.id] || {})[skill.id];
                if (st === STATUS.COMPLETE) complete++;
                else if (st === STATUS.IN_PROGRESS) inProgress++;
            });
            const n = needing.length;
            return {
                skill, n, complete, inProgress, missing: n - complete - inProgress,
                pctComplete: percent(complete, n), pctProgress: percent(inProgress, n), pctMissing: percent(n - complete - inProgress, n)
            };
        }).filter(r => r.n > 0);
    }

    function renderHeatmap() {
        const rows = heatmapRows(Number(roleFilter.value) || null);
        const el = document.getElementById("heatmap");
        if (rows.length === 0) {
            el.innerHTML = `<p class="muted">No consultants are assigned to roles with these skills yet.</p>`;
        } else {
            el.innerHTML = `
                <table class="heatmap-table">
                    <thead><tr><th>Skill</th><th>Level</th><th>Consultants needing it</th><th>Complete</th><th>In progress</th><th>Missing</th></tr></thead>
                    <tbody>${rows.map(r => `
                        <tr>
                            <td>${escapeHtml(r.skill.name)}</td>
                            <td>L${r.skill.level}</td>
                            <td>${r.n}</td>
                            <td class="heat-cell" style="background:${heatColour(r.pctComplete)}">${r.pctComplete}% <small>(${r.complete})</small></td>
                            <td class="heat-cell">${r.pctProgress}% <small>(${r.inProgress})</small></td>
                            <td class="heat-cell" style="background:${heatColour(100 - r.pctMissing)}">${r.pctMissing}% <small>(${r.missing})</small></td>
                        </tr>`).join("")}
                    </tbody>
                </table>`;
        }

        const byCommon = [...rows].sort((a, b) => b.complete - a.complete || b.pctComplete - a.pctComplete).slice(0, 3);
        const byGap = [...rows].sort((a, b) => b.missing - a.missing || b.pctMissing - a.pctMissing).slice(0, 3);
        document.getElementById("most-common").innerHTML = byCommon.map(r =>
            `<li><strong>${escapeHtml(r.skill.name)}</strong> <span class="muted">- ${r.complete} of ${r.n} complete</span></li>`).join("") || "<li class='muted'>No data</li>";
        document.getElementById("biggest-gaps").innerHTML = byGap.map(r =>
            `<li><strong>${escapeHtml(r.skill.name)}</strong> <span class="muted">- missing for ${r.missing} of ${r.n}</span></li>`).join("") || "<li class='muted'>No data</li>";
    }
    roleFilter.addEventListener("change", renderHeatmap);
    renderHeatmap();

    // --- Leaderboard ---
    const ranked = consultants
        .map(u => ({ u, s: userSummary(u), total: Object.values(progressByUser[u.id] || {}).filter(st => st === STATUS.COMPLETE).length }))
        .sort((a, b) => b.total - a.total || b.s.pct - a.s.pct)
        .slice(0, 5);
    const medal = ["#f1c40f", "#bdc3c7", "#e67e22"];
    document.getElementById("leaderboard").innerHTML = ranked.map((r, i) => `
        <tr class="clickable" data-user="${r.u.id}">
            <td><span class="rank-badge" style="background:${medal[i] || "#475569"}">${i + 1}</span></td>
            <td>${escapeHtml(displayName(r.u))}</td>
            <td>${escapeHtml(roleById[r.u.role_id]?.name || "No role")}</td>
            <td>${r.total}</td>
            <td style="min-width: 140px;">${progressBar(r.s.pct)}<small class="muted">${r.s.pct}%</small></td>
        </tr>`).join("");

    // --- Consultants grid ---
    document.getElementById("users-grid").innerHTML = consultants.map(u => {
        const s = userSummary(u);
        return `
            <button class="user-card" data-user="${u.id}">
                <h3>${escapeHtml(displayName(u))}</h3>
                <p>${escapeHtml(roleById[u.role_id]?.name || "No role selected")}</p>
                ${u.role_id ? `${progressBar(s.pct)}<p class="small">${s.pct}% complete</p>` : ""}
            </button>`;
    }).join("") || `<p class="muted">No consultants registered yet.</p>`;

    // --- Specific user view ---
    const detail = document.getElementById("specific-user-view");
    const icon = st => st === STATUS.COMPLETE ? `<span class="icon-competent">✔</span>`
        : st === STATUS.IN_PROGRESS ? `<span class="icon-in-progress">⚙</span>` : `<span class="icon-missing">✘</span>`;

    function showUser(userId) {
        const u = userById[userId];
        if (!u) return;
        const role = roleById[u.role_id];
        const roleSkillList = skillsForRole(u.role_id);
        const prog = progressByUser[u.id] || {};
        const s = summarise(roleSkillList, prog);
        const gaps = roleSkillList.filter(sk => prog[sk.id] !== STATUS.COMPLETE);
        const targets = allTargets.filter(t => t.user_id === u.id);

        detail.hidden = false;
        detail.innerHTML = `
            <div class="section-head">
                <h2>${escapeHtml(displayName(u))} <span class="muted small">${escapeHtml(role?.name || "No role")}</span></h2>
                <button class="link-btn" id="close-user">Close ✕</button>
            </div>
            <div class="specific-user-grid">
                <div>
                    <div class="user-panel">
                        <h3>Profile &amp; summary</h3>
                        <p class="muted">${escapeHtml(u.email)}</p>
                        <p><strong>${s.complete}</strong> of ${s.total} role skills complete · ${s.inProgress} in progress</p>
                        ${[1, 2, 3].map(l => {
                            const lv = s.byLevel[l]; const pct = percent(lv.complete, lv.total);
                            return `<div class="role-completion-bar"><label>L${l} ${LEVELS[l]} <span>${lv.total ? pct + "%" : "–"}</span></label>${progressBar(pct)}</div>`;
                        }).join("")}
                    </div>
                    <div class="user-panel">
                        <h3>Top skills to work on</h3>
                        ${gaps.length ? `<ol>${gaps.slice(0, 3).map(g => `<li>${escapeHtml(g.name)} <span class="muted">(L${g.level}${prog[g.id] === STATUS.IN_PROGRESS ? ", in progress" : ""})</span></li>`).join("")}</ol>`
                            : `<p class="muted">No gaps - role complete!</p>`}
                    </div>
                </div>
                <div class="user-panel">
                    <h3>Personal skills matrix</h3>
                    ${roleSkillList.length ? `
                    <table class="heatmap-table">
                        <thead><tr><th>Skill</th><th>L1</th><th>L2</th><th>L3</th></tr></thead>
                        <tbody>${roleSkillList.map(sk => `
                            <tr><td>${escapeHtml(sk.name)}</td>
                            ${[1, 2, 3].map(l => `<td>${sk.level === l ? icon(prog[sk.id]) : ""}</td>`).join("")}</tr>`).join("")}
                        </tbody>
                    </table>
                    <p class="small muted"><span class="icon-competent">✔</span> Complete · <span class="icon-in-progress">⚙</span> In progress · <span class="icon-missing">✘</span> Missing</p>`
                    : `<p class="muted">No role selected.</p>`}
                </div>
            </div>
            <div class="user-panel">
                <h3>SMART targets (${targets.length})</h3>
                <div class="targets-grid">${targets.map(targetCard).join("") || `<p class="muted">No targets set.</p>`}</div>
            </div>`;
        detail.querySelector("#close-user").addEventListener("click", () => { detail.hidden = true; });
        detail.scrollIntoView({ behavior: "smooth" });
    }

    document.querySelector("main").addEventListener("click", e => {
        const trigger = e.target.closest("[data-user]");
        if (trigger && !trigger.closest("#specific-user-view")) showUser(trigger.dataset.user);
    });

    // --- SMART target review ---
    function targetCard(t) {
        const u = userById[t.user_id];
        const skill = skillById[t.skill_id];
        const done = (progressByUser[t.user_id] || {})[t.skill_id] === STATUS.COMPLETE;
        return `
            <div class="target-card${done ? " target-done" : ""}">
                <div class="skill-card-head">
                    <h4>${escapeHtml(skill?.name || "Skill")}</h4>
                    <span class="status-pill ${done ? "pill-complete" : "pill-in-progress"}">${done ? "Achieved" : "Active"}</span>
                </div>
                <p class="muted small">${escapeHtml(u ? displayName(u) : "Unknown user")} · set ${formatDate(t.created_at)}</p>
                ${renderTargetText(t.target_text)}
            </div>`;
    }

    const targetUser = document.getElementById("target-user");
    const withTargets = users.filter(u => allTargets.some(t => t.user_id === u.id));
    targetUser.innerHTML += withTargets.map(u => `<option value="${u.id}">${escapeHtml(displayName(u))}</option>`).join("");
    function renderTargetReview() {
        const list = allTargets.filter(t => !targetUser.value || t.user_id === targetUser.value);
        document.getElementById("target-list").innerHTML = list.map(targetCard).join("")
            || `<p class="muted">No SMART targets have been set yet.</p>`;
    }
    targetUser.addEventListener("change", renderTargetReview);
    renderTargetReview();

    // Deep link from users.html: admin.html?user=<id>
    const linked = new URLSearchParams(window.location.search).get("user");
    if (linked) showUser(linked);
});
