// Roles page: renders a card per role from Supabase; clicking opens that role's skills matrix.

const ROLE_INFO = {
    "Software Developer": ["Engineering", "Design, build and ship quality software."],
    "DevOps Engineer": ["Infrastructure", "Automate deployments with CI/CD and infrastructure as code."],
    "Software Tester": ["Quality Assurance", "Plan, execute and automate tests across the stack."],
    "Business Analyst": ["Business", "Turn stakeholder needs into clear requirements."],
    "Project Manager": ["Delivery", "Lead projects to on-time, on-budget delivery."],
    "Product Owner": ["Product", "Own the backlog and maximise product value."],
    "Scrum Master": ["Delivery", "Coach teams to deliver with Agile and Scrum."],
    "Junior Manual Tester": ["Quality Assurance", "Learn testing fundamentals, Agile and Git."],
    "Java Developer": ["Engineering", "Master backend systems with Java and Spring Boot."],
    "Cloud Architect": ["Infrastructure", "Design scalable, secure cloud platforms."]
};

document.addEventListener("DOMContentLoaded", async () => {
    const session = requireLogin();
    if (!session) return;
    const grid = document.getElementById("roles-grid");

    try {
        const [roles, roleSkills, skills, progress, me] = await Promise.all([
            Store.roles(), Store.roleSkillMap(), Store.allSkills(), Store.progress(session.id), Store.user(session.id)
        ]);
        const skillById = Object.fromEntries(skills.map(s => [s.id, s]));

        grid.innerHTML = roles.map(role => {
            const [category, blurb] = ROLE_INFO[role.name] || ["Tech Role", "Explore the skills needed for this role."];
            const roleSkillList = (roleSkills[role.id] || []).map(id => skillById[id]).filter(Boolean);
            const summary = summarise(roleSkillList, progress);
            const isMine = me && me.role_id === role.id;
            const levelCounts = [1, 2, 3].map(l => `L${l}: ${summary.byLevel[l].total}`).join(" · ");

            return `
                <a class="role-card${isMine ? " role-card-mine" : ""}" href="role-detail.html?id=${role.id}">
                    <span class="role-badge">${escapeHtml(category)}</span>
                    ${isMine ? `<span class="role-badge badge-mine">My role</span>` : ""}
                    <h3>${escapeHtml(role.name)}</h3>
                    <p>${escapeHtml(blurb)}</p>
                    ${roleSkillList.length ? `
                        <p class="role-meta">${roleSkillList.length} skills · ${levelCounts}</p>
                        ${progressBar(summary.pct)}
                        <p class="role-meta">${summary.pct}% complete</p>`
                    : `<p class="role-meta">No skills mapped yet</p>`}
                    <span class="btn-primary" style="margin-top: 1rem;">View Skills</span>
                </a>`;
        }).join("");
    } catch (err) {
        grid.innerHTML = `<p class="error">Could not load roles: ${escapeHtml(err.message)}</p>`;
    }
});
